/**
 * Browser-safe parser core: read raw XER bytes, decode the Windows-1252 text,
 * parse the tab-delimited tables, decode packed calendar data, and expand
 * calendars into a day-by-day grid. No runtime-specific APIs — this barrel is
 * what the frontend imports.
 *
 * The Bun-only `readXerFile` lives in `./node` and is intentionally absent here.
 */

export { parseXer, decodeXer, type XerHeader, type XerTable, type XerDocument } from "./xer";

export {
	decodeCalendar,
	serialToDate,
	dateToSerial,
	type Shift,
	type Weekday,
	type CalendarException,
	type DecodedCalendar,
} from "./calendar";

export {
	buildGrid,
	GridError,
	formatDate,
	formatTime,
	formatHours,
	weekdayLabel,
	type DayInfo,
	type CalendarGrid,
	type GridResult,
	type GridOptions,
} from "./grid";
