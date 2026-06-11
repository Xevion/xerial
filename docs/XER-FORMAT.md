# The XER format

XER is Oracle Primavera P6's interchange format: a flat, tab-delimited text dump
of the P6 relational database. Not XML, not binary. Every line starts with a
record-type token in column 0:

| Token    | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| `ERMHDR` | One per file. Header: version, export date, user, DB, app, currency. |
| `%T`     | Begins a table. Column 1 is the table name (e.g. `TASK`).            |
| `%F`     | Field names for the table currently in scope.                        |
| `%R`     | A data record. Columns map positionally onto the preceding `%F`.     |
| `%E`     | End-of-file marker.                                                  |

Things the parser has to deal with:

- Encoding is Windows-1252 (cp1252), not UTF-8. Currency symbols mojibake if you
  read them as UTF-8, so the parser decodes with `TextDecoder("windows-1252")`.
- Line endings are CRLF; trailing `\r` is stripped per line.
- Empty trailing fields are absent; missing values become `""`.
- Booleans are `Y`/`N`, dates are `YYYY-MM-DD HH:MM`, enums are prefixed
  (`TK_Complete`, `TT_Mile`, `PR_FS`, `DT_FixedDUR2`).

## Relational model

It's a SQL dump — tables join on `*_id` columns.

| Table                   | Row = one...                   | Key joins                                            |
| ----------------------- | ------------------------------ | ---------------------------------------------------- |
| `PROJECT`               | project / baseline             | `proj_id`                                            |
| `PROJWBS`               | WBS node                       | `wbs_id`, `parent_wbs_id` -> `PROJWBS` (tree)        |
| `TASK`                  | activity                       | `task_id`; FK `proj_id`, `wbs_id`, `clndr_id`        |
| `TASKPRED`              | logic relationship             | `task_id` (successor) + `pred_task_id` (predecessor) |
| `TASKRSRC`              | resource assignment            | FK `task_id`, `rsrc_id`                              |
| `TASKACTV`              | activity-code assignment       | FK `task_id`, `actv_code_id`                         |
| `RSRC`                  | resource                       | `rsrc_id`, `parent_rsrc_id` (tree)                   |
| `ACTVTYPE` / `ACTVCODE` | activity-code type / value     | `actv_code_type_id` / `actv_code_id`                 |
| `CALENDAR`              | work calendar                  | `clndr_id`; work pattern packed in `clndr_data`      |
| `UDFTYPE` / `UDFVALUE`  | user-defined field def / value | `udf_type_id`, `fk_id`                               |

Common enum prefixes: `TK_` task status, `TT_` task type, `PR_` relationship type
(FS/SS/FF/SF), `DT_` duration type, `CP_`/`QT_` percent-complete and quantity types.

## The packed `clndr_data` field

A `CALENDAR` row's work pattern is stored as a nested s-expression-like blob of
`(<header>(<params>)(<children>))` nodes. The header is `|`-delimited and its last
segment is the node's name; params are a flat `|`-delimited key/value string;
children are nested nodes:

```
(0||CalendarData()(
  (0||DaysOfWeek()(
    (0||1()())                     weekday 1 (Sunday), no shifts = off
    (0||2()(                       weekday 2 (Monday)
      (0||0(s|08:00|f|12:00)())      shift 08:00-12:00
      (0||1(s|13:00|f|17:00)())))    shift 13:00-17:00
    (0||7()())))                   weekday 7 (Saturday), off
  (0||VIEW(ShowTotal|N)())
  (0||Exceptions()(
    (0||0(d|37865)())              exception serial 37865, off (holiday)
    (0||75(d|38047)( ... ))))))    exception serial 38047, custom shifts
```

P6 weekday indices run 1=Sunday to 7=Saturday. Exception `d` values are
Excel-style date serials (epoch 1899-12-30). P6 sometimes pretty-prints the blob
with `0x7F` (DEL) bytes as indentation between nodes; the parser skips them.
