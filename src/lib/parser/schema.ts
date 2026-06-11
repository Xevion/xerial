/**
 * Light typed views over known XER tables. XER columns vary by P6 version, so
 * every named field is optional (`string | undefined`) and an index signature
 * keeps the rest of the row reachable — these interfaces document and autocomplete
 * the columns the app actually reads without pretending a column is guaranteed.
 *
 * `XerDocument.table` is overloaded against `KnownTables`: a known name returns
 * the typed row, any other name falls back to the raw string record.
 */

/** Any XER row: field name -> raw string value. */
export type RawRow = Record<string, string>;

export interface TaskRow {
	[field: string]: string | undefined;
	clndr_id?: string;
	act_start_date?: string;
	act_end_date?: string;
	early_start_date?: string;
	early_end_date?: string;
	target_start_date?: string;
	target_end_date?: string;
	restart_date?: string;
	reend_date?: string;
}

export interface CalendarRow {
	[field: string]: string | undefined;
	clndr_id?: string;
	clndr_name?: string;
	clndr_data?: string;
	default_flag?: string;
}

export interface ProjectRow {
	[field: string]: string | undefined;
	proj_id?: string;
	proj_short_name?: string;
}

/** Maps a known table name to its typed row shape. */
export interface KnownTables {
	TASK: TaskRow;
	CALENDAR: CalendarRow;
	PROJECT: ProjectRow;
}
