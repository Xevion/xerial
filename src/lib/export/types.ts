import type { GridDiff, GridResult } from "../parser";

/**
 * A format renderer over some data model. Each output format (XLSX, CSV, TSV, …)
 * is one `ExportFormat` resolving to a `Blob` for uniform download handling. The
 * grid and the diff are different inputs, so they get distinct format families
 * over the same shape.
 */
export interface ExportFormat<T> {
	/** Stable identifier, e.g. "xlsx". */
	readonly id: string;
	/** Human label for a format picker, e.g. "Excel (.xlsx)". */
	readonly label: string;
	/** File extension without the dot, e.g. "csv". */
	readonly ext: string;
	/** MIME type for the produced Blob. */
	readonly mime: string;
	export(data: T): Promise<Blob>;
}

/** Exports the full day-by-day calendar grid. */
export type Exporter = ExportFormat<GridResult>;

/** Exports a two-file comparison as a change report. */
export type DiffExporter = ExportFormat<GridDiff>;
