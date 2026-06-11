import { defineRecipe } from "@pandacss/dev";

/**
 * Topbar buttons. `primary`/`ghost` ride on the green topbar (their colors are
 * fixed, not theme-reactive); `icon` is the square, label-less theme toggle.
 */
export const buttonRecipe = defineRecipe({
	className: "btn",
	description: "Topbar action buttons",
	base: {
		font: "inherit",
		fontSize: "0.9rem",
		fontWeight: "600",
		borderRadius: "5px",
		padding: "0.45rem 0.9rem",
		cursor: "pointer",
		border: "1px solid transparent",
		transition: "background 0.12s, border-color 0.12s",
		_disabled: { opacity: 0.6, cursor: "default" },
	},
	variants: {
		variant: {
			primary: {
				bg: "btn.primary.bg",
				color: "btn.primary.fg",
				"&:hover:not(:disabled)": { bg: "btn.primary.hoverBg" },
			},
			ghost: {
				bg: "transparent",
				color: "topbar.fg",
				borderColor: "rgba(255, 255, 255, 0.4)",
				_hover: { bg: "rgba(255, 255, 255, 0.12)" },
			},
			icon: {
				position: "relative",
				display: "grid",
				placeItems: "center",
				width: "2.05rem",
				height: "2.05rem",
				padding: 0,
				lineHeight: "0",
				bg: "transparent",
				color: "topbar.fg",
				borderColor: "rgba(255, 255, 255, 0.4)",
				_hover: { bg: "rgba(255, 255, 255, 0.12)" },
			},
		},
	},
	defaultVariants: {
		variant: "primary",
	},
});
