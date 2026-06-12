import { test, expect, describe } from "bun:test";

import {
	buildGrid,
	parseXer,
	dateToSerial,
	type GridResult,
	type XerDocument,
} from "../src/lib/parser";
import { diffGrids, DiffError } from "../src/lib/parser/diff";
import { buildXer, buildClndrData, fiveDayWeek, type CalendarSpec } from "./fixtures/builder";

const serialFor = (iso: string) => dateToSerial(new Date(`${iso}T00:00:00Z`));

interface CalRow {
	id: string;
	name: string;
	data: string;
}

function defined<T>(v: T | undefined | null): T {
	if (v === undefined || v === null) throw new Error("expected a defined value");
	return v;
}

const cal = (id: string, name: string, spec: CalendarSpec): CalRow => ({
	id,
	name,
	data: buildClndrData(spec),
});

/** A document over a fixed Mon..Fri window, all calendars used by one task each. */
function docWith(
	calendars: CalRow[],
	span: { start: string; end: string } = { start: "2025-01-06", end: "2025-01-10" },
): XerDocument {
	return parseXer(
		buildXer({
			tables: [
				{
					name: "CALENDAR",
					fields: ["clndr_id", "clndr_name", "clndr_data"],
					rows: calendars.map((c) => ({ clndr_id: c.id, clndr_name: c.name, clndr_data: c.data })),
				},
				{
					name: "TASK",
					fields: ["task_id", "clndr_id", "act_start_date", "act_end_date"],
					rows: calendars.map((c, i) => ({
						task_id: String(i + 1),
						clndr_id: c.id,
						act_start_date: `${span.start} 08:00`,
						act_end_date: `${span.end} 17:00`,
					})),
				},
			],
		}),
	);
}

const span = { start: "2025-01-06", end: "2025-01-10" };
const gridOf = (calendars: CalRow[]): GridResult =>
	buildGrid(docWith(calendars, span), { startIso: span.start, endIso: span.end, includeAll: true });

/** A 4-hour Friday: full days Mon–Thu, half day Friday. */
function shortFriday(): CalendarSpec {
	const full = defined(fiveDayWeek().days);
	return { days: { ...full, 6: [["08:00", "12:00"]] } };
}

describe("diffGrids calendar roster", () => {
	test("matches calendars by clndr_id across files", () => {
		const before = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const diff = diffGrids(before, after);
		expect(diff.calendars.map((c) => c.clndrId)).toEqual(["C1"]);
		expect(diff.calendars[0]?.kind).toBe("unchanged");
	});

	test("flags an added calendar (present only in revised)", () => {
		const before = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Std", fiveDayWeek()), cal("C2", "New", fiveDayWeek())]);
		const diff = diffGrids(before, after);
		const c2 = diff.calendars.find((c) => c.clndrId === "C2");
		expect(c2?.kind).toBe("added");
		expect(c2?.days.every((d) => d.before === null)).toBe(true);
	});

	test("flags a removed calendar (present only in baseline)", () => {
		const before = gridOf([cal("C1", "Std", fiveDayWeek()), cal("C2", "Old", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const diff = diffGrids(before, after);
		const c2 = diff.calendars.find((c) => c.clndrId === "C2");
		expect(c2?.kind).toBe("removed");
		expect(c2?.days.every((d) => d.after === null)).toBe(true);
	});
});

describe("diffGrids per-day changes", () => {
	test("identical calendars produce no changed days", () => {
		const before = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const c1 = defined(diffGrids(before, after).calendars[0]);
		expect(c1.kind).toBe("unchanged");
		expect(c1.changedCount).toBe(0);
		expect(c1.days.every((d) => d.kind === "same")).toBe(true);
	});

	test("a changed Friday surfaces as a single changed day", () => {
		const before = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Std", shortFriday())]);
		const c1 = defined(diffGrids(before, after).calendars[0]);
		expect(c1.kind).toBe("modified");
		expect(c1.changedCount).toBe(1);

		const fri = defined(c1.days.find((d) => d.serial === serialFor("2025-01-10")));
		expect(fri.kind).toBe("changed");
		expect(fri.before?.hours).toBe(8);
		expect(fri.after?.hours).toBe(4);
	});

	test("a new exception (workday turned holiday) is a changed day", () => {
		const holiday = serialFor("2025-01-08"); // Wednesday
		const after = gridOf([
			cal("C1", "Std", { ...fiveDayWeek(), exceptions: [{ serial: holiday }] }),
		]);
		const before = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const c1 = defined(diffGrids(before, after).calendars[0]);
		const wed = defined(c1.days.find((d) => d.serial === holiday));
		expect(wed.kind).toBe("changed");
		expect(wed.before?.working).toBe(true);
		expect(wed.after?.working).toBe(false);
	});
});

describe("diffGrids axis validation", () => {
	test("rejects grids built over different serial axes", () => {
		const before = gridOf([cal("C1", "Std", fiveDayWeek())]);
		const after = buildGrid(docWith([cal("C1", "Std", fiveDayWeek())]), {
			startIso: "2025-01-06",
			endIso: "2025-01-17",
			includeAll: true,
		});
		expect(() => diffGrids(before, after)).toThrow(DiffError);
	});
});
