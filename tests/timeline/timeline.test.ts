import { describe, expect, test } from "bun:test";

import { isoToSerial } from "../../src/lib/parser";
import {
	contrastText,
	layoutTimeline,
	parseTimeline,
	renderTimelineSvg,
	resolveColor,
} from "../../src/lib/timeline";
import { EXAMPLE_RANGE, EXAMPLE_ROWS } from "../fixtures/bar-chart-example";

const range = (start: string, finish: string) => ({
	start: isoToSerial(start),
	finish: isoToSerial(finish),
});
const EXAMPLE = range(EXAMPLE_RANGE.start, EXAMPLE_RANGE.finish);
const PLOT_WIDTH = 1000;

const layoutOf = (rows: (string | null)[][], window = range("2027-01-01", "2027-12-31")) =>
	layoutTimeline(parseTimeline(rows, window), { plotWidth: PLOT_WIDTH });
const barOf = (layout: ReturnType<typeof layoutOf>, id: string) => {
	const bar = layout.bars.find((b) => b.id === id);
	if (!bar) throw new Error(`no bar ${id}`);
	return bar;
};

describe("parseTimeline", () => {
	test("infers the row kind from the Box # text", () => {
		const { items, warnings } = parseTimeline(EXAMPLE_ROWS, EXAMPLE);
		const kinds = Object.fromEntries(items.map((i) => [i.id, i.kind]));
		expect(kinds["Box 01"]).toBe("bar");
		expect(kinds["V-Bar 02"]).toBe("line");
		expect(kinds["V-Curt 01"]).toBe("band");
		expect(kinds["Baseline 04"]).toBe("baseline");
		expect(warnings).toEqual(["Box 15: no start date, skipped"]);
	});

	test("ignores pre-numbered empty slots without warning", () => {
		const { items, warnings } = parseTimeline([["Box 16", null, null, null, null, null]], EXAMPLE);
		expect(items).toEqual([]);
		expect(warnings).toEqual([]);
	});

	test("milestone lines need only a start date", () => {
		const { items } = parseTimeline(
			[["V-Bar 01", "Outage", "Red", "White", "2027-12-05", null]],
			EXAMPLE,
		);
		expect(items[0]?.finish).toBeNull();
	});

	test("drops rows it can't draw and says why", () => {
		const { items, warnings } = parseTimeline(
			[
				["Box 01", "No finish", null, null, "2027-01-01", null],
				["Box 02", "Backwards", null, null, "2027-03-01", "2027-02-01"],
				["Baseline 09", null, null, null, "2027-01-01", "2027-02-01"],
			],
			EXAMPLE,
		);
		expect(items.map((i) => i.id)).toEqual(["Baseline 09"]);
		expect(warnings).toEqual([
			"Box 01: no finish date, skipped",
			"Box 02: finishes (2027-02-01) before it starts, skipped",
			"Baseline 09: no matching bar to sit under, skipped",
		]);
	});

	test("accepts Excel serials and Date objects as well as ISO strings", () => {
		const serial = Number(isoToSerial("2027-03-01"));
		const { items } = parseTimeline(
			[["Box 01", "t", null, null, serial, new Date("2027-04-01T00:00:00Z")]],
			EXAMPLE,
		);
		expect(items[0]?.start).toBe(isoToSerial("2027-03-01"));
		expect(items[0]?.finish).toBe(isoToSerial("2027-04-01"));
	});
});

describe("layoutTimeline: dates drive the horizontal position", () => {
	const window = range("2027-01-01", "2027-12-31"); // 365 days
	const perDay = PLOT_WIDTH / 365;

	test("a bar runs from the start of its first day to the end of its last", () => {
		const layout = layoutOf(
			[["Box 01", "Jan", "Red", "White", "2027-01-01", "2027-01-31"]],
			window,
		);
		const bar = barOf(layout, "Box 01");
		expect(bar.x).toBeCloseTo(layout.plot.x, 5);
		expect(bar.w).toBeCloseTo(31 * perDay, 5);
	});

	test("a milestone line sits mid-day on its date", () => {
		const layout = layoutOf([["V-Bar 01", "Go", "Red", "White", "2027-01-11", null]], window);
		expect(layout.lines[0]?.x).toBeCloseTo(layout.plot.x + 10.5 * perDay, 5);
	});

	test("a band spans the whole plot height", () => {
		const layout = layoutOf(
			[
				["Box 01", "x", null, null, "2027-01-01", "2027-01-31"],
				["V-Curt 01", "Games", "Yellow", "Black", "2027-07-01", "2027-07-31"],
			],
			window,
		);
		const band = layout.bands[0];
		expect(band?.y).toBe(layout.plot.y);
		expect(band?.h).toBe(layout.plot.h);
		expect(band?.w).toBeCloseTo(31 * perDay, 5);
	});

	test("anything outside the window is dropped with a warning", () => {
		const layout = layoutOf([["Box 01", "Late", null, null, "2028-02-01", "2028-03-01"]], window);
		expect(layout.bars).toEqual([]);
		expect(layout.warnings).toEqual(["Box 01: outside the schedule window, skipped"]);
	});

	test("bars that straddle the window edge are clipped to it", () => {
		const layout = layoutOf([["Box 01", "Wide", null, null, "2026-06-01", "2027-02-01"]], window);
		const bar = barOf(layout, "Box 01");
		expect(bar.x).toBe(layout.plot.x);
		expect(bar.w).toBeCloseTo(32 * perDay, 5);
	});
});

describe("layoutTimeline: rows are derived, not entered", () => {
	test("bars that don't overlap share a row, overlapping ones stack", () => {
		const layout = layoutOf([
			["Box 01", "A", null, null, "2027-01-01", "2027-02-28"],
			["Box 02", "B", null, null, "2027-02-01", "2027-03-31"],
			["Box 03", "C", null, null, "2027-04-01", "2027-05-31"],
		]);
		expect(barOf(layout, "Box 02").y).toBeGreaterThan(barOf(layout, "Box 01").y);
		expect(barOf(layout, "Box 03").y).toBe(barOf(layout, "Box 01").y);
	});

	test("a hand-off on a shared date stays side by side", () => {
		const layout = layoutOf([
			["Box 01", "A", null, null, "2027-01-01", "2027-02-28"],
			["Box 02", "B", null, null, "2027-02-28", "2027-04-30"],
		]);
		expect(barOf(layout, "Box 02").y).toBe(barOf(layout, "Box 01").y);
	});

	test("a label that spills out of a short bar reserves room in its row", () => {
		const layout = layoutOf([
			[
				"Box 01",
				"A long title that cannot fit in a short bar",
				null,
				null,
				"2027-01-01",
				"2027-01-05",
			],
			["Box 02", "Next", null, null, "2027-01-20", "2027-03-01"],
		]);
		expect(barOf(layout, "Box 01").labelAt).toBe("right");
		expect(barOf(layout, "Box 02").y).toBeGreaterThan(barOf(layout, "Box 01").y);
	});

	test("long titles shrink or wrap inside the bar before moving outside", () => {
		const layout = layoutOf([
			["Box 01", "Building 1 Architectural Finishes", null, null, "2027-01-01", "2027-03-31"],
		]);
		const bar = barOf(layout, "Box 01");
		expect(bar.labelAt).toBe("inside");
		expect(bar.lines.join(" ")).toBe("Building 1 Architectural Finishes");
	});

	test("a baseline attaches to the bar with the same number", () => {
		const layout = layoutOf([
			["Box 04", "Steel", "Med Blue", "White", "2027-01-01", "2027-06-05"],
			["Baseline 04", null, "Yellow", null, "2027-01-01", "2027-05-31"],
		]);
		expect(layout.bars).toHaveLength(1);
		const baseline = barOf(layout, "Box 04").baseline;
		expect(baseline?.w).toBeCloseTo((151 / 365) * PLOT_WIDTH, 5);
	});

	test("overlapping milestone flags stagger into tiers", () => {
		const layout = layoutOf([
			["V-Bar 01", "Substantial Completion", "Red", "White", "2027-06-10", null],
			["V-Bar 02", "Outage", "Red", "White", "2027-06-12", null],
		]);
		const [a, b] = layout.lines;
		expect(a?.flag.y).not.toBe(b?.flag.y);
	});

	test("lanes group bars into separate shaded bands", () => {
		const layout = layoutOf([
			["Box 01", "A", null, null, "2027-01-01", "2027-02-01", "Building 1"],
			["Box 02", "B", null, null, "2027-01-01", "2027-02-01", "Building 2"],
		]);
		expect(layout.lanes.map((l) => l.label)).toEqual(["Building 1", "Building 2"]);
		expect(barOf(layout, "Box 02").y).toBeGreaterThan(barOf(layout, "Box 01").y);
	});
});

describe("the example workbook", () => {
	const layout = layoutTimeline(parseTimeline(EXAMPLE_ROWS, EXAMPLE), { plotWidth: PLOT_WIDTH });
	const days = EXAMPLE.finish - EXAMPLE.start + 1;
	const dateAt = (x: number) =>
		Math.round(((x - layout.plot.x) / PLOT_WIDTH) * days) + (EXAMPLE.start as number);

	test("every bar lands on its table dates", () => {
		for (const row of EXAMPLE_ROWS) {
			const [id, , , , start, finish] = row;
			if (!id?.startsWith("Box ") || !start || !finish) continue;
			const bar = barOf(layout, id);
			expect(dateAt(bar.x)).toBe(isoToSerial(start));
			expect(dateAt(bar.x + bar.w) - 1).toBe(isoToSerial(finish));
		}
	});

	test("draws every populated row and only warns about the undated one", () => {
		expect(layout.bars).toHaveLength(14);
		expect(layout.lines).toHaveLength(3);
		expect(layout.bands).toHaveLength(1);
		expect(layout.warnings).toEqual(["Box 15: no start date, skipped"]);
	});

	test("spans the two years with a month tick for each month", () => {
		expect(layout.years.map((y) => y.label)).toEqual(["2027", "2028"]);
		expect(layout.months).toHaveLength(24);
	});
});

describe("renderTimelineSvg", () => {
	const layout = layoutTimeline(parseTimeline(EXAMPLE_ROWS, EXAMPLE));

	test("emits a standalone SVG with escaped titles", () => {
		const svg = renderTimelineSvg(layout, { title: "Plan & Review" });
		expect(svg.startsWith("<svg ")).toBe(true);
		expect(svg.endsWith("</svg>")).toBe(true);
		expect(svg).toContain("Plan &amp; Review");
		expect(svg).toContain("Steel &amp; Exterior Construction");
		expect(svg).not.toContain("Steel & Exterior");
	});
});

describe("palette", () => {
	test("resolves the table's color names, tolerant of case and spacing", () => {
		expect(resolveColor("Med Blue")).toBe("#0070C0");
		expect(resolveColor("dark blue")).toBe("#002060");
		expect(resolveColor("#abc")).toBe("#AABBCC");
		expect(resolveColor("Chartreuse-ish")).toBeNull();
		expect(resolveColor(null)).toBeNull();
	});

	test("picks readable text for a fill", () => {
		expect(contrastText("#FFFF00")).toBe("#000000");
		expect(contrastText("#002060")).toBe("#FFFFFF");
	});
});
