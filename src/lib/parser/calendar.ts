/**
 * Decode a CALENDAR row's packed `clndr_data` field into a weekly work pattern
 * plus exception list.
 *
 * The field is a nested s-expression-like blob of `(<header>(<params>)(<children>))`
 * nodes. The header is `|`-delimited and its last segment is the node's name;
 * params are a flat `|`-delimited key/value string; children are nested nodes:
 *
 *   (0||CalendarData()(
 *     (0||DaysOfWeek()(
 *       (0||1()())                     weekday 1 (Sunday), no shifts = off
 *       (0||2()(                       weekday 2 (Monday)
 *         (0||0(s|08:00|f|12:00)())      shift 08:00-12:00
 *         (0||1(s|13:00|f|17:00)())))    shift 13:00-17:00
 *       (0||7()())))                   weekday 7 (Saturday), off
 *     (0||VIEW(ShowTotal|N)())
 *     (0||Exceptions()(
 *       (0||0(d|37865)())              exception serial 37865, off (holiday)
 *       (0||75(d|38047)( ... ))))))    exception serial 38047, custom shifts
 *
 * P6 weekday indices run 1=Sunday to 7=Saturday. Exception `d` values are
 * Excel-style date serials (epoch 1899-12-30).
 *
 * Decoding never throws: a malformed blob yields `{ ok: false, error }`.
 */

import {
	parseHM,
	serial,
	serialToDate,
	serialToIso,
	shiftDurationMinutes,
	type IsoDate,
	type Serial,
} from "./time";

export interface Shift {
	/** "HH:MM" 24h, as stored (may be "7:00" or "07:00"). */
	start: string;
	finish: string;
}

export interface Weekday {
	/** P6 index 1..7 (1=Sunday). */
	index: number;
	/** Sun..Sat label. */
	name: string;
	working: boolean;
	shifts: Shift[];
	/** Sum of shift durations in hours. */
	hours: number;
}

export interface CalendarException {
	serial: Serial;
	date: Date;
	iso: IsoDate;
	working: boolean;
	shifts: Shift[];
	hours: number;
}

export interface DecodedCalendar {
	weekdays: Weekday[];
	/** Weekday pattern keyed by JS weekday (0=Sun..6=Sat) for grid lookup. */
	weekdaysByJsDay: Map<number, Weekday>;
	exceptions: CalendarException[];
	showTotal: boolean;
}

/** Success/failure of decoding without exceptions for the malformed case. */
export type DecodeResult = { ok: true; value: DecodedCalendar } | { ok: false; error: string };

interface RawNode {
	/** Last `|`-segment of the header (the key). */
	name: string;
	/** Parsed params, e.g. {s:"08:00", f:"17:00"} or {d:"37865"}. */
	params: Record<string, string>;
	children: RawNode[];
}

const DAY_NAMES = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Guard against a pathologically (or maliciously) deep blob blowing the stack. */
const MAX_DEPTH = 256;

/** A position-aware cursor over the packed blob, threaded through recursion. */
class Cursor {
	private i = 0;
	constructor(private readonly s: string) {}

	atEnd(): boolean {
		return this.i >= this.s.length;
	}

	peek(): string | undefined {
		return this.s[this.i];
	}

	next(): string {
		const ch = this.s[this.i];
		if (ch === undefined) throw new Error(`unexpected end of input at ${this.i}`);
		this.i++;
		return ch;
	}

	expect(ch: string): void {
		const got = this.s[this.i];
		if (got !== ch) {
			const what = got === undefined ? "end of input" : `'${got}'`;
			throw new Error(`expected '${ch}' at ${this.i}, got ${what}`);
		}
		this.i++;
	}

	/**
	 * Skip layout filler between nodes: ASCII whitespace plus the 0x7F (DEL) bytes
	 * P6 emits as indentation in the pretty-printed `clndr_data` variant.
	 */
	skipFiller(): void {
		while (!this.atEnd()) {
			const code = this.s.charCodeAt(this.i);
			if (code <= 0x20 || code === 0x7f) this.i++;
			else break;
		}
	}
}

/** Parse a flat `key|value|key|value` param string into an object. */
function parseParams(s: string): Record<string, string> {
	const out: Record<string, string> = {};
	if (s === "") return out;
	const parts = s.split("|");
	for (let i = 0; i < parts.length; i += 2) {
		const key = parts[i];
		if (key === undefined) continue;
		out[key] = parts[i + 1] ?? "";
	}
	return out;
}

/** Recursive-descent parse of one `(header(params)(children))` node. */
function parseNode(c: Cursor, depth: number): RawNode {
	if (depth > MAX_DEPTH) throw new Error(`calendar data nested deeper than ${MAX_DEPTH}`);

	c.expect("(");

	// header: everything up to the params '('
	let header = "";
	while (!c.atEnd() && c.peek() !== "(") header += c.next();
	const name = header.slice(header.lastIndexOf("|") + 1);

	// params: '(' ... ')'  flat, no nested parens
	c.expect("(");
	let paramStr = "";
	while (!c.atEnd() && c.peek() !== ")") paramStr += c.next();
	c.expect(")");

	// children: '(' node* ')'
	c.expect("(");
	const children: RawNode[] = [];
	for (;;) {
		c.skipFiller();
		if (c.peek() === "(") children.push(parseNode(c, depth + 1));
		else break;
	}
	c.expect(")"); // children close
	c.expect(")"); // node close

	return { name, params: parseParams(paramStr), children };
}

function shiftsFromNodes(nodes: RawNode[]): { shifts: Shift[]; hours: number } {
	const shifts: Shift[] = [];
	let minutes = 0;
	for (const n of nodes) {
		const start = n.params.s;
		const finish = n.params.f;
		if (start === undefined || finish === undefined) continue;
		shifts.push({ start, finish });
		minutes += shiftDurationMinutes(parseHM(start), parseHM(finish));
	}
	return { shifts, hours: minutes / 60 };
}

/** Decode a CALENDAR row's clndr_data into weekly pattern + exceptions. */
export function decodeCalendar(clndrData: string): DecodeResult {
	let root: RawNode;
	try {
		root = parseNode(new Cursor(clndrData.trim()), 0);
	} catch (err) {
		return { ok: false, error: (err as Error).message };
	}
	if (root.name !== "CalendarData") {
		return { ok: false, error: `expected CalendarData root, got '${root.name}'` };
	}

	const daysNode = root.children.find((c) => c.name === "DaysOfWeek");
	const viewNode = root.children.find((c) => c.name === "VIEW");
	const exceptionsNode = root.children.find((c) => c.name === "Exceptions");

	const weekdays: Weekday[] = [];
	const weekdaysByJsDay = new Map<number, Weekday>();
	for (const dayNode of daysNode?.children ?? []) {
		const index = Number(dayNode.name);
		const { shifts, hours } = shiftsFromNodes(dayNode.children);
		const weekday: Weekday = {
			index,
			name: DAY_NAMES[index] ?? String(index),
			working: shifts.length > 0,
			shifts,
			hours,
		};
		weekdays.push(weekday);
		// P6 index 1..7 (1=Sun) -> JS weekday 0..6 (0=Sun).
		if (Number.isInteger(index) && index >= 1 && index <= 7) {
			weekdaysByJsDay.set(index - 1, weekday);
		}
	}
	weekdays.sort((a, b) => a.index - b.index);

	const exceptions: CalendarException[] = [];
	for (const exNode of exceptionsNode?.children ?? []) {
		const raw = Number(exNode.params.d);
		if (!Number.isFinite(raw)) continue;
		const s = serial(raw);
		const { shifts, hours } = shiftsFromNodes(exNode.children);
		exceptions.push({
			serial: s,
			date: serialToDate(s),
			iso: serialToIso(s),
			working: shifts.length > 0,
			shifts,
			hours,
		});
	}
	exceptions.sort((a, b) => a.serial - b.serial);

	return {
		ok: true,
		value: {
			weekdays,
			weekdaysByJsDay,
			exceptions,
			showTotal: viewNode?.params.ShowTotal === "Y",
		},
	};
}
