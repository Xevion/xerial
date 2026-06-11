<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import CalendarGrid from "$lib/components/CalendarGrid.svelte";
	import DownloadMenu from "$lib/components/DownloadMenu.svelte";
	import Dropzone from "$lib/components/Dropzone.svelte";
	import StatusBar from "$lib/components/StatusBar.svelte";
	import ThemeToggle from "$lib/components/ThemeToggle.svelte";
	import Topbar from "$lib/components/Topbar.svelte";
	import WorkbookHeader from "$lib/components/WorkbookHeader.svelte";
	import { exporters, saveExport, type Exporter } from "$lib/export";
	import {
		parseXer,
		decodeXer,
		buildGrid,
		GridError,
		type XerDocument,
		type GridResult,
	} from "$lib/parser";
	import { savePersisted, loadPersisted, clearPersisted } from "$lib/persist";
	import { sampleXer } from "$lib/sample";

	import { css } from "styled-system/css";
	import { button } from "styled-system/recipes";

	let doc = $state<XerDocument | null>(null);
	let fileName = $state("");
	let includeAll = $state(false);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let exportError = $state<string | null>(null);

	// Rebuilds whenever the file or the "all calendars" toggle changes. The grid and
	// its failure travel together so the derivation stays pure (no state writes).
	const built = $derived.by<{ grid: GridResult | null; error: string | null }>(() => {
		if (!doc) return { grid: null, error: null };
		try {
			return { grid: buildGrid(doc, { includeAll }), error: null };
		} catch (e) {
			return { grid: null, error: e instanceof GridError ? e.message : String(e) };
		}
	});
	const grid = $derived(built.grid);
	// Surface a build failure, or an export failure if the grid itself is fine.
	const statusError = $derived(built.error ?? exportError);

	const baseName = $derived(fileName.replace(/\.xer$/i, "") || "schedule");

	/** Yield a frame so the busy spinner paints before a large parse blocks the thread. */
	const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

	async function ingest(bytes: Uint8Array, name: string, persist: boolean) {
		error = null;
		exportError = null;
		busy = true;
		await nextFrame();
		try {
			const parsed = parseXer(decodeXer(bytes));
			if (parsed.tables.length === 0)
				throw new Error("No tables found — is this a valid XER file?");
			doc = parsed;
			fileName = name;
			if (persist) void savePersisted(name, bytes);
		} catch (e) {
			doc = null;
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function loadFile(file: File) {
		await ingest(new Uint8Array(await file.arrayBuffer()), file.name, true);
	}

	function loadSample() {
		const { name, bytes } = sampleXer();
		void ingest(bytes, name, true);
	}

	// Re-hydrate a file kept across a dev reload (no-op in production / fresh tab).
	onMount(async () => {
		const restored = await loadPersisted();
		if (restored && !doc) await ingest(restored.bytes, restored.name, false);
	});

	async function runExport(exporter: Exporter) {
		if (!grid) return;
		busy = true;
		exportError = null;
		try {
			await saveExport(exporter, grid, `${baseName}-calendar-grid`);
		} catch (e) {
			exportError = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function reset() {
		doc = null;
		fileName = "";
		error = null;
		exportError = null;
		void clearPersisted();
	}

	const styles = {
		main: css({ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }),
		workbook: css({ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }),
		sheet: css({
			flex: 1,
			display: "flex",
			flexDirection: "column",
			minHeight: 0,
			padding: "0.75rem",
			gap: "0.75rem",
		}),
		empty: css({ margin: "auto", color: "muted", fontSize: "0.9rem" }),
	};
</script>

<Topbar>
	{#snippet actions()}
		{#if doc}
			<button class={button({ variant: "ghost" })} type="button" onclick={reset}>New file</button>
			<DownloadMenu {exporters} {busy} disabled={busy || !grid} onPick={runExport} />
		{/if}
		<ThemeToggle />
	{/snippet}
</Topbar>

<main class={styles.main}>
	{#if doc}
		<div class={styles.workbook} in:fade={{ duration: 160 }}>
			<WorkbookHeader {fileName} header={doc.header} bind:includeAll />
			<div class={styles.sheet}>
				{#if grid && grid.calendars.length}
					<CalendarGrid {grid} />
				{:else if grid}
					<p class={styles.empty}>No calendars to show. Try “Show all calendars”.</p>
				{/if}
			</div>
		</div>
	{:else}
		<div class={styles.main} in:fade={{ duration: 160 }}>
			<Dropzone {busy} {error} onFile={loadFile} onSample={loadSample} />
		</div>
	{/if}
</main>

{#if doc}
	<StatusBar {grid} buildError={statusError} />
{/if}
