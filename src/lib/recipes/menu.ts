import { menuAnatomy } from "@ark-ui/svelte/anatomy";

import { defineSlotRecipe } from "@pandacss/dev";

/**
 * Dropdown chrome for Ark UI's Menu. Only the floating parts are styled here; the
 * trigger keeps the shared `button` recipe via the part's `asChild` snippet, so a
 * menu trigger reads identically to any other button on its surface.
 *
 * Ark drives focus with `data-highlighted` (keyboard *and* pointer), so the row
 * highlight keys off `_highlighted` rather than `_hover` — that keeps the
 * arrow-key selection and mouse hover visually identical.
 */
export const menuRecipe = defineSlotRecipe({
	className: "menu",
	description: "Ark Menu dropdown surface",
	slots: menuAnatomy.keys(),
	base: {
		content: {
			zIndex: 20,
			minWidth: "12rem",
			padding: "0.3rem",
			bg: "panel",
			color: "text",
			border: "1px solid token(colors.border)",
			borderRadius: "8px",
			boxShadow: "menu",
			_focusVisible: { outline: "none" },
		},
		item: {
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: "1rem",
			width: "100%",
			paddingBlock: "0.4rem",
			paddingInline: "0.55rem",
			borderRadius: "5px",
			fontSize: "0.875rem",
			textAlign: "left",
			cursor: "pointer",
			_highlighted: { bg: "selection" },
		},
	},
});
