import type { GridDiff } from "../parser";
import type { DiffExporter } from "./types";

import { csvField } from "./csv";
import { diffToMatrix } from "./diffReport";

function toCsv(diff: GridDiff): string {
	return diffToMatrix(diff)
		.map((row) => row.map(csvField).join(","))
		.join("\r\n");
}

export const diffCsvExporter: DiffExporter = {
	id: "diff-csv",
	label: "Change report (.csv)",
	ext: "csv",
	mime: "text/csv;charset=utf-8",
	export(diff) {
		return Promise.resolve(new Blob([toCsv(diff)], { type: this.mime }));
	},
};
