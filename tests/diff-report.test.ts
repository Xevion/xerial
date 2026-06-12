import { test, expect, describe } from "bun:test";

import { summarizeDiff, diffToMatrix } from "../src/lib/export";
import {
	buildGrid,
	parseXer,
	dateToSerial,
	type GridResult,
	type XerDocument,
} from "../src/lib/parser";
import { diffGrids } from "../src/lib/parser/diff";
import { buildXer, buildClndrData, fiveDayWeek, type CalendarSpec } from "./fixtures/builder";

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

// A three-week window so a recurring weekday edit lands on multiple dates and can
// be grouped (Fridays Jan 10, 17, 24).
const SPAN = { start: "2025-01-06", end: "2025-01-24" };

function docWith(calendars: CalRow[]): XerDocument {
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
						act_start_date: `${SPAN.start} 08:00`,
						act_end_date: `${SPAN.end} 17:00`,
					})),
				},
			],
		}),
	);
}

const gridOf = (calendars: CalRow[]): GridResult =>
	buildGrid(docWith(calendars), { startIso: SPAN.start, endIso: SPAN.end, includeAll: true });

/** Mon–Thu full, Friday cut to a 4h half day. */
function shortFriday(): CalendarSpec {
	const full = defined(fiveDayWeek().days);
	return { days: { ...full, 6: [["08:00", "12:00"]] } };
}

describe("summarizeDiff grouped lines", () => {
	test("collapses a recurring Friday hours cut into one line", () => {
		const before = gridOf([cal("C1", "Standard", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Standard", shortFriday())]);
		const summary = defined(summarizeDiff(diffGrids(before, after))[0]);

		expect(summary.kind).toBe("modified");
		expect(summary.lines).toHaveLength(1);
		const line = defined(summary.lines[0]);
		expect(line.tone).toBe("hours");
		expect(line.text).toBe("Fridays: 8h → 4h (3 days)");
	});

	test("reports an added holiday by date", () => {
		const holiday = dateToSerial(new Date("2025-01-08T00:00:00Z")); // Wednesday within the span
		const before = gridOf([cal("C1", "Standard", fiveDayWeek())]);
		const after = gridOf([
			cal("C1", "Standard", { ...fiveDayWeek(), exceptions: [{ serial: holiday }] }),
		]);
		const summary = defined(summarizeDiff(diffGrids(before, after))[0]);
		const holidayLine = defined(summary.lines.find((l) => l.tone === "holiday"));
		expect(holidayLine.text).toMatch(/^Added holiday: /);
	});

	test("describes an added calendar", () => {
		const before = gridOf([cal("C1", "Standard", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Standard", fiveDayWeek()), cal("C2", "Night", fiveDayWeek())]);
		const added = defined(summarizeDiff(diffGrids(before, after)).find((s) => s.clndrId === "C2"));
		expect(added.kind).toBe("added");
		expect(defined(added.lines[0]).text).toBe("New calendar");
	});

	test("describes a removed calendar", () => {
		const before = gridOf([cal("C1", "Standard", fiveDayWeek()), cal("C2", "Old", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Standard", fiveDayWeek())]);
		const removed = defined(
			summarizeDiff(diffGrids(before, after)).find((s) => s.clndrId === "C2"),
		);
		expect(removed.kind).toBe("removed");
		expect(defined(removed.lines[0]).text).toBe("No longer present");
	});

	test("omits unchanged calendars from the summary", () => {
		const before = gridOf([cal("C1", "Standard", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Standard", fiveDayWeek())]);
		expect(summarizeDiff(diffGrids(before, after))).toHaveLength(0);
	});
});

describe("diffToMatrix change rows", () => {
	test("emits a header and one row per changed day", () => {
		const before = gridOf([cal("C1", "Standard", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Standard", shortFriday())]);
		const rows = diffToMatrix(diffGrids(before, after));

		expect(rows[0]).toEqual(["Calendar", "Day", "Before", "After"]);
		const friday = defined(rows.find((r) => r[2] === "8h" && r[3] === "4h"));
		expect(friday[0]).toBe("Standard");
	});

	test("represents an added calendar as a single summary row", () => {
		const before = gridOf([cal("C1", "Standard", fiveDayWeek())]);
		const after = gridOf([cal("C1", "Standard", fiveDayWeek()), cal("C2", "Night", fiveDayWeek())]);
		const rows = diffToMatrix(diffGrids(before, after));
		const added = defined(rows.find((r) => r[0] === "Night"));
		expect(added[2]).toBe("(added)");
	});
});
