---
status: accepted
---

# TLU Operation view splits into DOM-wiring submodules, not just calculation modules

`views/tlu-operation.ejs`'s inline `<script type="module">` had grown to ~990 lines covering four concerns: the "All Years / All Vessels" landing table, the "Cycle Time — Per Vessel" card (select cascade, timeline table, row-detail edit modal, CSV import), and the "Export CSV" grouped-export card. Every existing `assets/js/*.mjs` module (`cycle-time.mjs`, `coal-barging-calc.mjs`) is pure calculation code with zero DOM access — the page scripts do all `document.getElementById`/`addEventListener` wiring inline.

We split "Cycle Time — Per Vessel" and "Export CSV" out into `assets/js/tlu-operation-cycle-time.mjs` and `assets/js/tlu-operation-export-csv.mjs`. Unlike the existing modules, both own DOM querying and event-wiring: each exports a single `init(data)` — `initCycleTime({ vesselPeriods, optionLists })` / `initExportCsv({ vesselPeriods })` — that queries its card's own element IDs and attaches its own listeners. This is a new kind of module for the codebase; a future reader comparing it to `cycle-time.mjs` needs to know the split was deliberate, not a drift from convention.

A third file, `assets/js/tlu-operation-shared.mjs`, holds only the symbols genuinely needed by 2+ of the three sections (`CYCLE_TIME_COLUMNS`, `headerKeys`, `columnDisplayValue` and its formatting helpers, `groupRowsByVessel`, `buildRowValues`, `buildHeaderCells`, `fetchJson`, `replaceSelectOptions`, `monthNames`, `availableYearsFrom`). Helpers used by only one section moved directly into that section's file instead: `csvCell`/`triggerCsvDownload` into the export-csv submodule, `urutkanSesuaiDenganDischargeSequence`/`dischargeSequenceSortValue`/`OPERATION_EDIT_META` into the cycle-time submodule. `CYCLE_TIME_COLUMNS` staying in the shared file specifically preserves the single-source-of-truth guarantee issue #12 established (landing table, Cycle Time table, and grouped CSV export must never fork a second column/label list).

The "All Years / All Vessels" landing table was left inline — it wasn't part of this request, and its own inline script now just imports from `tlu-operation-shared.mjs` like the two new submodules do.

## Considered Options

- **Keep one inline script** — rejected: the two target sections were the largest, most self-contained chunks and the ones actually requested to move; leaving everything inline doesn't reduce the file's size or improve section boundaries.
- **Extend the existing pure-calculation-module pattern (no DOM access in `.mjs` files)** — rejected: `cycle-time.mjs`/`coal-barging-calc.mjs` only ever needed to export formulas the inline script calls per-cell. Cycle Time and Export CSV are full features (selects, listeners, fetch, modal) — forcing them into a pure-function shape would mean either duplicating all the DOM wiring back into the inline script (defeating the split) or inventing a much larger callback-passing API for no benefit.
- **One shared file holding everything above the two sections, regardless of fan-out (chosen: rejected variant)** — rejected: would have pulled export-only and cycle-time-only helpers into a file meant to represent real cross-section dependencies, turning it into a junk drawer and obscuring which symbols are actually shared.
- **Shared file scoped to true multi-consumer symbols only (chosen)** — keeps `tlu-operation-shared.mjs` an accurate map of real dependencies; single-consumer helpers live next to their one caller.

## Consequences

Any future TLU Operation view split (e.g. the landing table, if it grows) should follow the same shape: an `init(data)`-exporting submodule that self-queries its own DOM, pulling only genuinely shared symbols from `tlu-operation-shared.mjs`. `CYCLE_TIME_COLUMNS` still has exactly one definition. No new test coverage was added — this is a behavior-preserving relocation of previously-untested inline-script logic; first-time test coverage for this view (including the landing table) is a separate task.
