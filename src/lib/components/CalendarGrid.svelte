<script lang="ts">
	import { formatDate, formatTime, formatHours, weekdayLabel } from "$lib/export";
	import type { GridView } from "$lib/grid-view";

	import { css } from "styled-system/css";

	let { view }: { view: GridView } = $props();

	/** Extra columns rendered beyond the viewport so fast scrolling never shows gaps. */
	const OVERSCAN = 8;
	/** Fallback column width (≈ the 4.6rem in panda.config) until a cell is measured. */
	const COL_W_GUESS = 74;

	// A neutral hover wash for the diff view so the green selection tint doesn't read
	// as meaning; the overlay still lets the underlying diff colors show through.
	const neutralHover = css({
		"--grid-hover": "color-mix(in srgb, token(colors.text) 9%, transparent)",
	});
	const wrapClass = $derived(view.diff ? `grid-wrap ${neutralHover}` : "grid-wrap");

	// Per-column presentation depends only on the date, not the calendar or row, so
	// it's computed once per grid instead of re-derived for every one of the cells.
	const columns = $derived(
		view.serials.map((s) => {
			const wd = weekdayLabel(s);
			return { key: s, date: formatDate(s), wd, weekend: wd === "Sat" || wd === "Sun" };
		}),
	);

	let scroller = $state<HTMLDivElement>();
	let scrollLeft = $state(0);
	let viewportWidth = $state(0);
	// Measured from a real header cell rather than hardcoded, so the scroll→column
	// math tracks the actual rendered width through font-size, zoom, or CSS changes.
	let colW = $state(COL_W_GUESS);

	$effect(() => {
		const el = scroller;
		if (!el) return;
		const measure = () => {
			viewportWidth = el.clientWidth;
			const cell = el.querySelector(".c-date");
			const w = cell?.getBoundingClientRect().width ?? 0;
			if (w > 0) colW = w;
		};
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		measure();
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
	const first = $derived(Math.max(0, Math.floor(scrollLeft / colW) - OVERSCAN));
	const last = $derived(Math.min(n, Math.ceil((scrollLeft + viewportWidth) / colW) + OVERSCAN));
	// Indices of the date columns to actually render; the rest are empty spacer cells.
	const visible = $derived.by(() => {
		const out: number[] = [];
		for (let i = first; i < last; i++) out.push(i);
		return out;
	});
	const leftW = $derived(first * colW);
	const rightW = $derived(Math.max(0, n - last) * colW);
</script>

<div class={wrapClass} bind:this={scroller} onscroll={onScroll}>
	<table class="grid">
		<thead>
			<tr>
				<th class="c-corner c-name"></th>
				<th class="c-corner c-label"></th>
				{#if leftW > 0}<th class="c-spacer" style="width:{leftW}px" aria-hidden="true"></th>{/if}
				{#each visible as i (columns[i]?.key ?? i)}
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
			{#each view.rows as row (row.clndrId)}
				<tr
					class="r-start"
					class:added={row.state === "added"}
					class:removed={row.state === "removed"}
				>
					<td class="c-name {row.state ?? ''}" rowspan="3" title={row.name}>{row.name}</td>
					<td class="c-label">Start</td>
					{#if leftW > 0}<td class="c-spacer" style="width:{leftW}px"></td>{/if}
					{#each visible as i (columns[i]?.key ?? i)}
						{@const cell = row.cells[i]}
						<td
							class="num"
							class:off={!cell?.working}
							class:weekend={columns[i]?.weekend}
							class:chg={cell?.changed}
							title={cell?.title}
						>
							{cell && cell.start !== null ? formatTime(cell.start) : ""}
						</td>
					{/each}
					{#if rightW > 0}<td class="c-spacer" style="width:{rightW}px"></td>{/if}
				</tr>
				<tr
					class="r-end"
					class:added={row.state === "added"}
					class:removed={row.state === "removed"}
				>
					<td class="c-label">End</td>
					{#if leftW > 0}<td class="c-spacer" style="width:{leftW}px"></td>{/if}
					{#each visible as i (columns[i]?.key ?? i)}
						{@const cell = row.cells[i]}
						<td
							class="num"
							class:off={!cell?.working}
							class:weekend={columns[i]?.weekend}
							class:chg={cell?.changed}
						>
							{cell && cell.end !== null ? formatTime(cell.end) : ""}
						</td>
					{/each}
					{#if rightW > 0}<td class="c-spacer" style="width:{rightW}px"></td>{/if}
				</tr>
				<tr
					class="r-total"
					class:added={row.state === "added"}
					class:removed={row.state === "removed"}
				>
					<td class="c-label">Total Hours</td>
					{#if leftW > 0}<td class="c-spacer" style="width:{leftW}px"></td>{/if}
					{#each visible as i (columns[i]?.key ?? i)}
						{@const cell = row.cells[i]}
						<td
							class="num hours"
							class:off={!cell || cell.hours === 0}
							class:weekend={columns[i]?.weekend}
							class:chg={cell?.changed}
							title={cell?.title}
						>
							{cell ? formatHours(cell.hours) : ""}
						</td>
					{/each}
					{#if rightW > 0}<td class="c-spacer" style="width:{rightW}px"></td>{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
