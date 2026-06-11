<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Download from "@lucide/svelte/icons/download";

	import type { Exporter } from "$lib/export";

	import { css } from "styled-system/css";
	import { button } from "styled-system/recipes";

	let {
		exporters,
		disabled = false,
		busy = false,
		onPick,
	}: {
		exporters: Exporter[];
		disabled?: boolean;
		busy?: boolean;
		onPick: (exporter: Exporter) => void;
	} = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();

	function choose(exporter: Exporter) {
		open = false;
		onPick(exporter);
	}

	// Close on an outside click or Escape while the menu is open.
	function onWindowPointer(e: PointerEvent) {
		if (root && !root.contains(e.target as Node)) open = false;
	}

	const styles = {
		root: css({ position: "relative" }),
		caret: css({
			width: "1rem",
			height: "1rem",
			transition: "transform 0.15s",
			'&[data-open="true"]': { transform: "rotate(180deg)" },
		}),
		menu: css({
			position: "absolute",
			top: "calc(100% + 0.35rem)",
			right: 0,
			zIndex: 20,
			minWidth: "12rem",
			padding: "0.3rem",
			bg: "panel",
			color: "text",
			border: "1px solid token(colors.border)",
			borderRadius: "8px",
			boxShadow: "menu",
		}),
		item: css({
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: "1rem",
			width: "100%",
			paddingBlock: "0.4rem",
			paddingInline: "0.55rem",
			borderRadius: "5px",
			font: "inherit",
			fontSize: "0.875rem",
			textAlign: "left",
			cursor: "pointer",
			bg: "transparent",
			border: "none",
			color: "inherit",
			_hover: { bg: "selection" },
			_focusVisible: { outline: "none", bg: "selection" },
		}),
		ext: css({ color: "muted", fontSize: "0.78rem", fontVariantNumeric: "tabular-nums" }),
	};
</script>

<svelte:window
	onpointerdown={open ? onWindowPointer : undefined}
	onkeydown={(e) => e.key === "Escape" && (open = false)}
/>

<div class={styles.root} bind:this={root}>
	<button
		class={button({ variant: "onAccent" })}
		type="button"
		{disabled}
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<Download size={16} aria-hidden="true" />
		{busy ? "Working…" : "Download"}
		<ChevronDown class={styles.caret} data-open={open} aria-hidden="true" />
	</button>

	{#if open}
		<div class={styles.menu} role="menu">
			{#each exporters as exporter (exporter.id)}
				<button class={styles.item} type="button" role="menuitem" onclick={() => choose(exporter)}>
					<span>{exporter.label.replace(/\s*\(.*\)$/, "")}</span>
					<span class={styles.ext}>.{exporter.ext}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
