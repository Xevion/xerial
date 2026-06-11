import { defineRecipe } from "@pandacss/dev";

/**
 * One button recipe for every surface. The colored variants (`solid`, `onAccent`)
 * carry their own background; the bare ones (`ghost`, `icon`) inherit the
 * surrounding text color and tint their hover from it via `color-mix`, so the
 * same variant reads correctly on the white-on-green ribbon and on the page body
 * without a per-surface override.
 */
export const buttonRecipe = defineRecipe({
	className: "btn",
	description: "Buttons across the ribbon and page surfaces",
	base: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: "0.4rem",
		font: "inherit",
		fontSize: "0.875rem",
		fontWeight: "600",
		lineHeight: 1.2,
		whiteSpace: "nowrap",
		borderRadius: "6px",
		padding: "0.45rem 0.85rem",
		cursor: "pointer",
		border: "1px solid transparent",
		transition: "background 0.12s, border-color 0.12s, color 0.12s",
		_disabled: { opacity: 0.55, cursor: "default", pointerEvents: "none" },
		_focusVisible: { outline: "2px solid token(colors.accent)", outlineOffset: "1px" },
	},
	variants: {
		variant: {
			/** Accent-filled primary action on a neutral (body) surface. */
			solid: {
				bg: "accent",
				color: "#ffffff",
				"&:hover:not(:disabled)": { bg: "accent.strong" },
			},
			/** Bordered secondary action on a neutral surface. */
			subtle: {
				bg: "panel",
				color: "text",
				borderColor: "border",
				"&:hover:not(:disabled)": { bg: "selection", borderColor: "accent" },
			},
			/** White button reading as primary on the green ribbon. */
			onAccent: {
				bg: "btn.primary.bg",
				color: "btn.primary.fg",
				"&:hover:not(:disabled)": { bg: "btn.primary.hoverBg" },
			},
			/** Bare; adopts the surrounding text color on any surface. */
			ghost: {
				bg: "transparent",
				color: "inherit",
				borderColor: "color-mix(in srgb, currentColor 28%, transparent)",
				_hover: { bg: "color-mix(in srgb, currentColor 14%, transparent)" },
			},
			/** Square, label-less ghost — the theme toggle. */
			icon: {
				position: "relative",
				gap: 0,
				width: "2.05rem",
				height: "2.05rem",
				padding: 0,
				bg: "transparent",
				color: "inherit",
				borderColor: "color-mix(in srgb, currentColor 28%, transparent)",
				_hover: { bg: "color-mix(in srgb, currentColor 14%, transparent)" },
			},
		},
	},
	defaultVariants: {
		variant: "solid",
	},
});
