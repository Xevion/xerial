import type { ExcelColumnMetadata } from "excel-builder-vanilla";

import type { GridResult } from "../parser";
import type { Exporter } from "./types";

const DATE_FMT = "m/d/yyyy";
const TIME_FMT = "h:mm AM/PM";
const HOURS_FMT = "0.##";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const FIRST_DATE_COL = 3;

/** A cell carrying a value plus a stylesheet format id (excel-builder applies it via `s`). */
function styled(value: number | string, style: number): ExcelColumnMetadata {
	return { value, metadata: { style } };
}

/**
 * Write a calendar grid to an .xlsx workbook: a shared date axis across the top
 * and three stacked rows per calendar (Start, End, Total Hours). Dates are Excel
 * serials; Start/End are day-fractions with time formats; Total Hours are plain
 * numbers (0 on non-working days). Serials and fractions stay plain numbers — the
 * date/time presentation is purely a cell number-format, never a cell type.
 */
async function gridToXlsx(grid: GridResult): Promise<Blob> {
	// Lazy-loaded: the xlsx writer + fflate are only needed at export time, so they
	// stay out of the initial bundle and download on first export.
	const { Workbook, createExcelFile } = await import("excel-builder-vanilla");
	const wb = new Workbook();
	const ws = wb.createWorksheet({ name: "Calendar" });

	// excel-builder styles are pre-registered in the stylesheet and referenced by
	// id per cell, so define each combination once up front.
	const styles = wb.getStyleSheet();
	const headerLabelStyle = styles.createFormat({ font: { bold: true } }).id;
	const headerDateStyle = styles.createFormat({ font: { bold: true }, format: DATE_FMT }).id;
	const nameCellStyle = styles.createFormat({ alignment: { vertical: "top", wrapText: true } }).id;
	const timeStyle = styles.createFormat({ format: TIME_FMT }).id;
	const hoursStyle = styles.createFormat({ format: HOURS_FMT }).id;

	ws.setColumns([{ width: 42 }, { width: 12 }]);

	const data: (number | string | ExcelColumnMetadata)[][] = [];

	const header: (number | string | ExcelColumnMetadata)[] = [
		styled("Calendar Name", headerLabelStyle),
		"",
	];
	grid.serials.forEach((serial) => header.push(styled(serial, headerDateStyle)));
	data.push(header);

	const merges: [string, string][] = [];
	for (const cal of grid.calendars) {
		// 1-based Excel row of this calendar's first (Start) row, given the header at row 1.
		const startExcelRow = data.length + 1;

		const startRow: (number | string | ExcelColumnMetadata)[] = [
			styled(cal.name, nameCellStyle),
			"Start",
		];
		const endRow: (number | string | ExcelColumnMetadata)[] = ["", "End"];
		const totalRow: (number | string | ExcelColumnMetadata)[] = ["", "Total Hours"];

		for (const info of cal.days) {
			if (info.working && info.start !== null && info.end !== null) {
				startRow.push(styled(info.start, timeStyle));
				endRow.push(styled(info.end, timeStyle));
			} else {
				// Empty placeholders keep working days in their correct columns.
				startRow.push("");
				endRow.push("");
			}
			totalRow.push(styled(info.hours, hoursStyle));
		}

		data.push(startRow, endRow, totalRow);
		merges.push([`A${startExcelRow}`, `A${startExcelRow + 2}`]);
	}

	ws.setData(data);
	for (const [from, to] of merges) ws.mergeCells(from, to);

	// Freeze the header row and the first two columns. The worksheet/sheetView
	// freezePane helpers set the pane state without populating `_freezePane`,
	// which makes pane export throw; drive the pane directly so both are set.
	ws.sheetView.pane.freezePane(FIRST_DATE_COL - 1, 1, "C2");
	ws.sheetView.pane.state = "frozen";

	wb.addWorksheet(ws);

	return createExcelFile(wb, "Blob", { mimeType: XLSX_MIME });
}

export const xlsxExporter: Exporter = {
	id: "xlsx",
	label: "Excel (.xlsx)",
	ext: "xlsx",
	mime: XLSX_MIME,
	export: gridToXlsx,
};
