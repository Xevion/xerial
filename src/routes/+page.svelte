<script lang="ts">
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import CalendarGrid from "$lib/components/CalendarGrid.svelte";
	import DiffSummary from "$lib/components/DiffSummary.svelte";
	import DownloadMenu from "$lib/components/DownloadMenu.svelte";
	import Dropzone from "$lib/components/Dropzone.svelte";
	import StatusBar from "$lib/components/StatusBar.svelte";
	import ThemeToggle from "$lib/components/ThemeToggle.svelte";
	import Topbar from "$lib/components/Topbar.svelte";
	import WorkbookHeader from "$lib/components/WorkbookHeader.svelte";
	import {
		exporters,
		diffExporters,
		saveExport,
		type Exporter,
		type DiffExporter,
	} from "$lib/export";
	import { gridToView, diffToView } from "$lib/grid-view";
	import {
		parseXer,
		decodeXer,
		detectActivitySpan,
		prepareGrid,
		selectGrid,
		buildGrid,
		diffGrids,
		GridError,
		type XerDocument,
		type GridResult,
		type PreparedGrid,
		type GridDiff,
	} from "$lib/parser";
	import { savePersisted, loadPersisted, clearPersisted } from "$lib/persist";
	import { sampleXer, compareSampleXer } from "$lib/sample";
	import { selectableBounds } from "$lib/window";

	import { css } from "styled-system/css";
	import { button } from "styled-system/recipes";

	let doc = $state<XerDocument | null>(null);
	let fileName = $state("");
	// Explicit calendar selection by clndr_id; null falls back to the used calendars.
	let selectedIds = $state<Set<string> | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let exportError = $state<string | null>(null);
	// User-chosen date window; null falls back to the file's detected activity span.
	let range = $state<{ start: string; end: string } | null>(null);

	// Compare mode: a second "revised" document loaded alongside the baseline `doc`.
	// Two named slots rather than a files[] array — the single-file flow is untouched,
	// and a diff is inherently pairwise (baseline → revised).
	let compareDoc = $state<XerDocument | null>(null);
	let compareFileName = $state("");
	let compareError = $state<string | null>(null);
	let compareInput = $state<HTMLInputElement>();

	const asMessage = (e: unknown) => (e instanceof GridError ? e.message : String(e));

	// The file's auto-detected envelope — a cheap TASK-row scan, so it's safe to seed
	// the picker without paying for a full grid build. Null when no activity dates.
	const detectedSpan = $derived.by<{ start: string; end: string } | null>(() => {
		if (!doc) return null;
		const s = detectActivitySpan(doc);
		return s.startIso && s.endIso ? { start: s.startIso, end: s.endIso } : null;
	});
	const effectiveRange = $derived(range ?? detectedSpan);
	// Days outside the schedule's months/weeks are disabled in the picker.
	const bounds = $derived(detectedSpan ? selectableBounds(detectedSpan) : null);

	// The expensive half — decode + expand every calendar over the serial axis. The
	// axis is the chosen date window, so a range change re-expands (unavoidable), but
	// the "all calendars" toggle still only re-runs the cheap selection below.
	const prepared = $derived.by<{ value: PreparedGrid | null; error: string | null }>(() => {
		if (!doc) return { value: null, error: null };
		try {
			const opts = effectiveRange
				? { startIso: effectiveRange.start, endIso: effectiveRange.end }
				: {};
			return { value: prepareGrid(doc, opts), error: null };
		} catch (e) {
			return { value: null, error: asMessage(e) };
		}
	});

	// The calendar roster is stable across date ranges, so the selector and its
	// default (used calendars, or all when none are referenced) derive from it cheaply.
	const calendarList = $derived(
		(prepared.value?.calendars ?? []).map((c) => ({ id: c.clndrId, name: c.name, usage: c.usage })),
	);
	const defaultSelected = $derived.by<Set<string>>(() => {
		const used = calendarList.filter((c) => c.usage > 0).map((c) => c.id);
		return new Set(used.length ? used : calendarList.map((c) => c.id));
	});
	const effectiveSelected = $derived(selectedIds ?? defaultSelected);

	// Selecting which prepared calendars to show is cheap and reuses calendar objects
	// verbatim, so toggling re-renders only the rows that actually appear or vanish.
	const built = $derived.by<{ grid: GridResult | null; error: string | null }>(() => {
		if (!prepared.value) return { grid: null, error: prepared.error };
		try {
			return {
				grid: selectGrid(prepared.value, { selectedClndrIds: effectiveSelected }),
				error: null,
			};
		} catch (e) {
			return { grid: null, error: asMessage(e) };
		}
	});
	const grid = $derived(built.grid);
	// Surface a build failure, or an export failure if the grid itself is fine.
	const statusError = $derived(built.error ?? exportError);

	// Compare mode is active once both slots hold a parsed document.
	const compareMode = $derived(!!(doc && compareDoc));

	// The diff axis is the union of both files' activity envelopes, so a calendar
	// edit that extends or shifts the schedule still has every day in view.
	const compareSpan = $derived.by<{ start: string; end: string } | null>(() => {
		if (!doc || !compareDoc) return null;
		const a = detectActivitySpan(doc);
		const b = detectActivitySpan(compareDoc);
		const starts = [a.startIso, b.startIso].filter((s): s is string => !!s).sort();
		const ends = [a.endIso, b.endIso].filter((s): s is string => !!s).sort();
		const start = starts[0];
		const end = ends.at(-1);
		if (!start || !end) return null;
		return { start, end };
	});

	// Build both grids over the shared window (all calendars, so added/removed ones
	// appear) and diff them. Errors surface in the compare strip rather than throwing.
	const compared = $derived.by<{ diff: GridDiff | null; error: string | null }>(() => {
		if (!doc || !compareDoc || !compareSpan) return { diff: null, error: null };
		try {
			const opts = { startIso: compareSpan.start, endIso: compareSpan.end, includeAll: true };
			const before = buildGrid(doc, opts);
			const after = buildGrid(compareDoc, opts);
			return { diff: diffGrids(before, after), error: null };
		} catch (e) {
			return { diff: null, error: asMessage(e) };
		}
	});

	// One virtualized grid renders both modes; each adapter maps its data onto the
	// shared view model. Null when there's nothing to show.
	const gridView = $derived(grid ? gridToView(grid) : null);
	const diffView = $derived(compared.diff ? diffToView(compared.diff) : null);

	const baseName = $derived(fileName.replace(/\.xer$/i, "") || "schedule");

	// Lead with the loaded filename so a tab is identifiable at a glance.
	const pageTitle = $derived(fileName ? `${fileName} · Xerial` : "Xerial");

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
		// A new file gets its own detected span and calendar roster; drop the old ones.
		range = null;
		selectedIds = null;
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

	/** Parse raw bytes into a document, or throw a friendly error — shared by the slots. */
	function parseBytes(bytes: Uint8Array): XerDocument {
		const parsed = parseXer(decodeXer(bytes));
		if (parsed.tables.length === 0) throw new Error("No tables found — is this a valid XER file?");
		return parsed;
	}

	async function loadCompareFile(file: File) {
		compareError = null;
		try {
			compareDoc = parseBytes(new Uint8Array(await file.arrayBuffer()));
			compareFileName = file.name;
		} catch (e) {
			compareDoc = null;
			compareError = e instanceof Error ? e.message : String(e);
		}
	}

	/** Load the baseline+revised demo pair into both slots in one click. */
	function loadCompareSample() {
		const { baseline, revised } = compareSampleXer();
		compareError = null;
		try {
			doc = parseBytes(baseline.bytes);
			fileName = baseline.name;
			range = null;
			selectedIds = null;
			compareDoc = parseBytes(revised.bytes);
			compareFileName = revised.name;
		} catch (e) {
			compareError = e instanceof Error ? e.message : String(e);
		}
	}

	/** Drop the revised slot and return to the single-file view of the baseline. */
	function exitCompare() {
		compareDoc = null;
		compareFileName = "";
		compareError = null;
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
			await saveExport(exporter, grid, `${baseName}_${grid.startIso}_to_${grid.endIso}`);
		} catch (e) {
			exportError = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function runDiffExport(exporter: DiffExporter) {
		const diff = compared.diff;
		if (!diff) return;
		busy = true;
		exportError = null;
		try {
			await saveExport(exporter, diff, `${baseName}_changes`);
		} catch (e) {
			exportError = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	// The menu emits an id; resolve it against the right format family and run it.
	function pickExport(id: string) {
		const exporter = exporters.find((e) => e.id === id);
		if (exporter) void runExport(exporter);
	}
	function pickDiffExport(id: string) {
		const exporter = diffExporters.find((e) => e.id === id);
		if (exporter) void runDiffExport(exporter);
	}

	function reset() {
		doc = null;
		fileName = "";
		error = null;
		exportError = null;
		range = null;
		selectedIds = null;
		compareDoc = null;
		compareFileName = "";
		compareError = null;
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
		// "baseline → revised" strip naming the two compared files above the diff.
		compareHead: css({
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			paddingBlock: "0.5rem",
			paddingInline: "0.9rem",
			borderBottom: "1px solid token(colors.border)",
			bg: "panel",
			fontSize: "0.82rem",
		}),
		compareFile: css({ fontWeight: 600, fontVariantNumeric: "tabular-nums" }),
		compareArrow: css({ color: "muted" }),
		compareLabel: css({
			color: "muted",
			marginRight: "0.35rem",
			textTransform: "uppercase",
			fontSize: "0.7rem",
			letterSpacing: "0.04em",
		}),
		compareError: css({ color: "danger", fontSize: "0.85rem", margin: "auto" }),
		headError: css({ color: "danger", fontSize: "0.8rem", marginLeft: "auto" }),
	};
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<Topbar>
	{#snippet actions()}
		{#if doc}
			<button class={button({ variant: "ghost" })} type="button" onclick={reset}>New file</button>
			{#if compareMode}
				<button class={button({ variant: "ghost" })} type="button" onclick={exitCompare}>
					Exit compare
				</button>
				<DownloadMenu
					items={diffExporters}
					label="Changes"
					{busy}
					disabled={busy || !compared.diff}
					onPick={pickDiffExport}
				/>
			{:else}
				<button
					class={button({ variant: "ghost" })}
					type="button"
					onclick={() => compareInput?.click()}
				>
					Compare file…
				</button>
				<DownloadMenu items={exporters} {busy} disabled={busy || !grid} onPick={pickExport} />
			{/if}
		{/if}
		<ThemeToggle />
	{/snippet}
</Topbar>

<main class={styles.main}>
	{#if compareMode && doc && compareDoc}
		<div class={styles.workbook} in:fade={{ duration: 160 }}>
			<div class={styles.compareHead}>
				<span class={styles.compareLabel}>Comparing</span>
				<span class={styles.compareFile}>{fileName}</span>
				<span class={styles.compareArrow}>→</span>
				<span class={styles.compareFile}>{compareFileName}</span>
				{#if exportError}<span class={styles.headError}>{exportError}</span>{/if}
			</div>
			<div class={styles.sheet}>
				{#if compared.error}
					<p class={styles.compareError}>{compared.error}</p>
				{:else if compared.diff && diffView}
					<DiffSummary diff={compared.diff} />
					<CalendarGrid view={diffView} />
				{/if}
			</div>
		</div>
	{:else if doc}
		<div class={styles.workbook} in:fade={{ duration: 160 }}>
			<WorkbookHeader
				{fileName}
				header={doc.header}
				calendars={calendarList}
				selected={effectiveSelected}
				onSelectionChange={(s) => (selectedIds = s)}
				span={detectedSpan}
				{bounds}
				range={effectiveRange}
				onRangeChange={(r) => (range = r)}
			/>
			<div class={styles.sheet}>
				{#if gridView && gridView.rows.length}
					<CalendarGrid view={gridView} />
				{:else if gridView}
					<p class={styles.empty}>No calendars selected. Pick some from the Calendars menu.</p>
				{/if}
			</div>
		</div>
	{:else}
		<div class={styles.main} in:fade={{ duration: 160 }}>
			<Dropzone
				{busy}
				error={error ?? compareError}
				onFile={loadFile}
				onSample={loadSample}
				onCompareSample={loadCompareSample}
			/>
		</div>
	{/if}
</main>

<input
	bind:this={compareInput}
	type="file"
	accept=".xer"
	hidden
	onchange={(e) => {
		const input = e.currentTarget;
		const file = input.files?.[0];
		if (file) void loadCompareFile(file);
		input.value = "";
	}}
/>

{#if doc && !compareMode}
	<StatusBar {grid} buildError={statusError} />
{/if}
