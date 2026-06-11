<script lang="ts">
	import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

	import type { GridResult } from "$lib/parser";

	import { css } from "styled-system/css";

	let {
		grid = null,
		buildError = null,
	}: {
		grid?: GridResult | null;
		buildError?: string | null;
	} = $props();

	// Excel's status bar: a sheet tab anchored left, live counts and notices right.
	const styles = {
		bar: css({
			display: "flex",
			alignItems: "stretch",
			gap: "1rem",
			height: "1.85rem",
			paddingRight: "1rem",
			borderTop: "1px solid token(colors.border)",
			bg: "grid.headerBg",
			color: "grid.headerFg",
			fontSize: "0.78rem",
		}),
		tab: css({
			display: "flex",
			alignItems: "center",
			paddingInline: "1rem",
			fontWeight: 600,
			color: "text",
			bg: "panel",
			borderRight: "1px solid token(colors.border)",
			boxShadow: "inset 0 2px 0 token(colors.accent)",
		}),
		spacer: css({ flex: 1 }),
		dims: css({ display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }),
		notice: css({
			display: "flex",
			alignItems: "center",
			gap: "0.35rem",
			color: "warn",
			fontWeight: 600,
		}),
		error: css({
			display: "flex",
			alignItems: "center",
			gap: "0.35rem",
			color: "danger",
			fontWeight: 600,
		}),
	};

	const calCount = $derived(grid?.calendars.length ?? 0);
	const dayCount = $derived(grid?.serials.length ?? 0);
</script>

<div class={styles.bar}>
	<span class={styles.tab}>Calendars</span>
	<span class={styles.spacer}></span>
	{#if buildError}
		<span class={styles.error}><TriangleAlert size={14} aria-hidden="true" />{buildError}</span>
	{:else if grid}
		{#if grid.skipped.length}
			<span class={styles.notice}>
				<TriangleAlert size={14} aria-hidden="true" />
				{grid.skipped.length} skipped
			</span>
		{/if}
		<span class={styles.dims}>
			{calCount} calendar{calCount === 1 ? "" : "s"} × {dayCount} days · {grid.startIso} → {grid.endIso}
		</span>
	{/if}
</div>
