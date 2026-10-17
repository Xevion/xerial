import type { ItemKind, TimelineItem, TimelineModel, TimelineRange } from "./types";

import { dateToSerial, isoToSerial, serial, serialToIso, type Serial } from "../parser";

/**
 * Column order of the schedule table:
 *   Box # | Box Title | Box Color | Text Color | Start | Finish | (Lane)
 * Lane is optional and not in the original sheet.
 */
type Row = readonly unknown[];

/**
 * The sheet encodes a row's type in its "Box #" text rather than a column:
 * "Box 04" is a bar, "V-Bar 01" a milestone line, "V-Curt 01" a curtain band and
 * "Baseline 04" the baseline of Box 04. Keep that convention so existing tables
 * parse unchanged.
 */
const KIND_BY_PREFIX: [RegExp, ItemKind][] = [
	[/^v-?bar/i, "line"],
	[/^v-?curt/i, "band"],
	[/^baseline/i, "baseline"],
];

const text = (v: unknown): string =>
	typeof v === "string" ? v.trim() : v == null ? "" : String(v);

/** Accept an Excel serial, a JS Date, or a "YYYY-MM-DD" string. */
function toSerial(v: unknown): Serial | null {
	if (typeof v === "number" && Number.isFinite(v)) return serial(Math.floor(v));
	if (v instanceof Date) return dateToSerial(v);
	if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) return isoToSerial(v.trim());
	return null;
}

/**
 * Turn the raw table rows into typed items. Rows that can't be drawn are dropped
 * with a warning rather than throwing, so a half-filled table still renders.
 * Pre-numbered empty slots ("Box 16" with nothing else) are silently ignored.
 */
export function parseTimeline(rows: readonly Row[], range: TimelineRange): TimelineModel {
	const items: TimelineItem[] = [];
	const warnings: string[] = [];

	for (const row of rows) {
		const [rawId, rawTitle, rawColor, rawTextColor, rawStart, rawFinish, rawLane] = row;
		const id = text(rawId);
		const title = text(rawTitle);
		const start = toSerial(rawStart);
		const finish = toSerial(rawFinish);
		if (!title && start === null && finish === null) continue;

		const label = id || title;
		const kind = KIND_BY_PREFIX.find(([re]) => re.test(id))?.[1] ?? "bar";
		const number = /(\d+)\s*$/.exec(id)?.[1];

		if (start === null) {
			warnings.push(`${label}: no start date, skipped`);
			continue;
		}
		if (kind !== "line") {
			if (finish === null) {
				warnings.push(`${label}: no finish date, skipped`);
				continue;
			}
			if (finish < start) {
				warnings.push(`${label}: finishes (${serialToIso(finish)}) before it starts, skipped`);
				continue;
			}
		}

		items.push({
			kind,
			id,
			number: number === undefined ? null : Number(number),
			title,
			color: text(rawColor) || null,
			textColor: text(rawTextColor) || null,
			start,
			finish: kind === "line" ? null : finish,
			lane: text(rawLane) || null,
		});
	}

	for (const item of items) {
		if (item.kind !== "baseline") continue;
		const hasParent = items.some((i) => i.kind === "bar" && i.number === item.number);
		if (!hasParent) warnings.push(`${item.id}: no matching bar to sit under, skipped`);
	}

	return { range, items, warnings };
}
