---
status: accepted
---

# Restore the master-data CSV template download, reversing #7/#8/#9

During the master-data migration, issues #7 (Jetty), #8 (FLF), and #9 (SI-Barges) each explicitly marked legacy's `?download=<module>_template` route as out of scope, matching the precedent already set when Vessel, Shipper, Vendor, and Barges were ported without it (issues #3-#6, silently). The button was judged skippable: Import CSV worked without it, and dropping it kept those tickets smaller.

In practice, users still relied on it in the legacy PHP app to get a correctly-headed starting CSV before using Import CSV. Its absence makes Import CSV harder to use correctly — a user has to reverse-engineer the expected columns from a failed import error instead of downloading a working starting point. Issue #16 restores it for all 7 CSV-import master-data modules (Vessel, Shipper, Vendor, Barges, Jetty, FLF, SI-Barges).

## Considered Options

- **Leave it dropped** (status quo per #7/#8/#9) — rejected: the original rationale (smaller tickets) no longer outweighs the recurring usability cost now that all 7 modules are live.
- **Restore, columns verified against the current importer** (chosen) — reuses the Coal-Barging download route/service/header pattern (`contentDispositionAttachment`, #15). Before reusing legacy's exact column list for each module, each was checked against that module's current `importXCsv`: all 7 still accept every legacy column, including ones no longer in `IMPORT_REQUIRED_COLUMNS` (Shipper's `laytime`, Vendor's `freight`) — both importers read them as optional extras when present, so legacy's templates remain fully compatible as-is.
- **Regenerate columns from `IMPORT_REQUIRED_COLUMNS` alone** — rejected: would have silently dropped `laytime`/`freight` from the Shipper/Vendor templates even though both are real, DB-backed columns the importer still uses when supplied.

## Consequences

All 7 templates are byte-identical in column shape to their legacy PHP counterparts (header order and the first example row). TLU Operation and Coal-Barging are unaffected — their own per-vessel re-import template (`?download=tlu_operation_template`) is a separate, already-ported feature.
