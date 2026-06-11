<script lang="ts">
	import type { Snippet } from "svelte";

	import { css } from "styled-system/css";

	let { actions }: { actions?: Snippet } = $props();

	const styles = {
		bar: css({
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "1rem",
			paddingBlock: "0.5rem",
			paddingInline: "1rem",
			bg: "topbar.bg",
			color: "topbar.fg",
			boxShadow: "topbar",
		}),
		brand: css({ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }),
		// The mark reads like a sheet-tab chip — a small nod to the spreadsheet it produces.
		mark: css({
			fontWeight: 700,
			letterSpacing: "0.01em",
			bg: "color-mix(in srgb, #ffffff 18%, transparent)",
			paddingBlock: "0.12rem",
			paddingInline: "0.5rem",
			borderRadius: "5px",
		}),
		tag: css({
			fontSize: "0.82rem",
			opacity: 0.85,
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis",
			sm: { display: "none" },
		}),
		actions: css({ display: "flex", alignItems: "center", gap: "0.5rem" }),
	};
</script>

<header class={styles.bar}>
	<div class={styles.brand}>
		<span class={styles.mark}>Xerial</span>
		<span class={styles.tag}>P6 calendars → spreadsheet, in your browser</span>
	</div>
	<div class={styles.actions}>{@render actions?.()}</div>
</header>
