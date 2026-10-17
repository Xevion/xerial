/**
 * Color names as the schedule table spells them, resolved to hex. The values are
 * the ones the table's own cells (and the hand-drawn shapes) use, so an automated
 * chart matches what the author already sees in the "Box Color" column.
 */
const NAMED: Record<string, string> = {
	yellow: "#FFFF00",
	red: "#C00000",
	medblue: "#0070C0",
	mediumblue: "#0070C0",
	darkblue: "#002060",
	lightblue: "#80C4FF",
	green: "#84E291",
	lightgreen: "#84E291",
	orange: "#ED7D31",
	grey: "#808080",
	gray: "#808080",
	black: "#000000",
	white: "#FFFFFF",
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Resolve a color name ("Med Blue") or hex ("#0070C0", "0070C0") to `#RRGGBB`; null when unknown. */
export function resolveColor(raw: string | null): string | null {
	if (raw === null) return null;
	const key = raw
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, "");
	const named = NAMED[key];
	if (named) return named;
	const hex = HEX.exec(raw.trim());
	if (!hex?.[1]) return null;
	const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
	return `#${digits.toUpperCase()}`;
}

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function contrastText(hex: string): string {
	const channel = (i: number) => {
		const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
	return luminance > 0.4 ? "#000000" : "#FFFFFF";
}
