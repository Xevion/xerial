<script lang="ts">
  import {
    parseXer,
    decodeXer,
    buildGrid,
    GridError,
    formatDate,
    formatTime,
    formatHours,
    weekdayLabel,
    type XerDocument,
    type GridResult,
  } from "../parser";
  import { gridToXlsx, downloadBlob } from "./xlsx";

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
  const isWeekend = (serial: number) => {
    const wd = weekdayLabel(serial);
    return wd === "Sat" || wd === "Sun";
  };

  async function loadFile(file: File) {
    error = null;
    buildError = null;
    busy = true;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseXer(decodeXer(bytes));
      if (parsed.tables.length === 0) throw new Error("No tables found — is this a valid XER file?");
      doc = parsed;
      fileName = file.name;
    } catch (e) {
      doc = null;
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

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
      const blob = await gridToXlsx(grid);
      downloadBlob(blob, `${baseName}-calendar-grid.xlsx`);
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
  }
</script>

<header class="topbar">
  <div class="brand">
    <span class="logo">Xerial</span>
    <span class="tag">P6 calendars → Excel, in your browser</span>
  </div>
  {#if doc}
    <div class="actions">
      <button class="btn ghost" onclick={reset}>New file</button>
      <button class="btn primary" onclick={exportXlsx} disabled={busy || !grid}>
        {busy ? "Working…" : "Download .xlsx"}
      </button>
    </div>
  {/if}
</header>

<main>
  {#if !doc}
    <div
      class="dropzone"
      class:dragging
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
      <div class="drop-inner">
        <div class="drop-icon">⬇</div>
        <p class="drop-title">Drop a Primavera <strong>.xer</strong> file here</p>
        <p class="drop-sub">
          or click to browse · calendars are expanded to a day-by-day grid in your browser
        </p>
        {#if busy}<p class="drop-sub">Parsing…</p>{/if}
        {#if error}<p class="error">{error}</p>{/if}
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
    <section class="meta">
      <div class="meta-file">{fileName}</div>
      {#if h}
        <div class="meta-bits">
          <span>P6 v{h.version}</span>
          <span>exported {h.exportDate}</span>
          {#if h.userFullName}<span>by {h.userFullName}</span>{/if}
        </div>
      {/if}
    </section>

    <section class="toolbar">
      {#if grid}
        <span class="dims">
          {grid.calendars.length} calendar{grid.calendars.length === 1 ? "" : "s"} ×
          {grid.serials.length} days · {grid.startIso} → {grid.endIso}
        </span>
      {/if}
      <label class="toggle">
        <input type="checkbox" bind:checked={includeAll} />
        Show all calendars
      </label>
      {#if grid && grid.skipped.length}
        <span class="warn">{grid.skipped.length} calendar(s) skipped (undecodable)</span>
      {/if}
      {#if buildError}<span class="error inline">{buildError}</span>{/if}
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
                  <td class="num" class:off={!day.working} class:weekend={isWeekend(grid.serials[i]!)}>
                    {day.start !== null ? formatTime(day.start) : ""}
                  </td>
                {/each}
              </tr>
              <tr class="r-end">
                <td class="c-label">End</td>
                {#each cal.days as day, i (i)}
                  <td class="num" class:off={!day.working} class:weekend={isWeekend(grid.serials[i]!)}>
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
                    class:weekend={isWeekend(grid.serials[i]!)}
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
      <p class="trunc">No calendars to show. Try “Show all calendars”.</p>
    {/if}
  {/if}
</main>
