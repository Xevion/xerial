<script lang="ts">
	import FileSpreadsheet from "@lucide/svelte/icons/file-spreadsheet";

	import type { XerHeader } from "$lib/parser";

	import { css } from "styled-system/css";

	let {
		fileName,
		header,
		includeAll = $bindable(false),
	}: {
		fileName: string;
		header: XerHeader | null;
		includeAll?: boolean;
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
		toggle: css({
			display: "flex",
			alignItems: "center",
			gap: "0.4rem",
			marginLeft: "auto",
			fontSize: "0.82rem",
			color: "muted",
			fontWeight: 600,
			cursor: "pointer",
			"& input": { accentColor: "token(colors.accent)", cursor: "pointer" },
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
	<label class={styles.toggle}>
		<input type="checkbox" bind:checked={includeAll} />
		Show all calendars
	</label>
</div>
