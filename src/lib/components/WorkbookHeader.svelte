<script lang="ts">
	import FileSpreadsheet from "@lucide/svelte/icons/file-spreadsheet";

	import CalendarSelect from "$lib/components/CalendarSelect.svelte";
	import DateRangePicker from "$lib/components/DateRangePicker.svelte";
	import type { XerHeader } from "$lib/parser";

	import { css } from "styled-system/css";

	let {
		fileName,
		header,
		calendars,
		selected,
		onSelectionChange,
		span,
		bounds,
		range,
		onRangeChange,
	}: {
		fileName: string;
		header: XerHeader | null;
		/** Every calendar in the file, for the selection dropdown. */
		calendars: { id: string; name: string; usage: number }[];
		/** The currently shown calendars, by clndr_id. */
		selected: ReadonlySet<string>;
		onSelectionChange: (next: Set<string>) => void;
		/** Detected activity envelope; the picker is hidden when null (no dates). */
		span: { start: string; end: string } | null;
		/** Selectable bounds for the picker (month/week-padded span). */
		bounds: { min: string; max: string } | null;
		/** The effective window the grid is built for. */
		range: { start: string; end: string } | null;
		onRangeChange: (range: { start: string; end: string }) => void;
	} = $props();

	const styles = {
		bar: css({
			display: "flex",
			alignItems: "center",
			gap: "1rem",
			flexWrap: "wrap",
			paddingBlock: "0.55rem",
			paddingInline: "1rem",
			borderBottom: "1px solid token(colors.border)",
			bg: "panel",
		}),
		file: css({ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 600 }),
		fileIcon: css({ color: "accent", flexShrink: 0 }),
		bits: css({
			display: "flex",
			gap: "0.75rem",
			flexWrap: "wrap",
			color: "muted",
			fontSize: "0.82rem",
		}),
		controls: css({
			marginLeft: "auto",
			display: "flex",
			alignItems: "center",
			gap: "0.6rem",
			flexWrap: "wrap",
		}),
	};
</script>

<div class={styles.bar}>
	<span class={styles.file}>
		<FileSpreadsheet size={17} class={styles.fileIcon} aria-hidden="true" />
		{fileName}
	</span>
	{#if header}
		<span class={styles.bits}>
			<span>P6 v{header.version}</span>
			<span>exported {header.exportDate}</span>
			{#if header.userFullName}<span>by {header.userFullName}</span>{/if}
		</span>
	{/if}
	<div class={styles.controls}>
		{#if span && bounds && range}
			<DateRangePicker
				start={range.start}
				end={range.end}
				fullSpan={span}
				min={bounds.min}
				max={bounds.max}
				resetKey={fileName}
				onChange={onRangeChange}
			/>
		{/if}
		{#if calendars.length}
			<CalendarSelect {calendars} {selected} onChange={onSelectionChange} />
		{/if}
	</div>
</div>
