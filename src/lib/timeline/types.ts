import type { Serial } from "../parser";

/**
 * What a table row draws:
 *   bar      — a horizontal box spanning start..finish
 *   baseline — a thin strip under the bar with the same number (original plan)
 *   line     — a dashed vertical milestone at `start`, flagged with its title
 *   band     — a translucent vertical curtain spanning start..finish
 */
export type ItemKind = "bar" | "baseline" | "line" | "band";

/** One populated row of the schedule table. */
export interface TimelineItem {
	kind: ItemKind;
	/** The id as displayed in the "Box #" column, e.g. "Box 04" or "V-Bar 01". */
	id: string;
	/** Trailing number of the id; a baseline points at the bar with the same one. */
	number: number | null;
	title: string;
	/** Raw color name or hex as typed in the table. */
	color: string | null;
	textColor: string | null;
	start: Serial;
	/** Absent for `line` items, which are a single date. */
	finish: Serial | null;
	/** Optional swim-lane (e.g. "Building 1"); items sharing one stack together. */
	lane: string | null;
}

/** The inclusive date window the chart covers (the "Schedule Parameters"). */
export interface TimelineRange {
	start: Serial;
	finish: Serial;
}

export interface TimelineModel {
	range: TimelineRange;
	items: TimelineItem[];
	/** Rows that were skipped or adjusted, phrased for the person who owns the table. */
	warnings: string[];
}

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PlacedBar extends Box {
	id: string;
	fill: string;
	textFill: string;
	/** Title split into the lines to draw (one, or two when wrapped inside a short bar). */
	lines: string[];
	fontSize: number;
	/** Where the title sits: inside the bar, or spilling out to one side when it won't fit. */
	labelAt: "inside" | "right" | "left";
	baseline: { x: number; w: number } | null;
}

export interface PlacedLine {
	id: string;
	x: number;
	color: string;
	label: string;
	/** Flag box above the plot; stacked in tiers so neighboring flags don't collide. */
	flag: Box;
	textFill: string;
}

export interface PlacedBand extends Box {
	id: string;
	fill: string;
	label: string;
}

export interface Tick {
	x: number;
	w: number;
	label: string;
}

export interface PlacedLane {
	label: string;
	y: number;
	h: number;
	shaded: boolean;
}

export interface TimelineLayout {
	width: number;
	height: number;
	plot: Box;
	months: Tick[];
	years: Tick[];
	lanes: PlacedLane[];
	bars: PlacedBar[];
	lines: PlacedLine[];
	bands: PlacedBand[];
	/** Y of the top ruler and bottom ruler, both `rulerHeight` tall. */
	topRulerY: number;
	bottomRulerY: number;
	rulerHeight: number;
	/** Parse warnings plus anything layout had to drop (e.g. outside the window). */
	warnings: string[];
}

export interface LayoutOptions {
	/** Width of the date axis in px. Everything else is derived from it. */
	plotWidth: number;
	barHeight: number;
	/** Vertical gap between stacked bars; the baseline strip lives in it. */
	rowGap: number;
	fontSize: number;
}
