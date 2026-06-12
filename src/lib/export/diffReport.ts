/**
 * Human-facing renderings of a `GridDiff`. The diff core stays presentation-
 * agnostic and reports raw per-day `DayInfo` on each side; this turns that into the
 * two shapes the app shows: a grouped change summary for the on-screen list, and a
 * flat per-changed-day matrix for the CSV/XLSX change reports.
 */

import type { CalendarChangeKind, CalendarDiff, DayInfo, GridDiff, Serial } from "../parser";

import { formatDate, formatDayLabel, formatHours, formatTime, weekdayLabel } from "./format";

/** A single bullet under a calendar in the change summary. */
export interface ChangeLine {
	/** Drives the marker color; the kind of edit this line describes. */
	tone: "hours" | "shift" | "holiday" | "working" | "added" | "removed";
	text: string;
}

export interface CalendarSummary {
	clndrId: string;
	name: string;
	kind: CalendarChangeKind;
	changedCount: number;
	lines: ChangeLine[];
}

const PLURAL: Record<string, string> = {
	Sun: "Sundays",
	Mon: "Mondays",
	Tue: "Tuesdays",
	Wed: "Wednesdays",
	Thu: "Thursdays",
	Fri: "Fridays",
	Sat: "Saturdays",
};

const plural = (wd: string) => PLURAL[wd] ?? wd;
const hoursLabel = (h: number) => `${formatHours(h)}h`;

/** A working day's span, e.g. "8:00 AM–5:00 PM"; "off" when not working. */
function spanLabel(info: DayInfo): string {
	if (!info.working || info.start === null || info.end === null) return "off";
	return `${formatTime(info.start)}–${formatTime(info.end)}`;
}

/** One transition's grouping bucket: same weekday + same before/after reads as one line. */
interface Bucket {
	wd: string;
	from: string;
	to: string;
	serials: Serial[];
}

function bucketLine(b: Bucket, tone: "hours" | "shift"): ChangeLine {
	const n = b.serials.length;
	const first = b.serials[0];
	const text =
		n === 1 && first !== undefined
			? `${formatDayLabel(first)}: ${b.from} → ${b.to}`
			: `${plural(b.wd)}: ${b.from} → ${b.to} (${n} days)`;
	return { tone, text };
}

function dateList(serials: Serial[]): string {
	return serials.map(formatDayLabel).join(", ");
}

/** Group a modified calendar's changed days into the prose lines a person would write. */
function summarizeModified(cal: CalendarDiff): ChangeLine[] {
	const hours = new Map<string, Bucket>();
	const shifts = new Map<string, Bucket>();
	const holidays: Serial[] = [];
	const nowWorking: Serial[] = [];

	for (const d of cal.days) {
		if (d.kind !== "changed") continue;
		const b = d.before;
		const a = d.after;
		if (!b || !a) continue;
		const wd = weekdayLabel(d.serial);

		if (b.working && !a.working) {
			holidays.push(d.serial);
		} else if (!b.working && a.working) {
			nowWorking.push(d.serial);
		} else if (b.hours !== a.hours) {
			const from = hoursLabel(b.hours);
			const to = hoursLabel(a.hours);
			const key = `${wd}|${from}|${to}`;
			const bucket = hours.get(key) ?? { wd, from, to, serials: [] };
			bucket.serials.push(d.serial);
			hours.set(key, bucket);
		} else {
			const from = spanLabel(b);
			const to = spanLabel(a);
			const key = `${wd}|${from}|${to}`;
			const bucket = shifts.get(key) ?? { wd, from, to, serials: [] };
			bucket.serials.push(d.serial);
			shifts.set(key, bucket);
		}
	}

	const lines: ChangeLine[] = [];
	for (const bucket of hours.values()) lines.push(bucketLine(bucket, "hours"));
	for (const bucket of shifts.values()) lines.push(bucketLine(bucket, "shift"));
	if (holidays.length)
		lines.push({
			tone: "holiday",
			text: `Added holiday${holidays.length === 1 ? "" : "s"}: ${dateList(holidays)}`,
		});
	if (nowWorking.length)
		lines.push({ tone: "working", text: `Now working: ${dateList(nowWorking)}` });
	return lines;
}

function summarizeCalendar(cal: CalendarDiff): CalendarSummary {
	const base = {
		clndrId: cal.clndrId,
		name: cal.name,
		kind: cal.kind,
		changedCount: cal.changedCount,
	};
	if (cal.kind === "added") return { ...base, lines: [{ tone: "added", text: "New calendar" }] };
	if (cal.kind === "removed")
		return { ...base, lines: [{ tone: "removed", text: "No longer present" }] };
	return { ...base, lines: summarizeModified(cal) };
}

/** Grouped, human-readable summary of every calendar that changed (unchanged omitted). */
export function summarizeDiff(diff: GridDiff): CalendarSummary[] {
	return diff.calendars.filter((c) => c.kind !== "unchanged").map(summarizeCalendar);
}

/** A changed day's value for the report, e.g. "8h"; "—" when the side is absent. */
function cellLabel(info: DayInfo | null): string {
	return info ? hoursLabel(info.hours) : "—";
}

/**
 * Flatten a diff into a change report: a header plus one row per changed day
 * (`Calendar, Day, Before, After`). Added/removed calendars collapse to a single
 * summary row rather than enumerating every wholly-new or wholly-gone day.
 */
export function diffToMatrix(diff: GridDiff): string[][] {
	const rows: string[][] = [["Calendar", "Day", "Before", "After"]];

	for (const cal of diff.calendars) {
		if (cal.kind === "unchanged") continue;
		if (cal.kind === "added") {
			rows.push([cal.name, "—", "(added)", "new calendar"]);
			continue;
		}
		if (cal.kind === "removed") {
			rows.push([cal.name, "—", "removed", "—"]);
			continue;
		}
		for (const d of cal.days) {
			if (d.kind !== "changed") continue;
			rows.push([cal.name, formatDate(d.serial), cellLabel(d.before), cellLabel(d.after)]);
		}
	}

	return rows;
}
