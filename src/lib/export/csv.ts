import type { GridResult } from "../parser";
import type { Exporter } from "./types";

import { gridToMatrix } from "./matrix";

/** Quote a field per RFC 4180 when it contains a comma, quote, or newline. */
function csvField(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(grid: GridResult): string {
	return gridToMatrix(grid)
		.map((row) => row.map(csvField).join(","))
		.join("\r\n");
}

export const csvExporter: Exporter = {
	id: "csv",
	label: "CSV (.csv)",
	ext: "csv",
	mime: "text/csv;charset=utf-8",
	export(grid) {
		return Promise.resolve(new Blob([toCsv(grid)], { type: this.mime }));
	},
};
