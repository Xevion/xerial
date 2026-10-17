import type {
	Box,
	LayoutOptions,
	PlacedBand,
	PlacedBar,
	PlacedLane,
	PlacedLine,
	Tick,
	TimelineItem,
	TimelineLayout,
	TimelineModel,
} from "./types";

import { dateToSerial, serial, serialToDate, type Serial } from "../parser";
import { contrastText, resolveColor } from "./palette";

export const DEFAULT_OPTIONS: LayoutOptions = {
	plotWidth: 1100,
	barHeight: 22,
	rowGap: 6,
	fontSize: 10,
};

const MARGIN = 8;
const LANE_PAD = 6;
const FLAG_HEIGHT = 18;
const FLAG_GAP = 3;
const RULER_ROW = 16;
const LABEL_GAP = 4;
const FALLBACK_FILL = "#8C8C8C";
const FLAG_FILL = "#C00000";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Span = readonly [number, number];

/** Rough text width: a proportional sans averages ~0.5em per character. */
function measure(label: string, fontSize: number): number {
	return label.length * fontSize * 0.5;
}

const MIN_FONT = 8;
const LINE_HEIGHT = 1.15;
const BAR_PAD = 8;

/** Split at the space nearest the middle, so both halves are as short as possible. */
function splitInTwo(label: string): [string, string] | null {
	const mid = label.length / 2;
	let best = -1;
	for (let i = label.indexOf(" "); i !== -1; i = label.indexOf(" ", i + 1))
		if (best === -1 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
	return best === -1 ? null : [label.slice(0, best), label.slice(best + 1)];
}

/**
 * Fit a title inside a bar the way the hand-drawn chart does: shrink the font a
 * little, then wrap onto two lines, and only then give up (the caller moves the
 * label outside). Returns null when it can't be made to fit.
 */
function fitInside(
	label: string,
	width: number,
	height: number,
	fontSize: number,
): { lines: string[]; size: number } | null {
	for (let size = fontSize; size >= MIN_FONT; size--)
		if (measure(label, size) + BAR_PAD <= width) return { lines: [label], size };
	const halves = splitInTwo(label);
	if (!halves) return null;
	for (let size = fontSize; size >= MIN_FONT; size--) {
		if (2 * size * LINE_HEIGHT > height) continue;
		if (halves.every((half) => measure(half, size) + BAR_PAD <= width))
			return { lines: halves, size };
	}
	return null;
}

/**
 * Place `span` on the first row it doesn't collide with, creating a row if none
 * fits. First-fit in table order means the "Box #" ordering the author already
 * maintains decides who gets the upper rows. Overlaps up to `tolerance` px are
 * ignored: schedules hand off on a shared date (one box finishes the day the next
 * starts) and those should still sit side by side.
 */
function firstFit(rows: Span[][], span: Span, tolerance: number): number {
	const [a, b] = span;
	let index = rows.findIndex((row) =>
		row.every(([c, d]) => b - c <= tolerance || d - a <= tolerance),
	);
	if (index === -1) index = rows.push([]) - 1;
	rows[index]?.push(span);
	return index;
}

function monthTicks(start: Serial, finish: Serial, x: (day: number) => number): Tick[] {
	const ticks: Tick[] = [];
	for (let from: number = start; from <= finish; ) {
		const d = serialToDate(serial(from));
		const month = d.getUTCMonth();
		const next = Math.min(
			dateToSerial(new Date(Date.UTC(d.getUTCFullYear(), month + 1, 1))),
			finish + 1,
		);
		const w = x(next) - x(from);
		const name = MONTHS[month] ?? "";
		ticks.push({ x: x(from), w, label: w >= 36 ? name : name.slice(0, 1) });
		from = next;
	}
	return ticks;
}

function yearTicks(start: Serial, finish: Serial, x: (day: number) => number): Tick[] {
	const ticks: Tick[] = [];
	for (let year = serialToDate(start).getUTCFullYear(); ; year++) {
		const from = Math.max(dateToSerial(new Date(Date.UTC(year, 0, 1))), start);
		if (from > finish) break;
		const next = Math.min(dateToSerial(new Date(Date.UTC(year + 1, 0, 1))), finish + 1);
		ticks.push({ x: x(from), w: x(next) - x(from), label: String(year) });
	}
	return ticks;
}

/**
 * Turn a parsed table into drawable geometry.
 *
 * Dates are the only thing that fixes a position horizontally: the window
 * start..finish maps linearly onto `plotWidth`, and a bar spans start through the
 * *end* of its finish day. Everything vertical is derived: bars stack into rows
 * by first-fit (a row is reused as soon as the dates — and any label that spills
 * out of a short bar — leave room), so no row/height column is needed.
 */
export function layoutTimeline(
	model: TimelineModel,
	overrides: Partial<LayoutOptions> = {},
): TimelineLayout {
	const opts = { ...DEFAULT_OPTIONS, ...overrides };
	const warnings = [...model.warnings];
	const { start, finish } = model.range;
	const days = finish - start + 1;
	const plotL = MARGIN;
	const plotR = MARGIN + opts.plotWidth;
	const x = (day: number) => plotL + ((day - start) / days) * opts.plotWidth;
	const clampX = (v: number) => Math.min(Math.max(v, plotL), plotR);
	const pitch = opts.barHeight + opts.rowGap;
	const dayPx = opts.plotWidth / days;

	const inRange = (item: TimelineItem, a: number, b: number) => {
		if (b < start || a > finish) {
			warnings.push(`${item.id}: outside the schedule window, skipped`);
			return false;
		}
		return true;
	};

	// --- vertical milestones (flags need to be placed first: they set the top margin) ---
	const flagFor = (title: string, cx: number): Box => {
		const w = measure(title, opts.fontSize) + 14;
		return { x: Math.min(Math.max(cx - w / 2, 0), plotR + MARGIN - w), y: 0, w, h: FLAG_HEIGHT };
	};
	const tierEnds: number[] = [];
	const lines: PlacedLine[] = [];
	const lineItems = model.items
		.filter((i) => i.kind === "line" && inRange(i, i.start, i.start))
		.map((item) => ({ item, cx: x(item.start + 0.5) }))
		.sort((a, b) => a.cx - b.cx);
	for (const { item, cx } of lineItems) {
		const flag = flagFor(item.title, cx);
		let tier = tierEnds.findIndex((end) => end + FLAG_GAP < flag.x);
		if (tier === -1) tier = tierEnds.length;
		tierEnds[tier] = flag.x + flag.w;
		const color = resolveColor(item.color) ?? FLAG_FILL;
		const textFill = resolveColor(item.textColor) ?? contrastText(color);
		lines.push({
			id: item.id,
			x: cx,
			color,
			label: item.title,
			flag: { ...flag, y: tier },
			textFill,
		});
	}
	const flagArea = tierEnds.length * (FLAG_HEIGHT + FLAG_GAP);
	for (const line of lines)
		line.flag.y = MARGIN + flagArea - (line.flag.y + 1) * (FLAG_HEIGHT + FLAG_GAP);

	const rulerHeight = RULER_ROW * 2;
	const topRulerY = MARGIN + flagArea;
	const plotY = topRulerY + rulerHeight + 1;

	// --- bars: group by lane, stack by first-fit ---
	const baselines = new Map<number, TimelineItem>();
	for (const item of model.items) {
		if (item.kind === "baseline" && item.number !== null && !baselines.has(item.number))
			baselines.set(item.number, item);
	}
	const laneNames: string[] = [];
	const laneRows = new Map<string, Span[][]>();
	const placed: { bar: PlacedBar; lane: string; row: number }[] = [];

	for (const item of model.items) {
		if (item.kind !== "bar" || item.finish === null) continue;
		if (!inRange(item, item.start, item.finish)) continue;

		const x0 = clampX(x(item.start));
		const x1 = clampX(x(item.finish + 1));
		const fill = resolveColor(item.color) ?? FALLBACK_FILL;
		const textFill = resolveColor(item.textColor) ?? contrastText(fill);
		const fit = fitInside(item.title, x1 - x0, opts.barHeight, opts.fontSize);
		let labelAt: PlacedBar["labelAt"] = "inside";
		let lines = fit?.lines ?? [item.title];
		let fontSize = fit?.size ?? opts.fontSize;
		let span: [number, number] = [x0, x1];
		if (!fit) {
			lines = [item.title];
			fontSize = opts.fontSize;
			const tw = measure(item.title, fontSize);
			if (x1 + LABEL_GAP + tw <= plotR) {
				labelAt = "right";
				span = [x0, x1 + LABEL_GAP + tw];
			} else if (x0 - LABEL_GAP - tw >= plotL) {
				labelAt = "left";
				span = [x0 - LABEL_GAP - tw, x1];
			}
		}

		const base = item.number === null ? undefined : baselines.get(item.number);
		let baseline: PlacedBar["baseline"] = null;
		if (base?.finish != null && inRange(base, base.start, base.finish)) {
			const b0 = clampX(x(base.start));
			const b1 = clampX(x(base.finish + 1));
			baseline = { x: b0, w: b1 - b0 };
			span = [Math.min(span[0], b0), Math.max(span[1], b1)];
		}

		const lane = item.lane ?? "";
		if (!laneRows.has(lane)) {
			laneRows.set(lane, []);
			laneNames.push(lane);
		}
		const row = firstFit(laneRows.get(lane) ?? [], span, dayPx * 1.5);
		placed.push({
			bar: {
				id: item.id,
				x: x0,
				y: 0,
				w: x1 - x0,
				h: opts.barHeight,
				fill,
				textFill,
				lines,
				fontSize,
				labelAt,
				baseline,
			},
			lane,
			row,
		});
	}

	// --- lanes: stacked top to bottom in order of first appearance ---
	const lanes: PlacedLane[] = [];
	let cursor = plotY;
	for (const name of laneNames) {
		const rows = Math.max(laneRows.get(name)?.length ?? 1, 1);
		const h = rows * pitch + LANE_PAD * 2 - opts.rowGap + 2;
		lanes.push({ label: name, y: cursor, h, shaded: name !== "" });
		cursor += h + (name === "" ? 0 : 6);
	}
	const plotH = Math.max(cursor - plotY, pitch);
	const bars = placed.map(({ bar, lane, row }) => {
		const laneTop = lanes.find((l) => l.label === lane)?.y ?? plotY;
		return { ...bar, y: laneTop + LANE_PAD + row * pitch };
	});

	// --- vertical bands span the whole plot ---
	const bands: PlacedBand[] = [];
	for (const item of model.items) {
		if (item.kind !== "band" || item.finish === null || !inRange(item, item.start, item.finish))
			continue;
		const x0 = clampX(x(item.start));
		const x1 = clampX(x(item.finish + 1));
		bands.push({
			id: item.id,
			x: x0,
			y: plotY,
			w: x1 - x0,
			h: plotH,
			fill: resolveColor(item.color) ?? "#80C4FF",
			label: item.title,
		});
	}

	const bottomRulerY = plotY + plotH + 1;
	return {
		width: opts.plotWidth + MARGIN * 2,
		height: bottomRulerY + rulerHeight + MARGIN,
		plot: { x: plotL, y: plotY, w: opts.plotWidth, h: plotH },
		months: monthTicks(start, finish, x),
		years: yearTicks(start, finish, x),
		lanes,
		bars,
		lines,
		bands,
		topRulerY,
		bottomRulerY,
		rulerHeight,
		warnings,
	};
}
