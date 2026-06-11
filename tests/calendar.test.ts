import { describe, expect, test } from "bun:test";

import {
	dateToSerial,
	decodeCalendar,
	serial,
	serialToDate,
	type DecodedCalendar,
} from "../src/lib/parser";
import { buildClndrData, fiveDayWeek, type ShiftSpec } from "./fixtures/builder";

/** Decode and assert success, returning the calendar for the happy-path tests. */
function decode(data: string): DecodedCalendar {
	const result = decodeCalendar(data);
	if (!result.ok) throw new Error(`expected decode to succeed: ${result.error}`);
	return result.value;
}

describe("serial <-> date", () => {
	test("round-trips through the Excel epoch (1899-12-30)", () => {
		for (const s of [1, 25569, 37865, 45658]) {
			expect(dateToSerial(serialToDate(serial(s)))).toBe(serial(s));
		}
	});

	test("serial 25569 is the Unix epoch 1970-01-01", () => {
		expect(serialToDate(serial(25569)).toISOString().slice(0, 10)).toBe("1970-01-01");
	});
});

describe("decodeCalendar weekdays", () => {
	test("five-day week: Mon–Fri working 8h, Sun/Sat off", () => {
		const decoded = decode(buildClndrData(fiveDayWeek()));
		const byName = Object.fromEntries(decoded.weekdays.map((w) => [w.name, w]));

		for (const name of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
			expect(byName[name]?.working).toBe(true);
			expect(byName[name]?.hours).toBe(8); // lunch gap excluded
		}
		expect(byName.Sun?.working).toBe(false);
		expect(byName.Sat?.working).toBe(false);
		expect(byName.Sat?.hours).toBe(0);
	});

	test("weekdays are sorted by P6 index with Sun..Sat labels", () => {
		const decoded = decode(buildClndrData(fiveDayWeek()));
		expect(decoded.weekdays.map((w) => w.name)).toEqual([
			"Sun",
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
			"Sat",
		]);
	});

	test("weekdaysByJsDay maps JS weekday 0=Sun..6=Sat to the pattern", () => {
		const decoded = decode(buildClndrData(fiveDayWeek()));
		expect(decoded.weekdaysByJsDay.get(0)?.name).toBe("Sun"); // off
		expect(decoded.weekdaysByJsDay.get(1)?.working).toBe(true); // Mon
		expect(decoded.weekdaysByJsDay.get(6)?.working).toBe(false); // Sat
	});

	test("a shift that wraps past midnight counts its full duration", () => {
		const night: ShiftSpec[] = [["22:00", "06:00"]];
		const decoded = decode(buildClndrData({ days: { 2: night } }));
		expect(decoded.weekdays.find((w) => w.name === "Mon")?.hours).toBe(8);
	});

	test("a 00:00->00:00 shift is a full 24h day", () => {
		const decoded = decode(buildClndrData({ days: { 2: [["00:00", "00:00"]] } }));
		expect(decoded.weekdays.find((w) => w.name === "Mon")?.hours).toBe(24);
	});

	test("multiple shifts accumulate", () => {
		const split: ShiftSpec[] = [
			["06:00", "10:00"],
			["14:00", "18:00"],
		];
		const decoded = decode(buildClndrData({ days: { 4: split } }));
		const wed = decoded.weekdays.find((w) => w.name === "Wed");
		expect(wed?.shifts).toHaveLength(2);
		expect(wed?.hours).toBe(8);
	});
});

describe("decodeCalendar exceptions", () => {
	test("a shift-less exception is a non-working holiday", () => {
		const decoded = decode(buildClndrData({ ...fiveDayWeek(), exceptions: [{ serial: 45658 }] }));
		expect(decoded.exceptions).toHaveLength(1);
		const ex = decoded.exceptions[0];
		expect(ex?.working).toBe(false);
		expect(ex?.hours).toBe(0);
		expect(ex?.iso as string).toBe("2025-01-01");
	});

	test("an exception with shifts overrides hours for that date", () => {
		const decoded = decode(
			buildClndrData({
				...fiveDayWeek(),
				exceptions: [{ serial: 45658, shifts: [["09:00", "13:00"]] }],
			}),
		);
		const ex = decoded.exceptions[0];
		expect(ex?.working).toBe(true);
		expect(ex?.hours).toBe(4);
	});

	test("exceptions are sorted by serial", () => {
		const decoded = decode(
			buildClndrData({
				exceptions: [{ serial: 45700 }, { serial: 45658 }, { serial: 45680 }],
			}),
		);
		expect(decoded.exceptions.map((e) => e.serial)).toEqual([45658, 45680, 45700].map(serial));
	});
});

describe("decodeCalendar view + errors", () => {
	test("reads the ShowTotal flag", () => {
		expect(decode(buildClndrData({ showTotal: true })).showTotal).toBe(true);
		expect(decode(buildClndrData({ showTotal: false })).showTotal).toBe(false);
	});

	test("a non-CalendarData root fails, it does not throw", () => {
		const result = decodeCalendar("(0||NotCalendar()())");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("CalendarData");
	});
});
