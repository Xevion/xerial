import { describe, expect, test } from "bun:test";

import { csvExporter, gridToMatrix, tsvExporter, xlsxExporter } from "../../src/lib/export";
import { buildGrid, parseXer, type GridResult } from "../../src/lib/parser";
import { buildClndrData, buildXer, fiveDayWeek } from "../fixtures/builder";

/** A one-calendar grid over Mon–Fri 2025-01-06..10; name contains a comma. */
function sampleGrid(): GridResult {
	const doc = parseXer(
		buildXer({
			tables: [
				{
					name: "CALENDAR",
					fields: ["clndr_id", "clndr_name", "clndr_data"],
					rows: [
						{ clndr_id: "C1", clndr_name: "Acme, Inc", clndr_data: buildClndrData(fiveDayWeek()) },
					],
				},
				{
					name: "TASK",
					fields: ["task_id", "clndr_id", "act_start_date", "act_end_date"],
					rows: [
						{
							task_id: "1",
							clndr_id: "C1",
							act_start_date: "2025-01-06 08:00",
							act_end_date: "2025-01-10 17:00",
						},
					],
				},
			],
		}),
	);
	return buildGrid(doc);
}

describe("gridToMatrix", () => {
	test("is a header row plus three rows per calendar", () => {
		const matrix = gridToMatrix(sampleGrid());
		expect(matrix).toHaveLength(1 + 3); // one calendar
		expect(matrix[0]?.[0]).toBe("Calendar Name");
		expect(matrix[0]).toContain("1/6/2025");
		expect(matrix[1]?.[1]).toBe("Start");
		expect(matrix[2]?.[1]).toBe("End");
		expect(matrix[3]?.[1]).toBe("Total Hours");
	});
});

describe("csvExporter", () => {
	test("emits a CSV blob with the date axis and RFC-4180 quoting", async () => {
		const blob = await csvExporter.export(sampleGrid());
		expect(blob.type).toContain("text/csv");
		const text = await blob.text();
		const lines = text.split("\r\n");
		expect(lines[0]?.startsWith("Calendar Name,")).toBe(true);
		expect(text).toContain("1/6/2025");
		expect(text).toContain('"Acme, Inc"'); // comma forces quoting
		expect(text).toContain("8:00 AM");
	});
});

describe("tsvExporter", () => {
	test("emits tab-separated text without quoting", async () => {
		const blob = await tsvExporter.export(sampleGrid());
		const text = await blob.text();
		expect(text).toContain("\t");
		expect(text).toContain("Acme, Inc"); // no quoting in TSV
		expect(text).not.toContain('"Acme');
	});
});

describe("xlsxExporter", () => {
	test("produces a non-empty workbook blob", async () => {
		const blob = await xlsxExporter.export(sampleGrid());
		expect(blob.size).toBeGreaterThan(0);
		expect(blob.type).toContain("spreadsheetml");
	});
});
