import { test, expect, describe } from "bun:test";

import { weekdayLabel } from "../src/lib/export";
import { parseXer, buildGrid, GridError, dateToSerial, type XerDocument } from "../src/lib/parser";
import { buildXer, buildClndrData, fiveDayWeek, type CalendarSpec } from "./fixtures/builder";

const serialFor = (iso: string) => dateToSerial(new Date(`${iso}T00:00:00Z`));

interface CalRow {
	id: string;
	name: string;
	data: string;
}

/** Assemble a parsed document from calendar specs + a Mon–Fri activity window. */
function docWith(
	calendars: CalRow[],
	tasks: { clndr_id: string }[],
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
					rows: tasks.map((t, i) => ({
						task_id: String(i + 1),
						clndr_id: t.clndr_id,
						act_start_date: `${span.start} 08:00`,
						act_end_date: `${span.end} 17:00`,
					})),
				},
			],
		}),
	);
}

const cal = (id: string, name: string, spec: CalendarSpec): CalRow => ({
	id,
	name,
	data: buildClndrData(spec),
});

describe("buildGrid structure", () => {
	test("throws when there is no CALENDAR table", () => {
		const doc = parseXer(
			buildXer({ tables: [{ name: "TASK", fields: ["task_id"], rows: [["1"]] }] }),
		);
		expect(() => buildGrid(doc)).toThrow(GridError);
	});

	test("auto-detects the date span from TASK dates", () => {
		const doc = docWith([cal("C1", "Std", fiveDayWeek())], [{ clndr_id: "C1" }]);
		const grid = buildGrid(doc);
		expect(grid.startIso).toBe("2025-01-06");
		expect(grid.endIso).toBe("2025-01-10");
		expect(grid.serials).toHaveLength(5); // Mon..Fri inclusive
		expect(grid.serials[0]).toBe(serialFor("2025-01-06"));
	});
});

describe("buildGrid calendar selection", () => {
	test("defaults to only calendars used by tasks", () => {
		const doc = docWith(
			[cal("C1", "Used", fiveDayWeek()), cal("C2", "Unused", fiveDayWeek())],
			[{ clndr_id: "C1" }],
		);
		const grid = buildGrid(doc);
		expect(grid.calendars.map((c) => c.clndrId)).toEqual(["C1"]);
	});

	test("includeAll surfaces unused calendars too", () => {
		const doc = docWith(
			[cal("C1", "Used", fiveDayWeek()), cal("C2", "Unused", fiveDayWeek())],
			[{ clndr_id: "C1" }],
		);
		const grid = buildGrid(doc, { includeAll: true });
		expect(grid.calendars.map((c) => c.clndrId).sort()).toEqual(["C1", "C2"]);
	});

	test("undecodable calendars are skipped, not thrown", () => {
		const doc = docWith(
			[
				{ id: "BAD", name: "Broken", data: "not a calendar blob" },
				cal("C1", "Good", fiveDayWeek()),
			],
			[{ clndr_id: "BAD" }, { clndr_id: "C1" }],
		);
		const grid = buildGrid(doc);
		expect(grid.calendars.map((c) => c.clndrId)).toEqual(["C1"]);
		expect(grid.skipped.map((s) => s.clndrId)).toEqual(["BAD"]);
	});

	test("a skipped calendar also surfaces as a diagnostic", () => {
		const doc = docWith(
			[{ id: "BAD", name: "Broken", data: "not a calendar blob" }],
			[{ clndr_id: "BAD" }],
		);
		const grid = buildGrid(doc);
		expect(grid.diagnostics.map((d) => d.code)).toContain("CALENDAR_DECODE_FAILED");
	});
});

describe("buildGrid span validation", () => {
	test("rejects an unparseable date option with a GridError", () => {
		const doc = docWith([cal("C1", "Std", fiveDayWeek())], [{ clndr_id: "C1" }]);
		expect(() => buildGrid(doc, { startIso: "not-a-date", endIso: "2025-01-10" })).toThrow(
			GridError,
		);
	});
});

describe("buildGrid day resolution", () => {
	test("resolves weekday hours and marks weekends off", () => {
		// Span Mon..Fri so no weekend columns; extend to the following Sunday.
		const doc = docWith([cal("C1", "Std", fiveDayWeek())], [{ clndr_id: "C1" }], {
			start: "2025-01-06",
			end: "2025-01-12",
		});
		const grid = buildGrid(doc);
		const days = grid.calendars[0]?.days;

		// serials[0] = Mon 2025-01-06
		expect(grid.serials.map(weekdayLabel)[0]).toBe("Mon");
		expect(days?.[0]?.working).toBe(true);
		expect(days?.[0]?.hours).toBe(8);
		expect(days?.[0]?.start).toBeCloseTo(8 / 24, 6);
		expect(days?.[0]?.end).toBeCloseTo(17 / 24, 6);

		// Sat (index 5) and Sun (index 6) are off.
		expect(days?.[5]?.working).toBe(false);
		expect(days?.[6]?.working).toBe(false);
		expect(days?.[6]?.hours).toBe(0);
	});

	test("an exception overrides the weekday pattern", () => {
		const holiday = serialFor("2025-01-08"); // a Wednesday
		const spec: CalendarSpec = { ...fiveDayWeek(), exceptions: [{ serial: holiday }] };
		const doc = docWith([cal("C1", "Std", spec)], [{ clndr_id: "C1" }]);
		const grid = buildGrid(doc);
		const wedIndex = grid.serials.indexOf(holiday);
		expect(grid.serials.map(weekdayLabel)[wedIndex]).toBe("Wed");
		expect(grid.calendars[0]?.days[wedIndex]?.working).toBe(false);
	});
});
