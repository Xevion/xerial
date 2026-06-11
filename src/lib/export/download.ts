import type { GridResult } from "../parser";
import type { Exporter } from "./types";

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

/** Run an exporter over a grid and download the result as `<baseName>.<ext>`. */
export async function saveExport(
	exporter: Exporter,
	grid: GridResult,
	baseName: string,
): Promise<void> {
	const blob = await exporter.export(grid);
	downloadBlob(blob, `${baseName}.${exporter.ext}`);
}
