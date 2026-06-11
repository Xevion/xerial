/**
 * Synthetic XER + clndr_data builders for tests. Lets each test construct a
 * minimal, deterministic file (or a single packed calendar blob) instead of
 * depending on large real exports. Output matches the real format: CRLF line
 * endings, tab-delimited records, the `ERMHDR`/`%T`/`%F`/`%R`/`%E` token grammar,
 * and the nested `(header(params)(children))` calendar grammar.
 */

const CRLF = "\r\n";

export interface XerHeaderSpec {
  version?: string;
  exportDate?: string;
  projectFlag?: string;
  user?: string;
  userFullName?: string;
  database?: string;
  moduleName?: string;
  currency?: string;
}

export interface XerTableSpec {
  name: string;
  fields: string[];
  /** Rows as field->value maps (missing fields become ""), or positional arrays. */
  rows: (Record<string, string> | string[])[];
}

export interface XerSpec {
  header?: XerHeaderSpec | null;
  tables: XerTableSpec[];
}

/** Build a complete XER file string from a spec. */
export function buildXer(spec: XerSpec): string {
  const lines: string[] = [];

  if (spec.header !== null) {
    const h = spec.header ?? {};
    lines.push(
      [
        "ERMHDR",
        h.version ?? "20.12",
        h.exportDate ?? "2025-01-01",
        h.projectFlag ?? "Project",
        h.user ?? "admin",
        h.userFullName ?? "Admin User",
        h.database ?? "PRIMAVERA",
        h.moduleName ?? "Project Management",
        h.currency ?? "USD",
      ].join("\t"),
    );
  }

  for (const table of spec.tables) {
    lines.push(`%T\t${table.name}`);
    lines.push(`%F\t${table.fields.join("\t")}`);
    for (const row of table.rows) {
      const values = Array.isArray(row) ? row : table.fields.map((f) => row[f] ?? "");
      lines.push(`%R\t${values.join("\t")}`);
    }
  }
  lines.push("%E");

  return lines.join(CRLF) + CRLF;
}

/** Shift as [start, finish] in "HH:MM". */
export type ShiftSpec = [string, string];

export interface CalendarSpec {
  /** P6 weekday index (1=Sun..7=Sat) -> its shifts. Missing/empty days are off. */
  days?: Partial<Record<number, ShiftSpec[]>>;
  /** Exception dates as Excel serials, each with optional shifts (empty = holiday). */
  exceptions?: { serial: number; shifts?: ShiftSpec[] }[];
  showTotal?: boolean;
}

function node(name: string, params: Record<string, string> = {}, children: string[] = []): string {
  const paramStr = Object.entries(params)
    .map(([k, v]) => `${k}|${v}`)
    .join("|");
  return `(0||${name}(${paramStr})(${children.join("")}))`;
}

function shiftNodes(shifts: ShiftSpec[]): string[] {
  return shifts.map(([s, f]) => node("0", { s, f }));
}

/** Build a packed `clndr_data` blob from a calendar spec. */
export function buildClndrData(spec: CalendarSpec): string {
  const dayNodes: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const shifts = spec.days?.[i] ?? [];
    dayNodes.push(node(String(i), {}, shiftNodes(shifts)));
  }
  const daysOfWeek = node("DaysOfWeek", {}, dayNodes);
  const view = node("VIEW", { ShowTotal: spec.showTotal ? "Y" : "N" });
  const exceptionNodes = (spec.exceptions ?? []).map((e, i) =>
    node(String(i), { d: String(e.serial) }, shiftNodes(e.shifts ?? [])),
  );
  const exceptions = node("Exceptions", {}, exceptionNodes);
  return node("CalendarData", {}, [daysOfWeek, view, exceptions]);
}

/** A standard Mon–Fri 8h/day (08:00–12:00, 13:00–17:00) calendar spec. */
export function fiveDayWeek(): CalendarSpec {
  const day: ShiftSpec[] = [
    ["08:00", "12:00"],
    ["13:00", "17:00"],
  ];
  return { days: { 2: day, 3: day, 4: day, 5: day, 6: day } };
}
