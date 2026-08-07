// Cycle-time / laytime / LTC (laytime charge) calculation formulas for the TLU
// "Cycle Time" table (Operation/8tluoperation.php).
//
// Extracted from the page's inline <script> so the pure calc logic can be unit
// tested with Node's built-in test runner and reasoned about independently of
// the DOM/HTML-templating code that consumes it (rowMarkup, getFieldValue).
//
// These numbers feed laytime/demurrage (LTC) charges — real financial stakes.
// Every formula below is a direct port of the original inline implementation;
// the comment above each function is the correctness spec, not the code.

// ---------------------------------------------------------------------------
// Local duplicates of two page-level helpers.
//
// parseOperationData and formatDisplayNumber both live in the page's own
// <script type="module"> because they're also used for fields that have
// nothing to do with cycle time (e.g. barge_vendor, qty, qty_disc, rc). They
// stay defined there — this module does not import from the page, since an
// inline <script type="module"> block has no URL other files can import from
// (dependencies can only flow page -> module, never module -> page).
//
// A handful of the functions below (calculateDischTimeLoadingRate,
// sortRowsByCompletedDisch, getFieldValue) still need this exact decoding
// logic internally to stay self-contained and pure. Kept intentionally tiny
// and byte-for-byte identical to the page's copy so there's nothing to drift.
// ---------------------------------------------------------------------------

function parseOperationData(value) {
  if (value && typeof value === 'object') return value;
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function formatDisplayNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const normalized = text.replaceAll(',', '').replaceAll(' ', '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return text;

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6
  }).format(Number(normalized));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseOperationNumber(value) {
  const normalized = String(value ?? '').replaceAll(',', '').trim();
  if (normalized === '') return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

// Laycan Start/End are stored as bare "YYYY-MM-DD" dates. Date.parse() treats a
// date-only string as UTC midnight but a "YYYY-MM-DD HH:MM:SS" string (once the
// space is swapped for "T") as local midnight — mixing the two would shift Laycan
// Start/End by the local UTC offset relative to Arrival Jetty/Start Loading. Anchor
// the bare date to local midnight explicitly so all values share the same basis.
export function parseLaycanDateTime(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return NaN;
  return Date.parse(s.includes(' ') || s.includes('T') ? s.replace(' ', 'T') : `${s}T00:00:00`);
}

export function formatCycleTimeNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const normalized = text.replaceAll(',', '').replaceAll(' ', '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return text;

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4
  }).format(Number(normalized));
}

// ---------------------------------------------------------------------------
// The 28 calculate* formulas (plus calculateCargoReadinessP3, its own helper
// dependency of the orchestrator below).
// ---------------------------------------------------------------------------

export function calculateQtyActual(data) {
  const qtyDisc = parseOperationNumber(data.qty_disc);
  const rc = parseOperationNumber(data.rc);
  if (qtyDisc === null && rc === null) return '';

  return formatDisplayNumber((qtyDisc ?? 0) + (rc ?? 0));
}

// Default for Waiting Loading Jetty: 0 if Laycan Start is empty, else (Start Loading - Arrival Jetty) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateWaitingLoadingJetty(laycanStart, data) {
  if (!String(laycanStart ?? '').trim()) return 0;

  const startLoading = Date.parse(String(data.start_loading ?? '').trim().replace(' ', 'T'));
  const arrivalJetty = Date.parse(String(data.arrival_jetty ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(startLoading) || !Number.isFinite(arrivalJetty)) return '';

  return (startLoading - arrivalJetty) / 86400000;
}

// Default for Barges Arrival Early: conditional formula comparing Arrival Jetty against Laycan Start/End.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateBargesArrivalEarly(row, data) {
  const laycanStartRaw = String(row.laycan_start ?? '').trim();
  if (!laycanStartRaw) return 0;

  const laycanStart = parseLaycanDateTime(laycanStartRaw);
  const laycanEnd = parseLaycanDateTime(row.laycan_end);
  const arrivalJetty = Date.parse(String(data.arrival_jetty ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(laycanStart) || !Number.isFinite(arrivalJetty)) return '';

  if (arrivalJetty > laycanStart && Number.isFinite(laycanEnd) && arrivalJetty >= laycanEnd) {
    return 0;
  }

  const startLoading = Date.parse(String(data.start_loading ?? '').trim().replace(' ', 'T'));
  const daysBetween = (end, start) => (end - start) / 86400000;

  if (Number.isFinite(laycanEnd) && laycanStart < arrivalJetty && arrivalJetty < laycanEnd) {
    return Number.isFinite(startLoading) ? daysBetween(startLoading, arrivalJetty) : '';
  }

  if (arrivalJetty < laycanStart && Number.isFinite(startLoading) && startLoading < laycanStart) {
    return daysBetween(startLoading, arrivalJetty);
  }

  return daysBetween(laycanStart, arrivalJetty);
}

// Default for Waiting Plan Loading: (Waiting Loading Jetty - Barges Arrival Early), floored at 0.
// Inputs/output are raw (unrounded) numbers — rounding only happens at display time via formatCycleTimeNumber.
export function calculateWaitingPlanLoading(bargesArrivalEarly, waitingLoadingJetty) {
  if (bargesArrivalEarly === null || waitingLoadingJetty === null) return '';

  const diff = waitingLoadingJetty - bargesArrivalEarly;
  return diff < 0 ? 0 : diff;
}

// Default for Check Waiting Loading Jetty: True if Waiting Loading Jetty equals Barges Arrival Early + Waiting Plan Loading.
// Compares raw (unrounded) numbers with a tiny epsilon for floating-point safety, not the rounded display values.
export function calculateCheckWaitingLoadingJetty(waitingLoadingJetty, bargesArrivalEarly, waitingPlanLoading) {
  if (waitingLoadingJetty === null || bargesArrivalEarly === null || waitingPlanLoading === null) return '';

  const sum = bargesArrivalEarly + waitingPlanLoading;
  return Math.abs(waitingLoadingJetty - sum) < 1e-9 ? 'True' : 'False';
}

// Default for Loading Time Jetty: 0 if Completed Loading is empty, else (Completed Loading - Start Loading) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateLoadingTimeJetty(data) {
  const completedLoadingRaw = String(data.completed_loading ?? '').trim();
  if (!completedLoadingRaw) return 0;

  const completedLoading = Date.parse(completedLoadingRaw.replace(' ', 'T'));
  const startLoading = Date.parse(String(data.start_loading ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(completedLoading) || !Number.isFinite(startLoading)) return '';

  return (completedLoading - startLoading) / 86400000;
}

// Default for Disch Time for Loading Rate: 0 if Completed Disch is empty, else (Completed Disch - Start Disch) in days.
// Rule priority (checked in order, first match wins), based on discharge-sequence order (allRows):
//   1. Sandwich rule (top priority): this row's Start Disch equals the PREVIOUS row's Start Disch AND
//      this row's Completed Disch equals the NEXT row's Completed Disch → 0. (Prev/next rows are not forced by
//      this rule — each still resolves through this same cascade independently, e.g. rule 2 below.)
//   2. Consecutive-pair rule: this row's Start Disch and Completed Disch both equal the PREVIOUS row's → 0.
//   3. Default: Completed Disch − Start Disch (days).
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateDischTimeLoadingRate(row, data, allRows) {
  const completedDischRaw = String(data.completed_disch ?? '').trim();
  if (!completedDischRaw) return 0;

  const startDischRaw = String(data.start_disch ?? '').trim();

  const rows = allRows || [row];
  const idx = rows.findIndex(r => Number(r.id) === Number(row.id));
  const prevData = idx > 0 ? parseOperationData(rows[idx - 1].operation_data) : null;
  const nextData = idx >= 0 && idx < rows.length - 1 ? parseOperationData(rows[idx + 1].operation_data) : null;

  const prevStartDischRaw = prevData ? String(prevData.start_disch ?? '').trim() : '';
  const prevCompletedDischRaw = prevData ? String(prevData.completed_disch ?? '').trim() : '';
  const nextCompletedDischRaw = nextData ? String(nextData.completed_disch ?? '').trim() : '';

  if (prevData && nextData && startDischRaw && prevStartDischRaw === startDischRaw
      && nextCompletedDischRaw && nextCompletedDischRaw === completedDischRaw) {
    return 0;
  }

  if (prevData && prevCompletedDischRaw && prevCompletedDischRaw === completedDischRaw && prevStartDischRaw === startDischRaw) {
    return 0;
  }

  const completedDisch = Date.parse(completedDischRaw.replace(' ', 'T'));
  const startDisch = Date.parse(startDischRaw.replace(' ', 'T'));
  if (!Number.isFinite(completedDisch) || !Number.isFinite(startDisch)) return '';

  return (completedDisch - startDisch) / 86400000;
}

// Default for Disch Time: 0 if Completed Disch is empty, else (Completed Disch - Start Disch) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateDischTimePercent(data) {
  const completedDischRaw = String(data.completed_disch ?? '').trim();
  if (!completedDischRaw) return 0;

  const completedDisch = Date.parse(completedDischRaw.replace(' ', 'T'));
  const startDisch = Date.parse(String(data.start_disch ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(completedDisch) || !Number.isFinite(startDisch)) return '';

  return (completedDisch - startDisch) / 86400000;
}

// Default for Pure Time: 0 if Start Disch is empty, else (Start Disch - TA Barges Actual) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculatePureTime(data) {
  const startDischRaw = String(data.start_disch ?? '').trim();
  if (!startDischRaw) return 0;

  const startDisch = Date.parse(startDischRaw.replace(' ', 'T'));
  const taBargesActual = Date.parse(String(data.ta_barges_actual ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(startDisch) || !Number.isFinite(taBargesActual)) return '';

  return (startDisch - taBargesActual) / 86400000;
}

// Default for Total CT LTC: 0 if Arrival Jetty is empty, else (Back to Jetty - Arrival Jetty) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateTotalCtLtc(data) {
  const arrivalJettyRaw = String(data.arrival_jetty ?? '').trim();
  if (!arrivalJettyRaw) return 0;

  const arrivalJetty = Date.parse(arrivalJettyRaw.replace(' ', 'T'));
  const backToJetty = Date.parse(String(data.back_to_jetty ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(arrivalJetty) || !Number.isFinite(backToJetty)) return '';

  return (backToJetty - arrivalJetty) / 86400000;
}

// Default for LTC Day: Laytime - (Total CT LTC - Barges Arrival Early); capped at 0 when that result is positive.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateLtcDay(laytime, totalCtLtc, bargesArrivalEarly) {
  if (laytime === null || totalCtLtc === null || bargesArrivalEarly === null) return '';

  const diff = laytime - (totalCtLtc - bargesArrivalEarly);
  return diff > 0 ? 0 : diff;
}

// Default for LTC Total: LTC Rate * LTC Day.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateLtcTotal(ltcRate, ltcDay) {
  if (ltcRate === null || ltcDay === null) return '';

  return ltcRate * ltcDay;
}

// Default for Back to Jetty Time: 0 if Back to Jetty is empty, else (Back to Jetty - Completed Disch) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateBackToJettyTime(data) {
  const backToJettyRaw = String(data.back_to_jetty ?? '').trim();
  if (!backToJettyRaw) return 0;

  const backToJetty = Date.parse(backToJettyRaw.replace(' ', 'T'));
  const completedDisch = Date.parse(String(data.completed_disch ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(backToJetty) || !Number.isFinite(completedDisch)) return '';

  return (backToJetty - completedDisch) / 86400000;
}

// Default for Part 1: 0 if Clear Pass is empty, else (Clear Pass - Completed Loading) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculatePart1(data) {
  const clearPassRaw = String(data.clear_pass ?? '').trim();
  if (!clearPassRaw) return 0;

  const clearPass = Date.parse(clearPassRaw.replace(' ', 'T'));
  const completedLoading = Date.parse(String(data.completed_loading ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(clearPass) || !Number.isFinite(completedLoading)) return '';

  return (clearPass - completedLoading) / 86400000;
}

// Default for Part 2: 0 if Clear Pass is empty, else (TA Barges Actual - Clear Pass) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculatePart2(data) {
  const clearPassRaw = String(data.clear_pass ?? '').trim();
  if (!clearPassRaw) return 0;

  const clearPass = Date.parse(clearPassRaw.replace(' ', 'T'));
  const taBargesActual = Date.parse(String(data.ta_barges_actual ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(clearPass) || !Number.isFinite(taBargesActual)) return '';

  return (taBargesActual - clearPass) / 86400000;
}

// Default for Sailing Time: 0 if Clear Pass is empty; else if Cast Off Mooring Clear Pass is empty,
// (TA Barges Actual - Clear Pass) in days; else (TA Barges Actual - Cast Off Mooring Clear Pass) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateSailingTime(data) {
  const clearPassRaw = String(data.clear_pass ?? '').trim();
  if (!clearPassRaw) return 0;

  const taBargesActual = Date.parse(String(data.ta_barges_actual ?? '').trim().replace(' ', 'T'));
  const castOffMooringClearPassRaw = String(data.cast_off_mooring_clear_pass ?? '').trim();

  if (!castOffMooringClearPassRaw) {
    const clearPass = Date.parse(clearPassRaw.replace(' ', 'T'));
    if (!Number.isFinite(clearPass) || !Number.isFinite(taBargesActual)) return '';
    return (taBargesActual - clearPass) / 86400000;
  }

  const castOffMooringClearPass = Date.parse(castOffMooringClearPassRaw.replace(' ', 'T'));
  if (!Number.isFinite(castOffMooringClearPass) || !Number.isFinite(taBargesActual)) return '';

  return (taBargesActual - castOffMooringClearPass) / 86400000;
}

// Default for Mooring 2: 0 if Clear Pass is empty, else (Part 2 - Sailing Time) in days.
// part2 and sailingTime are already-resolved raw (unrounded) numbers from getFieldValue/rowMarkup.
export function calculateMooring2(data, part2, sailingTime) {
  const clearPassRaw = String(data.clear_pass ?? '').trim();
  if (!clearPassRaw) return 0;

  if (part2 === null || sailingTime === null) return '';

  return part2 - sailingTime;
}

// Default for Check Part 2: True if Part 2 equals Mooring 2 + Sailing Time.
// Compares raw (unrounded) numbers with a tiny epsilon for floating-point safety, not the rounded display values.
export function calculateCheckPart2(part2, mooring2, sailingTime) {
  if (part2 === null || mooring2 === null || sailingTime === null) return '';

  const sum = mooring2 + sailingTime;
  return Math.abs(part2 - sum) < 1e-9 ? 'True' : 'False';
}

// Default for Total Waiting Disch MV: Mooring 2 + Pure Time.
// Inputs/output are raw (unrounded) numbers — rounding only happens at display time via formatCycleTimeNumber.
export function calculateTotalWaitingDischMv(mooring2, pureTime) {
  if (mooring2 === null || pureTime === null) return '';

  return mooring2 + pureTime;
}

// Default for Waiting Cargo Readiness (P2): IFERROR(Waiting Cargo Readiness (P3) / Pure Time * Total Waiting Disch MV, 0).
// Mirrors spreadsheet IFERROR semantics: blank/non-numeric inputs and division-by-zero all fall back to 0.
export function calculateWaitingCargoReadiness(waitingCargoReadinessP3, pureTime, totalWaitingDischMv) {
  const numerator = waitingCargoReadinessP3 ?? 0;
  const denominator = pureTime ?? 0;
  const multiplier = totalWaitingDischMv ?? 0;
  if (!denominator) return 0;

  const result = (numerator / denominator) * multiplier;
  return Number.isFinite(result) ? result : 0;
}

// Default for Waiting MV (P2): IFERROR(Waiting MV (P3) / Pure Time * Total Waiting Disch MV, 0).
// Mirrors spreadsheet IFERROR semantics: blank/non-numeric inputs and division-by-zero all fall back to 0.
export function calculateWaitingMv(waitingMvP3, pureTime, totalWaitingDischMv) {
  const numerator = waitingMvP3 ?? 0;
  const denominator = pureTime ?? 0;
  const multiplier = totalWaitingDischMv ?? 0;
  if (!denominator) return 0;

  const result = (numerator / denominator) * multiplier;
  return Number.isFinite(result) ? result : 0;
}

// Default for Waiting FLF (P2): IFERROR(Waiting FLF (P3) / Pure Time * Total Waiting Disch MV, 0).
// Mirrors spreadsheet IFERROR semantics: blank/non-numeric inputs and division-by-zero all fall back to 0.
export function calculateWaitingFlf(waitingFlfP3, pureTime, totalWaitingDischMv) {
  const numerator = waitingFlfP3 ?? 0;
  const denominator = pureTime ?? 0;
  const multiplier = totalWaitingDischMv ?? 0;
  if (!denominator) return 0;

  const result = (numerator / denominator) * multiplier;
  return Number.isFinite(result) ? result : 0;
}

// Default for Waiting Queueing (P2): IFERROR(Waiting Queuing (P3) / Pure Time * Total Waiting Disch MV, 0).
// Mirrors spreadsheet IFERROR semantics: blank/non-numeric inputs and division-by-zero all fall back to 0.
export function calculateWaitingQueueing(waitingQueuingP3, pureTime, totalWaitingDischMv) {
  const numerator = waitingQueuingP3 ?? 0;
  const denominator = pureTime ?? 0;
  const multiplier = totalWaitingDischMv ?? 0;
  if (!denominator) return 0;

  const result = (numerator / denominator) * multiplier;
  return Number.isFinite(result) ? result : 0;
}

// Default for Other Factor (P2): IFERROR(Other Factor (P3) / Pure Time * Total Waiting Disch MV, 0).
// Mirrors spreadsheet IFERROR semantics: blank/non-numeric inputs and division-by-zero all fall back to 0.
export function calculateOtherFactor(otherFactorP3, pureTime, totalWaitingDischMv) {
  const numerator = otherFactorP3 ?? 0;
  const denominator = pureTime ?? 0;
  const multiplier = totalWaitingDischMv ?? 0;
  if (!denominator) return 0;

  const result = (numerator / denominator) * multiplier;
  return Number.isFinite(result) ? result : 0;
}

// Default for Waiting Sequence (P2): IFERROR(Waiting Sequence (P3) / Pure Time * Total Waiting Disch MV, 0).
// Mirrors spreadsheet IFERROR semantics: blank/non-numeric inputs and division-by-zero all fall back to 0.
export function calculateWaitingSequence(waitingSequenceP3, pureTime, totalWaitingDischMv) {
  const numerator = waitingSequenceP3 ?? 0;
  const denominator = pureTime ?? 0;
  const multiplier = totalWaitingDischMv ?? 0;
  if (!denominator) return 0;

  const result = (numerator / denominator) * multiplier;
  return Number.isFinite(result) ? result : 0;
}

// Default for LHV Time: 0 if LHV is empty, else (LHV - Completed Loading) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateLhvTime(data) {
  const lhvRaw = String(data.lhv ?? '').trim();
  if (!lhvRaw) return 0;

  const lhv = Date.parse(lhvRaw.replace(' ', 'T'));
  const completedLoading = Date.parse(String(data.completed_loading ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(lhv) || !Number.isFinite(completedLoading)) return '';

  return (lhv - completedLoading) / 86400000;
}

// Default for Clear Pass Time: 0 if Clear Pass is empty, else (Clear Pass - End Mooring) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
export function calculateClearPassTime(data) {
  const clearPassRaw = String(data.clear_pass ?? '').trim();
  if (!clearPassRaw) return 0;

  const clearPass = Date.parse(clearPassRaw.replace(' ', 'T'));
  const endMooring = Date.parse(String(data.end_mooring ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(clearPass) || !Number.isFinite(endMooring)) return '';

  return (clearPass - endMooring) / 86400000;
}

// Default for SPOG Time: Part 1 - (LHV Time + Clear Pass Time).
// Inputs/output are raw (unrounded) numbers — rounding only happens at display time via formatCycleTimeNumber.
export function calculateSpogTime(part1, lhvTime, clearPassTime) {
  if (part1 === null || lhvTime === null || clearPassTime === null) return '';

  return part1 - (lhvTime + clearPassTime);
}

// Default for Check Part 1: True if Part 1 equals LHV Time + SPOG Time + Clear Pass Time.
// Compares raw (unrounded) numbers with a tiny epsilon for floating-point safety, not the rounded display values.
export function calculateCheckPart1(part1, lhvTime, spogTime, clearPassTime) {
  if (part1 === null || lhvTime === null || spogTime === null || clearPassTime === null) return '';

  const sum = lhvTime + spogTime + clearPassTime;
  return Math.abs(part1 - sum) < 1e-9 ? 'True' : 'False';
}

// Default for Check Waiting Time Disch MV: True if Pure Time equals the sum of the (P3) waiting components.
// Compares raw (unrounded) numbers with a tiny epsilon for floating-point safety, not the rounded display values.
export function calculateCheckWaitingTimeDischMv(pureTime, waitingCargoReadinessP3, waitingMvP3, waitingFlfP3, waitingQueuingP3, waitingSequenceP3, otherFactorP3) {
  if (pureTime === null || waitingCargoReadinessP3 === null || waitingMvP3 === null || waitingFlfP3 === null || waitingQueuingP3 === null || waitingSequenceP3 === null || otherFactorP3 === null) return '';

  const sum = waitingCargoReadinessP3 + waitingMvP3 + waitingFlfP3 + waitingQueuingP3 + waitingSequenceP3 + otherFactorP3;
  return Math.abs(pureTime - sum) < 1e-9 ? 'True' : 'False';
}

// Sum of Disch Time for Loading Rate across every barge row of the vessel (not just the filtered/sorted rows shown).
export function sumDischTimeLoadingRate(allRows) {
  return (allRows || []).reduce((sum, r) => {
    return sum + (parseOperationNumber(getFieldValue(r, 'disch_time_loading_rate', allRows)) ?? 0);
  }, 0);
}

// Default for Loading Rate: IFERROR(Stowage Plan / SUM(Disch Time for Loading Rate), 0).
// Stowage Plan is a vessel-level value shared by every barge row; the sum runs over all barge rows of the vessel.
export function calculateLoadingRate(stowageplanMt, totalDischTimeLoadingRate) {
  const numerator = stowageplanMt ?? 0;
  const denominator = totalDischTimeLoadingRate ?? 0;
  if (!denominator) return 0;

  const result = numerator / denominator;
  return Number.isFinite(result) ? result : 0;
}

// Sum of QTY Actual across every barge row of the vessel (not just the filtered/sorted rows shown).
export function sumQtyActual(allRows) {
  return (allRows || []).reduce((sum, r) => {
    return sum + (parseOperationNumber(getFieldValue(r, 'qty_actual', allRows)) ?? 0);
  }, 0);
}

// Sorts rows by Completed Disch ascending (same date field driving Disch Time for Loading Rate's
// discharge-sequence order). Rows with an empty/invalid Completed Disch sort last, original order preserved for ties.
export function sortRowsByCompletedDisch(allRows) {
  return [...(allRows || [])].sort((a, b) => {
    const aTime = Date.parse(String(parseOperationData(a.operation_data).completed_disch ?? '').trim().replace(' ', 'T'));
    const bTime = Date.parse(String(parseOperationData(b.operation_data).completed_disch ?? '').trim().replace(' ', 'T'));
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);
    if (aValid && bValid) return aTime - bTime;
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });
}

// Default for % Cargo Readiness (P3): (sum of QTY Actual up to and including this row) / (sum of QTY Actual
// across all rows of the vessel), as a percentage. Rows are first sorted by Completed Disch ascending
// (matching Disch Time for Loading Rate's discharge-sequence order) so the percentage increases row by row.
// Returns the raw (unrounded) percentage number — rounding to a whole percent happens at display time via
// formatCargoReadinessPercent.
export function calculateCargoReadinessP3(row, allRows) {
  const rows = allRows && allRows.length ? allRows : [row];
  const sortedRows = sortRowsByCompletedDisch(rows);
  const idx = sortedRows.findIndex(r => Number(r.id) === Number(row.id));
  const upToRows = idx >= 0 ? sortedRows.slice(0, idx + 1) : [row];

  const cumulativeQtyActual = upToRows.reduce((sum, r) => {
    return sum + (parseOperationNumber(getFieldValue(r, 'qty_actual', allRows)) ?? 0);
  }, 0);
  const totalQtyActual = sumQtyActual(rows);
  if (!totalQtyActual) return 0;

  return (cumulativeQtyActual / totalQtyActual) * 100;
}

// ---------------------------------------------------------------------------
// getFieldValue — used both internally by the calc logic above (recursive
// per-field resolution) and directly by page template code for non-calc
// fields (e.g. stowageplan_mt). Kept as a faithful port of the original:
// same per-field dispatch, same recursive getFieldValue(...) calls to resolve
// a dependency's own default rather than reading a value already computed in
// a batch pass (that batch style lives in computeCycleTimeFields below).
// ---------------------------------------------------------------------------

// fields stored directly on the sibarges row (everything else lives inside operation_data)
const DIRECT_ROW_FIELDS = new Set([
  'no_pk', 'buyer', 'mothervessel', 'jetty_code', 'shipper_code', 'tugboat', 'barge',
  'laycan_start', 'laycan_end', 'operation_remarks',
  'created_by', 'created_at', 'updated_at'
]);

export function getFieldValue(row, key, allRows = [row]) {
  if (key === 'stowageplan_mt') {
    const rows = allRows && allRows.length ? allRows : [row];
    return rows[0]?.stowageplan_mt ?? '';
  }
  if (DIRECT_ROW_FIELDS.has(key)) return row[key] ?? '';
  const operationData = parseOperationData(row.operation_data);
  if (key === 'qty_actual') return calculateQtyActual(operationData);
  if (key === 'waiting_loading_jetty' && !String(operationData.waiting_loading_jetty ?? '').trim()) {
    return calculateWaitingLoadingJetty(row.laycan_start, operationData);
  }
  if (key === 'barges_arrival_early' && !String(operationData.barges_arrival_early ?? '').trim()) {
    return calculateBargesArrivalEarly(row, operationData);
  }
  if (key === 'waiting_plan_loading' && !String(operationData.waiting_plan_loading ?? '').trim()) {
    const bargesArrivalEarly = parseOperationNumber(getFieldValue(row, 'barges_arrival_early'));
    const waitingLoadingJetty = parseOperationNumber(getFieldValue(row, 'waiting_loading_jetty'));
    return calculateWaitingPlanLoading(bargesArrivalEarly, waitingLoadingJetty);
  }
  if (key === 'check_waiting_loading_jetty' && !String(operationData.check_waiting_loading_jetty ?? '').trim()) {
    const waitingLoadingJetty = parseOperationNumber(getFieldValue(row, 'waiting_loading_jetty'));
    const bargesArrivalEarly = parseOperationNumber(getFieldValue(row, 'barges_arrival_early'));
    const waitingPlanLoading = parseOperationNumber(getFieldValue(row, 'waiting_plan_loading'));
    return calculateCheckWaitingLoadingJetty(waitingLoadingJetty, bargesArrivalEarly, waitingPlanLoading);
  }
  if (key === 'loading_time_jetty' && !String(operationData.loading_time_jetty ?? '').trim()) {
    return calculateLoadingTimeJetty(operationData);
  }
  if (key === 'disch_time_loading_rate' && !String(operationData.disch_time_loading_rate ?? '').trim()) {
    return calculateDischTimeLoadingRate(row, operationData, allRows);
  }
  if (key === 'disch_time_percent' && !String(operationData.disch_time_percent ?? '').trim()) {
    return calculateDischTimePercent(operationData);
  }
  if (key === 'cargo_readiness_p3' && !String(operationData.cargo_readiness_p3 ?? '').trim()) {
    return calculateCargoReadinessP3(row, allRows);
  }
  if (key === 'pure_time' && !String(operationData.pure_time ?? '').trim()) {
    return calculatePureTime(operationData);
  }
  if (key === 'total_ct_ltc' && !String(operationData.total_ct_ltc ?? '').trim()) {
    return calculateTotalCtLtc(operationData);
  }
  if (key === 'ltc_day' && !String(operationData.ltc_day ?? '').trim()) {
    const laytime = parseOperationNumber(operationData.laytime);
    const totalCtLtc = parseOperationNumber(getFieldValue(row, 'total_ct_ltc'));
    const bargesArrivalEarly = parseOperationNumber(getFieldValue(row, 'barges_arrival_early'));
    return calculateLtcDay(laytime, totalCtLtc, bargesArrivalEarly);
  }
  if (key === 'ltc_total' && !String(operationData.ltc_total ?? '').trim()) {
    const ltcRate = parseOperationNumber(operationData.ltc_rate);
    const ltcDay = parseOperationNumber(getFieldValue(row, 'ltc_day'));
    return calculateLtcTotal(ltcRate, ltcDay);
  }
  if (key === 'back_to_jetty_time' && !String(operationData.back_to_jetty_time ?? '').trim()) {
    return calculateBackToJettyTime(operationData);
  }
  if (key === 'part_1' && !String(operationData.part_1 ?? '').trim()) {
    return calculatePart1(operationData);
  }
  if (key === 'part_2' && !String(operationData.part_2 ?? '').trim()) {
    return calculatePart2(operationData);
  }
  if (key === 'sailing_time' && !String(operationData.sailing_time ?? '').trim()) {
    return calculateSailingTime(operationData);
  }
  if (key === 'mooring_2' && !String(operationData.mooring_2 ?? '').trim()) {
    const part2 = parseOperationNumber(getFieldValue(row, 'part_2'));
    const sailingTime = parseOperationNumber(getFieldValue(row, 'sailing_time'));
    return calculateMooring2(operationData, part2, sailingTime);
  }
  if (key === 'check_part_2' && !String(operationData.check_part_2 ?? '').trim()) {
    const part2 = parseOperationNumber(getFieldValue(row, 'part_2'));
    const mooring2 = parseOperationNumber(getFieldValue(row, 'mooring_2'));
    const sailingTime = parseOperationNumber(getFieldValue(row, 'sailing_time'));
    return calculateCheckPart2(part2, mooring2, sailingTime);
  }
  if (key === 'total_waiting_disch_mv' && !String(operationData.total_waiting_disch_mv ?? '').trim()) {
    const mooring2 = parseOperationNumber(getFieldValue(row, 'mooring_2'));
    const pureTime = parseOperationNumber(getFieldValue(row, 'pure_time'));
    return calculateTotalWaitingDischMv(mooring2, pureTime);
  }
  if (key === 'waiting_cargo_readiness' && !String(operationData.waiting_cargo_readiness ?? '').trim()) {
    const waitingCargoReadinessP3 = parseOperationNumber(getFieldValue(row, 'waiting_cargo_readiness_p3'));
    const pureTime = parseOperationNumber(getFieldValue(row, 'pure_time'));
    const totalWaitingDischMv = parseOperationNumber(getFieldValue(row, 'total_waiting_disch_mv'));
    return calculateWaitingCargoReadiness(waitingCargoReadinessP3, pureTime, totalWaitingDischMv);
  }
  if (key === 'waiting_mv' && !String(operationData.waiting_mv ?? '').trim()) {
    const waitingMvP3 = parseOperationNumber(getFieldValue(row, 'waiting_mv_p3'));
    const pureTime = parseOperationNumber(getFieldValue(row, 'pure_time'));
    const totalWaitingDischMv = parseOperationNumber(getFieldValue(row, 'total_waiting_disch_mv'));
    return calculateWaitingMv(waitingMvP3, pureTime, totalWaitingDischMv);
  }
  if (key === 'waiting_flf' && !String(operationData.waiting_flf ?? '').trim()) {
    const waitingFlfP3 = parseOperationNumber(getFieldValue(row, 'waiting_flf_p3'));
    const pureTime = parseOperationNumber(getFieldValue(row, 'pure_time'));
    const totalWaitingDischMv = parseOperationNumber(getFieldValue(row, 'total_waiting_disch_mv'));
    return calculateWaitingFlf(waitingFlfP3, pureTime, totalWaitingDischMv);
  }
  if (key === 'waiting_queueing' && !String(operationData.waiting_queueing ?? '').trim()) {
    const waitingQueuingP3 = parseOperationNumber(getFieldValue(row, 'waiting_queuing_p3'));
    const pureTime = parseOperationNumber(getFieldValue(row, 'pure_time'));
    const totalWaitingDischMv = parseOperationNumber(getFieldValue(row, 'total_waiting_disch_mv'));
    return calculateWaitingQueueing(waitingQueuingP3, pureTime, totalWaitingDischMv);
  }
  if (key === 'other_factor' && !String(operationData.other_factor ?? '').trim()) {
    const otherFactorP3 = parseOperationNumber(getFieldValue(row, 'other_factor_p3'));
    const pureTime = parseOperationNumber(getFieldValue(row, 'pure_time'));
    const totalWaitingDischMv = parseOperationNumber(getFieldValue(row, 'total_waiting_disch_mv'));
    return calculateOtherFactor(otherFactorP3, pureTime, totalWaitingDischMv);
  }
  if (key === 'waiting_sequence' && !String(operationData.waiting_sequence ?? '').trim()) {
    const waitingSequenceP3 = parseOperationNumber(getFieldValue(row, 'waiting_sequence_p3'));
    const pureTime = parseOperationNumber(getFieldValue(row, 'pure_time'));
    const totalWaitingDischMv = parseOperationNumber(getFieldValue(row, 'total_waiting_disch_mv'));
    return calculateWaitingSequence(waitingSequenceP3, pureTime, totalWaitingDischMv);
  }
  if (key === 'lhv_time' && !String(operationData.lhv_time ?? '').trim()) {
    return calculateLhvTime(operationData);
  }
  if (key === 'clear_pass_time' && !String(operationData.clear_pass_time ?? '').trim()) {
    return calculateClearPassTime(operationData);
  }
  if (key === 'spog_time' && !String(operationData.spog_time ?? '').trim()) {
    const part1 = parseOperationNumber(getFieldValue(row, 'part_1'));
    const lhvTime = parseOperationNumber(getFieldValue(row, 'lhv_time'));
    const clearPassTime = parseOperationNumber(getFieldValue(row, 'clear_pass_time'));
    return calculateSpogTime(part1, lhvTime, clearPassTime);
  }
  if (key === 'check_part_1' && !String(operationData.check_part_1 ?? '').trim()) {
    const part1 = parseOperationNumber(getFieldValue(row, 'part_1'));
    const lhvTime = parseOperationNumber(getFieldValue(row, 'lhv_time'));
    const spogTime = parseOperationNumber(getFieldValue(row, 'spog_time'));
    const clearPassTime = parseOperationNumber(getFieldValue(row, 'clear_pass_time'));
    return calculateCheckPart1(part1, lhvTime, spogTime, clearPassTime);
  }
  if (key === 'check_waiting_time_disch_mv' && !String(operationData.check_waiting_time_disch_mv ?? '').trim()) {
    const pureTime = parseOperationNumber(getFieldValue(row, 'pure_time'));
    const waitingCargoReadinessP3 = parseOperationNumber(getFieldValue(row, 'waiting_cargo_readiness_p3'));
    const waitingMvP3 = parseOperationNumber(getFieldValue(row, 'waiting_mv_p3'));
    const waitingFlfP3 = parseOperationNumber(getFieldValue(row, 'waiting_flf_p3'));
    const waitingQueuingP3 = parseOperationNumber(getFieldValue(row, 'waiting_queuing_p3'));
    const waitingSequenceP3 = parseOperationNumber(getFieldValue(row, 'waiting_sequence_p3'));
    const otherFactorP3 = parseOperationNumber(getFieldValue(row, 'other_factor_p3'));
    return calculateCheckWaitingTimeDischMv(pureTime, waitingCargoReadinessP3, waitingMvP3, waitingFlfP3, waitingQueuingP3, waitingSequenceP3, otherFactorP3);
  }
  if (key === 'loading_rate' && !String(operationData.loading_rate ?? '').trim()) {
    const stowageplanMt = parseOperationNumber(getFieldValue(row, 'stowageplan_mt', allRows));
    const totalDischTimeLoadingRate = sumDischTimeLoadingRate(allRows);
    return calculateLoadingRate(stowageplanMt, totalDischTimeLoadingRate);
  }
  return operationData[key] ?? '';
}

// ---------------------------------------------------------------------------
// computeCycleTimeFields — new orchestrator (Q3/Q6). Replaces the calc-default
// portion that used to be inlined directly in rowMarkup: one sequential batch
// pass over all the calculate* defaults, each applied only if the field wasn't
// already manually overridden in operationData. Returns a NEW object; never
// mutates the row or the operationData decoded from it (Q6) — this fixes a
// latent aliasing bug in the original inline code, where parseOperationData
// returns the very same object reference when row.operation_data is already
// a parsed object (rather than a JSON string), so mutating "operationData" in
// place would have mutated the caller's row too.
// ---------------------------------------------------------------------------

export function computeCycleTimeFields(row, allRows = [row]) {
  const operationData = { ...parseOperationData(row.operation_data) };

  operationData.qty_actual = calculateQtyActual(operationData);

  if (!String(operationData.waiting_loading_jetty ?? '').trim()) {
    operationData.waiting_loading_jetty = calculateWaitingLoadingJetty(row.laycan_start, operationData);
  }
  if (!String(operationData.barges_arrival_early ?? '').trim()) {
    operationData.barges_arrival_early = calculateBargesArrivalEarly(row, operationData);
  }
  if (!String(operationData.waiting_plan_loading ?? '').trim()) {
    operationData.waiting_plan_loading = calculateWaitingPlanLoading(
      parseOperationNumber(operationData.barges_arrival_early),
      parseOperationNumber(operationData.waiting_loading_jetty)
    );
  }
  if (!String(operationData.check_waiting_loading_jetty ?? '').trim()) {
    operationData.check_waiting_loading_jetty = calculateCheckWaitingLoadingJetty(
      parseOperationNumber(operationData.waiting_loading_jetty),
      parseOperationNumber(operationData.barges_arrival_early),
      parseOperationNumber(operationData.waiting_plan_loading)
    );
  }
  if (!String(operationData.loading_time_jetty ?? '').trim()) {
    operationData.loading_time_jetty = calculateLoadingTimeJetty(operationData);
  }
  if (!String(operationData.disch_time_loading_rate ?? '').trim()) {
    operationData.disch_time_loading_rate = calculateDischTimeLoadingRate(row, operationData, allRows);
  }
  if (!String(operationData.disch_time_percent ?? '').trim()) {
    operationData.disch_time_percent = calculateDischTimePercent(operationData);
  }
  if (!String(operationData.cargo_readiness_p3 ?? '').trim()) {
    operationData.cargo_readiness_p3 = calculateCargoReadinessP3(row, allRows);
  }
  if (!String(operationData.pure_time ?? '').trim()) {
    operationData.pure_time = calculatePureTime(operationData);
  }
  if (!String(operationData.total_ct_ltc ?? '').trim()) {
    operationData.total_ct_ltc = calculateTotalCtLtc(operationData);
  }
  if (!String(operationData.ltc_day ?? '').trim()) {
    operationData.ltc_day = calculateLtcDay(
      parseOperationNumber(operationData.laytime),
      parseOperationNumber(operationData.total_ct_ltc),
      parseOperationNumber(operationData.barges_arrival_early)
    );
  }
  if (!String(operationData.ltc_total ?? '').trim()) {
    operationData.ltc_total = calculateLtcTotal(
      parseOperationNumber(operationData.ltc_rate),
      parseOperationNumber(operationData.ltc_day)
    );
  }
  if (!String(operationData.back_to_jetty_time ?? '').trim()) {
    operationData.back_to_jetty_time = calculateBackToJettyTime(operationData);
  }
  if (!String(operationData.part_1 ?? '').trim()) {
    operationData.part_1 = calculatePart1(operationData);
  }
  if (!String(operationData.part_2 ?? '').trim()) {
    operationData.part_2 = calculatePart2(operationData);
  }
  if (!String(operationData.sailing_time ?? '').trim()) {
    operationData.sailing_time = calculateSailingTime(operationData);
  }
  if (!String(operationData.mooring_2 ?? '').trim()) {
    operationData.mooring_2 = calculateMooring2(
      operationData,
      parseOperationNumber(operationData.part_2),
      parseOperationNumber(operationData.sailing_time)
    );
  }
  if (!String(operationData.check_part_2 ?? '').trim()) {
    operationData.check_part_2 = calculateCheckPart2(
      parseOperationNumber(operationData.part_2),
      parseOperationNumber(operationData.mooring_2),
      parseOperationNumber(operationData.sailing_time)
    );
  }
  if (!String(operationData.total_waiting_disch_mv ?? '').trim()) {
    operationData.total_waiting_disch_mv = calculateTotalWaitingDischMv(
      parseOperationNumber(operationData.mooring_2),
      parseOperationNumber(operationData.pure_time)
    );
  }
  if (!String(operationData.waiting_cargo_readiness ?? '').trim()) {
    operationData.waiting_cargo_readiness = calculateWaitingCargoReadiness(
      parseOperationNumber(operationData.waiting_cargo_readiness_p3),
      parseOperationNumber(operationData.pure_time),
      parseOperationNumber(operationData.total_waiting_disch_mv)
    );
  }
  if (!String(operationData.waiting_mv ?? '').trim()) {
    operationData.waiting_mv = calculateWaitingMv(
      parseOperationNumber(operationData.waiting_mv_p3),
      parseOperationNumber(operationData.pure_time),
      parseOperationNumber(operationData.total_waiting_disch_mv)
    );
  }
  if (!String(operationData.waiting_flf ?? '').trim()) {
    operationData.waiting_flf = calculateWaitingFlf(
      parseOperationNumber(operationData.waiting_flf_p3),
      parseOperationNumber(operationData.pure_time),
      parseOperationNumber(operationData.total_waiting_disch_mv)
    );
  }
  if (!String(operationData.waiting_queueing ?? '').trim()) {
    operationData.waiting_queueing = calculateWaitingQueueing(
      parseOperationNumber(operationData.waiting_queuing_p3),
      parseOperationNumber(operationData.pure_time),
      parseOperationNumber(operationData.total_waiting_disch_mv)
    );
  }
  if (!String(operationData.other_factor ?? '').trim()) {
    operationData.other_factor = calculateOtherFactor(
      parseOperationNumber(operationData.other_factor_p3),
      parseOperationNumber(operationData.pure_time),
      parseOperationNumber(operationData.total_waiting_disch_mv)
    );
  }
  if (!String(operationData.waiting_sequence ?? '').trim()) {
    operationData.waiting_sequence = calculateWaitingSequence(
      parseOperationNumber(operationData.waiting_sequence_p3),
      parseOperationNumber(operationData.pure_time),
      parseOperationNumber(operationData.total_waiting_disch_mv)
    );
  }
  if (!String(operationData.lhv_time ?? '').trim()) {
    operationData.lhv_time = calculateLhvTime(operationData);
  }
  if (!String(operationData.clear_pass_time ?? '').trim()) {
    operationData.clear_pass_time = calculateClearPassTime(operationData);
  }
  if (!String(operationData.spog_time ?? '').trim()) {
    operationData.spog_time = calculateSpogTime(
      parseOperationNumber(operationData.part_1),
      parseOperationNumber(operationData.lhv_time),
      parseOperationNumber(operationData.clear_pass_time)
    );
  }
  if (!String(operationData.check_part_1 ?? '').trim()) {
    operationData.check_part_1 = calculateCheckPart1(
      parseOperationNumber(operationData.part_1),
      parseOperationNumber(operationData.lhv_time),
      parseOperationNumber(operationData.spog_time),
      parseOperationNumber(operationData.clear_pass_time)
    );
  }
  if (!String(operationData.loading_rate ?? '').trim()) {
    operationData.loading_rate = calculateLoadingRate(
      parseOperationNumber(getFieldValue(row, 'stowageplan_mt', allRows)),
      sumDischTimeLoadingRate(allRows)
    );
  }

  return operationData;
}
