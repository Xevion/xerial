# Timeline (bar chart) automation

Notes from automating `Bar Chart Example for RC.xlsx`, plus the prototype that
came out of it (`src/lib/timeline/`). Rendered example: [`timeline-example.svg`](timeline-example.svg).

## What the workbook actually is

A data table (`Box # | Box Title | Box Color | Text Color | Start | Finish`) and,
next to it, a chart that is **~30 hand-drawn Excel shapes** (rectangles, dashed
connectors, text boxes) sitting on top of a static picture of the month ruler.
Nothing links the two: edit a date in the table and the chart doesn't move.

Reverse-engineering the shapes' anchors against the table shows the chart _is_ a
linear date axis (~1/731 of the width per day, a bar ends at the end of its finish
day), but drawn by eye, so it has drifted from its own data:

| Box         | Table says          | Drawn as         |
| ----------- | ------------------- | ---------------- |
| 03          | ends 31‑Jul‑28      | ends ~30‑Oct‑28  |
| 07          | starts 1‑Apr‑27     | starts ~Jan‑27   |
| 08          | starts 1‑May‑27     | starts ~Jan‑27   |
| 09          | color Dark Blue     | light blue       |
| 10          | no color            | black            |
| 15          | **no dates at all** | drawn Jun–Oct 27 |
| 04 baseline | 1‑Jan → 31‑May      | ~10‑Jan → 21‑May |
| most others | —                   | 1–12 days off    |

## What the table already encodes

- **Row type lives in the `Box #` text**, via custom number formats: `Box 04` is a
  bar, `V-Bar 01` a dashed milestone line with a flag label, `V-Curt 01` a
  translucent vertical band, and `Baseline 04` (a number formatted `"Baseline "00`)
  is the thin original-plan strip under Box 04. The parser keeps that convention.
- **Box order** ("populated boxes should be ordered by Box #") is what decides
  stacking priority.
- **Color names** map to the exact hex values the table cells and shapes use.

## What the sheet is missing, and how the prototype fills it in

| Missing from the table | Derived instead                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| x position / width     | linear map of Start/Finish onto the window in "Schedule Parameters" (priority 1)                                                                             |
| Label                  | the title: shrunk, then wrapped to two lines, then placed beside the bar (priority 2)                                                                        |
| Row / y position       | first-fit stacking in Box # order; non-overlapping bars share a row, a shared hand-off date doesn't count as overlap, an overflowing label reserves its room |
| Bar height             | one constant (the drawn heights vary 140k–290k EMU only because they were dragged by hand)                                                                   |
| Text color             | contrast against the fill when the column is blank                                                                                                           |
| Month/year ruler       | generated from the window                                                                                                                                    |
| Flag collisions        | milestone flags stagger into tiers                                                                                                                           |
| Grey swim lanes        | optional 7th column `Lane` (e.g. "Building 1"); the example doesn't use it                                                                                   |

Still genuinely needs a human decision: which rows belong in a lane, and what a
row with a title but no dates (Box 15) should do — the prototype skips it with a
warning rather than guess.

## Using the prototype

```ts
const model = parseTimeline(rows, { start, finish }); // rows = the table, as arrays
const layout = layoutTimeline(model, { plotWidth: 1100 });
const svg = renderTimelineSvg(layout, { title: "Schedule – Scenario for Review" });
```

Pure data-in / SVG-out, no DOM, covered by `tests/timeline/`. Not wired into the UI
yet: it needs an `.xlsx` reader for the input side (Xerial only has a writer today)
and a download/preview surface.
