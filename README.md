# Xerial

Expand Primavera P6 `.xer` calendars into a day-by-day Excel grid — entirely in
your browser. Drop a file in, get a `Start` / `End` / `Total Hours` matrix per
calendar, download it as `.xlsx`. Nothing is uploaded; the file is parsed on your
device.

## Use it

A static site, deployed to GitHub Pages. Open it, drag a `.xer` file onto the
dropzone, and download the resulting workbook. Toggle **Show all calendars** to
include calendars not referenced by any activity.

## Develop

[Bun](https://bun.sh) + [Vite](https://vite.dev) + [Svelte 5](https://svelte.dev).

```bash
bun install
bun run dev       # local dev server (HMR)
bun run check     # svelte-check / typecheck
bun test          # parser + grid unit tests
bun run build     # production bundle -> dist/
```

## The format

`.xer` is Oracle Primavera P6's tab-delimited export of its relational database.
The parser handles the Windows-1252 encoding, CRLF lines, the
`ERMHDR`/`%T`/`%F`/`%R`/`%E` token grammar, and the nested `clndr_data` calendar
blob. See [`docs/XER-FORMAT.md`](docs/XER-FORMAT.md) for the full reference.
