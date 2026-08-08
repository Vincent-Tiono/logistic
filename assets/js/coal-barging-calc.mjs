// Calculated-display-column formulas for the Coal Barging read views
// (Operation/9coalbarging.php). Distinct from and unrelated to
// assets/js/cycle-time.mjs's laytime/demurrage formula set — Coal Barging
// has no Cycle Time tab; these 4 formulas are simple, single-row-local
// derivations with no cross-row dependency.
//
// Per docs/adr/0001-tlu-grouped-export-computes-client-side.md's precedent,
// the server hands over raw operation_data and these formulas run here in
// the browser, not server-side.
//
// Extracted from the legacy inline <script> (9coalbarging.php:2768-2817), the
// same formulas legacy also duplicates server-side in PHP (:334-365) for the
// CSV export — this port keeps only the one copy.

/** Local copy, matching cycle-time.mjs's own parseOperationNumber — kept
 * intentionally tiny and byte-for-byte identical so there's nothing to
 * drift, same rationale as cycle-time.mjs's header comment. */
export function parseOperationNumber(value) {
  const normalized = String(value ?? '').replaceAll(',', '').trim();
  if (normalized === '') return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

// Month number (no leading zero) parsed out of a "YYYY-MM-DD[ HH:MM[:SS]]"
// completed_disch value. '' if blank/unparseable.
export function monthVesselFromCompletedDisch(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^\d{4}-(\d{2})-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/);
  if (!match) return '';

  return String(Number(match[1]));
}

// 'RC' only when the saved status_act_rc is exactly 'RC' (case/whitespace-
// insensitive); everything else (including blank) defaults to 'ACT'.
export function statusActRcValue(operationData) {
  const value = String(operationData.status_act_rc ?? '').trim().toUpperCase();
  return value === 'RC' ? 'RC' : 'ACT';
}

// Saved status_act_act_rc passes through as-is if it's 'ACT&RC' or 'ACT';
// otherwise derived from statusActRcValue ('RC' -> 'ACT&RC', else 'ACT').
export function statusActActRcValue(operationData) {
  const savedValue = String(operationData.status_act_act_rc ?? '').trim().toUpperCase();
  if (savedValue === 'ACT&RC') return 'ACT&RC';
  if (savedValue === 'ACT') return 'ACT';

  return statusActRcValue(operationData) === 'RC' ? 'ACT&RC' : 'ACT';
}

// date_jetty if saved, else falls back to completed_loading.
export function dateJettyEffectiveValue(operationData) {
  const stored = String(operationData.date_jetty ?? '').trim();
  if (stored) return stored;

  return String(operationData.completed_loading ?? '').trim();
}

// QTY DISC - QTY Laut (qty_actual), both parsed numeric. '' if either side
// is blank/non-numeric. Raw (unrounded, unformatted) value — see
// calculateDsrVsRedraft for the display-formatted version.
export function dsrVsRedraftRawValue(operationData) {
  const qtyDisc = parseOperationNumber(operationData.qty_disc);
  const qtyLaut = parseOperationNumber(operationData.qty_actual);
  if (qtyDisc === null || qtyLaut === null) return '';

  return qtyDisc - qtyLaut;
}
