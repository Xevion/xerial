import type { XerDocument } from "./xer";
import {
  decodeCalendar,
  dateToSerial,
  serialToDate,
  type DecodedCalendar,
  type CalendarException,
} from "./calendar";

/** Effective shifts for one calendar on one day. */
export interface DayInfo {
  working: boolean;
  /** Day fraction (0..1) of earliest start, or null when non-working. */
  start: number | null;
  /** Day fraction (0..1) of latest finish, or null when non-working. */
  end: number | null;
  hours: number;
}

export interface CalendarGrid {
  clndrId: string;
  name: string;
  /** Aligned 1:1 with `serials`. */
  days: DayInfo[];
}

export interface GridResult {
  startIso: string;
  endIso: string;
  /** Excel date serials for the columns, left to right. */
  serials: number[];
  calendars: CalendarGrid[];
  /** Calendars whose clndr_data failed to decode. */
  skipped: { clndrId: string; name: string; reason: string }[];
}

export class GridError extends Error {}

/** "HH:MM" -> day fraction (0..1). */
function timeFraction(t: string): number {
  const [h, m] = t.split(":");
  return (Number(h) * 60 + Number(m ?? 0)) / 1440;
}

function dayInfo(
  weekdayHours: Map<number, DecodedCalendar["weekdays"][number]>,
  exceptionsBySerial: Map<number, CalendarException>,
  serial: number,
): DayInfo {
  const exception = exceptionsBySerial.get(serial);
  let shifts: { start: string; finish: string }[];
  let hours: number;

  if (exception) {
    shifts = exception.shifts;
    hours = exception.hours;
  } else {
    const jsDay = serialToDate(serial).getUTCDay(); // 0=Sun..6=Sat
    const wd = weekdayHours.get(jsDay + 1); // P6 index 1=Sun..7=Sat
    shifts = wd?.shifts ?? [];
    hours = wd?.hours ?? 0;
  }

  if (shifts.length === 0) return { working: false, start: null, end: null, hours: 0 };

  let start = Infinity;
  let end = -Infinity;
  for (const s of shifts) {
    start = Math.min(start, timeFraction(s.start));
    end = Math.max(end, timeFraction(s.finish));
  }
  return { working: true, start, end, hours };
}

/** Auto-detect the activity date envelope (ISO yyyy-mm-dd) from TASK rows. */
function activitySpan(tasks: Record<string, string>[]): { startIso?: string; endIso?: string } {
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

export interface GridOptions {
  /** Include every CALENDAR row, not just those used by tasks. */
  includeAll?: boolean;
  startIso?: string;
  endIso?: string;
}

/** Expand a parsed XER document into a day-by-day calendar grid. */
export function buildGrid(doc: XerDocument, opts: GridOptions = {}): GridResult {
  const cals = doc.table("CALENDAR")?.rows ?? [];
  const tasks = doc.table("TASK")?.rows ?? [];
  if (cals.length === 0) throw new GridError("No CALENDAR table in this file.");

  const usage = new Map<string, number>();
  for (const t of tasks) {
    const id = t.clndr_id ?? "";
    usage.set(id, (usage.get(id) ?? 0) + 1);
  }

  const auto = activitySpan(tasks);
  const startIso = opts.startIso ?? auto.startIso;
  const endIso = opts.endIso ?? auto.endIso;
  if (!startIso || !endIso) {
    throw new GridError("Could not determine a date span — no activity dates found.");
  }

  const minSerial = dateToSerial(new Date(`${startIso}T00:00:00Z`));
  const maxSerial = dateToSerial(new Date(`${endIso}T00:00:00Z`));
  if (maxSerial < minSerial) throw new GridError("End date is before start date.");
  const nDays = maxSerial - minSerial + 1;
  const serials = Array.from({ length: nDays }, (_, i) => minSerial + i);

  // Default to calendars actually used by tasks; fall back to all when none are.
  const used = (c: Record<string, string>) => usage.get(c.clndr_id ?? "") ?? 0;
  let rows = cals;
  const anyUsed = rows.some((c) => used(c) > 0);
  if (!opts.includeAll && anyUsed) rows = rows.filter((c) => used(c) > 0);
  rows = [...rows].sort((a, b) => used(b) - used(a));

  const calendars: CalendarGrid[] = [];
  const skipped: GridResult["skipped"] = [];

  for (const c of rows) {
    let decoded: DecodedCalendar;
    try {
      decoded = decodeCalendar(c.clndr_data ?? "");
    } catch (err) {
      skipped.push({ clndrId: c.clndr_id ?? "", name: c.clndr_name ?? "", reason: (err as Error).message });
      continue;
    }
    const weekdayHours = new Map(decoded.weekdays.map((w) => [w.index, w]));
    const exceptionsBySerial = new Map(decoded.exceptions.map((e) => [e.serial, e]));
    calendars.push({
      clndrId: c.clndr_id ?? "",
      name: c.clndr_name ?? "",
      days: serials.map((s) => dayInfo(weekdayHours, exceptionsBySerial, s)),
    });
  }

  return { startIso, endIso, serials, calendars, skipped };
}

/** Excel date serial -> "m/d/yyyy" (UTC), matching the .xlsx date format. */
export function formatDate(serial: number): string {
  const d = serialToDate(serial);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

/** Short weekday label for a date serial (UTC). */
export function weekdayLabel(serial: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][serialToDate(serial).getUTCDay()]!;
}

/** Day fraction (0..1) -> "h:mm AM/PM". */
export function formatTime(fraction: number): string {
  const total = Math.round(fraction * 1440);
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
