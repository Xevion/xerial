import type { GridResult } from "../parser";

const DATE_FMT = "m/d/yyyy";
const TIME_FMT = "h:mm AM/PM";
const HOURS_FMT = "0.##";

/**
 * Write a calendar grid to an .xlsx workbook: a shared date axis across the top
 * and three stacked rows per calendar (Start, End, Total Hours). Dates are Excel
 * serials; Start/End are day-fractions with time formats; Total Hours are plain
 * numbers (0 on non-working days).
 */
export async function gridToXlsx(grid: GridResult): Promise<Blob> {
  // Lazy-loaded: exceljs is large and only needed at export time, so it stays
  // out of the initial bundle and downloads on first export.
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Xerial";
  const ws = wb.addWorksheet("Calendar");

  const FIRST_DATE_COL = 3;
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 12;

  const header = ws.getRow(1);
  header.getCell(1).value = "Calendar Name";
  grid.serials.forEach((serial, i) => {
    const cell = header.getCell(FIRST_DATE_COL + i);
    cell.value = serial;
    cell.numFmt = DATE_FMT;
  });
  header.font = { bold: true };
  header.commit();

  let rowCursor = 2;
  for (const cal of grid.calendars) {
    const startRow = ws.getRow(rowCursor);
    const endRow = ws.getRow(rowCursor + 1);
    const totalRow = ws.getRow(rowCursor + 2);

    startRow.getCell(1).value = cal.name;
    startRow.getCell(2).value = "Start";
    endRow.getCell(2).value = "End";
    totalRow.getCell(2).value = "Total Hours";

    cal.days.forEach((info, i) => {
      const col = FIRST_DATE_COL + i;
      if (info.working) {
        const s = startRow.getCell(col);
        s.value = info.start;
        s.numFmt = TIME_FMT;
        const e = endRow.getCell(col);
        e.value = info.end;
        e.numFmt = TIME_FMT;
      }
      const t = totalRow.getCell(col);
      t.value = info.hours;
      t.numFmt = HOURS_FMT;
    });

    startRow.commit();
    endRow.commit();
    totalRow.commit();

    ws.mergeCells(rowCursor, 1, rowCursor + 2, 1);
    ws.getCell(rowCursor, 1).alignment = { vertical: "top", wrapText: true };
    rowCursor += 3;
  }

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Trigger a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
