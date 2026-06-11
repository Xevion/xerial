<script lang="ts">
	import { onMount } from "svelte";

	import {
		formatDate,
		formatTime,
		formatHours,
		weekdayLabel,
		saveExport,
		xlsxExporter,
	} from "$lib/export";
	import {
		parseXer,
		decodeXer,
		buildGrid,
		GridError,
		type Serial,
		type XerDocument,
		type GridResult,
	} from "$lib/parser";
	import { savePersisted, loadPersisted, clearPersisted } from "$lib/persist";
	import { themeStore } from "$lib/theme.svelte";

	import { css } from "styled-system/css";
	import { button } from "styled-system/recipes";

	const styles = {
		topbar: css({
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "1rem",
			padding: "0.6rem 1rem",
			bg: "topbar.bg",
			color: "topbar.fg",
			boxShadow: "topbar",
		}),
		brand: css({
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			fontWeight: 700,
			letterSpacing: "0.02em",
			// The brand shrinks slightly on narrow screens.
			sm: { fontSize: "0.9rem" },
		}),
		logo: css({ bg: "rgba(255, 255, 255, 0.15)", padding: "0.1rem 0.45rem", borderRadius: "4px" }),
		tag: css({ fontWeight: 400, fontSize: "0.85rem", opacity: 0.8 }),
		actions: css({ display: "flex", alignItems: "center", gap: "0.5rem" }),
		// Sun and moon are both mounted, centered, and cross-faded by the `_dark`
		// condition — no per-theme markup branch needed.
		sunIcon: css({
			position: "absolute",
			width: "1.15rem",
			height: "1.15rem",
			transition: "transform 0.2s ease, opacity 0.2s ease",
			transform: "rotate(0) scale(1)",
			opacity: 1,
			_dark: { transform: "rotate(-90deg) scale(0)", opacity: 0 },
		}),
		moonIcon: css({
			position: "absolute",
			width: "1.15rem",
			height: "1.15rem",
			transition: "transform 0.2s ease, opacity 0.2s ease",
			transform: "rotate(90deg) scale(0)",
			opacity: 0,
			_dark: { transform: "rotate(0) scale(1)", opacity: 1 },
		}),
		main: css({
			flex: 1,
			display: "flex",
			flexDirection: "column",
			minHeight: 0,
			padding: "1rem",
			gap: "0.75rem",
			sm: { padding: "0.6rem" },
		}),
		dropzone: css({
			flex: 1,
			display: "grid",
			placeItems: "center",
			border: "2px dashed token(colors.grid.line)",
			borderRadius: "10px",
			bg: "panel",
			cursor: "pointer",
			transition: "border-color 0.15s, background 0.15s",
			_hover: { borderColor: "accent" },
			_focusVisible: { borderColor: "accent", outline: "none" },
			'&[data-dragging="true"]': { borderColor: "accent", bg: "selection" },
		}),
		dropInner: css({ textAlign: "center", padding: "2rem" }),
		dropIcon: css({ fontSize: "2.5rem", color: "accent", marginBottom: "0.5rem" }),
		dropTitle: css({ fontSize: "1.15rem", margin: "0.25rem 0" }),
		dropSub: css({ color: "muted", fontSize: "0.9rem", margin: "0.2rem 0" }),
		error: css({ color: "danger", fontSize: "0.9rem" }),
		errorInline: css({ color: "danger", fontSize: "0.9rem", marginLeft: "auto" }),
		meta: css({ display: "flex", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }),
		metaFile: css({ fontWeight: 600 }),
		metaBits: css({
			display: "flex",
			gap: "0.75rem",
			flexWrap: "wrap",
			color: "muted",
			fontSize: "0.85rem",
		}),
		toolbar: css({ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }),
		toggle: css({
			display: "flex",
			alignItems: "center",
			gap: "0.4rem",
			fontSize: "0.85rem",
			color: "muted",
			fontWeight: 600,
			cursor: "pointer",
			"& input": { accentColor: "token(colors.accent)" },
		}),
		dims: css({ color: "muted", fontSize: "0.85rem" }),
		warn: css({ color: "warn", fontSize: "0.82rem" }),
		trunc: css({ color: "muted", fontSize: "0.82rem", margin: 0 }),
	};

	let doc = $state<XerDocument | null>(null);
	let fileName = $state("");
	let includeAll = $state(false);
	let error = $state<string | null>(null);
	let dragging = $state(false);
	let busy = $state(false);
	let fileInput = $state<HTMLInputElement>();

	// Rebuilds whenever the file or the "all calendars" toggle changes.
	const grid = $derived.by<GridResult | null>(() => {
		if (!doc) return null;
		try {
			return buildGrid(doc, { includeAll });
		} catch (e) {
			// Surface build errors without throwing during render.
			buildError = e instanceof GridError ? e.message : String(e);
			return null;
		}
	});
	let buildError = $state<string | null>(null);

	const baseName = $derived(fileName.replace(/\.xer$/i, "") || "schedule");
	const isWeekend = (serial: Serial | undefined) => {
		if (serial === undefined) return false;
		const wd = weekdayLabel(serial);
		return wd === "Sat" || wd === "Sun";
	};

	async function ingest(bytes: Uint8Array, name: string, persist: boolean) {
		error = null;
		buildError = null;
		busy = true;
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

	// Re-hydrate a file kept across a dev reload (no-op in production / fresh tab).
	onMount(async () => {
		const restored = await loadPersisted();
		if (restored && !doc) await ingest(restored.bytes, restored.name, false);
	});

	function onFiles(files: FileList | null | undefined) {
		const file = files?.[0];
		if (file) loadFile(file);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		onFiles(e.dataTransfer?.files);
	}

	async function exportXlsx() {
		if (!grid) return;
		busy = true;
		try {
			await saveExport(xlsxExporter, grid, `${baseName}-calendar-grid`);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function reset() {
		doc = null;
		fileName = "";
		error = null;
		buildError = null;
		void clearPersisted();
	}
</script>

<header class={styles.topbar}>
	<div class={styles.brand}>
		<span class={styles.logo}>Xerial</span>
		<span class={styles.tag}>P6 calendars → Excel, in your browser</span>
	</div>
	<div class={styles.actions}>
		{#if doc}
			<button class={button({ variant: "ghost" })} onclick={reset}>New file</button>
			<button class={button({ variant: "primary" })} onclick={exportXlsx} disabled={busy || !grid}>
				{busy ? "Working…" : "Download .xlsx"}
			</button>
		{/if}
		<button
			class={button({ variant: "icon" })}
			type="button"
			onclick={() => themeStore.toggle()}
			title={themeStore.isDark ? "Switch to light theme" : "Switch to dark theme"}
			aria-label="Toggle color theme"
		>
			<svg
				class={styles.sunIcon}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="4" />
				<path
					d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
				/>
			</svg>
			<svg
				class={styles.moonIcon}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
			</svg>
		</button>
	</div>
</header>

<main class={styles.main}>
	{#if !doc}
		<div
			class={styles.dropzone}
			data-dragging={dragging}
			role="button"
			tabindex="0"
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
			onclick={() => fileInput?.click()}
			onkeydown={(e) => (e.key === "Enter" || e.key === " ") && fileInput?.click()}
		>
			<div class={styles.dropInner}>
				<div class={styles.dropIcon}>⬇</div>
				<p class={styles.dropTitle}>Drop a Primavera <strong>.xer</strong> file here</p>
				<p class={styles.dropSub}>
					or click to browse · calendars are expanded to a day-by-day grid in your browser
				</p>
				{#if busy}<p class={styles.dropSub}>Parsing…</p>{/if}
				{#if error}<p class={styles.error}>{error}</p>{/if}
			</div>
			<input
				bind:this={fileInput}
				type="file"
				accept=".xer"
				hidden
				onchange={(e) => onFiles((e.currentTarget as HTMLInputElement).files)}
			/>
		</div>
	{:else}
		{@const h = doc.header}
		<section class={styles.meta}>
			<div class={styles.metaFile}>{fileName}</div>
			{#if h}
				<div class={styles.metaBits}>
					<span>P6 v{h.version}</span>
					<span>exported {h.exportDate}</span>
					{#if h.userFullName}<span>by {h.userFullName}</span>{/if}
				</div>
			{/if}
		</section>

		<section class={styles.toolbar}>
			{#if grid}
				<span class={styles.dims}>
					{grid.calendars.length} calendar{grid.calendars.length === 1 ? "" : "s"} ×
					{grid.serials.length} days · {grid.startIso} → {grid.endIso}
				</span>
			{/if}
			<label class={styles.toggle}>
				<input type="checkbox" bind:checked={includeAll} />
				Show all calendars
			</label>
			{#if grid && grid.skipped.length}
				<span class={styles.warn}>{grid.skipped.length} calendar(s) skipped (undecodable)</span>
			{/if}
			{#if buildError}<span class={styles.errorInline}>{buildError}</span>{/if}
		</section>

		{#if grid && grid.calendars.length}
			<div class="grid-wrap">
				<table class="grid">
					<thead>
						<tr>
							<th class="c-name">Calendar</th>
							<th class="c-label"></th>
							{#each grid.serials as serial (serial)}
								<th class="c-date" class:weekend={isWeekend(serial)} title={formatDate(serial)}>
									<span class="d-date">{formatDate(serial)}</span>
									<span class="d-wd">{weekdayLabel(serial)}</span>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each grid.calendars as cal (cal.clndrId)}
							<tr class="r-start">
								<td class="c-name" rowspan="3" title={cal.name}>{cal.name}</td>
								<td class="c-label">Start</td>
								{#each cal.days as day, i (i)}
									<td
										class="num"
										class:off={!day.working}
										class:weekend={isWeekend(grid.serials[i])}
									>
										{day.start !== null ? formatTime(day.start) : ""}
									</td>
								{/each}
							</tr>
							<tr class="r-end">
								<td class="c-label">End</td>
								{#each cal.days as day, i (i)}
									<td
										class="num"
										class:off={!day.working}
										class:weekend={isWeekend(grid.serials[i])}
									>
										{day.end !== null ? formatTime(day.end) : ""}
									</td>
								{/each}
							</tr>
							<tr class="r-total">
								<td class="c-label">Total Hours</td>
								{#each cal.days as day, i (i)}
									<td
										class="num hours"
										class:off={day.hours === 0}
										class:weekend={isWeekend(grid.serials[i])}
									>
										{formatHours(day.hours)}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if grid}
			<p class={styles.trunc}>No calendars to show. Try “Show all calendars”.</p>
		{/if}
	{/if}
</main>
