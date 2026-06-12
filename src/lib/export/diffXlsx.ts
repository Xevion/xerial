import type { ExcelColumnMetadata } from "excel-builder-vanilla";

import type { GridDiff } from "../parser";
import type { DiffExporter } from "./types";

import { diffToMatrix } from "./diffReport";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Write the change report to an .xlsx workbook: a bold header row over the flat
 * `Calendar, Day, Before, After` matrix, with the header frozen. Values are plain
 * strings — this is a human-readable diff, not a recalculating sheet.
 */
async function diffToXlsx(diff: GridDiff): Promise<Blob> {
	// Lazy-loaded so the xlsx writer + fflate stay out of the initial bundle.
	const { Workbook, createExcelFile } = await import("excel-builder-vanilla");
	const wb = new Workbook();
	const ws = wb.createWorksheet({ name: "Changes" });

	const styles = wb.getStyleSheet();
	const headerStyle = styles.createFormat({ font: { bold: true } }).id;

	ws.setColumns([{ width: 32 }, { width: 16 }, { width: 14 }, { width: 14 }]);

	const matrix = diffToMatrix(diff);
	const data: (string | ExcelColumnMetadata)[][] = matrix.map((row, i) =>
		i === 0 ? row.map((cell) => ({ value: cell, metadata: { style: headerStyle } })) : row,
	);
	ws.setData(data);

	// Freeze the header row (same direct-pane approach the grid exporter uses).
	ws.sheetView.pane.freezePane(0, 1, "A2");
	ws.sheetView.pane.state = "frozen";

	wb.addWorksheet(ws);
	return createExcelFile(wb, "Blob", { mimeType: XLSX_MIME });
}

export const diffXlsxExporter: DiffExporter = {
	id: "diff-xlsx",
	label: "Change report (.xlsx)",
	ext: "xlsx",
	mime: XLSX_MIME,
	export: diffToXlsx,
};
