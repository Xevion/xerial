/**
 * Synthetic sample workbook for the "Try a sample" affordance. Rather than
 * shipping a static fixture, the demo builds a small but realistic XER on demand
 * and feeds it through the exact same decode → parse → grid path a dropped file
 * takes — so the sample exercises the real pipeline, not a shortcut.
 *
 * The generated content is pure ASCII, so UTF-8 and the parser's Windows-1252
 * decode agree byte-for-byte; `TextEncoder` is enough.
 */

import { isoToSerial } from "./parser";

const CRLF = "\r\n";

/** One `(0||name(k|v…)(children…))` node of the packed clndr_data s-expression. */
function node(name: string, params: Record<string, string> = {}, children = ""): string {
	const p = Object.entries(params).flat().join("|");
	return `(0||${name}(${p})(${children}))`;
}

/** "HH:MM"→"HH:MM" shifts for one day. */
type Shift = [string, string];
const shifts = (list: Shift[]) => list.map(([s, f]) => node("0", { s, f })).join("");

interface CalendarShape {
	/** P6 weekday index (1=Sun…7=Sat) → its shifts; absent days are non-working. */
	days: Partial<Record<number, Shift[]>>;
	/** Excel serials observed as full holidays. */
	holidays?: number[];
}

function clndrData({ days, holidays = [] }: CalendarShape): string {
	const week = Array.from({ length: 7 }, (_, i) =>
		node(String(i + 1), {}, shifts(days[i + 1] ?? [])),
	).join("");
	const exceptions = holidays.map((serial, i) => node(String(i), { d: String(serial) })).join("");
	return node(
		"CalendarData",
		{},
		node("DaysOfWeek", {}, week) +
			node("VIEW", { ShowTotal: "Y" }) +
			node("Exceptions", {}, exceptions),
	);
}

const office: Shift[] = [
	["08:00", "12:00"],
	["13:00", "17:00"],
];
const tenHour: Shift[] = [
	["07:00", "12:00"],
	["12:30", "17:30"],
];
const continuous: Shift[] = [["00:00", "24:00"]];

const HOLIDAY = isoToSerial("2026-01-19"); // a full-week holiday inside the span

const calendars: { id: string; name: string; defaultFlag: string; shape: CalendarShape }[] = [
	{
		id: "1",
		name: "Standard 5-Day Workweek",
		defaultFlag: "Y",
		shape: { days: { 2: office, 3: office, 4: office, 5: office, 6: office }, holidays: [HOLIDAY] },
	},
	{
		id: "2",
		name: "6-Day Construction (10h)",
		defaultFlag: "N",
		shape: {
			days: { 2: tenHour, 3: tenHour, 4: tenHour, 5: tenHour, 6: tenHour, 7: tenHour },
			holidays: [HOLIDAY],
		},
	},
	{
		id: "3",
		name: "7-Day Continuous (24h)",
		defaultFlag: "N",
		shape: {
			days: {
				1: continuous,
				2: continuous,
				3: continuous,
				4: continuous,
				5: continuous,
				6: continuous,
				7: continuous,
			},
		},
	},
	{
		id: "4",
		name: "4-Day Maintenance (Mon–Thu)",
		defaultFlag: "N",
		shape: { days: { 2: tenHour, 3: tenHour, 4: tenHour, 5: tenHour } },
	},
];

/** Activities fix the visible span and decide which calendars are "used". */
const tasks = [
	["100", "1", "2026-01-05 08:00", "2026-01-23 17:00"],
	["101", "1", "2026-01-06 08:00", "2026-01-16 17:00"],
	["102", "2", "2026-01-05 07:00", "2026-01-24 17:30"],
	["103", "3", "2026-01-07 00:00", "2026-01-21 00:00"],
];

function buildSampleXer(): string {
	const lines = [
		[
			"ERMHDR",
			"20.12",
			"2026-01-26",
			"Project",
			"demo",
			"Sample Project",
			"PRIMAVERA",
			"Project Management",
			"USD",
		].join("\t"),
		"%T\tCALENDAR",
		"%F\tclndr_id\tclndr_name\tdefault_flag\tclndr_type\tclndr_data",
		...calendars.map((c) =>
			["%R", c.id, c.name, c.defaultFlag, "CA_Base", clndrData(c.shape)].join("\t"),
		),
		"%T\tTASK",
		"%F\ttask_id\tclndr_id\ttarget_start_date\ttarget_end_date",
		...tasks.map((t) => ["%R", ...t].join("\t")),
		"%E",
	];
	return lines.join(CRLF) + CRLF;
}

/** The sample file's raw bytes plus the name it should appear under. */
export function sampleXer(): { name: string; bytes: Uint8Array } {
	return { name: "sample-project.xer", bytes: new TextEncoder().encode(buildSampleXer()) };
}
