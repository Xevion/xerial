import type { GridResult } from "../parser";
import type { Exporter } from "./types";

import { gridToMatrix } from "./matrix";

/** TSV has no quoting; collapse embedded tabs/newlines to spaces to stay aligned. */
function tsvField(value: string): string {
	return value.replace(/[\t\r\n]+/g, " ");
}

function toTsv(grid: GridResult): string {
	return gridToMatrix(grid)
		.map((row) => row.map(tsvField).join("\t"))
		.join("\r\n");
}

export const tsvExporter: Exporter = {
	id: "tsv",
	label: "TSV (.tsv)",
	ext: "tsv",
	mime: "text/tab-separated-values;charset=utf-8",
	export(grid) {
		return Promise.resolve(new Blob([toTsv(grid)], { type: this.mime }));
	},
};
