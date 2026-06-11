#!/usr/bin/env bun
/**
 * Inspect a Primavera P6 XER file: header metadata, table inventory, the
 * project list, and a schedule/WBS/relationship overview.
 *
 *   bun inspect.ts <file.xer> [--table NAME] [--json]
 *
 * --table NAME   dump the field list + first rows of one table
 * --json         emit the structured summary as JSON instead of text
 */

import { readXerFile, type XerDocument } from "./xer";

function arg(flag: string): string | undefined {
  const i = Bun.argv.indexOf(flag);
  return i === -1 ? undefined : Bun.argv[i + 1];
}

function num(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Build a parent->children index and return root rows for a self-referential table. */
function summary(doc: XerDocument) {
  const projects = doc.table("PROJECT")?.rows ?? [];
  const tasks = doc.table("TASK")?.rows ?? [];
  const preds = doc.table("TASKPRED")?.rows ?? [];
  const wbs = doc.table("PROJWBS")?.rows ?? [];
  const rsrc = doc.table("RSRC")?.rows ?? [];

  // status_code distribution across all activities
  const byStatus = new Map<string, number>();
  for (const t of tasks) {
    const k = t.status_code || "(blank)";
    byStatus.set(k, (byStatus.get(k) ?? 0) + 1);
  }
  // task_type distribution
  const byType = new Map<string, number>();
  for (const t of tasks) {
    const k = t.task_type || "(blank)";
    byType.set(k, (byType.get(k) ?? 0) + 1);
  }

  const projSummaries = projects.map((p) => {
    const id = p.proj_id;
    const ptasks = tasks.filter((t) => t.proj_id === id);
    const done = ptasks.filter((t) => t.status_code === "TK_Complete").length;
    return {
      proj_id: id,
      short_name: p.proj_short_name,
      plan_start: p.plan_start_date,
      plan_end: p.scd_end_date || p.plan_end_date,
      data_date: p.last_recalc_date,
      task_count: ptasks.length,
      complete: done,
      pct_complete: ptasks.length ? Math.round((done / ptasks.length) * 1000) / 10 : 0,
    };
  });

  return {
    header: doc.header,
    tables: doc.tables.map((t) => ({ name: t.name, fields: t.fields.length, rows: t.rows.length })),
    totals: {
      projects: projects.length,
      activities: tasks.length,
      relationships: preds.length,
      wbs_nodes: wbs.length,
      resources: rsrc.length,
    },
    activity_status: Object.fromEntries([...byStatus].sort((a, b) => b[1] - a[1])),
    activity_type: Object.fromEntries([...byType].sort((a, b) => b[1] - a[1])),
    projects: projSummaries,
  };
}

function dumpTable(doc: XerDocument, name: string) {
  const t = doc.table(name.toUpperCase());
  if (!t) {
    console.error(`Table not found: ${name}. Available: ${doc.tables.map((x) => x.name).join(", ")}`);
    process.exit(1);
  }
  console.log(`Table ${t.name}: ${t.rows.length} rows, ${t.fields.length} fields`);
  console.log(`Fields: ${t.fields.join(", ")}`);
  console.log("\nFirst rows:");
  for (const r of t.rows.slice(0, 5)) {
    console.log("-".repeat(60));
    for (const f of t.fields) {
      const v = r[f];
      if (v) console.log(`  ${f.padEnd(24)} ${v}`);
    }
  }
}

async function main() {
  const path = Bun.argv[2];
  if (!path || path.startsWith("--")) {
    console.error("Usage: bun inspect.ts <file.xer> [--table NAME] [--json]");
    process.exit(1);
  }

  const doc = await readXerFile(path);

  const table = arg("--table");
  if (table) return dumpTable(doc, table);

  const s = summary(doc);
  if (Bun.argv.includes("--json")) {
    console.log(JSON.stringify(s, null, 2));
    return;
  }

  const h = s.header;
  console.log(`XER ${h?.version}  exported ${h?.exportDate} by ${h?.userFullName} (${h?.user})`);
  console.log(`Database: ${h?.database} | Module: ${h?.moduleName} | Currency: ${h?.currency}`);
  console.log();
  console.log(`Totals: ${s.totals.projects} projects | ${s.totals.activities} activities | ` +
    `${s.totals.relationships} relationships | ${s.totals.wbs_nodes} WBS nodes | ${s.totals.resources} resources`);

  console.log(`\nProjects:`);
  for (const p of s.projects) {
    console.log(`  [${p.proj_id}] ${p.short_name}`);
    console.log(`        ${p.task_count} activities, ${p.pct_complete}% complete | ` +
      `data date ${p.data_date} | plan ${p.plan_start} -> ${p.plan_end}`);
  }

  console.log(`\nActivity status:`);
  for (const [k, v] of Object.entries(s.activity_status)) console.log(`  ${k.padEnd(16)} ${v}`);

  console.log(`\nActivity type:`);
  for (const [k, v] of Object.entries(s.activity_type)) console.log(`  ${k.padEnd(20)} ${v}`);

  console.log(`\nTables (${s.tables.length}):`);
  for (const t of [...s.tables].sort((a, b) => b.rows - a.rows)) {
    console.log(`  ${t.name.padEnd(14)} ${String(t.rows).padStart(6)} rows  ${t.fields} fields`);
  }
}

main();
