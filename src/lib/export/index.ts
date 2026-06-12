/**
 * Export layer: format-specific renderers over the parser's format-agnostic grid,
 * plus the presentation helpers the UI shares with them. The parser core knows
 * nothing about any of this.
 */

import type { DiffExporter, Exporter } from "./types";

import { csvExporter } from "./csv";
import { diffCsvExporter } from "./diffCsv";
import { diffXlsxExporter } from "./diffXlsx";
import { tsvExporter } from "./tsv";
import { xlsxExporter } from "./xlsx";

export { downloadBlob, saveExport } from "./download";
export { formatDate, formatDayLabel, formatHours, formatTime, weekdayLabel } from "./format";
export { gridToMatrix } from "./matrix";
export { summarizeDiff, diffToMatrix, type CalendarSummary, type ChangeLine } from "./diffReport";
export { csvExporter } from "./csv";
export { tsvExporter } from "./tsv";
export { xlsxExporter } from "./xlsx";
export { diffCsvExporter } from "./diffCsv";
export { diffXlsxExporter } from "./diffXlsx";
export type { DiffExporter, ExportFormat, Exporter } from "./types";

/** Grid exporters, in the order a format picker should present them. */
export const exporters: Exporter[] = [xlsxExporter, csvExporter, tsvExporter];

/** Diff (change-report) exporters, in picker order. */
export const diffExporters: DiffExporter[] = [diffXlsxExporter, diffCsvExporter];
