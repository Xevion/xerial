import type { GridResult } from "../parser";

import { formatDate, formatHours, formatTime } from "./format";

/**
 * Flatten a grid into a row/column matrix of display strings: a shared date axis
 * across the top, then three stacked rows per calendar (Start, End, Total Hours).
 * Text exporters (CSV, TSV) serialize this directly; the XLSX exporter writes raw
 * values with number formats instead.
 */
export function gridToMatrix(grid: GridResult): string[][] {
	const rows: string[][] = [["Calendar Name", "", ...grid.serials.map(formatDate)]];

	for (const cal of grid.calendars) {
		rows.push([
			cal.name,
			"Start",
			...cal.days.map((d) => (d.start !== null ? formatTime(d.start) : "")),
		]);
		rows.push(["", "End", ...cal.days.map((d) => (d.end !== null ? formatTime(d.end) : ""))]);
		rows.push(["", "Total Hours", ...cal.days.map((d) => formatHours(d.hours))]);
	}

	return rows;
}
