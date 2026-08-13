---
status: accepted
---

# Decommission the PHP app

The Node/Fastify port reached full parity with every PHP module (all Operation modules, plus VM&FAT/Fuel & Kurs, which issue #1 had listed as deferred but was ported on 2026-08-08 anyway). The Node app is now the one running. Kept ADR-0002's strangler-fig coexistence going past the point it was buying anything, so all PHP source (`Operation/`, `VM&FAT/*.php`, `includes/`, `config/database.php`, and the root auth/entry scripts) was deleted outright rather than left dormant — dead code with no reader is worse than no code. Superseded ADR-0002's "PHP and Node/TS coexist during the transition" framing: the transition is over.

## Consequences

- `tests/characterization/global-setup.ts` no longer spawns a `php -S` server; `targets.ts` dropped its PHP entry. The `*.characterization.spec.ts` files were kept — they run per-target via `describe.each(targets)`, not as PHP-vs-Node diffs, so they continue to exercise real Node behavior with one target instead of two.
- Root SQL dumps (`databarging.sql`, `databasemlp.sql`, `datacoalbarging.sql`, `clean/*.sql`) were kept — they're MySQL provisioning artifacts for the 3 databases the Node app still uses as-is (ADR-0002), not PHP application code.
- `usermlp.password` may still hold plaintext rows from the pre-migration era; Node's legacy-plaintext-login/rehash path (`src/services/auth.service.ts`, covered by `password-migration.node-only.spec.ts`) stays — that's a data-format concern, independent of the PHP source being gone.
