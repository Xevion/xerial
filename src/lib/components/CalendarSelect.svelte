<script lang="ts">
	import { Menu } from "@ark-ui/svelte/menu";
	import { Portal } from "@ark-ui/svelte/portal";

	import Check from "@lucide/svelte/icons/check";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ListFilter from "@lucide/svelte/icons/list-filter";

	import { css } from "styled-system/css";
	import { button, menu } from "styled-system/recipes";

	let {
		calendars,
		selected,
		onChange,
	}: {
		calendars: { id: string; name: string; usage: number }[];
		selected: ReadonlySet<string>;
		onChange: (next: Set<string>) => void;
	} = $props();

	const allIds = $derived(calendars.map((c) => c.id));
	const usedIds = $derived(calendars.filter((c) => c.usage > 0).map((c) => c.id));

	function toggle(id: string, checked: boolean) {
		onChange(new Set(checked ? [...selected, id] : [...selected].filter((x) => x !== id)));
	}

	// Light up whichever quick action matches the current selection, so the active
	// preset (commonly "Used", the default) reads as selected rather than inert.
	const sameSet = (a: ReadonlySet<string>, ids: string[]) =>
		a.size === ids.length && ids.every((x) => a.has(x));
	const activeAction = $derived(
		selected.size === 0
			? "none"
			: sameSet(selected, allIds)
				? "all"
				: sameSet(selected, usedIds)
					? "used"
					: null,
	);

	const m = menu();
	const styles = {
		count: css({ color: "muted", fontSize: "0.78rem", fontVariantNumeric: "tabular-nums" }),
		caret: css({
			width: "1rem",
			height: "1rem",
			transition: "transform 0.15s",
			'[data-state="open"] &': { transform: "rotate(180deg)" },
		}),
		actions: css({ display: "flex", gap: "0.25rem", paddingBlock: "0.1rem 0.35rem" }),
		action: css({
			flex: 1,
			paddingBlock: "0.25rem",
			font: "inherit",
			fontSize: "0.76rem",
			fontWeight: 500,
			color: "text",
			bg: "transparent",
			border: "1px solid token(colors.border)",
			borderRadius: "5px",
			cursor: "pointer",
			_hover: { bg: "selection", borderColor: "accent" },
			'&[data-active="true"]': { bg: "selection", borderColor: "accent", fontWeight: 600 },
		}),
		// The calendar list scrolls within the popover so a long roster can't push the
		// menu past the viewport and spawn a page scrollbar.
		list: css({ maxHeight: "min(50vh, 18rem)", overflowY: "auto" }),
		item: css({
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			width: "100%",
			paddingBlock: "0.4rem",
			paddingInline: "0.5rem",
			borderRadius: "5px",
			fontSize: "0.875rem",
			cursor: "pointer",
			_highlighted: { bg: "selection" },
		}),
		box: css({
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: "1rem",
			height: "1rem",
			flexShrink: 0,
			border: "1px solid token(colors.border)",
			borderRadius: "3px",
			color: "transparent",
		}),
		boxOn: css({ bg: "accent", borderColor: "accent", color: "#ffffff" }),
		name: css({ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
		usage: css({
			color: "muted",
			fontSize: "0.76rem",
			fontVariantNumeric: "tabular-nums",
			flexShrink: 0,
		}),
	};
</script>

<Menu.Root closeOnSelect={false} positioning={{ strategy: "fixed" }}>
	<Menu.Trigger>
		{#snippet asChild(props)}
			<button class={button({ variant: "subtle" })} type="button" {...props()}>
				<ListFilter size={15} aria-hidden="true" />
				Calendars
				<span class={styles.count}>{selected.size}/{calendars.length}</span>
				<ChevronDown class={styles.caret} aria-hidden="true" />
			</button>
		{/snippet}
	</Menu.Trigger>
	<Portal>
		<Menu.Positioner>
			<Menu.Content class={m.content}>
				<div class={styles.actions}>
					<button
						class={styles.action}
						type="button"
						data-active={activeAction === "all"}
						onclick={() => onChange(new Set(allIds))}
					>
						All
					</button>
					<button
						class={styles.action}
						type="button"
						data-active={activeAction === "used"}
						onclick={() => onChange(new Set(usedIds))}
					>
						Used
					</button>
					<button
						class={styles.action}
						type="button"
						data-active={activeAction === "none"}
						onclick={() => onChange(new Set())}
					>
						None
					</button>
				</div>
				<Menu.Separator class={css({ height: "1px", bg: "border", marginBlock: "0.25rem" })} />
				<div class={styles.list}>
					{#each calendars as cal (cal.id)}
						<Menu.CheckboxItem
							class={styles.item}
							value={cal.id}
							checked={selected.has(cal.id)}
							onCheckedChange={(checked) => toggle(cal.id, checked)}
						>
							<span class={`${styles.box} ${selected.has(cal.id) ? styles.boxOn : ""}`}>
								{#if selected.has(cal.id)}<Check size={12} aria-hidden="true" />{/if}
							</span>
							<span class={styles.name}>{cal.name || cal.id}</span>
							<span class={styles.usage}>{cal.usage || "—"}</span>
						</Menu.CheckboxItem>
					{/each}
				</div>
			</Menu.Content>
		</Menu.Positioner>
	</Portal>
</Menu.Root>
