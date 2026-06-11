import type { GridResult } from "../parser";

/**
 * A calendar-grid exporter. The grid model is format-agnostic, so each format
 * (XLSX, CSV, TSV, ...) is just a different `Exporter` over the same data. All
 * exporters resolve to a `Blob` for uniform download handling.
 */
export interface Exporter {
	/** Stable identifier, e.g. "xlsx". */
	readonly id: string;
	/** Human label for a format picker, e.g. "Excel (.xlsx)". */
	readonly label: string;
	/** File extension without the dot, e.g. "csv". */
	readonly ext: string;
	/** MIME type for the produced Blob. */
	readonly mime: string;
	export(grid: GridResult): Promise<Blob>;
}
