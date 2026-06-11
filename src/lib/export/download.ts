import type { GridResult } from "../parser";
import type { Exporter } from "./types";

/**
 * The slice of the File System Access API we use. It's declared locally rather
 * than relied upon from lib.dom because it's still Chromium-only and absent from
 * some TS DOM lib versions — feature-detected at the call site before use.
 */
interface SaveFilePicker {
	showSaveFilePicker(opts: {
		suggestedName?: string;
		types?: { description?: string; accept: Record<string, string[]> }[];
	}): Promise<FileSystemFileHandleLike>;
}
interface FileSystemFileHandleLike {
	createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

/** Trigger a browser download of a Blob under the given filename (the fallback path). */
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

/**
 * Run an exporter over a grid and save the result as `<baseName>.<ext>`.
 *
 * Where the File System Access API exists (Chromium), this opens the OS "Save"
 * dialog with the name prepopulated so the user picks the destination and final
 * name; cancelling it is a no-op, not an error. Elsewhere (Firefox/Safari) it
 * falls back to an anchor download carrying the same suggested name.
 */
export async function saveExport(
	exporter: Exporter,
	grid: GridResult,
	baseName: string,
): Promise<void> {
	const blob = await exporter.export(grid);
	const filename = `${baseName}.${exporter.ext}`;

	if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
		try {
			const picker = window as unknown as SaveFilePicker;
			const handle = await picker.showSaveFilePicker({
				suggestedName: filename,
				types: [{ description: exporter.label, accept: { [exporter.mime]: [`.${exporter.ext}`] } }],
			});
			const writable = await handle.createWritable();
			await writable.write(blob);
			await writable.close();
			return;
		} catch (e) {
			// The user dismissing the picker is an expected non-result, not a failure.
			if (e instanceof DOMException && e.name === "AbortError") return;
			throw e;
		}
	}

	downloadBlob(blob, filename);
}
