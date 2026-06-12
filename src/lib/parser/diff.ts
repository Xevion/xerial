/**
 * Structural diff of two expanded calendar grids. Presentation-agnostic, like the
 * rest of the parser: it reports which calendars and which days differ, carrying
 * the raw `DayInfo` on each side. Formatting the result into a human list lives in
 * `$lib/export`; highlighting it on the grid lives in the UI.
 *
 * Both grids must be expanded over an identical serial axis — the caller builds
 * them over a shared date window so day `i` means the same date in each. Calendars
 * are matched across files by `clndr_id`; one present on only one side is reported
 * as added or removed rather than modified.
 */

import type { CalendarGrid, DayInfo, GridResult } from "./grid";
import type { Serial } from "./time";

export class DiffError extends Error {}

/** A calendar's fate across the two files. */
export type CalendarChangeKind = "unchanged" | "modified" | "added" | "removed";

/** One day's comparison for one calendar, aligned 1:1 with the shared serial axis. */
export interface DayDiff {
	serial: Serial;
	kind: "same" | "changed";
	/** Baseline side; null when the calendar was added in the revised file. */
	before: DayInfo | null;
	/** Revised side; null when the calendar was removed in the revised file. */
	after: DayInfo | null;
}

export interface CalendarDiff {
	clndrId: string;
	name: string;
	kind: CalendarChangeKind;
	/** Aligned 1:1 with `serials`. */
	days: DayDiff[];
	/** How many days differ (0 for added/removed — every day is wholly new/gone). */
	changedCount: number;
}

export interface GridDiff {
	startIso: string;
	endIso: string;
	serials: Serial[];
	/** Calendar order: modified first, then added, removed, unchanged; stable within. */
	calendars: CalendarDiff[];
}

/** Two `DayInfo`s are equal when working state, hours, and span all match. */
function dayInfoEqual(a: DayInfo, b: DayInfo): boolean {
	return a.working === b.working && a.hours === b.hours && a.start === b.start && a.end === b.end;
}

function diffMatched(before: CalendarGrid, after: CalendarGrid, serials: Serial[]): CalendarDiff {
	let changedCount = 0;
	const days = serials.map<DayDiff>((serial, i) => {
		const b = before.days[i] ?? null;
		const a = after.days[i] ?? null;
		const changed = !(b && a) || !dayInfoEqual(b, a);
		if (changed) changedCount++;
		return { serial, kind: changed ? "changed" : "same", before: b, after: a };
	});
	return {
		clndrId: after.clndrId,
		// Prefer the revised name; fall back to baseline if a rename emptied it.
		name: after.name || before.name,
		kind: changedCount > 0 ? "modified" : "unchanged",
		days,
		changedCount,
	};
}

function oneSided(cal: CalendarGrid, serials: Serial[], side: "added" | "removed"): CalendarDiff {
	const days = serials.map<DayDiff>((serial, i) => {
		const info = cal.days[i] ?? null;
		return {
			serial,
			kind: "changed",
			before: side === "removed" ? info : null,
			after: side === "added" ? info : null,
		};
	});
	return { clndrId: cal.clndrId, name: cal.name, kind: side, days, changedCount: 0 };
}

const RANK: Record<CalendarChangeKind, number> = {
	modified: 0,
	added: 1,
	removed: 2,
	unchanged: 3,
};

/**
 * Compare two grids built over the same serial axis. Throws `DiffError` when the
 * axes differ — the caller is responsible for expanding both over a shared window.
 */
export function diffGrids(before: GridResult, after: GridResult): GridDiff {
	const serials = after.serials;
	if (before.serials.length !== serials.length || before.serials.some((s, i) => s !== serials[i])) {
		throw new DiffError("Cannot diff grids expanded over different date ranges.");
	}

	const beforeById = new Map(before.calendars.map((c) => [c.clndrId, c]));
	const afterById = new Map(after.calendars.map((c) => [c.clndrId, c]));

	const calendars: CalendarDiff[] = [];
	for (const a of after.calendars) {
		const b = beforeById.get(a.clndrId);
		calendars.push(b ? diffMatched(b, a, serials) : oneSided(a, serials, "added"));
	}
	for (const b of before.calendars) {
		if (!afterById.has(b.clndrId)) calendars.push(oneSided(b, serials, "removed"));
	}

	// Stable sort by kind so the most actionable rows lead; equal-kind order holds.
	calendars.sort((x, y) => RANK[x.kind] - RANK[y.kind]);

	return { startIso: after.startIso, endIso: after.endIso, serials, calendars };
}
