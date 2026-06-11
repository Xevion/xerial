<script lang="ts">
	import { formatDate, formatTime, formatHours, weekdayLabel } from "$lib/export";
	import type { GridResult } from "$lib/parser";

	let { grid }: { grid: GridResult } = $props();

	/** Date column width in px; must match `.c-date` width (`--col-w`) in panda.config.ts. */
	const COL_W = 74;
	/** Extra columns rendered beyond the viewport so fast scrolling never shows gaps. */
	const OVERSCAN = 8;

	// Per-column presentation depends only on the date, not the calendar or row, so
	// it's computed once per grid instead of re-derived for every one of the cells.
	const columns = $derived(
		grid.serials.map((s) => {
			const wd = weekdayLabel(s);
			return { key: s, date: formatDate(s), wd, weekend: wd === "Sat" || wd === "Sun" };
		}),
	);

	let scroller = $state<HTMLDivElement>();
	let scrollLeft = $state(0);
	let viewportWidth = $state(0);

	$effect(() => {
		const el = scroller;
		if (!el) return;
		const ro = new ResizeObserver(() => (viewportWidth = el.clientWidth));
		ro.observe(el);
		viewportWidth = el.clientWidth;
		return () => ro.disconnect();
	});

	// Coalesce scroll events to one read per frame.
	let pending = 0;
	function onScroll() {
		if (pending) return;
		pending = requestAnimationFrame(() => {
			pending = 0;
			if (scroller) scrollLeft = scroller.scrollLeft;
		});
	}

	const n = $derived(columns.length);
	const first = $derived(Math.max(0, Math.floor(scrollLeft / COL_W) - OVERSCAN));
	const last = $derived(Math.min(n, Math.ceil((scrollLeft + viewportWidth) / COL_W) + OVERSCAN));
	// Indices of the date columns to actually render; the rest are empty spacer cells.
	const view = $derived.by(() => {
		const out: number[] = [];
		for (let i = first; i < last; i++) out.push(i);
		return out;
	});
	const leftW = $derived(first * COL_W);
	const rightW = $derived(Math.max(0, n - last) * COL_W);
</script>

<div class="grid-wrap" bind:this={scroller} onscroll={onScroll} style="--col-w:{COL_W}px">
	<table class="grid">
		<thead>
			<tr>
				<th class="c-corner c-name"></th>
				<th class="c-corner c-label"></th>
				{#if leftW > 0}<th class="c-spacer" style="width:{leftW}px" aria-hidden="true"></th>{/if}
				{#each view as i (columns[i]?.key ?? i)}
					{@const col = columns[i]}
					<th class="c-date" class:weekend={col?.weekend} title={col?.date}>
						<span class="d-date">{col?.date ?? ""}</span>
						<span class="d-wd">{col?.wd ?? ""}</span>
					</th>
				{/each}
				{#if rightW > 0}<th class="c-spacer" style="width:{rightW}px" aria-hidden="true"></th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each grid.calendars as cal (cal.clndrId)}
				<tr class="r-start">
					<td class="c-name" rowspan="3" title={cal.name}>{cal.name}</td>
					<td class="c-label">Start</td>
					{#if leftW > 0}<td class="c-spacer" style="width:{leftW}px"></td>{/if}
					{#each view as i (columns[i]?.key ?? i)}
						{@const day = cal.days[i]}
						<td class="num" class:off={!day?.working} class:weekend={columns[i]?.weekend}>
							{day && day.start !== null ? formatTime(day.start) : ""}
						</td>
					{/each}
					{#if rightW > 0}<td class="c-spacer" style="width:{rightW}px"></td>{/if}
				</tr>
				<tr class="r-end">
					<td class="c-label">End</td>
					{#if leftW > 0}<td class="c-spacer" style="width:{leftW}px"></td>{/if}
					{#each view as i (columns[i]?.key ?? i)}
						{@const day = cal.days[i]}
						<td class="num" class:off={!day?.working} class:weekend={columns[i]?.weekend}>
							{day && day.end !== null ? formatTime(day.end) : ""}
						</td>
					{/each}
					{#if rightW > 0}<td class="c-spacer" style="width:{rightW}px"></td>{/if}
				</tr>
				<tr class="r-total">
					<td class="c-label">Total Hours</td>
					{#if leftW > 0}<td class="c-spacer" style="width:{leftW}px"></td>{/if}
					{#each view as i (columns[i]?.key ?? i)}
						{@const day = cal.days[i]}
						<td
							class="num hours"
							class:off={!day || day.hours === 0}
							class:weekend={columns[i]?.weekend}
						>
							{day ? formatHours(day.hours) : ""}
						</td>
					{/each}
					{#if rightW > 0}<td class="c-spacer" style="width:{rightW}px"></td>{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
