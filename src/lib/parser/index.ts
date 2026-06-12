/**
 * Browser-safe parser core: read raw XER bytes, decode the Windows-1252 text,
 * parse the tab-delimited tables, decode packed calendar data, and expand
 * calendars into a day-by-day grid. No runtime-specific APIs — this barrel is
 * what the frontend imports.
 *
 * The data model is presentation-agnostic: grids carry raw serials, day-fractions,
 * and hours. Formatting and export live in `$lib/export`. The Bun-only
 * `readXerFile` lives in `./node` and is intentionally absent here.
 */

export {
	decodeXer,
	encodeXer,
	parseXer,
	type XerDocument,
	type XerHeader,
	type XerTable,
} from "./xer";

export {
	decodeCalendar,
	type CalendarException,
	type DecodedCalendar,
	type DecodeResult,
	type Shift,
	type Weekday,
} from "./calendar";

export {
	addDays,
	dateToSerial,
	dayFraction,
	fractionToMinutes,
	isoToSerial,
	jsWeekdayOf,
	minutes,
	minutesToFraction,
	parseHM,
	rangeInclusive,
	serial,
	serialToDate,
	serialToIso,
	shiftDurationMinutes,
	type DayFraction,
	type IsoDate,
	type Minutes,
	type Serial,
} from "./time";

export { Diagnostics, type Diagnostic, type DiagnosticCode, type Severity } from "./diagnostics";

export type { CalendarRow, KnownTables, ProjectRow, RawRow, TaskRow } from "./schema";

export {
	buildGrid,
	detectActivitySpan,
	prepareGrid,
	selectGrid,
	GridError,
	type CalendarGrid,
	type DayInfo,
	type GridOptions,
	type GridResult,
	type PreparedGrid,
	type SkippedCalendar,
} from "./grid";

export {
	diffGrids,
	DiffError,
	type CalendarChangeKind,
	type CalendarDiff,
	type DayDiff,
	type GridDiff,
} from "./diff";
