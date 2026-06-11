import { test, expect, describe } from "bun:test";
import { decodeCalendar, serialToDate, dateToSerial } from "../src/parser";
import { buildClndrData, fiveDayWeek, type ShiftSpec } from "./fixtures/builder";

describe("serial <-> date", () => {
  test("round-trips through the Excel epoch (1899-12-30)", () => {
    for (const serial of [1, 25569, 37865, 45658]) {
      expect(dateToSerial(serialToDate(serial))).toBe(serial);
    }
  });

  test("serial 25569 is the Unix epoch 1970-01-01", () => {
    expect(serialToDate(25569).toISOString().slice(0, 10)).toBe("1970-01-01");
  });
});

describe("decodeCalendar weekdays", () => {
  test("five-day week: Mon–Fri working 8h, Sun/Sat off", () => {
    const decoded = decodeCalendar(buildClndrData(fiveDayWeek()));
    const byName = Object.fromEntries(decoded.weekdays.map((w) => [w.name, w]));

    for (const name of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
      expect(byName[name]!.working).toBe(true);
      expect(byName[name]!.hours).toBe(8); // lunch gap excluded
    }
    expect(byName.Sun!.working).toBe(false);
    expect(byName.Sat!.working).toBe(false);
    expect(byName.Sat!.hours).toBe(0);
  });

  test("weekdays are sorted by P6 index with Sun..Sat labels", () => {
    const decoded = decodeCalendar(buildClndrData(fiveDayWeek()));
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

  test("a shift that wraps past midnight counts its full duration", () => {
    const night: ShiftSpec[] = [["22:00", "06:00"]];
    const decoded = decodeCalendar(buildClndrData({ days: { 2: night } }));
    const mon = decoded.weekdays.find((w) => w.name === "Mon")!;
    expect(mon.hours).toBe(8);
  });

  test("a 00:00->00:00 shift is a full 24h day", () => {
    const decoded = decodeCalendar(buildClndrData({ days: { 2: [["00:00", "00:00"]] } }));
    expect(decoded.weekdays.find((w) => w.name === "Mon")!.hours).toBe(24);
  });

  test("multiple shifts accumulate", () => {
    const split: ShiftSpec[] = [
      ["06:00", "10:00"],
      ["14:00", "18:00"],
    ];
    const decoded = decodeCalendar(buildClndrData({ days: { 4: split } }));
    const wed = decoded.weekdays.find((w) => w.name === "Wed")!;
    expect(wed.shifts).toHaveLength(2);
    expect(wed.hours).toBe(8);
  });
});

describe("decodeCalendar exceptions", () => {
  test("a shift-less exception is a non-working holiday", () => {
    const decoded = decodeCalendar(
      buildClndrData({ ...fiveDayWeek(), exceptions: [{ serial: 45658 }] }),
    );
    expect(decoded.exceptions).toHaveLength(1);
    const ex = decoded.exceptions[0]!;
    expect(ex.working).toBe(false);
    expect(ex.hours).toBe(0);
    expect(ex.iso).toBe("2025-01-01");
  });

  test("an exception with shifts overrides hours for that date", () => {
    const decoded = decodeCalendar(
      buildClndrData({
        ...fiveDayWeek(),
        exceptions: [{ serial: 45658, shifts: [["09:00", "13:00"]] }],
      }),
    );
    const ex = decoded.exceptions[0]!;
    expect(ex.working).toBe(true);
    expect(ex.hours).toBe(4);
  });

  test("exceptions are sorted by serial", () => {
    const decoded = decodeCalendar(
      buildClndrData({
        exceptions: [{ serial: 45700 }, { serial: 45658 }, { serial: 45680 }],
      }),
    );
    expect(decoded.exceptions.map((e) => e.serial)).toEqual([45658, 45680, 45700]);
  });
});

describe("decodeCalendar view + errors", () => {
  test("reads the ShowTotal flag", () => {
    expect(decodeCalendar(buildClndrData({ showTotal: true })).showTotal).toBe(true);
    expect(decodeCalendar(buildClndrData({ showTotal: false })).showTotal).toBe(false);
  });

  test("throws on a non-CalendarData root", () => {
    expect(() => decodeCalendar("(0||NotCalendar()())")).toThrow();
  });
});
