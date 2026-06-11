/**
 * UI-level window math over ISO yyyy-mm-dd dates, for the date-range picker. The
 * grid's serial/fraction units stay in the parser; this is purely about which
 * dates the picker offers and the week-aligned quick selection. All arithmetic
 * routes through the parser's serial helpers so it shares the grid's calendar.
 */

import { addDays, isoToSerial, jsWeekdayOf, serialToIso } from "$lib/parser";

/** First day of the ISO date's month. */
function monthStart(iso: string): string {
	return `${iso.slice(0, 7)}-01`;
}

/** Last day of the ISO date's month. */
function monthEnd(iso: string): string {
	const y = Number(iso.slice(0, 4));
	const m = Number(iso.slice(5, 7));
	const firstOfNext = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
	return serialToIso(addDays(isoToSerial(firstOfNext), -1));
}

/** Expand a span outward to whole Sunday–Saturday weeks. */
export function toWholeWeeks(span: { start: string; end: string }): { start: string; end: string } {
	const s = isoToSerial(span.start);
	const e = isoToSerial(span.end);
	return {
		start: serialToIso(addDays(s, -jsWeekdayOf(s))),
		end: serialToIso(addDays(e, 6 - jsWeekdayOf(e))),
	};
}

/**
 * The picker's selectable bounds: the span padded out to whole months, then to
 * whole weeks. A week-aligned superset of the month-padded span, so both a clean
 * month window and the "whole weeks" preset always land inside the bounds.
 */
export function selectableBounds(span: { start: string; end: string }): {
	min: string;
	max: string;
} {
	const weeks = toWholeWeeks({ start: monthStart(span.start), end: monthEnd(span.end) });
	return { min: weeks.start, max: weeks.end };
}

/** Local-time ISO yyyy-mm-dd (the picker speaks wall-clock dates, not UTC instants). */
function isoLocal(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Calendar month containing `d`. */
export function monthRangeOf(d: Date): { start: string; end: string } {
	const y = d.getFullYear();
	const m = d.getMonth();
	return { start: isoLocal(new Date(y, m, 1)), end: isoLocal(new Date(y, m + 1, 0)) };
}

/** Calendar quarter containing `d`. */
export function quarterRangeOf(d: Date): { start: string; end: string } {
	const y = d.getFullYear();
	const startMonth = Math.floor(d.getMonth() / 3) * 3;
	return {
		start: isoLocal(new Date(y, startMonth, 1)),
		end: isoLocal(new Date(y, startMonth + 3, 0)),
	};
}

/** Calendar year containing `d`. */
export function yearRangeOf(d: Date): { start: string; end: string } {
	const y = d.getFullYear();
	return { start: isoLocal(new Date(y, 0, 1)), end: isoLocal(new Date(y, 11, 31)) };
}

/** Whether two inclusive ISO date ranges share any day. */
export function rangesOverlap(
	a: { start: string; end: string },
	b: { start: string; end: string },
): boolean {
	return a.start <= b.end && b.start <= a.end;
}
