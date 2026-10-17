/**
 * Schedule timeline ("bar chart") generator: turn a Box table — id, title,
 * colors, start, finish — into a dated chart. Pure data-in, SVG-out; no DOM.
 *
 *   parseTimeline(rows, range) -> TimelineModel     (what to draw, plus warnings)
 *   layoutTimeline(model)      -> TimelineLayout    (where to draw it)
 *   renderTimelineSvg(layout)  -> string            (the picture)
 */

export { DEFAULT_OPTIONS, layoutTimeline } from "./layout";
export { contrastText, resolveColor } from "./palette";
export { parseTimeline } from "./parse";
export { renderTimelineSvg, type SvgOptions } from "./svg";
export type {
	ItemKind,
	LayoutOptions,
	PlacedBand,
	PlacedBar,
	PlacedLine,
	TimelineItem,
	TimelineLayout,
	TimelineModel,
	TimelineRange,
} from "./types";
