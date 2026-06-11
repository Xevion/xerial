#!/usr/bin/env bun
/**
 * Demonstrates resolving the XER relational model into a navigable schedule:
 * joins TASK -> PROJWBS (WBS tree) and TASK <-> TASKPRED (logic network),
 * then reports the WBS outline and the activity-level driving relationships.
 *
 *   bun schedule.ts <file.xer> [--proj PROJ_ID]
 *
 * XER is essentially a SQL dump: tables are joined on *_id columns.
 * Key foreign keys exercised here:
 *   TASK.wbs_id      -> PROJWBS.wbs_id          (which WBS bucket owns the activity)
 *   PROJWBS.parent_wbs_id -> PROJWBS.wbs_id     (the WBS hierarchy itself)
 *   TASKPRED.task_id / .pred_task_id -> TASK    (successor / predecessor logic)
 */

import { readXerFile } from "./xer";

const REL_LABEL: Record<string, string> = {
  PR_FS: "FS", // finish-to-start
  PR_SS: "SS", // start-to-start
  PR_FF: "FF", // finish-to-finish
  PR_SF: "SF", // start-to-finish
};

const STATUS_LABEL: Record<string, string> = {
  TK_NotStart: "Not Started",
  TK_Active: "In Progress",
  TK_Complete: "Complete",
};

function arg(flag: string): string | undefined {
  const i = Bun.argv.indexOf(flag);
  return i === -1 ? undefined : Bun.argv[i + 1];
}

async function main() {
  const path = Bun.argv[2];
  if (!path || path.startsWith("--")) {
    console.error("Usage: bun schedule.ts <file.xer> [--proj PROJ_ID]");
    process.exit(1);
  }
  const doc = await readXerFile(path);

  const tasks = doc.table("TASK")?.rows ?? [];
  const wbs = doc.table("PROJWBS")?.rows ?? [];
  const preds = doc.table("TASKPRED")?.rows ?? [];

  // Pick a project: explicit --proj, else the one with the most activities.
  let projId = arg("--proj");
  if (!projId) {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      const id = t.proj_id ?? "";
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    projId = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  if (!projId) {
    console.error("No projects found in file.");
    process.exit(1);
  }
  console.log(`Project ${projId}\n`);

  // Indexes (the "joins").
  const taskById = new Map(tasks.map((t) => [t.task_id, t]));
  const wbsById = new Map(wbs.map((w) => [w.wbs_id, w]));

  const projTasks = tasks.filter((t) => t.proj_id === projId);
  const projWbs = wbs.filter((w) => w.proj_id === projId);

  // WBS children index for outline traversal.
  const wbsChildren = new Map<string, string[]>();
  for (const w of projWbs) {
    const parent = w.parent_wbs_id || "ROOT";
    (wbsChildren.get(parent) ?? wbsChildren.set(parent, []).get(parent)!).push(w.wbs_id ?? "");
  }
  // Activities grouped by their owning WBS.
  const tasksByWbs = new Map<string, typeof projTasks>();
  for (const t of projTasks) {
    const wid = t.wbs_id ?? "";
    (tasksByWbs.get(wid) ?? tasksByWbs.set(wid, []).get(wid)!).push(t);
  }

  // WBS outline, depth-limited for readable demo output.
  console.log("WBS outline (activity counts in brackets):");
  const roots = projWbs
    .filter((w) => !w.parent_wbs_id || !wbsById.has(w.parent_wbs_id) || w.proj_node_flag === "Y")
    .map((w) => w.wbs_id ?? "");
  const seen = new Set<string>();
  function walk(id: string, depth: number) {
    if (seen.has(id)) return;
    seen.add(id);
    const w = wbsById.get(id);
    if (!w) return;
    const direct = tasksByWbs.get(id)?.length ?? 0;
    console.log(`${"  ".repeat(depth)}* ${w.wbs_name}  [${direct}]`);
    if (depth >= 3) return; // keep the demo output readable
    for (const c of wbsChildren.get(id) ?? []) walk(c, depth + 1);
  }
  for (const r of roots) walk(r, 0);

  // Relationship-type breakdown for this project.
  const projTaskIds = new Set(projTasks.map((t) => t.task_id));
  const projPreds = preds.filter((p) => projTaskIds.has(p.task_id));
  const byRel = new Map<string, number>();
  let withLag = 0;
  for (const p of projPreds) {
    const rel = p.pred_type ?? "";
    byRel.set(rel, (byRel.get(rel) ?? 0) + 1);
    if (num(p.lag_hr_cnt)) withLag++;
  }
  console.log(`\nLogic: ${projPreds.length} relationships`);
  for (const [k, v] of [...byRel].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(REL_LABEL[k] ?? k).padEnd(4)} ${v}`);
  }
  console.log(`  with non-zero lag: ${withLag}`);

  // Sample: in-progress activities with their driving predecessors.
  console.log(`\nIn-progress activities (predecessors resolved via task_id join):`);
  const active = projTasks.filter((t) => t.status_code === "TK_Active").slice(0, 8);
  for (const t of active) {
    const ps = projPreds.filter((p) => p.task_id === t.task_id);
    console.log(`  ${t.task_code}  ${t.task_name}`);
    console.log(`      status ${STATUS_LABEL[t.status_code ?? ""] ?? t.status_code} | ` +
      `${pct(t)}% | start ${t.act_start_date || t.early_start_date || "-"} | ` +
      `finish ${t.early_end_date || t.act_end_date || "-"}`);
    for (const p of ps.slice(0, 4)) {
      const pred = taskById.get(p.pred_task_id);
      const lag = num(p.lag_hr_cnt);
      console.log(`      <- ${REL_LABEL[p.pred_type ?? ""] ?? p.pred_type}` +
        `${lag ? ` ${lag > 0 ? "+" : ""}${lag}h` : ""}  ${pred?.task_code ?? p.pred_task_id} ${pred?.task_name ?? ""}`);
    }
  }
}

function num(s: string | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function pct(t: Record<string, string>): string {
  return String(Math.round(num(t.phys_complete_pct) * 10) / 10);
}

main();
