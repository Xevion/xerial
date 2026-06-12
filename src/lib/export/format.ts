/**
 * Presentation helpers: turn the parser's raw units (serials, day-fractions,
 * hours) into the human strings shown in the UI and text exports. These live in
 * the export layer, not the parser, so the data model stays format-agnostic.
 */

import { fractionToMinutes, serialToDate, type DayFraction, type Serial } from "../parser";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Excel date serial -> "m/d/yyyy" (UTC), matching the .xlsx date format. */
export function formatDate(serial: Serial): string {
	const d = serialToDate(serial);
	return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

/** Short weekday label for a date serial (UTC). */
export function weekdayLabel(serial: Serial): string {
	return WEEKDAYS[serialToDate(serial).getUTCDay()] ?? "";
}

/** Prose day label for change lists, e.g. "Fri Jan 9" (UTC). */
export function formatDayLabel(serial: Serial): string {
	const d = serialToDate(serial);
	return `${WEEKDAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Day fraction (0..1) -> "h:mm AM/PM". */
export function formatTime(fraction: DayFraction): string {
	const total = fractionToMinutes(fraction);
	const h24 = Math.floor(total / 60) % 24;
	const m = total % 60;
	const ampm = h24 < 12 ? "AM" : "PM";
	const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
	return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Hours with up to two decimals, trailing zeros trimmed (Excel "0.##"). */
export function formatHours(hours: number): string {
	return String(Math.round(hours * 100) / 100);
}
