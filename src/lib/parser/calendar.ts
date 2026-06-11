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
 */

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
	serial: number;
	date: Date;
	/** "YYYY-MM-DD". */
	iso: string;
	working: boolean;
	shifts: Shift[];
	hours: number;
}

export interface DecodedCalendar {
	weekdays: Weekday[];
	exceptions: CalendarException[];
	showTotal: boolean;
}

interface RawNode {
	/** Last `|`-segment of the header (the key). */
	name: string;
	/** Parsed params, e.g. {s:"08:00", f:"17:00"} or {d:"37865"}. */
	params: Record<string, string>;
	children: RawNode[];
}

const DAY_NAMES = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

/** Excel serial (days since 1899-12-30) -> UTC Date. */
export function serialToDate(serial: number): Date {
	return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY);
}

/** Days since 1899-12-30 for a UTC date; inverse of serialToDate. */
export function dateToSerial(date: Date): number {
	return Math.round((date.getTime() - EXCEL_EPOCH_MS) / MS_PER_DAY);
}

function isoUTC(date: Date): string {
	return date.toISOString().slice(0, 10);
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

/**
 * Skip layout filler between nodes: ASCII whitespace plus the 0x7F (DEL) bytes
 * P6 emits as indentation in the pretty-printed `clndr_data` variant.
 */
function skipFiller(s: string, pos: { i: number }): void {
	while (pos.i < s.length) {
		const code = s.charCodeAt(pos.i);
		if (code <= 0x20 || code === 0x7f) pos.i++;
		else break;
	}
}

/**
 * Recursive-descent parser over the packed blob. `pos` is a single-element
 * cursor so it threads through recursion by reference.
 */
function parseNode(s: string, pos: { i: number }): RawNode {
	// '('
	if (s[pos.i] !== "(") throw new Error(`expected '(' at ${pos.i}, got '${s[pos.i]}'`);
	pos.i++;

	// header: everything up to the params '('
	let header = "";
	while (pos.i < s.length && s[pos.i] !== "(") header += s[pos.i++];
	const name = header.slice(header.lastIndexOf("|") + 1);

	// params: '(' ... ')'  flat, no nested parens
	if (s[pos.i] !== "(") throw new Error(`expected params '(' at ${pos.i}`);
	pos.i++;
	let paramStr = "";
	while (pos.i < s.length && s[pos.i] !== ")") paramStr += s[pos.i++];
	pos.i++; // past ')'

	// children: '(' node* ')'
	if (s[pos.i] !== "(") throw new Error(`expected children '(' at ${pos.i}`);
	pos.i++;
	const children: RawNode[] = [];
	while (pos.i < s.length) {
		skipFiller(s, pos); // whitespace + the 0x7F (DEL) chars P6 uses for indentation
		if (s[pos.i] === "(") children.push(parseNode(s, pos));
		else break;
	}
	if (s[pos.i] !== ")") throw new Error(`expected children ')' at ${pos.i}`);
	pos.i++; // past children ')'

	// node ')'
	if (s[pos.i] !== ")") throw new Error(`expected node ')' at ${pos.i}`);
	pos.i++;

	return { name, params: parseParams(paramStr), children };
}

/** "HH:MM" -> minutes since midnight. */
function timeToMinutes(t: string): number {
	const [h, m] = t.split(":");
	return Number(h) * 60 + Number(m ?? 0);
}

function shiftsFromNodes(nodes: RawNode[]): { shifts: Shift[]; hours: number } {
	const shifts: Shift[] = [];
	let minutes = 0;
	for (const n of nodes) {
		const start = n.params.s;
		const finish = n.params.f;
		if (start === undefined || finish === undefined) continue;
		shifts.push({ start, finish });
		let dur = timeToMinutes(finish) - timeToMinutes(start);
		if (dur <= 0) dur += 24 * 60; // finish <= start wraps past midnight (00:00->00:00 = 24h)
		minutes += dur;
	}
	return { shifts, hours: minutes / 60 };
}

/** Decode a CALENDAR row's clndr_data into weekly pattern + exceptions. */
export function decodeCalendar(clndrData: string): DecodedCalendar {
	const root = parseNode(clndrData.trim(), { i: 0 });
	if (root.name !== "CalendarData") {
		throw new Error(`expected CalendarData root, got '${root.name}'`);
	}

	const daysNode = root.children.find((c) => c.name === "DaysOfWeek");
	const viewNode = root.children.find((c) => c.name === "VIEW");
	const exceptionsNode = root.children.find((c) => c.name === "Exceptions");

	const weekdays: Weekday[] = [];
	for (const dayNode of daysNode?.children ?? []) {
		const index = Number(dayNode.name);
		const { shifts, hours } = shiftsFromNodes(dayNode.children);
		weekdays.push({
			index,
			name: DAY_NAMES[index] ?? String(index),
			working: shifts.length > 0,
			shifts,
			hours,
		});
	}
	weekdays.sort((a, b) => a.index - b.index);

	const exceptions: CalendarException[] = [];
	for (const exNode of exceptionsNode?.children ?? []) {
		const serial = Number(exNode.params.d);
		if (!Number.isFinite(serial)) continue;
		const { shifts, hours } = shiftsFromNodes(exNode.children);
		const date = serialToDate(serial);
		exceptions.push({
			serial,
			date,
			iso: isoUTC(date),
			working: shifts.length > 0,
			shifts,
			hours,
		});
	}
	exceptions.sort((a, b) => a.serial - b.serial);

	return {
		weekdays,
		exceptions,
		showTotal: viewNode?.params.ShowTotal === "Y",
	};
}
