import { test, expect, describe } from "bun:test";

import { parseXer, decodeXer, encodeXer } from "../src/lib/parser";
import { buildXer } from "./fixtures/builder";

describe("decodeXer (Windows-1252)", () => {
	test("decodes high bytes as cp1252, not UTF-8", () => {
		// 0xA3 = £, 0x80 = € in Windows-1252 (both invalid as standalone UTF-8).
		expect(decodeXer(new Uint8Array([0xa3]))).toBe("£");
		expect(decodeXer(new Uint8Array([0x80]))).toBe("€");
	});

	test("plain ASCII is unchanged", () => {
		expect(decodeXer(new Uint8Array([0x41, 0x42, 0x43]))).toBe("ABC");
	});
});

describe("encodeXer (Windows-1252)", () => {
	test("encodes non-ASCII as single cp1252 bytes, not multi-byte UTF-8", () => {
		// The bug: an en-dash UTF-8-encoded to E2 80 93 becomes mojibake when read as cp1252.
		expect(Array.from(encodeXer("–"))).toEqual([0x96]);
		expect(Array.from(encodeXer("£"))).toEqual([0xa3]);
		expect(Array.from(encodeXer("€"))).toEqual([0x80]);
	});

	test("plain ASCII is unchanged", () => {
		expect(Array.from(encodeXer("ABC"))).toEqual([0x41, 0x42, 0x43]);
	});

	test("round-trips through decodeXer", () => {
		const s = "4-Day Maintenance (Mon–Thu) £€";
		expect(decodeXer(encodeXer(s))).toBe(s);
	});

	test("throws on characters cp1252 cannot represent", () => {
		expect(() => encodeXer("🚀")).toThrow();
	});
});

describe("parseXer header", () => {
	test("maps ERMHDR fields by position", () => {
		const doc = parseXer(
			buildXer({
				header: {
					version: "20.12",
					exportDate: "2025-03-04",
					user: "jdoe",
					userFullName: "Jane Doe",
					database: "PMDB",
					moduleName: "PM",
					currency: "GBP",
				},
				tables: [],
			}),
		);
		expect(doc.header).not.toBeNull();
		expect(doc.header?.version).toBe("20.12");
		expect(doc.header?.exportDate).toBe("2025-03-04");
		expect(doc.header?.user).toBe("jdoe");
		expect(doc.header?.userFullName).toBe("Jane Doe");
		expect(doc.header?.currency).toBe("GBP");
		expect(doc.header?.raw[0]).toBe("20.12");
	});

	test("header is null when absent", () => {
		const doc = parseXer(buildXer({ header: null, tables: [] }));
		expect(doc.header).toBeNull();
	});
});

describe("parseXer tables", () => {
	test("maps %F fields onto %R values positionally", () => {
		const doc = parseXer(
			buildXer({
				tables: [
					{
						name: "PROJECT",
						fields: ["proj_id", "proj_short_name"],
						rows: [{ proj_id: "1", proj_short_name: "ALPHA" }],
					},
				],
			}),
		);
		const t = doc.table("PROJECT");
		expect(t?.fields).toEqual(["proj_id", "proj_short_name"]);
		expect(t?.rows).toHaveLength(1);
		expect(t?.rows[0]).toEqual({ proj_id: "1", proj_short_name: "ALPHA" });
	});

	test("preserves table order and supports lookup by name", () => {
		const doc = parseXer(
			buildXer({
				tables: [
					{ name: "PROJECT", fields: ["proj_id"], rows: [["1"]] },
					{ name: "TASK", fields: ["task_id"], rows: [["10"], ["11"]] },
				],
			}),
		);
		expect(doc.tables.map((t) => t.name)).toEqual(["PROJECT", "TASK"]);
		expect(doc.table("TASK")?.rows).toHaveLength(2);
		expect(doc.table("MISSING")).toBeUndefined();
	});

	test("missing trailing values become empty strings", () => {
		// Row supplies only the first of three fields.
		const doc = parseXer(
			buildXer({
				tables: [{ name: "T", fields: ["a", "b", "c"], rows: [["x"]] }],
			}),
		);
		expect(doc.table("T")?.rows[0]).toEqual({ a: "x", b: "", c: "" });
	});

	test("ignores unknown leading tokens (forward-compat)", () => {
		const xer = "%T\tT\r\n%F\ta\r\n%R\t1\r\n%Q\tsome future token\r\n%R\t2\r\n%E\r\n";
		const doc = parseXer(xer);
		expect(doc.table("T")?.rows.map((r) => r.a)).toEqual(["1", "2"]);
	});

	test("tolerates LF-only line endings", () => {
		const xer = "%T\tT\n%F\ta\tb\n%R\t1\t2\n%E\n";
		const doc = parseXer(xer);
		expect(doc.table("T")?.rows[0]).toEqual({ a: "1", b: "2" });
	});

	test("empty file yields no header and no tables", () => {
		const doc = parseXer("");
		expect(doc.header).toBeNull();
		expect(doc.tables).toEqual([]);
	});
});

describe("parseXer diagnostics", () => {
	const codesOf = (xer: string) => parseXer(xer).diagnostics.map((d) => d.code);

	test("a clean file has no diagnostics", () => {
		const xer = "%T\tT\r\n%F\ta\r\n%R\t1\r\n%E\r\n";
		expect(parseXer(xer).diagnostics).toEqual([]);
	});

	test("a %T line with no table name is reported and skipped", () => {
		const xer = "%T\r\n%F\ta\r\n%R\t1\r\n%E\r\n";
		const doc = parseXer(xer);
		expect(doc.tables).toHaveLength(0);
		expect(codesOf(xer)).toContain("MALFORMED_TABLE_HEADER");
	});

	test("a duplicate column name is reported, last value wins", () => {
		const xer = "%T\tT\r\n%F\ta\ta\r\n%R\t1\t2\r\n%E\r\n";
		const doc = parseXer(xer);
		expect(doc.diagnostics.map((d) => d.code)).toContain("DUPLICATE_FIELD");
		expect(doc.table("T")?.rows[0]).toEqual({ a: "2" });
	});

	test("a record before any columns is reported and skipped", () => {
		expect(codesOf("%R\t1\r\n%E\r\n")).toContain("RECORD_BEFORE_FIELDS");
	});

	test("an unknown token is recorded as info", () => {
		const xer = "%T\tT\r\n%F\ta\r\n%Q\tfuture\r\n%R\t1\r\n%E\r\n";
		const diag = parseXer(xer).diagnostics.find((d) => d.code === "UNKNOWN_TOKEN");
		expect(diag?.severity).toBe("info");
	});
});
