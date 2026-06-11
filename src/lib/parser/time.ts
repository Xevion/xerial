/**
 * Date, serial, and time-of-day arithmetic for the XER domain, with branded
 * units so the three easily-confused `number` quantities can't be mixed:
 *
 *   Serial      — Excel date serial (whole days since the 1899-12-30 epoch)
 *   DayFraction — time of day as a 0..1 fraction of a 24h day
 *   Minutes     — minutes since midnight (0..1440)
 *   IsoDate     — a "YYYY-MM-DD" calendar date string
 *
 * The brands are nominal: arithmetic strips them, so every cross-unit conversion
 * must pass through a helper here. Raw casts live only in this module — callers
 * never reach for `as`. This is the single home for the Excel-epoch math.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Excel date serial: whole days since 1899-12-30 (UTC). */
export type Serial = Brand<number, "Serial">;
/** Time of day as a fraction of a 24h day, 0 (midnight) ..1. */
export type DayFraction = Brand<number, "DayFraction">;
/** Minutes since midnight. */
export type Minutes = Brand<number, "Minutes">;
/** Calendar date as "YYYY-MM-DD". */
export type IsoDate = Brand<string, "IsoDate">;

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;
const MIN_PER_DAY = 1440;

/** Brand a raw number as a Serial (use when the value is known to be one). */
export function serial(n: number): Serial {
	return n as Serial;
}

/** Brand a raw number of minutes-since-midnight. */
export function minutes(n: number): Minutes {
	return n as Minutes;
}

/** Brand a raw 0..1 number as a day fraction. */
export function dayFraction(n: number): DayFraction {
	return n as DayFraction;
}

/** Excel serial -> UTC midnight Date. */
export function serialToDate(s: Serial): Date {
	return new Date(EXCEL_EPOCH_MS + (s as number) * MS_PER_DAY);
}

/** UTC date -> Excel serial; inverse of serialToDate. */
export function dateToSerial(date: Date): Serial {
	return Math.round((date.getTime() - EXCEL_EPOCH_MS) / MS_PER_DAY) as Serial;
}

/** Parse a "YYYY-MM-DD" (optionally with trailing time) into a Serial. */
export function isoToSerial(iso: string): Serial {
	return dateToSerial(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

/** Serial -> "YYYY-MM-DD" (UTC). */
export function serialToIso(s: Serial): IsoDate {
	return serialToDate(s).toISOString().slice(0, 10) as IsoDate;
}

/** Shift a serial by a whole number of days. */
export function addDays(s: Serial, days: number): Serial {
	return ((s as number) + days) as Serial;
}

/** Inclusive [from..to] serial range, left to right. Empty when to < from. */
export function rangeInclusive(from: Serial, to: Serial): Serial[] {
	const n = (to as number) - (from as number) + 1;
	if (n <= 0) return [];
	return Array.from({ length: n }, (_, i) => ((from as number) + i) as Serial);
}

/** JS weekday for a serial: 0=Sun .. 6=Sat (UTC). */
export function jsWeekdayOf(s: Serial): number {
	return serialToDate(s).getUTCDay();
}

/** "HH:MM" (24h, hours/minutes possibly unpadded) -> minutes since midnight. */
export function parseHM(t: string): Minutes {
	const [h, m] = t.split(":");
	return (Number(h) * 60 + Number(m ?? 0)) as Minutes;
}

/** Minutes since midnight -> day fraction (0..1). */
export function minutesToFraction(m: Minutes): DayFraction {
	return ((m as number) / MIN_PER_DAY) as DayFraction;
}

/** Day fraction (0..1) -> minutes since midnight, rounded. */
export function fractionToMinutes(f: DayFraction): number {
	return Math.round((f as number) * MIN_PER_DAY);
}

/**
 * Worked minutes of a shift from start to finish. A finish at or before the
 * start wraps past midnight (so 00:00->00:00 is a full 24h day, 22:00->06:00
 * is 8h).
 */
export function shiftDurationMinutes(start: Minutes, finish: Minutes): number {
	let dur = (finish as number) - (start as number);
	if (dur <= 0) dur += MIN_PER_DAY;
	return dur;
}
