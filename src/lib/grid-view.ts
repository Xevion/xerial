/**
 * A neutral view model for the calendar grid, so one virtualized renderer
 * (`CalendarGrid`) draws both the single-file grid and the two-file diff overlay.
 * Each mode supplies an adapter that maps its data onto the same row/cell shape;
 * the component stays ignorant of which it's showing beyond the `diff` flag.
 */

import { formatHours } from "$lib/export";

import type { DayFraction, DayInfo, GridDiff, GridResult, Serial } from "./parser";

/** One day of one row. `null` means no data for that date (e.g. an added calendar's baseline). */
interface GridViewCell {
	start: DayFraction | null;
	end: DayFraction | null;
	hours: number;
	working: boolean;
	/** Diff-only: this day differs between the two files. */
	changed: boolean;
	/** Optional hover note, e.g. "8h → 4h". */
	title?: string | undefined;
}

interface GridViewRow {
	clndrId: string;
	name: string;
	/** Diff-only: the calendar's fate, driving the name bar and row tint. */
	state?: "added" | "removed" | "modified" | undefined;
	/** Aligned 1:1 with `serials`. */
	cells: (GridViewCell | null)[];
}

export interface GridView {
	serials: Serial[];
	rows: GridViewRow[];
	/** When true, the renderer enables diff styling (neutral hover, change marks). */
	diff: boolean;
}

/** Adapt a single-file grid: every cell present, nothing marked changed. */
export function gridToView(grid: GridResult): GridView {
	return {
		serials: grid.serials,
		diff: false,
		rows: grid.calendars.map((cal) => ({
			clndrId: cal.clndrId,
			name: cal.name,
			cells: cal.days.map((d) => ({
				start: d.start,
				end: d.end,
				hours: d.hours,
				working: d.working,
				changed: false,
			})),
		})),
	};
}

/** Hover note for a changed cell; describes the transition the diff colors hint at. */
function changeTitle(before: DayInfo | null, after: DayInfo | null): string | undefined {
	if (!before) return "added in revised";
	if (!after) return "removed in revised";
	if (before.hours !== after.hours)
		return `${formatHours(before.hours)}h → ${formatHours(after.hours)}h`;
	return "schedule changed";
}

/** Adapt a diff: show the revised side (falling back to baseline), mark changes. */
export function diffToView(diff: GridDiff): GridView {
	return {
		serials: diff.serials,
		diff: true,
		rows: diff.calendars.map((cal) => ({
			clndrId: cal.clndrId,
			name: cal.name,
			state: cal.kind === "unchanged" ? undefined : cal.kind,
			cells: cal.days.map((d) => {
				const shown = d.after ?? d.before;
				if (!shown) return null;
				const changed = d.kind === "changed";
				return {
					start: shown.start,
					end: shown.end,
					hours: shown.hours,
					working: shown.working,
					changed,
					title: changed ? changeTitle(d.before, d.after) : undefined,
				};
			}),
		})),
	};
}
