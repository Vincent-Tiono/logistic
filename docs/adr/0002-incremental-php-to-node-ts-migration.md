---
status: superseded by ADR-0005
---

# Incrementally migrate PHP to Node/TS + Fastify, strangler-fig style

The app is ~21.8K lines of framework-less PHP (mysqli, no Composer, no tests) with 3 monolithic Operation files (3000-4400 lines). No performance, scale, or hiring problem drove this decision — the app is ~7 weeks old, single-dev, local-only, small dataset. The motivation is purely development velocity: large untested PHP files are slow to change safely. We considered modernizing PHP in place (add Composer, a framework, PHPUnit) instead, which would have been the lower-risk/lower-cost option, but chose a full language swap to Node/TS + Fastify anyway.

Migration is incremental (old PHP and new Node/TS coexist during the transition, cut over module by module), not a rewrite-from-scratch, since a full rewrite carries unbounded risk for no corresponding benefit here. Order follows the module dependency graph, not just perceived pain: scaffold+auth first (proves the stack on the smallest surface, folds in a plaintext-password fix), then the 6 dependency-free master-data modules (vessel, shipper, vendor, barges, jetty, FLF), then SI-barges (depends on master data), then the two Operation modules (TLU, coal-barging) last, since they're the largest and most calculation-heavy. Each module gets characterization tests written against current PHP behavior before porting.

## Considered Options

- **Modernize PHP in place** (Composer + framework + PHPUnit, keep PHP) — rejected: doesn't address the underlying decision to standardize on Node/TS; would be revisited later anyway.
- **Full rewrite from scratch** — rejected: solo dev, no deadline, but also no reason to accept the risk of a big-bang cutover when the app has zero live users to protect but also zero urgency forcing a rewrite window.
- **Incremental strangler-fig, dependency-ordered** (chosen) — bounded per-session scope (fits solo-dev/no-deadline/limited-context-per-session constraints), each ticket independently shippable and testable.

## Consequences

The repo will run PHP and Node/TS side by side for an extended period (no deadline forcing convergence) — routing between them stays simple only because there's no production deployment yet (`php -S localhost:8000` dev-only). If this app goes to production before the migration finishes, a reverse-proxy/routing strategy becomes a new, currently-unplanned decision. The 3 separate MySQL databases and existing schema are kept as-is for this migration; schema consolidation is explicitly out of scope and would be a separate future decision.
