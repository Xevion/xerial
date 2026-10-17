import type { Tick, TimelineLayout } from "./types";

const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";
const INK = "#222222";
const RULE = "#4A4A4A";
const LANE_FILL = "#F2F2F2";
const GRID = "#D9D9D9";

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => Math.round(v * 100) / 100;

export interface SvgOptions {
	fontSize?: number;
	/** Heading drawn above the chart (the "Schedule – Scenario for Review" title). */
	title?: string;
}

/** One ruler strip: cells with a border and a centred label. */
function strip(ticks: Tick[], y: number, h: number, fontSize: number, bold: boolean): string {
	return ticks
		.map(
			(t) =>
				`<rect x="${n(t.x)}" y="${y}" width="${n(t.w)}" height="${h}" fill="#FFFFFF" stroke="${RULE}" stroke-width="0.75"/>` +
				`<text x="${n(t.x + t.w / 2)}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="${bold ? 700 : 500}">${esc(t.label)}</text>`,
		)
		.join("");
}

/** Render a computed layout as a standalone SVG document string. */
export function renderTimelineSvg(layout: TimelineLayout, options: SvgOptions = {}): string {
	const fs = options.fontSize ?? 10;
	const titleH = options.title ? 34 : 0;
	const { plot, rulerHeight: rh } = layout;
	const half = rh / 2;
	const parts: string[] = [];

	parts.push(`<rect width="${layout.width}" height="${layout.height + titleH}" fill="#FFFFFF"/>`);
	if (options.title)
		parts.push(
			`<text x="${layout.width / 2}" y="${titleH - 10}" text-anchor="middle" font-size="22" font-weight="700">${esc(options.title)}</text>`,
		);
	parts.push(`<g transform="translate(0 ${titleH})">`);

	for (const lane of layout.lanes) {
		if (!lane.shaded) continue;
		parts.push(
			`<rect x="${plot.x}" y="${lane.y}" width="${plot.w}" height="${lane.h}" fill="${LANE_FILL}"/>`,
			...(lane.label
				? [
						`<text x="${plot.x + 4}" y="${lane.y + 10}" font-size="${fs - 1}" fill="#808080">${esc(lane.label)}</text>`,
					]
				: []),
		);
	}

	// Month gridlines, with year boundaries drawn heavier.
	for (const m of layout.months)
		parts.push(
			`<line x1="${n(m.x)}" x2="${n(m.x)}" y1="${plot.y}" y2="${plot.y + plot.h}" stroke="${GRID}" stroke-width="0.5"/>`,
		);
	for (const y of layout.years.slice(1))
		parts.push(
			`<line x1="${n(y.x)}" x2="${n(y.x)}" y1="${plot.y}" y2="${plot.y + plot.h}" stroke="${RULE}" stroke-width="1"/>`,
		);

	for (const b of layout.bands)
		parts.push(
			`<rect x="${n(b.x)}" y="${b.y}" width="${n(b.w)}" height="${b.h}" fill="${b.fill}" fill-opacity="0.35" stroke="${b.fill}" stroke-opacity="0.8"/>`,
			`<text transform="translate(${n(b.x + b.w / 2)} ${n(b.y + b.h / 2)}) rotate(-90)" text-anchor="middle" dominant-baseline="central" font-size="${fs + 4}" fill="${INK}">${esc(b.label)}</text>`,
		);

	for (const bar of layout.bars) {
		parts.push(
			`<rect x="${n(bar.x)}" y="${n(bar.y)}" width="${n(bar.w)}" height="${bar.h}" fill="${bar.fill}" stroke="#FFFFFF" stroke-width="0.5"><title>${esc(bar.lines.join(" "))}</title></rect>`,
		);
		if (bar.baseline)
			parts.push(
				`<rect x="${n(bar.baseline.x)}" y="${n(bar.y + bar.h + 1)}" width="${n(bar.baseline.w)}" height="4" fill="#FFFF99" stroke="${INK}" stroke-width="0.5"/>`,
			);
		const cy = bar.y + bar.h / 2;
		const inside = bar.labelAt === "inside";
		const tx = inside ? bar.x + bar.w / 2 : bar.labelAt === "right" ? bar.x + bar.w + 4 : bar.x - 4;
		const anchor = inside ? "middle" : bar.labelAt === "right" ? "start" : "end";
		const step = bar.fontSize * 1.15;
		bar.lines.forEach((text, i) => {
			const y = cy + (i - (bar.lines.length - 1) / 2) * step;
			parts.push(
				`<text x="${n(tx)}" y="${n(y)}" text-anchor="${anchor}" dominant-baseline="central" font-size="${bar.fontSize}" fill="${inside ? bar.textFill : INK}">${esc(text)}</text>`,
			);
		});
	}

	for (const line of layout.lines) {
		const f = line.flag;
		parts.push(
			`<line x1="${n(line.x)}" x2="${n(line.x)}" y1="${n(f.y + f.h)}" y2="${plot.y + plot.h}" stroke="${line.color}" stroke-width="1.25" stroke-dasharray="5 3"/>`,
			`<rect x="${n(f.x)}" y="${n(f.y)}" width="${n(f.w)}" height="${f.h}" fill="${line.color}"/>`,
			`<text x="${n(f.x + f.w / 2)}" y="${n(f.y + f.h / 2)}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="700" fill="${line.textFill}">${esc(line.label)}</text>`,
		);
	}

	// Rulers on both edges: year over month on top, month over year underneath.
	parts.push(
		strip(layout.years, layout.topRulerY, half, fs + 1, true),
		strip(layout.months, layout.topRulerY + half, half, fs, false),
		strip(layout.months, layout.bottomRulerY, half, fs, false),
		strip(layout.years, layout.bottomRulerY + half, half, fs + 1, true),
		"</g>",
	);

	const h = layout.height + titleH;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${h}" viewBox="0 0 ${layout.width} ${h}" font-family="${FONT}" role="img">` +
		`<title>${esc(options.title ?? "Schedule")}</title>${parts.join("")}</svg>`
	);
}
