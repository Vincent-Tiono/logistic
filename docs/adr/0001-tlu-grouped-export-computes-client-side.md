---
status: accepted
---

# TLU grouped CSV export computes cycle-time defaults client-side, not in PHP

Two places in `Operation/8tluoperation.php` exported/displayed cycle-time columns (Waiting Loading Jetty, Barges Arrival Early, etc.) as blank whenever a row was saved before the browser had ever computed its cycle-time defaults: the "Export CSV" submodule (`?download=tlu_grouped_export`) and the "All Years / All Vessels" landing table. Both built their output from `cycleTimeExportRow()`, which read `operation_data` raw and never ran the `calculate*` formulas that the Cycle Time submodule runs on every render via `getFieldValue()`/`columnDisplayValue()` (`assets/js/cycle-time.mjs`).

We fixed both by having PHP hand over raw rows (vessel-defaulted `operation_data`, not cycle-time-computed) as JSON, and computing the display values client-side with the same `getFieldValue()`/`columnDisplayValue()` calls the Cycle Time tab already uses per cell — instead of porting the `calculate*` formulas to PHP. Column order, labels and CSS classes for both are read directly from the live `#cycleTimeTable` thead markup rather than a second array kept in sync with it. `cycleTimeExportRow()`, `TLU_CYCLE_TIME_EXPORT_HEADERS`, `TLU_CYCLE_TIME_HEADER_CLASSES` and the `tlu_grouped_export` GET handler were deleted rather than kept as a fallback.

## Considered Options

- **Port `calculate*` formulas to PHP** — rejected: creates two implementations of the same business logic (JS + PHP) that will drift as formulas change.
- **Persist computed defaults into `operation_data` on save, backfill old rows** — rejected: the current design deliberately recomputes cycle-time defaults live (so they stay correct if cross-row inputs change later, e.g. sibling barge data); persisting would freeze values at write time and reintroduce staleness.
- **Client-side compute via AJAX (chosen)** — single source of truth stays in `cycle-time.mjs`; reuses the same `allRows` cross-row semantics (loading rate sum, disch-time prev/next comparison) already exercised by the Cycle Time tab, since the sort used to build a vessel's `allRows` (`urutkanSesuaiDenganDischargeSequence` client-side, matched by `compareTluExportRows` server-side) is already identical between the two.

## Consequences

Any future cycle-time formula change only needs to happen in `cycle-time.mjs` — no parallel PHP implementation to keep in sync, and no second header/column array to update alongside `#cycleTimeTable`'s markup. Grouped export for large scopes ("Semua Tahun") now does the fetch + compute in the browser rather than streaming from PHP; a status line communicates this instead of an instant download. The landing table's row grouping/formatting now happens per visible page (100 rows) instead of once for the whole dataset at page load, which is incidentally cheaper too.
