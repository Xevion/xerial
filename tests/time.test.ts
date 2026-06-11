import { describe, expect, test } from "bun:test";
import fc from "fast-check";

import {
	dateToSerial,
	fractionToMinutes,
	minutes,
	minutesToFraction,
	parseHM,
	serial,
	serialToDate,
	shiftDurationMinutes,
} from "../src/lib/parser";

const pad = (n: number) => String(n).padStart(2, "0");

describe("serial <-> date roundtrip", () => {
	test("dateToSerial inverts serialToDate over a wide range", () => {
		fc.assert(
			fc.property(fc.integer({ min: -100_000, max: 2_958_465 }), (n) => {
				expect(dateToSerial(serialToDate(serial(n)))).toBe(serial(n));
			}),
		);
	});
});

describe("time-of-day conversions", () => {
	test("HH:MM -> fraction -> minutes preserves the minute count", () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), (h, m) => {
				const frac = minutesToFraction(parseHM(`${pad(h)}:${pad(m)}`));
				expect(fractionToMinutes(frac)).toBe(h * 60 + m);
			}),
		);
	});

	test("a within-day minute maps to a fraction in [0, 1)", () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 1439 }), (m) => {
				const frac = minutesToFraction(minutes(m));
				expect(frac).toBeGreaterThanOrEqual(0);
				expect(frac).toBeLessThan(1);
			}),
		);
	});
});

describe("shift duration", () => {
	test("is always (0, 1440] and wraps past midnight when finish <= start", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 0, max: 1439 }),
				fc.integer({ min: 0, max: 1439 }),
				(start, finish) => {
					const dur = shiftDurationMinutes(minutes(start), minutes(finish));
					expect(dur).toBeGreaterThan(0);
					expect(dur).toBeLessThanOrEqual(1440);
					expect(dur).toBe(finish > start ? finish - start : finish - start + 1440);
				},
			),
		);
	});
});
