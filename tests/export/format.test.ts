import { describe, expect, test } from "bun:test";

import { formatDate, formatHours, formatTime, weekdayLabel } from "../../src/lib/export";
import { dateToSerial, dayFraction } from "../../src/lib/parser";

const serialFor = (iso: string) => dateToSerial(new Date(`${iso}T00:00:00Z`));

describe("formatters", () => {
	test("formatDate renders UTC m/d/yyyy", () => {
		expect(formatDate(serialFor("2025-01-06"))).toBe("1/6/2025");
	});

	test("formatTime renders 12-hour clock", () => {
		expect(formatTime(dayFraction(8 / 24))).toBe("8:00 AM");
		expect(formatTime(dayFraction(13 / 24))).toBe("1:00 PM");
		expect(formatTime(dayFraction(0))).toBe("12:00 AM");
	});

	test("formatHours trims trailing zeros", () => {
		expect(formatHours(8)).toBe("8");
		expect(formatHours(7.5)).toBe("7.5");
		expect(formatHours(7.25)).toBe("7.25");
	});

	test("weekdayLabel maps serials to short names", () => {
		expect(weekdayLabel(serialFor("2025-01-06"))).toBe("Mon");
		expect(weekdayLabel(serialFor("2025-01-11"))).toBe("Sat");
	});
});
