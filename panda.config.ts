import { defineConfig } from "@pandacss/dev";

import { buttonRecipe } from "./src/lib/recipes/button";
import { datePickerRecipe } from "./src/lib/recipes/datePicker";
import { menuRecipe } from "./src/lib/recipes/menu";

export default defineConfig({
	preflight: true,

	include: ["./src/**/*.{js,ts,svelte}"],
	exclude: [],

	outdir: "styled-system",
	jsxFramework: undefined,

	// Emit every button variant; the theme-toggle `icon` is only referenced
	// through the recipe and would otherwise be tree-shaken out.
	staticCss: {
		recipes: { button: ["*"] },
	},

	theme: {
		extend: {
			recipes: {
				button: buttonRecipe,
			},

			slotRecipes: {
				menu: menuRecipe,
				datePicker: datePickerRecipe,
			},

			keyframes: {
				spin: { to: { transform: "rotate(360deg)" } },
				// Popover/menu entrance & exit, anchored to Ark's --transform-origin.
				popIn: {
					from: { opacity: 0, transform: "scale(0.96) translateY(-4px)" },
					to: { opacity: 1, transform: "scale(1) translateY(0)" },
				},
				popOut: {
					from: { opacity: 1, transform: "scale(1) translateY(0)" },
					to: { opacity: 0, transform: "scale(0.96) translateY(-4px)" },
				},
			},

			tokens: {
				colors: {
					// Branded Excel green, reused across light/dark accents.
					green: {
						DEFAULT: { value: "#217346" },
						strong: { value: "#1a5c38" },
						bright: { value: "#3aa76d" },
						brightStrong: { value: "#2f8f5b" },
						bar: { value: "#1f6b41" },
					},
				},
			},

			// Light and dark sit on one line per role — edit the pair side by side.
			semanticTokens: {
				colors: {
					bg: { value: { base: "#fafafa", _dark: "#18181a" } },
					panel: { value: { base: "#ffffff", _dark: "#1f1f22" } },
					text: { value: { base: "#1f1f1f", _dark: "#e6e6e6" } },
					muted: { value: { base: "#6b6b6b", _dark: "#9b9b9b" } },
					border: { value: { base: "#e2e2e2", _dark: "#34343a" } },
					selection: { value: { base: "#e8f2ec", _dark: "#233029" } },

					accent: {
						DEFAULT: { value: { base: "{colors.green}", _dark: "{colors.green.bright}" } },
						strong: {
							value: { base: "{colors.green.strong}", _dark: "{colors.green.brightStrong}" },
						},
					},

					topbar: {
						bg: { value: { base: "{colors.green}", _dark: "{colors.green.bar}" } },
						fg: { value: { base: "#ffffff", _dark: "#ffffff" } },
					},

					grid: {
						line: { value: { base: "#d4d4d4", _dark: "#3a3a3a" } },
						headerBg: { value: { base: "#f3f3f3", _dark: "#2a2a2c" } },
						headerFg: { value: { base: "#444444", _dark: "#c2c2c2" } },
						rownumBg: { value: { base: "#f3f3f3", _dark: "#2a2a2c" } },
						weekend: { value: { base: "#f7f7f7", _dark: "#202024" } },
						numOff: { value: { base: "#c4c4c4", _dark: "#555558" } },
					},

					danger: { value: { base: "#b3261e", _dark: "#f2756b" } },
					warn: { value: { base: "#8a6d00", _dark: "#d9b54a" } },

					// White button on the green bar; identical in both schemes.
					btn: {
						primary: {
							bg: { value: { base: "#ffffff", _dark: "#ffffff" } },
							fg: { value: { base: "{colors.green.strong}", _dark: "{colors.green.strong}" } },
							hoverBg: { value: { base: "#eef6f1", _dark: "#eef6f1" } },
						},
					},
				},
				shadows: {
					topbar: {
						value: { base: "0 1px 3px rgba(0, 0, 0, 0.15)", _dark: "0 1px 3px rgba(0, 0, 0, 0.5)" },
					},
					card: {
						value: {
							base: "0 10px 30px rgba(0, 0, 0, 0.10)",
							_dark: "0 14px 34px rgba(0, 0, 0, 0.45)",
						},
					},
					menu: {
						value: {
							base: "0 8px 24px rgba(0, 0, 0, 0.14)",
							_dark: "0 8px 24px rgba(0, 0, 0, 0.5)",
						},
					},
				},
			},
		},
	},

	globalCss: {
		"html, body": { margin: 0, height: "100%" },
		// Honor a user's reduced-motion preference: collapse animations/transitions.
		"@media (prefers-reduced-motion: reduce)": {
			"*, *::before, *::after": {
				animationDuration: "0.01ms !important",
				animationIterationCount: "1 !important",
				transitionDuration: "0.01ms !important",
			},
		},
		// Pin the native UA color scheme to the active theme so scrollbars and form
		// controls render dark under `.dark`, not just the tokenized chrome. The
		// `dark` class lives on <html> itself, so the `_dark` condition (`.dark &`,
		// a descendant) would never match it — these selectors target it directly.
		html: { colorScheme: "light" },
		".dark": { colorScheme: "dark" },
		// SvelteKit wraps the app body in a `display: contents` div, so the page's
		// <header>/<main> become direct flex children of <body>.
		body: {
			display: "flex",
			flexDirection: "column",
			minHeight: "100vh",
			backgroundColor: "bg",
			color: "text",
			fontFamily: '"Segoe UI", Calibri, system-ui, -apple-system, sans-serif',
		},

		// The calendar grid is a dense, structurally-selected table; its rules stay
		// global (keyed off semantic class names) rather than per-cell css() calls.
		".grid-wrap": {
			flex: 1,
			minHeight: 0,
			overflow: "auto",
			border: "1px solid token(colors.grid.line)",
			borderRadius: "6px",
			backgroundColor: "panel",
		},
		"table.grid": {
			// Fixed layout skips the per-cell measurement pass auto layout does across
			// the whole (very wide) table, and pins every date column to one uniform
			// width that the virtualizer measures to map scroll offset to a column range.
			tableLayout: "fixed",
			// Size to the sum of column widths — including the giant off-screen spacer
			// cells — so the scroll extent spans the full date range. Without this a
			// fixed-layout table shrinks to its container and collapses the spacers to
			// zero, ending the scroll far short of the last column.
			width: "max-content",
			borderCollapse: "separate",
			borderSpacing: 0,
			fontSize: "0.82rem",
			fontVariantNumeric: "tabular-nums",
			whiteSpace: "nowrap",
		},
		// Off-screen columns collapse into a single zero-content cell per row that just
		// reserves their width, so the table keeps its full scroll extent.
		".c-spacer": { padding: 0, border: "none" },
		"table.grid th, table.grid td": {
			borderRight: "1px solid token(colors.grid.line)",
			borderBottom: "1px solid token(colors.grid.line)",
			padding: "0.2rem 0.5rem",
			textAlign: "right",
		},
		"table.grid thead th": {
			position: "sticky",
			top: 0,
			zIndex: 2,
			backgroundColor: "grid.headerBg",
			color: "grid.headerFg",
			fontWeight: 600,
			borderBottom: "2px solid token(colors.grid.line)",
		},
		".c-date": { textAlign: "center", width: "4.6rem" },
		".c-date .d-date": { display: "block", fontWeight: 600 },
		".c-date .d-wd": {
			display: "block",
			fontWeight: 400,
			fontSize: "0.72rem",
			color: "muted",
		},
		".c-name": {
			position: "sticky",
			left: 0,
			zIndex: 1,
			backgroundColor: "grid.rownumBg",
			textAlign: "left",
			fontWeight: 600,
			width: "12rem",
			minWidth: "12rem",
			whiteSpace: "normal",
			verticalAlign: "top",
		},
		// Second frozen column sits immediately right of the 12rem name column.
		".c-label": {
			position: "sticky",
			left: "12rem",
			zIndex: 1,
			backgroundColor: "grid.rownumBg",
			color: "muted",
			textAlign: "left",
			fontWeight: 600,
			width: "6rem",
			minWidth: "6rem",
		},
		"table.grid thead .c-name, table.grid thead .c-label": { zIndex: 3 },
		// The frozen top-left corner reads as part of the header strip, with a thin
		// accent rule echoing the ribbon — Excel's "select all" corner.
		".c-corner": {
			backgroundColor: "grid.headerBg",
			boxShadow: "inset 0 -2px 0 token(colors.accent)",
		},
		".num.off": { color: "grid.numOff" },
		"td.weekend": { backgroundColor: "grid.weekend" },
		".r-total .num": { fontWeight: 600 },
		"table.grid tbody tr:hover td.num": { backgroundColor: "selection" },
	},
});
