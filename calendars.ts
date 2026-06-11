#!/usr/bin/env bun
/**
 * Decode and print the weekly work patterns (and exception summaries) of the
 * CALENDAR rows in an XER file, a sanity-check view before expanding to a
 * day-by-day grid.
 *
 *   bun calendars.ts <file.xer> [--used] [--id CLNDR_ID] [--exceptions]
 *
 * --used         only calendars referenced by at least one TASK row
 * --id ID        only the calendar with this clndr_id
 * --exceptions   also list every exception date (otherwise just a count)
 */

import { readXerFile } from "./xer";
import { decodeCalendar, type DecodedCalendar } from "./calendar";

function arg(flag: string): string | undefined {
  const i = Bun.argv.indexOf(flag);
  return i === -1 ? undefined : Bun.argv[i + 1];
}

function patternLine(d: DecodedCalendar): string {
  return d.weekdays
    .map((w) => (w.working ? `${w.name} ${w.hours}h` : `${w.name} off`))
    .join("  ");
}

async function main() {
  const path = Bun.argv[2];
  if (!path || path.startsWith("--")) {
    console.error("Usage: bun calendars.ts <file.xer> [--used] [--id ID] [--exceptions]");
    process.exit(1);
  }

  const doc = await readXerFile(path);
  const cals = doc.table("CALENDAR")?.rows ?? [];
  const tasks = doc.table("TASK")?.rows ?? [];

  const usage = new Map<string, number>();
  for (const t of tasks) usage.set(t.clndr_id, (usage.get(t.clndr_id) ?? 0) + 1);

  const onlyId = arg("--id");
  const onlyUsed = Bun.argv.includes("--used");
  const showExceptions = Bun.argv.includes("--exceptions");

  let rows = cals;
  if (onlyId) rows = rows.filter((c) => c.clndr_id === onlyId);
  else if (onlyUsed) rows = rows.filter((c) => (usage.get(c.clndr_id) ?? 0) > 0);

  rows.sort((a, b) => (usage.get(b.clndr_id) ?? 0) - (usage.get(a.clndr_id) ?? 0));

  console.log(`${rows.length} calendar(s) in ${path}\n`);

  for (const c of rows) {
    const used = usage.get(c.clndr_id) ?? 0;
    let decoded: DecodedCalendar;
    try {
      decoded = decodeCalendar(c.clndr_data);
    } catch (err) {
      console.log(`[${c.clndr_id}] ${c.clndr_name}  DECODE FAILED: ${(err as Error).message}`);
      continue;
    }

    const weekHours = decoded.weekdays.reduce((s, w) => s + w.hours, 0);
    const workDays = decoded.weekdays.filter((w) => w.working).length;
    const exDates = decoded.exceptions.map((e) => e.iso);
    const span = exDates.length ? `${exDates[0]} to ${exDates[exDates.length - 1]}` : "none";

    console.log("-".repeat(78));
    console.log(`[${c.clndr_id}] ${c.clndr_name}`);
    console.log(
      `   type=${c.clndr_type}  day_hr=${c.day_hr_cnt}  week_hr=${c.week_hr_cnt}  ` +
        `used by ${used} task(s)`,
    );
    console.log(`   pattern: ${patternLine(decoded)}`);
    console.log(
      `   = ${workDays} work day(s)/wk, ${weekHours}h/wk` +
        `   (header week_hr_cnt=${c.week_hr_cnt})`,
    );
    console.log(`   exceptions: ${decoded.exceptions.length}  span ${span}`);

    if (showExceptions) {
      for (const e of decoded.exceptions) {
        const tag = e.working ? `WORK ${e.hours}h (${e.shifts.map((s) => `${s.start}-${s.finish}`).join(", ")})` : "off";
        console.log(`      ${e.iso}  serial ${e.serial}  ${tag}`);
      }
    }
  }
}

main();
