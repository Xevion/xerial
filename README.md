# Primavera P6 XER tooling

Read and analyze Primavera P6 `.xer` export files with Bun.

```bash
bun inspect.ts  <file.xer>                   # header, totals, project list, table inventory
bun inspect.ts  <file.xer> --table TASK      # field list + first rows of one table
bun inspect.ts  <file.xer> --json            # structured summary as JSON
bun schedule.ts <file.xer> [--proj ID]       # WBS outline + resolved logic network
bun calendars.ts <file.xer> [--used]         # decoded weekly work patterns
bun grid.ts     <file.xer> [-o out.xlsx]     # day-by-day calendar grid to .xlsx
```

`xer.ts` is the library: `readXerFile(path)` returns a typed `XerDocument`. The
other scripts are consumers built on top of it.

## The XER format

XER is Oracle Primavera P6's interchange format: a flat, tab-delimited text dump
of the P6 relational database. Not XML, not binary. Every line starts with a
record-type token in column 0:

| Token    | Meaning |
| -------- | ------- |
| `ERMHDR` | One per file. Header: version, export date, user, DB, app, currency. |
| `%T`     | Begins a table. Column 1 is the table name (e.g. `TASK`). |
| `%F`     | Field names for the table currently in scope. |
| `%R`     | A data record. Columns map positionally onto the preceding `%F`. |
| `%E`     | End-of-file marker. |

Things the parser has to deal with:

- Encoding is Windows-1252 (cp1252), not UTF-8. Currency symbols mojibake if you
  read them as UTF-8, so `xer.ts` decodes with `TextDecoder("windows-1252")`.
- Line endings are CRLF; trailing `\r` is stripped per line.
- Empty trailing fields are absent; missing values become `""`.
- Booleans are `Y`/`N`, dates are `YYYY-MM-DD HH:MM`, enums are prefixed
  (`TK_Complete`, `TT_Mile`, `PR_FS`, `DT_FixedDUR2`).

## Relational model

It's a SQL dump - tables join on `*_id` columns.

| Table | Row = one... | Key joins |
| ----- | ------------ | --------- |
| `PROJECT`  | project / baseline      | `proj_id` |
| `PROJWBS`  | WBS node                | `wbs_id`, `parent_wbs_id` -> `PROJWBS` (tree) |
| `TASK`     | activity                | `task_id`; FK `proj_id`, `wbs_id`, `clndr_id` |
| `TASKPRED` | logic relationship      | `task_id` (successor) + `pred_task_id` (predecessor) |
| `TASKRSRC` | resource assignment     | FK `task_id`, `rsrc_id` |
| `TASKACTV` | activity-code assignment| FK `task_id`, `actv_code_id` |
| `RSRC`     | resource                | `rsrc_id`, `parent_rsrc_id` (tree) |
| `ACTVTYPE` / `ACTVCODE` | activity-code type / value | `actv_code_type_id` / `actv_code_id` |
| `CALENDAR` | work calendar           | `clndr_id`; work pattern packed in `clndr_data` |
| `UDFTYPE` / `UDFVALUE` | user-defined field def / value | `udf_type_id`, `fk_id` |

Common enum prefixes: `TK_` task status, `TT_` task type, `PR_` relationship type
(FS/SS/FF/SF), `DT_` duration type, `CP_`/`QT_` percent-complete and quantity types.

## Building further

`readXerFile()` hands you every table as `Record<field, string>[]`. From there:
load into SQLite/DuckDB for querying, diff two weekly exports for schedule
slippage, compute critical path / total float, export to CSV/JSON, or feed a
Gantt renderer. Values are raw strings - cast numbers and dates at the point of
use.
