<script lang="ts">
	import { Menu } from "@ark-ui/svelte/menu";
	import { Portal } from "@ark-ui/svelte/portal";

	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Download from "@lucide/svelte/icons/download";

	import { css } from "styled-system/css";
	import { button, menu } from "styled-system/recipes";

	/** The minimum a format needs to appear in the picker; the caller resolves the id. */
	interface MenuFormat {
		id: string;
		label: string;
		ext: string;
	}

	let {
		items,
		label = "Download",
		disabled = false,
		busy = false,
		onPick,
	}: {
		items: ReadonlyArray<MenuFormat>;
		label?: string;
		disabled?: boolean;
		busy?: boolean;
		onPick: (id: string) => void;
	} = $props();

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

<Menu.Root onSelect={(e) => onPick(e.value)}>
	<Menu.Trigger>
		{#snippet asChild(props)}
			<button class={button({ variant: "onAccent" })} type="button" {disabled} {...props()}>
				<Download size={16} aria-hidden="true" />
				{busy ? "Working…" : label}
				<ChevronDown class={styles.caret} aria-hidden="true" />
			</button>
		{/snippet}
	</Menu.Trigger>
	<Portal>
		<Menu.Positioner>
			<Menu.Content class={m.content}>
				{#each items as item (item.id)}
					<Menu.Item value={item.id} class={m.item}>
						<span>{item.label.replace(/\s*\(.*\)$/, "")}</span>
						<span class={styles.ext}>.{item.ext}</span>
					</Menu.Item>
				{/each}
			</Menu.Content>
		</Menu.Positioner>
	</Portal>
</Menu.Root>
