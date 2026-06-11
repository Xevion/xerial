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
		prepareGrid,
		selectGrid,
		GridError,
		type XerDocument,
		type GridResult,
		type PreparedGrid,
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

	const asMessage = (e: unknown) => (e instanceof GridError ? e.message : String(e));

	// The expensive half — decode + expand every calendar — depends only on the
	// document, so it recomputes on a new file but not on the "all calendars" toggle.
	const prepared = $derived.by<{ value: PreparedGrid | null; error: string | null }>(() => {
		if (!doc) return { value: null, error: null };
		try {
			return { value: prepareGrid(doc), error: null };
		} catch (e) {
			return { value: null, error: asMessage(e) };
		}
	});

	// Selecting which prepared calendars to show is cheap and reuses calendar objects
	// verbatim, so toggling re-renders only the rows that actually appear or vanish.
	const built = $derived.by<{ grid: GridResult | null; error: string | null }>(() => {
		if (!prepared.value) return { grid: null, error: prepared.error };
		try {
			return { grid: selectGrid(prepared.value, { includeAll }), error: null };
		} catch (e) {
			return { grid: null, error: asMessage(e) };
		}
	});
	const grid = $derived(built.grid);
	// Surface a build failure, or an export failure if the grid itself is fine.
	const statusError = $derived(built.error ?? exportError);

	const baseName = $derived(fileName.replace(/\.xer$/i, "") || "schedule");

	/**
	 * Resolve after the browser has actually painted. A single rAF fires *before*
	 * paint, so the spinner never shows; waiting two frames guarantees the busy
	 * state is on screen before — and stays up through — the blocking work.
	 */
	const afterPaint = () =>
		new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

	async function ingest(bytes: Uint8Array, name: string, persist: boolean) {
		error = null;
		exportError = null;
		busy = true;
		await afterPaint();
		try {
			const parsed = parseXer(decodeXer(bytes));
			if (parsed.tables.length === 0)
				throw new Error("No tables found — is this a valid XER file?");
			doc = parsed;
			fileName = name;
			if (persist) void savePersisted(name, bytes);
			// Hold the spinner up while prepare + the grid's first paint complete.
			await afterPaint();
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
