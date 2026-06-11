import type { TaskRow } from "./schema";
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

/**
 * The auto-detected activity envelope (ISO yyyy-mm-dd) for a document — the same
 * span `prepareGrid` falls back to. Exposed so the UI can seed a date-range
 * control with the file's real bounds without paying for a full grid build.
 * Either bound is undefined when no activity dates exist.
 */
export function detectActivitySpan(doc: XerDocument): {
	startIso: string | undefined;
	endIso: string | undefined;
} {
	return activitySpan(doc.table("TASK")?.rows ?? []);
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

/** One CALENDAR row decoded and expanded across the serial axis, plus its usage. */
interface PreparedCalendar {
	clndrId: string;
	name: string;
	/** How many tasks reference this calendar. */
	usage: number;
	/** Present when `clndr_data` decoded; reused verbatim across `includeAll` toggles. */
	grid?: CalendarGrid;
	/** Present when decoding failed. */
	error?: string;
}

/**
 * The expensive, `includeAll`-independent half of building a grid: every calendar
 * decoded and expanded exactly once. Memoize this on the document so toggling
 * which calendars are shown is a cheap re-selection rather than a full rebuild.
 */
export interface PreparedGrid {
	startIso: string;
	endIso: string;
	serials: Serial[];
	calendars: PreparedCalendar[];
	/** True when at least one calendar is referenced by a task. */
	anyUsed: boolean;
}

/** Decode and expand every calendar once; the result is `includeAll`-agnostic. */
export function prepareGrid(doc: XerDocument, opts: GridOptions = {}): PreparedGrid {
	const cals = doc.table("CALENDAR")?.rows ?? [];
	const tasks = doc.table("TASK")?.rows ?? [];
	if (cals.length === 0) throw new GridError("No CALENDAR table in this file.");

	const { startIso, endIso, serials } = resolveSpan(tasks, opts);
	const jsWeekdays = serials.map(jsWeekdayOf);

	const usage = new Map<string, number>();
	for (const t of tasks) {
		const id = t.clndr_id ?? "";
		usage.set(id, (usage.get(id) ?? 0) + 1);
	}

	const calendars = cals.map<PreparedCalendar>((c) => {
		const clndrId = c.clndr_id ?? "";
		const name = c.clndr_name ?? "";
		const used = usage.get(clndrId) ?? 0;
		const result = decodeCalendar(c.clndr_data ?? "");
		if (!result.ok) return { clndrId, name, usage: used, error: result.error };
		return {
			clndrId,
			name,
			usage: used,
			grid: { clndrId, name, days: expandDays(result.value, serials, jsWeekdays) },
		};
	});

	return { startIso, endIso, serials, calendars, anyUsed: calendars.some((c) => c.usage > 0) };
}

/**
 * Select which prepared calendars to show and assemble a `GridResult`. Cheap and
 * identity-preserving: the returned `CalendarGrid` objects are the very ones from
 * `prepared`, so an unchanged calendar keeps its reference across a toggle and the
 * UI can skip re-rendering it.
 */
export function selectGrid(prepared: PreparedGrid, opts: GridOptions = {}): GridResult {
	const includeAll = opts.includeAll ?? false;
	const wanted =
		!includeAll && prepared.anyUsed
			? prepared.calendars.filter((c) => c.usage > 0)
			: prepared.calendars;
	// Most-used first; Array.prototype.sort is stable, so equal-usage order holds.
	const ordered = [...wanted].sort((a, b) => b.usage - a.usage);

	const diagnostics = new Diagnostics();
	const calendars: CalendarGrid[] = [];
	const skipped: SkippedCalendar[] = [];
	for (const c of ordered) {
		if (c.grid) {
			calendars.push(c.grid);
			continue;
		}
		const reason = c.error ?? "unknown error";
		skipped.push({ clndrId: c.clndrId, name: c.name, reason });
		diagnostics.warn(
			"CALENDAR_DECODE_FAILED",
			`Calendar '${c.name || c.clndrId}' could not be decoded: ${reason}`,
			{ clndrId: c.clndrId, name: c.name },
		);
	}

	return {
		startIso: prepared.startIso,
		endIso: prepared.endIso,
		serials: prepared.serials,
		calendars,
		skipped,
		diagnostics: diagnostics.all(),
	};
}

/** Expand a parsed XER document into a day-by-day calendar grid. */
export function buildGrid(doc: XerDocument, opts: GridOptions = {}): GridResult {
	return selectGrid(prepareGrid(doc, opts), opts);
}
