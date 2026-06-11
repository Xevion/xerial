/**
 * Structured, non-fatal diagnostics raised while reading an XER file or building
 * a grid. The parser tolerates malformed input rather than throwing on it, and
 * records what it saw here so the UI can surface it instead of failing silently.
 *
 * Fatal problems (no CALENDAR table, an impossible date span) still throw
 * `GridError`; diagnostics are for the recoverable cases — a bad line, a column
 * that collided, a calendar that wouldn't decode.
 */

export type Severity = "info" | "warning" | "error";

/** Stable machine-readable identifiers for each kind of diagnostic. */
export type DiagnosticCode =
	| "MALFORMED_TABLE_HEADER"
	| "DUPLICATE_FIELD"
	| "RECORD_BEFORE_FIELDS"
	| "UNKNOWN_TOKEN"
	| "CALENDAR_DECODE_FAILED"
	| "INVALID_DATE_SPAN";

export interface Diagnostic {
	severity: Severity;
	code: DiagnosticCode;
	message: string;
	/** Optional structured detail (table name, line number, calendar id, ...). */
	context?: Record<string, unknown>;
}

/** Mutable sink that accumulates diagnostics during a parse or build pass. */
export class Diagnostics {
	private readonly items: Diagnostic[] = [];

	private add(
		severity: Severity,
		code: DiagnosticCode,
		message: string,
		context?: Record<string, unknown>,
	): void {
		this.items.push(context ? { severity, code, message, context } : { severity, code, message });
	}

	info(code: DiagnosticCode, message: string, context?: Record<string, unknown>): void {
		this.add("info", code, message, context);
	}

	warn(code: DiagnosticCode, message: string, context?: Record<string, unknown>): void {
		this.add("warning", code, message, context);
	}

	error(code: DiagnosticCode, message: string, context?: Record<string, unknown>): void {
		this.add("error", code, message, context);
	}

	/** Snapshot of every diagnostic recorded so far, in order. */
	all(): Diagnostic[] {
		return [...this.items];
	}

	hasErrors(): boolean {
		return this.items.some((d) => d.severity === "error");
	}
}
