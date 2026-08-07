// Unit tests for assets/js/cycle-time.mjs — the pure cycle-time / laytime /
// LTC calculation formulas extracted from Operation/8tluoperation.php.
//
// Run: node --test assets/js/
//
// Expected values are derived by hand from the spec comment above each
// function in cycle-time.mjs (which mirrors the original inline comments in
// 8tluoperation.php), not by re-running the implementation — per the
// handoff's Q8, the comments are the source of truth for correctness.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOperationNumber,
  parseLaycanDateTime,
  formatCycleTimeNumber,
  calculateQtyActual,
  calculateWaitingLoadingJetty,
  calculateBargesArrivalEarly,
  calculateWaitingPlanLoading,
  calculateCheckWaitingLoadingJetty,
  calculateLoadingTimeJetty,
  calculateDischTimeLoadingRate,
  calculateDischTimePercent,
  calculatePureTime,
  calculateTotalCtLtc,
  calculateLtcDay,
  calculateLtcTotal,
  calculateBackToJettyTime,
  calculatePart1,
  calculatePart2,
  calculateSailingTime,
  calculateMooring2,
  calculateCheckPart2,
  calculateTotalWaitingDischMv,
  calculateWaitingCargoReadiness,
  calculateWaitingMv,
  calculateWaitingFlf,
  calculateWaitingQueueing,
  calculateOtherFactor,
  calculateWaitingSequence,
  calculateLhvTime,
  calculateClearPassTime,
  calculateSpogTime,
  calculateCheckPart1,
  calculateCheckWaitingTimeDischMv,
  sumDischTimeLoadingRate,
  calculateLoadingRate,
  sumQtyActual,
  sortRowsByCompletedDisch,
  calculateCargoReadinessP3,
  getFieldValue,
  computeCycleTimeFields
} from './cycle-time.mjs';

describe('parseOperationNumber', () => {
  it('returns null for empty/blank input', () => {
    assert.equal(parseOperationNumber(''), null);
    assert.equal(parseOperationNumber('   '), null);
    assert.equal(parseOperationNumber(null), null);
    assert.equal(parseOperationNumber(undefined), null);
  });

  it('returns null for non-numeric text', () => {
    assert.equal(parseOperationNumber('abc'), null);
  });

  it('strips thousands separators and surrounding whitespace', () => {
    assert.equal(parseOperationNumber('1,234.5'), 1234.5);
    assert.equal(parseOperationNumber('  42  '), 42);
  });

  it('treats 0 as a valid number, not blank', () => {
    assert.equal(parseOperationNumber(0), 0);
    assert.equal(parseOperationNumber('0'), 0);
  });
});

describe('parseLaycanDateTime', () => {
  it('returns NaN for empty input', () => {
    assert.ok(Number.isNaN(parseLaycanDateTime('')));
    assert.ok(Number.isNaN(parseLaycanDateTime(null)));
  });

  it('anchors a bare YYYY-MM-DD date to local midnight', () => {
    assert.equal(parseLaycanDateTime('2026-01-10'), Date.parse('2026-01-10T00:00:00'));
  });

  it('parses a full datetime string as local time', () => {
    assert.equal(parseLaycanDateTime('2026-01-10 08:30:00'), Date.parse('2026-01-10T08:30:00'));
  });
});

describe('formatCycleTimeNumber', () => {
  it('returns empty string for blank input', () => {
    assert.equal(formatCycleTimeNumber(''), '');
    assert.equal(formatCycleTimeNumber(null), '');
  });

  it('rounds to 4 decimal places with thousands separators', () => {
    assert.equal(formatCycleTimeNumber(1234.56789), '1,234.5679');
  });

  it('returns non-numeric text unchanged', () => {
    assert.equal(formatCycleTimeNumber('True'), 'True');
  });
});

describe('calculateQtyActual', () => {
  it('returns empty string when both qty_disc and rc are blank', () => {
    assert.equal(calculateQtyActual({}), '');
  });

  it('sums qty_disc + rc, formatted with thousands separator', () => {
    assert.equal(calculateQtyActual({ qty_disc: '1000.5', rc: '' }), '1,000.5');
    assert.equal(calculateQtyActual({ qty_disc: '100', rc: '50' }), '150');
  });
});

describe('calculateWaitingLoadingJetty', () => {
  it('is 0 when Laycan Start is empty', () => {
    assert.equal(calculateWaitingLoadingJetty('', { start_loading: '2026-01-05 00:00:00', arrival_jetty: '2026-01-03 00:00:00' }), 0);
  });

  it('is (Start Loading - Arrival Jetty) in days otherwise', () => {
    const result = calculateWaitingLoadingJetty('2026-01-01', {
      start_loading: '2026-01-05 00:00:00',
      arrival_jetty: '2026-01-03 00:00:00'
    });
    assert.equal(result, 2);
  });

  it('returns empty string when Start Loading or Arrival Jetty is unparseable', () => {
    assert.equal(calculateWaitingLoadingJetty('2026-01-01', { start_loading: '', arrival_jetty: '2026-01-03 00:00:00' }), '');
  });
});

describe('calculateBargesArrivalEarly', () => {
  const row = { laycan_start: '2026-01-10', laycan_end: '2026-01-20' };

  it('is 0 when Laycan Start is empty', () => {
    assert.equal(calculateBargesArrivalEarly({ laycan_start: '' }, { arrival_jetty: '2026-01-15 00:00:00' }), 0);
  });

  it('is 0 when Arrival Jetty is past Laycan Start and at/after Laycan End', () => {
    assert.equal(calculateBargesArrivalEarly(row, { arrival_jetty: '2026-01-25 00:00:00' }), 0);
  });

  it('is (Start Loading - Arrival Jetty) when Arrival Jetty falls inside the laycan window', () => {
    const result = calculateBargesArrivalEarly(row, {
      arrival_jetty: '2026-01-15 00:00:00',
      start_loading: '2026-01-17 00:00:00'
    });
    assert.equal(result, 2);
  });

  it('is (Start Loading - Arrival Jetty) when Arrival Jetty is early and Start Loading is also before Laycan Start', () => {
    const result = calculateBargesArrivalEarly(row, {
      arrival_jetty: '2026-01-05 00:00:00',
      start_loading: '2026-01-08 00:00:00'
    });
    assert.equal(result, 3);
  });

  it('falls back to (Laycan Start - Arrival Jetty) otherwise', () => {
    const result = calculateBargesArrivalEarly(row, { arrival_jetty: '2026-01-05 00:00:00' });
    assert.equal(result, 5);
  });

  it('returns empty string when Arrival Jetty is unparseable', () => {
    assert.equal(calculateBargesArrivalEarly(row, { arrival_jetty: '' }), '');
  });
});

describe('calculateWaitingPlanLoading', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateWaitingPlanLoading(null, 5), '');
    assert.equal(calculateWaitingPlanLoading(3, null), '');
  });

  it('is (Waiting Loading Jetty - Barges Arrival Early)', () => {
    assert.equal(calculateWaitingPlanLoading(3, 5), 2);
  });

  it('is floored at 0 when the difference is negative', () => {
    assert.equal(calculateWaitingPlanLoading(5, 3), 0);
  });
});

describe('calculateCheckWaitingLoadingJetty', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateCheckWaitingLoadingJetty(null, 3, 2), '');
  });

  it('is True when Waiting Loading Jetty equals Barges Arrival Early + Waiting Plan Loading', () => {
    assert.equal(calculateCheckWaitingLoadingJetty(5, 3, 2), 'True');
  });

  it('is False otherwise', () => {
    assert.equal(calculateCheckWaitingLoadingJetty(5, 3, 3), 'False');
  });
});

describe('calculateLoadingTimeJetty', () => {
  it('is 0 when Completed Loading is empty', () => {
    assert.equal(calculateLoadingTimeJetty({}), 0);
  });

  it('is (Completed Loading - Start Loading) in days', () => {
    const result = calculateLoadingTimeJetty({
      completed_loading: '2026-01-05 10:00:00',
      start_loading: '2026-01-03 10:00:00'
    });
    assert.equal(result, 2);
  });
});

describe('calculateDischTimeLoadingRate', () => {
  it('is 0 when Completed Disch is empty', () => {
    assert.equal(calculateDischTimeLoadingRate({ id: 1 }, {}, [{ id: 1, operation_data: {} }]), 0);
  });

  it('is 0 under the sandwich rule (prev Start Disch == this Start Disch AND next Completed Disch == this Completed Disch)', () => {
    const rows = [
      { id: 1, operation_data: { start_disch: '2026-01-01 00:00:00', completed_disch: '2026-01-02 00:00:00' } },
      { id: 2, operation_data: { start_disch: '2026-01-01 00:00:00', completed_disch: '2026-01-03 00:00:00' } },
      { id: 3, operation_data: { start_disch: '2026-01-01 00:00:00', completed_disch: '2026-01-03 00:00:00' } }
    ];
    const result = calculateDischTimeLoadingRate(rows[1], rows[1].operation_data, rows);
    assert.equal(result, 0);
  });

  it('is 0 under the consecutive-pair rule (both Start Disch and Completed Disch equal the previous row\'s)', () => {
    const rows = [
      { id: 1, operation_data: { start_disch: '2026-01-01 00:00:00', completed_disch: '2026-01-02 00:00:00' } },
      { id: 2, operation_data: { start_disch: '2026-01-01 00:00:00', completed_disch: '2026-01-02 00:00:00' } }
    ];
    const result = calculateDischTimeLoadingRate(rows[1], rows[1].operation_data, rows);
    assert.equal(result, 0);
  });

  it('defaults to (Completed Disch - Start Disch) in days otherwise', () => {
    const rows = [
      { id: 1, operation_data: { start_disch: '2026-01-01 00:00:00', completed_disch: '2026-01-03 00:00:00' } }
    ];
    const result = calculateDischTimeLoadingRate(rows[0], rows[0].operation_data, rows);
    assert.equal(result, 2);
  });
});

describe('calculateDischTimePercent', () => {
  it('is 0 when Completed Disch is empty', () => {
    assert.equal(calculateDischTimePercent({}), 0);
  });

  it('is (Completed Disch - Start Disch) in days', () => {
    const result = calculateDischTimePercent({
      completed_disch: '2026-01-03 00:00:00',
      start_disch: '2026-01-01 00:00:00'
    });
    assert.equal(result, 2);
  });
});

describe('calculatePureTime', () => {
  it('is 0 when Start Disch is empty', () => {
    assert.equal(calculatePureTime({}), 0);
  });

  it('is (Start Disch - TA Barges Actual) in days', () => {
    const result = calculatePureTime({
      start_disch: '2026-01-03 00:00:00',
      ta_barges_actual: '2026-01-01 00:00:00'
    });
    assert.equal(result, 2);
  });
});

describe('calculateTotalCtLtc', () => {
  it('is 0 when Arrival Jetty is empty', () => {
    assert.equal(calculateTotalCtLtc({}), 0);
  });

  it('is (Back to Jetty - Arrival Jetty) in days', () => {
    const result = calculateTotalCtLtc({
      arrival_jetty: '2026-01-01 00:00:00',
      back_to_jetty: '2026-01-04 00:00:00'
    });
    assert.equal(result, 3);
  });
});

describe('calculateLtcDay', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateLtcDay(null, 1, 1), '');
  });

  it('is capped at 0 when Laytime - (Total CT LTC - Barges Arrival Early) is positive', () => {
    assert.equal(calculateLtcDay(10, 3, 1), 0);
  });

  it('is the raw (non-positive) difference otherwise', () => {
    assert.equal(calculateLtcDay(5, 10, 2), -3);
  });
});

describe('calculateLtcTotal', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateLtcTotal(null, 5), '');
  });

  it('is LTC Rate * LTC Day', () => {
    assert.equal(calculateLtcTotal(100, -3), -300);
  });
});

describe('calculateBackToJettyTime', () => {
  it('is 0 when Back to Jetty is empty', () => {
    assert.equal(calculateBackToJettyTime({}), 0);
  });

  it('is (Back to Jetty - Completed Disch) in days', () => {
    const result = calculateBackToJettyTime({
      back_to_jetty: '2026-01-04 00:00:00',
      completed_disch: '2026-01-01 00:00:00'
    });
    assert.equal(result, 3);
  });
});

describe('calculatePart1', () => {
  it('is 0 when Clear Pass is empty', () => {
    assert.equal(calculatePart1({}), 0);
  });

  it('is (Clear Pass - Completed Loading) in days', () => {
    const result = calculatePart1({
      clear_pass: '2026-01-04 00:00:00',
      completed_loading: '2026-01-01 00:00:00'
    });
    assert.equal(result, 3);
  });
});

describe('calculatePart2', () => {
  it('is 0 when Clear Pass is empty', () => {
    assert.equal(calculatePart2({}), 0);
  });

  it('is (TA Barges Actual - Clear Pass) in days', () => {
    const result = calculatePart2({
      clear_pass: '2026-01-01 00:00:00',
      ta_barges_actual: '2026-01-04 00:00:00'
    });
    assert.equal(result, 3);
  });
});

describe('calculateSailingTime', () => {
  it('is 0 when Clear Pass is empty', () => {
    assert.equal(calculateSailingTime({}), 0);
  });

  it('is (TA Barges Actual - Clear Pass) when Cast Off Mooring Clear Pass is empty', () => {
    const result = calculateSailingTime({
      clear_pass: '2026-01-01 00:00:00',
      ta_barges_actual: '2026-01-04 00:00:00'
    });
    assert.equal(result, 3);
  });

  it('is (TA Barges Actual - Cast Off Mooring Clear Pass) otherwise', () => {
    const result = calculateSailingTime({
      clear_pass: '2026-01-01 00:00:00',
      cast_off_mooring_clear_pass: '2026-01-02 00:00:00',
      ta_barges_actual: '2026-01-05 00:00:00'
    });
    assert.equal(result, 3);
  });
});

describe('calculateMooring2', () => {
  it('is 0 when Clear Pass is empty', () => {
    assert.equal(calculateMooring2({}, 10, 3), 0);
  });

  it('returns empty string when part2 or sailingTime is null', () => {
    assert.equal(calculateMooring2({ clear_pass: '2026-01-01 00:00:00' }, null, 3), '');
  });

  it('is (Part 2 - Sailing Time)', () => {
    assert.equal(calculateMooring2({ clear_pass: '2026-01-01 00:00:00' }, 10, 3), 7);
  });
});

describe('calculateCheckPart2', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateCheckPart2(null, 7, 3), '');
  });

  it('is True when Part 2 equals Mooring 2 + Sailing Time', () => {
    assert.equal(calculateCheckPart2(10, 7, 3), 'True');
  });

  it('is False otherwise', () => {
    assert.equal(calculateCheckPart2(10, 7, 2), 'False');
  });
});

describe('calculateTotalWaitingDischMv', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateTotalWaitingDischMv(null, 3), '');
  });

  it('is Mooring 2 + Pure Time', () => {
    assert.equal(calculateTotalWaitingDischMv(7, 3), 10);
  });
});

// calculateWaitingCargoReadiness / WaitingMv / WaitingFlf / WaitingQueueing / OtherFactor / WaitingSequence
// all share the same IFERROR(numerator / Pure Time * Total Waiting Disch MV, 0) shape.
const p2Fns = {
  calculateWaitingCargoReadiness,
  calculateWaitingMv,
  calculateWaitingFlf,
  calculateWaitingQueueing,
  calculateOtherFactor,
  calculateWaitingSequence
};

for (const [name, fn] of Object.entries(p2Fns)) {
  describe(name, () => {
    it('is IFERROR(numerator / Pure Time * Total Waiting Disch MV, 0)', () => {
      assert.equal(fn(10, 2, 100), 500);
    });

    it('falls back to 0 when Pure Time is 0 (division by zero)', () => {
      assert.equal(fn(10, 0, 100), 0);
    });

    it('falls back to 0 when all inputs are null', () => {
      assert.equal(fn(null, null, null), 0);
    });
  });
}

describe('calculateLhvTime', () => {
  it('is 0 when LHV is empty', () => {
    assert.equal(calculateLhvTime({}), 0);
  });

  it('is (LHV - Completed Loading) in days', () => {
    const result = calculateLhvTime({
      lhv: '2026-01-04 00:00:00',
      completed_loading: '2026-01-01 00:00:00'
    });
    assert.equal(result, 3);
  });
});

describe('calculateClearPassTime', () => {
  it('is 0 when Clear Pass is empty', () => {
    assert.equal(calculateClearPassTime({}), 0);
  });

  it('is (Clear Pass - End Mooring) in days', () => {
    const result = calculateClearPassTime({
      clear_pass: '2026-01-04 00:00:00',
      end_mooring: '2026-01-01 00:00:00'
    });
    assert.equal(result, 3);
  });
});

describe('calculateSpogTime', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateSpogTime(null, 3, 2), '');
  });

  it('is Part 1 - (LHV Time + Clear Pass Time)', () => {
    assert.equal(calculateSpogTime(10, 3, 2), 5);
  });
});

describe('calculateCheckPart1', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateCheckPart1(null, 3, 5, 2), '');
  });

  it('is True when Part 1 equals LHV Time + SPOG Time + Clear Pass Time', () => {
    assert.equal(calculateCheckPart1(10, 3, 5, 2), 'True');
  });

  it('is False otherwise', () => {
    assert.equal(calculateCheckPart1(10, 3, 4, 2), 'False');
  });
});

describe('calculateCheckWaitingTimeDischMv', () => {
  it('returns empty string for null inputs', () => {
    assert.equal(calculateCheckWaitingTimeDischMv(null, 1, 1, 1, 1, 1, 1), '');
  });

  it('is True when Pure Time equals the sum of the (P3) waiting components', () => {
    assert.equal(calculateCheckWaitingTimeDischMv(10, 1, 2, 3, 1, 2, 1), 'True');
  });

  it('is False otherwise', () => {
    assert.equal(calculateCheckWaitingTimeDischMv(10, 1, 2, 3, 1, 2, 2), 'False');
  });
});

describe('sumDischTimeLoadingRate', () => {
  it('sums Disch Time for Loading Rate across every row', () => {
    const rows = [
      { id: 1, operation_data: { disch_time_loading_rate: '2' } },
      { id: 2, operation_data: { disch_time_loading_rate: '3' } }
    ];
    assert.equal(sumDischTimeLoadingRate(rows), 5);
  });
});

describe('calculateLoadingRate', () => {
  it('falls back to 0 when the denominator is 0', () => {
    assert.equal(calculateLoadingRate(100, 0), 0);
  });

  it('is Stowage Plan / SUM(Disch Time for Loading Rate)', () => {
    assert.equal(calculateLoadingRate(100, 4), 25);
  });
});

describe('sumQtyActual', () => {
  it('sums QTY Actual (qty_disc + rc) across every row', () => {
    const rows = [
      { id: 1, operation_data: { qty_disc: '100', rc: '0' } },
      { id: 2, operation_data: { qty_disc: '200', rc: '0' } }
    ];
    assert.equal(sumQtyActual(rows), 300);
  });
});

describe('sortRowsByCompletedDisch', () => {
  it('sorts ascending by Completed Disch, invalid dates last, ties preserve original order', () => {
    const rows = [
      { id: 1, operation_data: { completed_disch: '2026-01-03 00:00:00' } },
      { id: 2, operation_data: { completed_disch: '' } },
      { id: 3, operation_data: { completed_disch: '2026-01-01 00:00:00' } },
      { id: 4, operation_data: { completed_disch: '2026-01-01 00:00:00' } }
    ];
    const sorted = sortRowsByCompletedDisch(rows);
    assert.deepEqual(sorted.map(r => r.id), [3, 4, 1, 2]);
  });
});

describe('calculateCargoReadinessP3', () => {
  const rows = [
    { id: 1, operation_data: { completed_disch: '2026-01-01 00:00:00', qty_disc: '100', rc: '0' } },
    { id: 2, operation_data: { completed_disch: '2026-01-02 00:00:00', qty_disc: '200', rc: '0' } },
    { id: 3, operation_data: { completed_disch: '2026-01-03 00:00:00', qty_disc: '200', rc: '0' } }
  ];

  it('is 0 when the total QTY Actual across all rows is 0', () => {
    assert.equal(calculateCargoReadinessP3({ id: 1, operation_data: {} }, [{ id: 1, operation_data: {} }]), 0);
  });

  it('is the cumulative QTY Actual up to this row (Completed Disch order) as a percentage of the total', () => {
    // row 2 is second by Completed Disch: (100 + 200) / 500 * 100 = 60
    assert.equal(calculateCargoReadinessP3(rows[1], rows), 60);
  });

  it('is 100 for the last row by Completed Disch', () => {
    assert.equal(calculateCargoReadinessP3(rows[2], rows), 100);
  });
});

describe('getFieldValue', () => {
  it('reads stowageplan_mt from the first row of allRows (vessel-level field)', () => {
    const allRows = [{ id: 1, stowageplan_mt: 5000 }, { id: 2 }];
    assert.equal(getFieldValue(allRows[1], 'stowageplan_mt', allRows), 5000);
  });

  it('reads DIRECT_ROW_FIELDS straight off the row', () => {
    assert.equal(getFieldValue({ buyer: 'Acme Corp' }, 'buyer'), 'Acme Corp');
  });

  it('recomputes a calc-default field when it is not manually overridden', () => {
    const row = {
      laycan_start: '2026-01-01',
      operation_data: { start_loading: '2026-01-05 00:00:00', arrival_jetty: '2026-01-03 00:00:00' }
    };
    assert.equal(getFieldValue(row, 'waiting_loading_jetty'), 2);
  });

  it('returns the stored value as-is when a calc-default field was manually overridden', () => {
    const row = { laycan_start: '2026-01-01', operation_data: { waiting_loading_jetty: '99' } };
    assert.equal(getFieldValue(row, 'waiting_loading_jetty'), '99');
  });
});

describe('computeCycleTimeFields', () => {
  it('returns a fully-populated operationData object derived from a fresh row', () => {
    const row = {
      id: 1,
      laycan_start: '2026-01-01',
      laycan_end: '2026-01-10',
      operation_data: {
        qty_disc: '100', rc: '0',
        arrival_jetty: '2026-01-02 00:00:00',
        start_loading: '2026-01-03 00:00:00',
        completed_loading: '2026-01-04 00:00:00',
        start_disch: '2026-01-05 00:00:00',
        completed_disch: '2026-01-06 00:00:00',
        ta_barges_actual: '2026-01-05 00:00:00',
        clear_pass: '2026-01-04 12:00:00',
        end_mooring: '2026-01-04 00:00:00',
        lhv: '2026-01-04 06:00:00',
        cast_off_mooring_clear_pass: '',
        back_to_jetty: '2026-01-07 00:00:00'
      }
    };
    const allRows = [row];

    const result = computeCycleTimeFields(row, allRows);

    assert.equal(result.qty_actual, '100');
    assert.equal(result.waiting_loading_jetty, 1); // start_loading - arrival_jetty
    assert.equal(result.loading_time_jetty, 1); // completed_loading - start_loading
    assert.equal(result.pure_time, 0); // start_disch == ta_barges_actual
    assert.equal(result.part_1, 0.5); // clear_pass - completed_loading (12h)
  });

  it('never mutates the input row or its operation_data object (Q6 purity)', () => {
    const operationData = { qty_disc: '100', rc: '0' };
    const row = { id: 1, laycan_start: '', operation_data: operationData };
    const before = JSON.stringify(operationData);

    const result = computeCycleTimeFields(row, [row]);

    assert.equal(JSON.stringify(operationData), before);
    assert.notEqual(result, operationData);
    assert.equal(row.operation_data, operationData);
  });

  it('preserves a manually-overridden field instead of recalculating it', () => {
    const row = {
      id: 1,
      laycan_start: '2026-01-01',
      operation_data: {
        waiting_loading_jetty: '42',
        start_loading: '2026-01-05 00:00:00',
        arrival_jetty: '2026-01-03 00:00:00'
      }
    };
    const result = computeCycleTimeFields(row, [row]);
    assert.equal(result.waiting_loading_jetty, '42');
  });

  it('always recalculates qty_actual even when a value is already stored (matches rowMarkup\'s unconditional assignment)', () => {
    const row = { id: 1, laycan_start: '', operation_data: { qty_actual: '999', qty_disc: '100', rc: '0' } };
    const result = computeCycleTimeFields(row, [row]);
    assert.equal(result.qty_actual, '100');
  });
});
