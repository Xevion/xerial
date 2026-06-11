import type { CalendarRow, TaskRow } from "./schema";
import type { XerDocument } from "./xer";

import { decodeCalendar, type DecodedCalendar, type Shift } from "./calendar";
import { Diagnostics, type Diagnostic } from "./diagnostics";
import {
	isoToSerial,
	jsWeekdayOf,
	minutes,
	minutesToFraction,
	parseHM,
	rangeInclusive,
	type DayFraction,
	type Serial,
} from "./time";

/** Effective shifts for one calendar on one day. */
export interface DayInfo {
	working: boolean;
	/** Day fraction (0..1) of earliest start, or null when non-working. */
	start: DayFraction | null;
	/** Day fraction (0..1) of latest finish, or null when non-working. */
	end: DayFraction | null;
	hours: number;
}

export interface CalendarGrid {
	clndrId: string;
	name: string;
	/** Aligned 1:1 with `serials`. */
	days: DayInfo[];
}

export interface SkippedCalendar {
	clndrId: string;
	name: string;
	reason: string;
}

export interface GridResult {
	startIso: string;
	endIso: string;
	/** Excel date serials for the columns, left to right. */
	serials: Serial[];
	calendars: CalendarGrid[];
	/** Calendars whose clndr_data failed to decode (a view over `diagnostics`). */
	skipped: SkippedCalendar[];
	/** Non-fatal problems encountered while building the grid. */
	diagnostics: Diagnostic[];
}

export class GridError extends Error {}

export interface GridOptions {
	/** Include every CALENDAR row, not just those used by tasks. */
	includeAll?: boolean;
	startIso?: string;
	endIso?: string;
}

const NON_WORKING: DayInfo = { working: false, start: null, end: null, hours: 0 };

/** Collapse a day's shifts into its earliest start / latest finish / total hours. */
function dayInfoFor(shifts: Shift[], hours: number): DayInfo {
	if (shifts.length === 0) return NON_WORKING;
	let startMin = Infinity;
	let endMin = -Infinity;
	for (const s of shifts) {
		startMin = Math.min(startMin, parseHM(s.start));
		endMin = Math.max(endMin, parseHM(s.finish));
	}
	return {
		working: true,
		start: minutesToFraction(minutes(startMin)),
		end: minutesToFraction(minutes(endMin)),
		hours,
	};
}

/**
 * Expand a decoded calendar across the serial axis. The weekly pattern repeats,
 * so the seven weekday `DayInfo`s and each exception are computed once and the
 * per-day loop is a pure lookup — no per-cell date math.
 */
function expandDays(decoded: DecodedCalendar, serials: Serial[], jsWeekdays: number[]): DayInfo[] {
	const weekdayInfos = new Map<number, DayInfo>();
	for (const [jsDay, wd] of decoded.weekdaysByJsDay) {
		weekdayInfos.set(jsDay, dayInfoFor(wd.shifts, wd.hours));
	}
	const exceptionInfos = new Map<number, DayInfo>();
	for (const e of decoded.exceptions) {
		exceptionInfos.set(e.serial, dayInfoFor(e.shifts, e.hours));
	}
	return serials.map(
		(s, i) => exceptionInfos.get(s) ?? weekdayInfos.get(jsWeekdays[i] ?? -1) ?? NON_WORKING,
	);
}

/** Auto-detect the activity date envelope (ISO yyyy-mm-dd) from TASK rows. */
function activitySpan(tasks: TaskRow[]): {
	startIso: string | undefined;
	endIso: string | undefined;
} {
	const startFields = ["act_start_date", "early_start_date", "target_start_date", "restart_date"];
	const endFields = ["act_end_date", "early_end_date", "target_end_date", "reend_date"];
	let mn: string | null = null;
	let mx: string | null = null;
	for (const t of tasks) {
		for (const f of startFields) {
			const d = t[f]?.slice(0, 10);
			if (d && (!mn || d < mn)) mn = d;
		}
		for (const f of endFields) {
			const d = t[f]?.slice(0, 10);
			if (d && (!mx || d > mx)) mx = d;
		}
	}
	return { startIso: mn ?? undefined, endIso: mx ?? undefined };
}

/** Resolve the date span (from options or auto-detection) to a serial axis. */
function resolveSpan(
	tasks: TaskRow[],
	opts: GridOptions,
): { startIso: string; endIso: string; serials: Serial[] } {
	const auto = activitySpan(tasks);
	const startIso = opts.startIso ?? auto.startIso;
	const endIso = opts.endIso ?? auto.endIso;
	if (!startIso || !endIso) {
		throw new GridError("Could not determine a date span — no activity dates found.");
	}

	const minSerial = isoToSerial(startIso);
	const maxSerial = isoToSerial(endIso);
	if (!Number.isFinite(minSerial) || !Number.isFinite(maxSerial)) {
		throw new GridError(`Invalid date span: ${startIso} → ${endIso}.`);
	}
	if (maxSerial < minSerial) throw new GridError("End date is before start date.");

	return { startIso, endIso, serials: rangeInclusive(minSerial, maxSerial) };
}

/**
 * Pick which calendars to expand: by default only those referenced by tasks
 * (most-used first); all of them when nothing is referenced or `includeAll`.
 */
function resolveCalendarRows(
	cals: CalendarRow[],
	tasks: TaskRow[],
	includeAll: boolean,
): CalendarRow[] {
	const usage = new Map<string, number>();
	for (const t of tasks) {
		const id = t.clndr_id ?? "";
		usage.set(id, (usage.get(id) ?? 0) + 1);
	}
	const used = (c: CalendarRow) => usage.get(c.clndr_id ?? "") ?? 0;

	let rows = cals;
	const anyUsed = rows.some((c) => used(c) > 0);
	if (!includeAll && anyUsed) rows = rows.filter((c) => used(c) > 0);
	return [...rows].sort((a, b) => used(b) - used(a));
}

/** Expand a parsed XER document into a day-by-day calendar grid. */
export function buildGrid(doc: XerDocument, opts: GridOptions = {}): GridResult {
	const cals = doc.table("CALENDAR")?.rows ?? [];
	const tasks = doc.table("TASK")?.rows ?? [];
	if (cals.length === 0) throw new GridError("No CALENDAR table in this file.");

	const { startIso, endIso, serials } = resolveSpan(tasks, opts);
	const jsWeekdays = serials.map(jsWeekdayOf);
	const rows = resolveCalendarRows(cals, tasks, opts.includeAll ?? false);

	const diagnostics = new Diagnostics();
	const calendars: CalendarGrid[] = [];
	const skipped: SkippedCalendar[] = [];

	for (const c of rows) {
		const clndrId = c.clndr_id ?? "";
		const name = c.clndr_name ?? "";
		const result = decodeCalendar(c.clndr_data ?? "");
		if (!result.ok) {
			skipped.push({ clndrId, name, reason: result.error });
			diagnostics.warn(
				"CALENDAR_DECODE_FAILED",
				`Calendar '${name || clndrId}' could not be decoded: ${result.error}`,
				{ clndrId, name },
			);
			continue;
		}
		calendars.push({ clndrId, name, days: expandDays(result.value, serials, jsWeekdays) });
	}

	return { startIso, endIso, serials, calendars, skipped, diagnostics: diagnostics.all() };
}
