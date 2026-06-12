<script lang="ts">
	import { summarizeDiff, type CalendarSummary, type ChangeLine } from "$lib/export";
	import type { GridDiff } from "$lib/parser";

	import { css } from "styled-system/css";

	let { diff }: { diff: GridDiff } = $props();

	const summaries = $derived(summarizeDiff(diff));
	const unchanged = $derived(diff.calendars.filter((c) => c.kind === "unchanged").length);

	// Color the calendar's left bar by its fate, and each line's marker by edit type.
	// Panda emits each token as a `--colors-<name>` custom property; reference those
	// directly since inline styles can't call Panda's build-time `token()`.
	const color = (name: string) => `var(--colors-${name})`;
	const barColor: Record<CalendarSummary["kind"], string> = {
		added: color("accent"),
		removed: color("danger"),
		modified: color("warn"),
		unchanged: color("muted"),
	};
	const toneColor: Record<ChangeLine["tone"], string> = {
		hours: color("warn"),
		shift: color("muted"),
		holiday: color("danger"),
		working: color("accent"),
		added: color("accent"),
		removed: color("danger"),
	};

	const styles = {
		// Capped so a large diff can't crowd out the grid below; scrolls internally.
		wrap: css({
			flexShrink: 0,
			maxHeight: "min(34vh, 20rem)",
			overflowY: "auto",
			bg: "panel",
			border: "1px solid token(colors.border)",
			borderRadius: "8px",
		}),
		head: css({
			position: "sticky",
			top: 0,
			zIndex: 1,
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			paddingBlock: "0.4rem",
			paddingInline: "0.75rem",
			bg: "grid.headerBg",
			color: "grid.headerFg",
			borderBottom: "1px solid token(colors.border)",
			fontSize: "0.72rem",
			fontWeight: 600,
			letterSpacing: "0.03em",
			textTransform: "uppercase",
		}),
		count: css({ marginLeft: "auto", color: "muted", textTransform: "none", letterSpacing: 0 }),
		none: css({ padding: "0.75rem", color: "muted", fontSize: "0.85rem" }),
		list: css({ display: "flex", flexDirection: "column" }),
		cal: css({
			borderLeft: "3px solid transparent",
			paddingBlock: "0.45rem",
			paddingInline: "0.75rem",
			"&:not(:last-child)": { borderBottom: "1px solid token(colors.border)" },
		}),
		name: css({ fontWeight: 600, fontSize: "0.85rem" }),
		lines: css({ display: "flex", flexDirection: "column", gap: "0.15rem", marginTop: "0.25rem" }),
		line: css({
			display: "flex",
			alignItems: "center",
			gap: "0.45rem",
			fontSize: "0.82rem",
			color: "text",
		}),
		dot: css({ width: "0.45rem", height: "0.45rem", borderRadius: "full", flexShrink: 0 }),
	};
</script>

<div class={styles.wrap}>
	<div class={styles.head}>
		Changes
		{#if unchanged > 0}<span class={styles.count}>{unchanged} unchanged</span>{/if}
	</div>
	{#if summaries.length === 0}
		<p class={styles.none}>No calendar differences between the two files.</p>
	{:else}
		<div class={styles.list}>
			{#each summaries as cal (cal.clndrId)}
				<div class={styles.cal} style="border-left-color: {barColor[cal.kind]}">
					<span class={styles.name}>{cal.name}</span>
					<div class={styles.lines}>
						{#each cal.lines as line (line.text)}
							<span class={styles.line}>
								<span class={styles.dot} style="background: {toneColor[line.tone]}"></span>
								{line.text}
							</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
