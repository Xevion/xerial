#!/usr/bin/env bun
/**
 * Expand P6 calendars into a flat day-by-day grid and write it to .xlsx: one
 * shared date axis across the top, and three stacked rows per calendar - Start
 * (earliest shift start), End (latest shift finish), Total Hours (net worked
 * hours, 0 on non-working days).
 *
 *   bun grid.ts <file.xer> [-o out.xlsx] [--start YYYY-MM-DD] [--end YYYY-MM-DD]
 *                          [--all] [--id ID]
 *
 * --start/--end   override the auto-detected activity-date span
 * --all           include every CALENDAR row (default: only those used by tasks)
 * --id ID         emit a single calendar (repeatable)
 *
 * A date's effective shifts come from the matching exception (possibly empty =
 * holiday, or custom hours), else the weekday pattern. Total Hours sums shift
 * durations only, excluding lunch gaps. Dates are written as Excel serials with
 * date formats; Start/End as day-fractions with time formats.
 */

import ExcelJS from "exceljs";
import { readXerFile } from "./xer";
import {
  decodeCalendar,
  dateToSerial,
  serialToDate,
  type DecodedCalendar,
  type CalendarException,
} from "./calendar";

function arg(flag: string): string | undefined {
  const i = Bun.argv.indexOf(flag);
  return i === -1 ? undefined : Bun.argv[i + 1];
}
function args(flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < Bun.argv.length; i++) if (Bun.argv[i] === flag) out.push(Bun.argv[i + 1]!);
  return out;
}

/** "HH:MM" -> day fraction (0..1). */
function timeFraction(t: string): number {
  const [h, m] = t.split(":");
  return (Number(h) * 60 + Number(m ?? 0)) / 1440;
}

interface DayInfo {
  working: boolean;
  /** Day fraction of earliest start, or null when non-working. */
  start: number | null;
  /** Day fraction of latest finish, or null when non-working. */
  end: number | null;
  hours: number;
}

/** Resolve the effective shifts for one calendar on one date serial. */
function dayInfo(
  decoded: DecodedCalendar,
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

const DATE_FMT = "m/d/yyyy";
const TIME_FMT = "h:mm AM/PM";
const HOURS_FMT = "0.##";

async function main() {
  const path = Bun.argv[2];
  if (!path || path.startsWith("--")) {
    console.error("Usage: bun grid.ts <file.xer> [-o out.xlsx] [--start D] [--end D] [--all] [--id ID]");
    process.exit(1);
  }
  const out = arg("-o") ?? "calendar-grid.xlsx";
  const ids = args("--id");
  const includeAll = Bun.argv.includes("--all");

  const doc = await readXerFile(path);
  const cals = doc.table("CALENDAR")?.rows ?? [];
  const tasks = doc.table("TASK")?.rows ?? [];

  const usage = new Map<string, number>();
  for (const t of tasks) usage.set(t.clndr_id, (usage.get(t.clndr_id) ?? 0) + 1);

  // Date span: explicit flags, else the true activity envelope from TASK dates.
  let startIso = arg("--start");
  let endIso = arg("--end");
  if (!startIso || !endIso) {
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
    startIso ??= mn ?? undefined;
    endIso ??= mx ?? undefined;
  }
  if (!startIso || !endIso) {
    console.error("Could not determine date span; pass --start and --end.");
    process.exit(1);
  }

  const minSerial = dateToSerial(new Date(`${startIso}T00:00:00Z`));
  const maxSerial = dateToSerial(new Date(`${endIso}T00:00:00Z`));
  const nDays = maxSerial - minSerial + 1;

  // Select calendars.
  let rows = cals;
  if (ids.length) rows = rows.filter((c) => ids.includes(c.clndr_id));
  else if (!includeAll) rows = rows.filter((c) => (usage.get(c.clndr_id) ?? 0) > 0);
  rows.sort((a, b) => (usage.get(b.clndr_id) ?? 0) - (usage.get(a.clndr_id) ?? 0));

  console.log(
    `Grid: ${rows.length} calendars x ${nDays} days (${startIso} to ${endIso}) -> ${out}`,
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Calendar");

  // Column geometry: A=name, B=row label, C..=one per date.
  const FIRST_DATE_COL = 3;
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 12;

  // Header row: date serials with a date format.
  const header = ws.getRow(1);
  header.getCell(1).value = "Calendar Name";
  for (let i = 0; i < nDays; i++) {
    const cell = header.getCell(FIRST_DATE_COL + i);
    cell.value = minSerial + i; // Excel serial
    cell.numFmt = DATE_FMT;
  }
  header.font = { bold: true };
  header.commit();

  let rowCursor = 2;
  for (const c of rows) {
    let decoded: DecodedCalendar;
    try {
      decoded = decodeCalendar(c.clndr_data);
    } catch (err) {
      console.warn(`  skip [${c.clndr_id}] ${c.clndr_name}: ${(err as Error).message}`);
      continue;
    }

    const weekdayHours = new Map(decoded.weekdays.map((w) => [w.index, w]));
    const exceptionsBySerial = new Map(decoded.exceptions.map((e) => [e.serial, e]));

    const startRow = ws.getRow(rowCursor);
    const endRow = ws.getRow(rowCursor + 1);
    const totalRow = ws.getRow(rowCursor + 2);

    startRow.getCell(1).value = c.clndr_name;
    startRow.getCell(2).value = "Start";
    endRow.getCell(2).value = "End";
    totalRow.getCell(2).value = "Total Hours";

    for (let i = 0; i < nDays; i++) {
      const info = dayInfo(decoded, weekdayHours, exceptionsBySerial, minSerial + i);
      const col = FIRST_DATE_COL + i;

      if (info.working) {
        const s = startRow.getCell(col);
        s.value = info.start;
        s.numFmt = TIME_FMT;
        const e = endRow.getCell(col);
        e.value = info.end;
        e.numFmt = TIME_FMT;
      }
      const tcell = totalRow.getCell(col);
      tcell.value = info.hours; // 0 on non-working days
      tcell.numFmt = HOURS_FMT;
    }

    startRow.commit();
    endRow.commit();
    totalRow.commit();

    // Merge the calendar name down its three rows.
    ws.mergeCells(rowCursor, 1, rowCursor + 2, 1);
    ws.getCell(rowCursor, 1).alignment = { vertical: "top", wrapText: true };

    rowCursor += 3;
  }

  // Freeze the header row and the two label columns.
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  await wb.xlsx.writeFile(out);
  console.log(`Wrote ${out} (${rowCursor - 1} rows)`);
}

main();
