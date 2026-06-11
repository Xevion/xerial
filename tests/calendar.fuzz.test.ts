import { describe, expect, test } from "bun:test";
import fc from "fast-check";

import { decodeCalendar } from "../src/lib/parser";

describe("decodeCalendar robustness", () => {
	test("never throws on arbitrary strings — failure is a Result", () => {
		fc.assert(
			fc.property(fc.string(), (s) => {
				const result = decodeCalendar(s);
				expect(typeof result.ok).toBe("boolean");
			}),
		);
	});

	test("never throws on arbitrary byte blobs decoded to text", () => {
		fc.assert(
			fc.property(fc.array(fc.integer({ min: 0, max: 255 })), (bytes) => {
				const s = String.fromCharCode(...bytes);
				expect(() => decodeCalendar(s)).not.toThrow();
			}),
		);
	});

	test("pathologically deep nesting is rejected, not a stack overflow", () => {
		const deep = "(0||x()(".repeat(5000);
		const result = decodeCalendar(deep);
		expect(result.ok).toBe(false);
	});
});
