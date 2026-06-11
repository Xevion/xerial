<script lang="ts">
	import { Menu } from "@ark-ui/svelte/menu";
	import { Portal } from "@ark-ui/svelte/portal";

	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Download from "@lucide/svelte/icons/download";

	import type { Exporter } from "$lib/export";

	import { css } from "styled-system/css";
	import { button, menu } from "styled-system/recipes";

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

	const byId = $derived(new Map(exporters.map((e) => [e.id, e])));

	function select(value: string) {
		const exporter = byId.get(value);
		if (exporter) onPick(exporter);
	}

	const m = menu();
	const styles = {
		caret: css({
			width: "1rem",
			height: "1rem",
			transition: "transform 0.15s",
			'[data-state="open"] &': { transform: "rotate(180deg)" },
		}),
		ext: css({ color: "muted", fontSize: "0.78rem", fontVariantNumeric: "tabular-nums" }),
	};
</script>

<Menu.Root onSelect={(e) => select(e.value)}>
	<Menu.Trigger>
		{#snippet asChild(props)}
			<button class={button({ variant: "onAccent" })} type="button" {disabled} {...props()}>
				<Download size={16} aria-hidden="true" />
				{busy ? "Working…" : "Download"}
				<ChevronDown class={styles.caret} aria-hidden="true" />
			</button>
		{/snippet}
	</Menu.Trigger>
	<Portal>
		<Menu.Positioner>
			<Menu.Content class={m.content}>
				{#each exporters as exporter (exporter.id)}
					<Menu.Item value={exporter.id} class={m.item}>
						<span>{exporter.label.replace(/\s*\(.*\)$/, "")}</span>
						<span class={styles.ext}>.{exporter.ext}</span>
					</Menu.Item>
				{/each}
			</Menu.Content>
		</Menu.Positioner>
	</Portal>
</Menu.Root>
