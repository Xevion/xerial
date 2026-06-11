import { test, expect, describe } from "bun:test";
import { parseXer, decodeXer } from "../src/parser";
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
    expect(doc.header!.version).toBe("20.12");
    expect(doc.header!.exportDate).toBe("2025-03-04");
    expect(doc.header!.user).toBe("jdoe");
    expect(doc.header!.userFullName).toBe("Jane Doe");
    expect(doc.header!.currency).toBe("GBP");
    expect(doc.header!.raw[0]).toBe("20.12");
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
    const t = doc.table("PROJECT")!;
    expect(t.fields).toEqual(["proj_id", "proj_short_name"]);
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toEqual({ proj_id: "1", proj_short_name: "ALPHA" });
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
    expect(doc.table("TASK")!.rows).toHaveLength(2);
    expect(doc.table("MISSING")).toBeUndefined();
  });

  test("missing trailing values become empty strings", () => {
    // Row supplies only the first of three fields.
    const doc = parseXer(
      buildXer({
        tables: [{ name: "T", fields: ["a", "b", "c"], rows: [["x"]] }],
      }),
    );
    expect(doc.table("T")!.rows[0]).toEqual({ a: "x", b: "", c: "" });
  });

  test("ignores unknown leading tokens (forward-compat)", () => {
    const xer =
      "%T\tT\r\n%F\ta\r\n%R\t1\r\n%Q\tsome future token\r\n%R\t2\r\n%E\r\n";
    const doc = parseXer(xer);
    expect(doc.table("T")!.rows.map((r) => r.a)).toEqual(["1", "2"]);
  });

  test("tolerates LF-only line endings", () => {
    const xer = "%T\tT\n%F\ta\tb\n%R\t1\t2\n%E\n";
    const doc = parseXer(xer);
    expect(doc.table("T")!.rows[0]).toEqual({ a: "1", b: "2" });
  });

  test("empty file yields no header and no tables", () => {
    const doc = parseXer("");
    expect(doc.header).toBeNull();
    expect(doc.tables).toEqual([]);
  });
});
