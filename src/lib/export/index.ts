/**
 * Export layer: format-specific renderers over the parser's format-agnostic grid,
 * plus the presentation helpers the UI shares with them. The parser core knows
 * nothing about any of this.
 */

import type { Exporter } from "./types";

import { csvExporter } from "./csv";
import { tsvExporter } from "./tsv";
import { xlsxExporter } from "./xlsx";

export { downloadBlob, saveExport } from "./download";
export { formatDate, formatHours, formatTime, weekdayLabel } from "./format";
export { gridToMatrix } from "./matrix";
export { csvExporter } from "./csv";
export { tsvExporter } from "./tsv";
export { xlsxExporter } from "./xlsx";
export type { Exporter } from "./types";

/** All available exporters, in the order a format picker should present them. */
export const exporters: Exporter[] = [xlsxExporter, csvExporter, tsvExporter];
