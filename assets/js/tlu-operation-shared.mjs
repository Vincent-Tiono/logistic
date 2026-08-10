// Shared between the TLU Operation view's inline script (All Years / All
// Vessels landing table) and its two DOM-wiring submodules,
// tlu-operation-cycle-time.mjs and tlu-operation-export-csv.mjs. Only
// symbols with 2+ consumers live here — see docs/adr/0004-tlu-operation-view-submodules.md.
// Column order/labels (CYCLE_TIME_COLUMNS) are the single source of truth
// for the landing table, the Cycle Time table and grouped CSV export alike
// (issue #12) — do not fork a second copy in a consumer.
import { getFieldValue, formatCycleTimeNumber } from '/assets/js/cycle-time.mjs';

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function displayValue(value) {
  const text = String(value ?? '').trim();
  return text === '' ? '-' : esc(text);
}

export function formatDisplayNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const normalized = text.replaceAll(',', '').replaceAll(' ', '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return text;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(normalized));
}

export function formatCargoReadinessPercent(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const normalized = text.replaceAll(',', '').replaceAll(' ', '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return text;
  return `${Math.round(Number(normalized))}%`;
}

const DDMONYY_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmtDDMonYY(val, withTime = false) {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return s;
  const yy = m[1].slice(-2);
  const mon = DDMONYY_MONTHS[parseInt(m[2], 10) - 1] || '';
  const dd = m[3];
  let out = `${dd}/${mon}/${yy}`;
  if (withTime && m[4]) out += ` ${m[4]}:${m[5]}`;
  return out;
}

export function fmtLaycanDateTime(value) {
  const datePart = fmtDDMonYY(value, false);
  if (datePart === '') return '';
  const m = String(value ?? '').trim().match(/(\d{2}):(\d{2})/);
  return m ? `${datePart} ${m[1]}:${m[2]}` : `${datePart} 00:00`;
}

const formattedNumberFields = new Set([
  'qty', 'qty_disc', 'rc', 'qty_actual',
  'waiting_loading_jetty', 'barges_arrival_early', 'waiting_plan_loading',
  'loading_time_jetty', 'part_1', 'lhv_time', 'spog_time', 'clear_pass_time',
  'part_2', 'mooring_2', 'sailing_time', 'total_waiting_disch_mv',
  'waiting_cargo_readiness', 'waiting_mv', 'waiting_flf', 'waiting_queueing',
  'waiting_sequence', 'other_factor', 'back_to_jetty_time',
  'loading_rate', 'disch_time_loading_rate', 'disch_time_percent',
  'pure_time', 'waiting_cargo_readiness_p3',
  'waiting_mv_p3', 'waiting_flf_p3', 'waiting_queuing_p3',
  'waiting_sequence_p3', 'other_factor_p3',
  'total_ct_ltc', 'laytime', 'ltc_rate', 'ltc_day', 'ltc_total'
]);
const CYCLE_TIME_PERCENT_FIELDS = new Set(['cargo_readiness_p3']);
const operationDateTimeFields = new Set([
  'arrival_jetty', 'start_loading', 'completed_loading', 'lhv', 'spog_zona_2',
  'pkk', 'rkbm', 'sts_spb', 'start_mooring', 'end_mooring', 'clear_pass',
  'start_mooring_clear_pass', 'cast_off_mooring_clear_pass', 'ta_barges_actual',
  'ta_mv', 'ta_flf', 'cargo_readiness_actual', 'start_disch', 'completed_disch',
  'back_to_jetty'
]);
const CYCLE_TIME_4DP_NUMBER_FIELDS = new Set([
  'waiting_loading_jetty', 'barges_arrival_early', 'waiting_plan_loading', 'loading_time_jetty',
  'part_1', 'lhv_time', 'spog_time', 'clear_pass_time',
  'part_2', 'mooring_2', 'sailing_time', 'total_waiting_disch_mv',
  'waiting_cargo_readiness', 'waiting_mv', 'waiting_flf', 'waiting_queueing',
  'waiting_sequence', 'other_factor', 'back_to_jetty_time',
  'loading_rate', 'disch_time_loading_rate', 'disch_time_percent',
  'pure_time', 'waiting_cargo_readiness_p3',
  'waiting_mv_p3', 'waiting_flf_p3', 'waiting_queuing_p3',
  'waiting_sequence_p3', 'other_factor_p3',
  'total_ct_ltc', 'laytime', 'ltc_rate', 'ltc_day', 'ltc_total'
]);

// Matches rowMarkup()/columnDisplayValue() in Operation/8tluoperation.php:2731-2740.
export function columnDisplayValue(row, key, allRows = [row]) {
  const raw = getFieldValue(row, key, allRows);
  if (key === 'laycan_start' || key === 'laycan_end') return fmtLaycanDateTime(raw);
  if (key === 'created_at' || key === 'updated_at') return fmtDDMonYY(raw, true);
  if (operationDateTimeFields.has(key)) return fmtDDMonYY(raw, true);
  if (CYCLE_TIME_PERCENT_FIELDS.has(key)) return formatCargoReadinessPercent(raw);
  if (CYCLE_TIME_4DP_NUMBER_FIELDS.has(key)) return formatCycleTimeNumber(raw);
  if (formattedNumberFields.has(key)) return formatDisplayNumber(raw);
  return (raw ?? '').toString();
}

// Matches groupRowsByVessel (8tluoperation.php:2398-2412): buckets an
// already-sorted flat row list by vessel, since cross-row cycle-time
// formulas only ever compare a row against its own vessel's siblings.
export function groupRowsByVessel(rows) {
  const groups = [];
  let current = null;
  let currentKey = null;
  for (const row of rows) {
    const key = `${row.no_pk} ${row.mothervessel}`;
    if (key !== currentKey) {
      current = [];
      groups.push(current);
      currentKey = key;
    }
    current.push(row);
  }
  return groups;
}

export function buildRowValues(row, allRows, rowIndexInVessel, headerKeys) {
  return headerKeys.map(key => key === 'stowageplan_mt'
    ? (rowIndexInVessel === 0 ? formatDisplayNumber(getFieldValue(row, 'stowageplan_mt', allRows)) : '')
    : columnDisplayValue(row, key, allRows));
}

export async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  return res.json();
}

export function replaceSelectOptions(select, placeholder, options) {
  select.innerHTML = '';
  select.appendChild(new Option(placeholder, ''));
  options.forEach(option => select.appendChild(new Option(option.label, option.value)));
}

export const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function availableYearsFrom(vesselPeriods) {
  return [...new Set(vesselPeriods.map(v => String(v.laycan_year)))]
    .sort((a, b) => Number(b) - Number(a));
}

// Column order/labels for the landing table, the Cycle Time table and
// grouped CSV export — single source of truth, read from the live
// #cycleTimeTable header the same way the legacy page's
// cycleTimeExportHeaderCells() does, once buildHeaderCells() has built it.
export const CYCLE_TIME_COLUMNS = [
  ['no_pk', 'No. Reff'],
  ['buyer', 'Buyer'],
  ['mothervessel', 'Mother Vessel'],
  ['stowageplan_mt', 'Stowage Plan'],
  ['jetty_code', 'Jetty'],
  ['shipper_code', 'Shipper'],
  ['tugboat', 'Tugboat'],
  ['barge', 'Barge'],
  ['barge_vendor', 'Barge Vendor'],
  ['qty', 'QTY'],
  ['qty_disc', 'QTY DISC'],
  ['rc', 'RC'],
  ['qty_actual', 'QTY Actual'],
  ['pbm_vendor', 'PBM Vendor'],
  ['floating_crane', 'Floating Crane'],
  ['waiting_loading_jetty', 'Waiting Loading Jetty'],
  ['check_waiting_loading_jetty', 'Check Waiting Loading Jetty'],
  ['barges_arrival_early', 'Barges Arrival Early'],
  ['waiting_plan_loading', 'Waiting Plan Loading'],
  ['loading_time_jetty', 'Loading Time Jetty'],
  ['laycan_start', 'Laycan Start'],
  ['laycan_end', 'Laycan End'],
  ['arrival_jetty', 'Arrival Jetty'],
  ['start_loading', 'Start Loading'],
  ['completed_loading', 'Completed Loading'],
  ['part_1', 'Part 1'],
  ['check_part_1', 'Check Part 1'],
  ['lhv_time', 'LHV Time'],
  ['spog_time', 'SPOG Time'],
  ['clear_pass_time', 'Clear Pass Time'],
  ['lhv', 'LHV'],
  ['spog_zona_2', 'SPOG ZONA 2'],
  ['pkk', 'PKK'],
  ['rkbm', 'RKBM'],
  ['sts_spb', 'STS/SPB'],
  ['start_mooring', 'Start Mooring'],
  ['end_mooring', 'End Mooring'],
  ['mooring_place_1', 'Mooring Place 1'],
  ['clear_pass', 'Clear Pass'],
  ['start_mooring_clear_pass', 'Start Mooring Clear Pass'],
  ['cast_off_mooring_clear_pass', 'Cast Off Mooring Clear Pass'],
  ['mooring_place_2', 'Mooring Place 2'],
  ['part_2', 'Part 2'],
  ['check_part_2', 'Check Part 2'],
  ['mooring_2', 'Mooring 2'],
  ['sailing_time', 'Sailing Time'],
  ['total_waiting_disch_mv', 'Total Waiting Disch MV'],
  ['check_total_waiting_disch_mv', 'Check Total Waiting Disch MV'],
  ['waiting_cargo_readiness', 'Waiting Cargo Readiness (P2)'],
  ['waiting_mv', 'Waiting MV (P2)'],
  ['waiting_flf', 'Waiting FLF (P2)'],
  ['waiting_queueing', 'Waiting Queueing (P2)'],
  ['waiting_sequence', 'Waiting Sequence (P2)'],
  ['other_factor', 'Other Factor (P2)'],
  ['back_to_jetty_time', 'Back to Jetty Time'],
  ['ta_barges_actual', 'TA Barges Actual'],
  ['ta_mv', 'TA MV'],
  ['ta_flf', 'TA FLF'],
  ['cargo_readiness_actual', 'Cargo Readiness Actual'],
  ['start_disch', 'Start Disch'],
  ['completed_disch', 'Completed Disch'],
  ['discharge_sequence', 'Discharge Sequence'],
  ['back_to_jetty', 'Back to Jetty'],
  ['loading_rate', 'Loading Rate'],
  ['disch_time_loading_rate', 'Disch Time for Loading Rate'],
  ['disch_time_percent', 'Disch Time'],
  ['cargo_readiness_p3', '% Cargo Readiness (P3)'],
  ['pure_time', 'Pure Time'],
  ['waiting_cargo_readiness_p3', 'Waiting Cargo Readiness (P3)'],
  ['waiting_mv_p3', 'Waiting MV (P3)'],
  ['waiting_flf_p3', 'Waiting FLF (P3)'],
  ['waiting_queuing_p3', 'Waiting Queuing (P3)'],
  ['waiting_sequence_p3', 'Waiting Sequence (P3)'],
  ['other_factor_p3', 'Other Factor (P3)'],
  ['check_waiting_time_disch_mv', 'Check Waiting Time Disch MV'],
  ['total_ct_ltc', 'Total CT LTC'],
  ['laytime', 'Laytime'],
  ['ltc_rate', 'LTC Rate'],
  ['ltc_day', 'LTC Day'],
  ['ltc_total', 'LTC Total'],
  ['operation_remarks', 'Remarks'],
  ['created_by', 'Created By'],
  ['created_at', 'Created At'],
  ['updated_at', 'Updated At'],
];

export const headerKeys = CYCLE_TIME_COLUMNS.map(([key]) => key);

// ===== Build both tables' shared header row =====

export function buildHeaderCells(rowEl, includeRowNumber) {
  rowEl.innerHTML = (includeRowNumber ? ['<th>No.</th>'] : [])
    .concat(CYCLE_TIME_COLUMNS.map(([key, label]) => `<th data-key="${esc(key)}">${esc(label)}</th>`))
    .join('');
}
