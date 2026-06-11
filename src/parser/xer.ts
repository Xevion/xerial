/**
 * Parser for Primavera P6 XER files.
 *
 * XER is a tab-delimited plain-text export format. Each line starts with a
 * record-type token in column 0:
 *
 *   ERMHDR  one-per-file header line (version, export date, user, db, etc.)
 *   %T      begins a table; column 1 is the table name
 *   %F      field/column names for the table currently in scope
 *   %R      a data record; columns map positionally onto the last %F
 *   %E      end-of-file marker
 *
 * Files are CRLF-terminated and encoded as Windows-1252 (cp1252), not UTF-8;
 * currency symbols (like the pound or euro sign) mojibake if read as UTF-8.
 */

export interface XerHeader {
  version: string;
  exportDate: string;
  /** Free-form project/export label (4th ERMHDR field). */
  projectFlag: string;
  user: string;
  userFullName: string;
  database: string;
  moduleName: string;
  currency: string;
  /** All raw ERMHDR fields, in order, for anything not named above. */
  raw: string[];
}

export interface XerTable {
  name: string;
  fields: string[];
  /** Each row maps field name -> raw string value (empty string when blank). */
  rows: Record<string, string>[];
}

export interface XerDocument {
  header: XerHeader | null;
  /** Tables in the order they appeared in the file. */
  tables: XerTable[];
  /** Convenience lookup by table name. */
  table(name: string): XerTable | undefined;
}

const DECODER = new TextDecoder("windows-1252");

/** Decode raw XER bytes to a string using the correct cp1252 encoding. */
export function decodeXer(bytes: Uint8Array): string {
  return DECODER.decode(bytes);
}

function parseHeader(fields: string[]): XerHeader {
  // ERMHDR\t<version>\t<date>\t<projlabel>\t<user>\t<fullname>\t<db>\t<module>\t<currency>
  const [, version, exportDate, projectFlag, user, userFullName, database, moduleName, currency] = fields;
  return {
    version: version ?? "",
    exportDate: exportDate ?? "",
    projectFlag: projectFlag ?? "",
    user: user ?? "",
    userFullName: userFullName ?? "",
    database: database ?? "",
    moduleName: moduleName ?? "",
    currency: currency ?? "",
    raw: fields.slice(1),
  };
}

/** Parse XER text (already decoded) into a structured document. */
export function parseXer(text: string): XerDocument {
  let header: XerHeader | null = null;
  const tables: XerTable[] = [];
  let current: XerTable | null = null;

  // Split on LF and strip trailing CR; tolerant of LF-only files too.
  const lines = text.split("\n");
  for (const line of lines) {
    if (line === "") continue;
    const row = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (row === "") continue;

    const tab = row.indexOf("\t");
    const tag = tab === -1 ? row : row.slice(0, tab);

    switch (tag) {
      case "ERMHDR":
        header = parseHeader(row.split("\t"));
        break;
      case "%T": {
        const name = row.slice(tab + 1).split("\t")[0]!;
        current = { name, fields: [], rows: [] };
        tables.push(current);
        break;
      }
      case "%F":
        if (current) current.fields = row.split("\t").slice(1);
        break;
      case "%R": {
        if (!current) break;
        const values = row.split("\t").slice(1);
        const record: Record<string, string> = {};
        for (let i = 0; i < current.fields.length; i++) {
          record[current.fields[i]!] = values[i] ?? "";
        }
        current.rows.push(record);
        break;
      }
      case "%E":
        break;
      default:
        // Unknown leading token: ignore (forward-compat with newer P6 tokens).
        break;
    }
  }

  return {
    header,
    tables,
    table(name: string) {
      return tables.find((t) => t.name === name);
    },
  };
}
