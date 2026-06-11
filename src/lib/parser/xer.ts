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
 *
 * Malformed lines are tolerated and recorded as diagnostics rather than thrown.
 */

import type { KnownTables, RawRow } from "./schema";

import { Diagnostics, type Diagnostic } from "./diagnostics";

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

export interface XerTable<Row = RawRow> {
	name: string;
	fields: string[];
	/** Each row maps field name -> raw string value (empty string when blank). */
	rows: Row[];
}

export interface XerDocument {
	header: XerHeader | null;
	/** Tables in the order they appeared in the file. */
	tables: XerTable[];
	/** Non-fatal problems encountered while parsing. */
	diagnostics: Diagnostic[];
	/** Convenience lookup by table name; typed for known tables. */
	table<K extends keyof KnownTables>(name: K): XerTable<KnownTables[K]> | undefined;
	table(name: string): XerTable | undefined;
}

const DECODER = new TextDecoder("windows-1252");

/** Decode raw XER bytes to a string using the correct cp1252 encoding. */
export function decodeXer(bytes: Uint8Array): string {
	return DECODER.decode(bytes);
}

function parseHeader(fields: string[]): XerHeader {
	// ERMHDR\t<version>\t<date>\t<projlabel>\t<user>\t<fullname>\t<db>\t<module>\t<currency>
	const [, version, exportDate, projectFlag, user, userFullName, database, moduleName, currency] =
		fields;
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

/** Map a table's `%F` columns positionally onto a `%R` row's values. */
function buildRow(fields: string[], values: string[]): RawRow {
	const record: RawRow = {};
	for (let i = 0; i < fields.length; i++) {
		const field = fields[i];
		if (field === undefined) continue;
		record[field] = values[i] ?? "";
	}
	return record;
}

/** Parse XER text (already decoded) into a structured document. */
export function parseXer(text: string): XerDocument {
	const diagnostics = new Diagnostics();
	let header: XerHeader | null = null;
	const tables: XerTable[] = [];
	let current: XerTable | null = null;

	// Split on LF and strip trailing CR; tolerant of LF-only files too.
	const lines = text.split("\n");
	for (let lineNo = 1; lineNo <= lines.length; lineNo++) {
		const line = lines[lineNo - 1] ?? "";
		const row = line.endsWith("\r") ? line.slice(0, -1) : line;
		if (row === "") continue;

		const tab = row.indexOf("\t");
		const tag = tab === -1 ? row : row.slice(0, tab);

		switch (tag) {
			case "ERMHDR":
				header = parseHeader(row.split("\t"));
				break;
			case "%T": {
				if (tab === -1) {
					diagnostics.warn("MALFORMED_TABLE_HEADER", "%T line has no table name; skipped.", {
						line: lineNo,
					});
					current = null;
					break;
				}
				const name = row.slice(tab + 1).split("\t")[0] ?? "";
				current = { name, fields: [], rows: [] };
				tables.push(current);
				break;
			}
			case "%F": {
				if (!current) break;
				const fields = row.split("\t").slice(1);
				const seen = new Set<string>();
				for (const field of fields) {
					if (seen.has(field)) {
						diagnostics.warn(
							"DUPLICATE_FIELD",
							`Table '${current.name}' declares column '${field}' more than once; the last value wins.`,
							{ line: lineNo, table: current.name, field },
						);
					}
					seen.add(field);
				}
				current.fields = fields;
				break;
			}
			case "%R": {
				if (!current || current.fields.length === 0) {
					diagnostics.warn("RECORD_BEFORE_FIELDS", "%R record before any %F columns; skipped.", {
						line: lineNo,
						...(current ? { table: current.name } : {}),
					});
					break;
				}
				current.rows.push(buildRow(current.fields, row.split("\t").slice(1)));
				break;
			}
			case "%E":
				break;
			default:
				diagnostics.info("UNKNOWN_TOKEN", `Ignored unrecognized record token '${tag}'.`, {
					line: lineNo,
					tag,
				});
				break;
		}
	}

	const index = new Map<string, XerTable>();
	for (const t of tables) if (!index.has(t.name)) index.set(t.name, t);

	return {
		header,
		tables,
		diagnostics: diagnostics.all(),
		table(name: string) {
			return index.get(name);
		},
	};
}
