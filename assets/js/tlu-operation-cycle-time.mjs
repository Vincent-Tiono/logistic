// Cycle Time — Per Vessel card: year/month/vessel cascade, the per-vessel
// timeline table, the row-detail edit modal (issue #11), and CSV import
// (IT-only, issue #11). Split out of views/tlu-operation.ejs's inline
// script — see docs/adr/0004-tlu-operation-view-submodules.md.
import { getFieldValue, calculateQtyActual } from '/assets/js/cycle-time.mjs';
import {
  esc, displayValue, columnDisplayValue, CYCLE_TIME_COLUMNS, headerKeys,
  buildHeaderCells, fetchJson, replaceSelectOptions, monthNames, availableYearsFrom,
} from '/assets/js/tlu-operation-shared.mjs';

// Editable-field metadata for the row-detail modal (issue #11) — a direct
// lookup ported from the union of legacy's dataBargesTable and cycleTimeTable
// header dataset attributes (8tluoperation.php:1357-1586): editable iff the
// key is one of TLU_OPERATION_FIELDS, plus operation_remarks (routed to the
// separate `remarks` SQL column, not into operation_data). Every other
// CYCLE_TIME_COLUMNS key (no_pk, buyer, mothervessel, stowageplan_mt,
// jetty_code, shipper_code, tugboat, barge, laycan_start, laycan_end,
// created_by, created_at, updated_at) is display-only by omission.
const OPERATION_EDIT_META = {
  barge_vendor: { inputType: 'barge-vendor' },
  qty: {},
  qty_disc: {},
  rc: {},
  qty_actual: { calculated: true },
  pbm_vendor: { inputType: 'pbm-vendor' },
  floating_crane: { inputType: 'floating-crane' },
  waiting_loading_jetty: {},
  check_waiting_loading_jetty: { inputType: 'truefalse' },
  barges_arrival_early: {},
  waiting_plan_loading: {},
  loading_time_jetty: {},
  arrival_jetty: { inputType: 'datetime-local' },
  start_loading: { inputType: 'datetime-local' },
  completed_loading: { inputType: 'datetime-local' },
  part_1: {},
  check_part_1: { inputType: 'truefalse' },
  lhv_time: {},
  spog_time: {},
  clear_pass_time: {},
  lhv: { inputType: 'datetime-local' },
  spog_zona_2: { inputType: 'datetime-local' },
  pkk: { inputType: 'datetime-local' },
  rkbm: { inputType: 'datetime-local' },
  sts_spb: { inputType: 'datetime-local' },
  start_mooring: { inputType: 'datetime-local' },
  end_mooring: { inputType: 'datetime-local' },
  mooring_place_1: {},
  clear_pass: { inputType: 'datetime-local' },
  start_mooring_clear_pass: { inputType: 'datetime-local' },
  cast_off_mooring_clear_pass: { inputType: 'datetime-local' },
  mooring_place_2: {},
  part_2: {},
  check_part_2: { inputType: 'truefalse' },
  mooring_2: {},
  sailing_time: {},
  total_waiting_disch_mv: {},
  check_total_waiting_disch_mv: { inputType: 'yesno' },
  waiting_cargo_readiness: {},
  waiting_mv: {},
  waiting_flf: {},
  waiting_queueing: {},
  waiting_sequence: {},
  other_factor: {},
  back_to_jetty_time: {},
  ta_barges_actual: { inputType: 'datetime-local' },
  ta_mv: { inputType: 'datetime-local' },
  ta_flf: { inputType: 'datetime-local' },
  cargo_readiness_actual: { inputType: 'datetime-local' },
  start_disch: { inputType: 'datetime-local' },
  completed_disch: { inputType: 'datetime-local' },
  discharge_sequence: { inputType: 'discharge-sequence' },
  back_to_jetty: { inputType: 'datetime-local' },
  loading_rate: {},
  disch_time_loading_rate: {},
  disch_time_percent: {},
  cargo_readiness_p3: {},
  pure_time: {},
  waiting_cargo_readiness_p3: {},
  waiting_mv_p3: {},
  waiting_flf_p3: {},
  waiting_queuing_p3: {},
  waiting_sequence_p3: {},
  other_factor_p3: {},
  check_waiting_time_disch_mv: { inputType: 'truefalse' },
  total_ct_ltc: {},
  laytime: {},
  ltc_rate: {},
  ltc_day: {},
  ltc_total: {},
  operation_remarks: { inputType: 'textarea', remarksColumn: true },
};

// Matches urutkanSesuaiDenganDischargeSequence (8tluoperation.php:2704-2723):
// the ordering cross-row cycle-time formulas (loading rate sum, disch time
// prev/next) treat as each vessel's sibling order.
function dischargeSequenceSortValue(row) {
  let operationData = {};
  try {
    operationData = row.operation_data && typeof row.operation_data === 'object'
      ? row.operation_data
      : JSON.parse(row.operation_data || '{}');
  } catch {
    operationData = {};
  }
  const sequence = Number(String(operationData.discharge_sequence ?? '').trim());
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
}

function urutkanSesuaiDenganDischargeSequence(rows) {
  return [...rows].sort((left, right) => {
    const leftSequence = dischargeSequenceSortValue(left);
    const rightSequence = dischargeSequenceSortValue(right);
    if (leftSequence === null && rightSequence !== null) return 1;
    if (leftSequence !== null && rightSequence === null) return -1;
    if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }
    const leftBargeSequence = Number(left.barge_seq) || 0;
    const rightBargeSequence = Number(right.barge_seq) || 0;
    if (leftBargeSequence !== rightBargeSequence) return leftBargeSequence - rightBargeSequence;
    return (Number(left.id) || 0) - (Number(right.id) || 0);
  });
}

export function init({ vesselPeriods, optionLists }) {
  buildHeaderCells(document.getElementById('cycleTimeHeaderRow'), true);

  const cycleYearSelect = document.getElementById('cycle_year');
  const cycleMonthSelect = document.getElementById('cycle_month');
  const cycleNoPkSelect = document.getElementById('cycle_no_pk');
  const cycleTimeBox = document.getElementById('cycleTimeBox');
  const cycleTimeBody = document.getElementById('cycleTimeBody');
  const cycleTimeSummary = document.getElementById('cycleTimeSummary');
  const downloadCycleTimeCsv = document.getElementById('downloadCycleTimeCsv');

  const availableYears = availableYearsFrom(vesselPeriods);
  replaceSelectOptions(cycleYearSelect, '-- Pilih Tahun --', availableYears.map(y => ({ value: y, label: y })));

  cycleYearSelect.addEventListener('change', () => {
    cycleTimeBox.classList.add('d-none');
    replaceSelectOptions(cycleNoPkSelect, '-- Pilih Mother Vessel --', []);
    cycleNoPkSelect.disabled = true;

    const year = cycleYearSelect.value;
    if (!year) {
      replaceSelectOptions(cycleMonthSelect, '-- Pilih Bulan --', []);
      cycleMonthSelect.disabled = true;
      return;
    }
    const months = [...new Set(
      vesselPeriods.filter(v => String(v.laycan_year) === year).map(v => Number(v.laycan_month))
    )].sort((a, b) => a - b);
    replaceSelectOptions(cycleMonthSelect, '-- Pilih Bulan --', months.map(m => ({ value: String(m), label: monthNames[m - 1] })));
    cycleMonthSelect.disabled = false;
  });

  cycleMonthSelect.addEventListener('change', () => {
    cycleTimeBox.classList.add('d-none');
    const year = cycleYearSelect.value;
    const month = cycleMonthSelect.value;
    if (!year || !month) {
      replaceSelectOptions(cycleNoPkSelect, '-- Pilih Mother Vessel --', []);
      cycleNoPkSelect.disabled = true;
      return;
    }
    const vessels = vesselPeriods
      .filter(v => String(v.laycan_year) === year && String(Number(v.laycan_month)) === String(Number(month)))
      .sort((a, b) => a.mothervessel.localeCompare(b.mothervessel));
    replaceSelectOptions(
      cycleNoPkSelect,
      '-- Pilih Mother Vessel --',
      vessels.map(v => ({ value: v.no_pk, label: `${v.mothervessel} (${v.no_pk})` }))
    );
    cycleNoPkSelect.disabled = false;
  });

  // currentAllRows stays in discharge-sequence order (the cross-row basis
  // every getFieldValue/columnDisplayValue call needs); renderCycleTimeTable()
  // re-derives display order and re-renders from it, so both the initial load
  // and the post-save/post-import refresh can share one code path.
  let currentAllRows = [];

  function renderCycleTimeTable() {
    const allRows = currentAllRows;
    // Default display order matches legacy's default sort (completed_disch
    // ascending, 8tluoperation.php:3990 `defaultSort: { key: 'completed_disch' }`).
    const displayRows = [...allRows].sort((a, b) => {
      const parse = v => {
        const t = v ? Date.parse(String(v).replace(' ', 'T')) : NaN;
        return isNaN(t) ? -Infinity : t;
      };
      return parse(getFieldValue(a, 'completed_disch', allRows)) - parse(getFieldValue(b, 'completed_disch', allRows));
    });

    // Single-vessel table: unlike the landing table's grouped rows, every row
    // here shows its own Stowage Plan (the value is identical vessel-wide, no
    // need to blank it after the first row).
    cycleTimeSummary.textContent = `${displayRows.length} baris`;
    cycleTimeBody.innerHTML = displayRows.length
      ? displayRows.map((row, index) => `<tr data-row-id="${row.id}" role="button" tabindex="0">${
          `<td>${index + 1}</td>` + headerKeys.map(key => `<td>${displayValue(columnDisplayValue(row, key, allRows))}</td>`).join('')
        }</tr>`).join('')
      : `<tr><td colspan="${headerKeys.length + 1}" class="text-center text-muted py-3">Data tidak ditemukan.</td></tr>`;
  }

  cycleNoPkSelect.addEventListener('change', async () => {
    const noPk = cycleNoPkSelect.value;

    // Matches loadSelectedVessel()'s downloadCsv.href assignment
    // (8tluoperation.php:3716-3717) — not IT-gated, unlike scope=year.
    if (downloadCycleTimeCsv) {
      if (noPk) {
        downloadCycleTimeCsv.href = `/tlu-operation?download=tlu_operation_template&no_pk=${encodeURIComponent(noPk)}`;
        downloadCycleTimeCsv.classList.remove('disabled');
        downloadCycleTimeCsv.removeAttribute('aria-disabled');
      } else {
        downloadCycleTimeCsv.href = '#';
        downloadCycleTimeCsv.classList.add('disabled');
        downloadCycleTimeCsv.setAttribute('aria-disabled', 'true');
      }
    }

    if (!noPk) {
      cycleTimeBox.classList.add('d-none');
      return;
    }

    cycleTimeBody.innerHTML = `<tr><td colspan="${headerKeys.length + 1}" class="text-center text-muted py-3">Memuat data...</td></tr>`;
    cycleTimeBox.classList.remove('d-none');

    const result = await fetchJson(`/tlu-operation?ajax=1&action=si_barges_by_vessel&no_pk=${encodeURIComponent(noPk)}`);
    if (!result.ok) {
      cycleTimeBody.innerHTML = `<tr><td colspan="${headerKeys.length + 1}" class="text-center text-danger py-3">${esc(result.msg || 'Gagal memuat data.')}</td></tr>`;
      cycleTimeSummary.textContent = '';
      currentAllRows = [];
      return;
    }

    currentAllRows = urutkanSesuaiDenganDischargeSequence(result.data || []);
    renderCycleTimeTable();
  });

  async function reloadCurrentVessel() {
    const noPk = cycleNoPkSelect.value;
    if (!noPk) return;
    const result = await fetchJson(`/tlu-operation?ajax=1&action=si_barges_by_vessel&no_pk=${encodeURIComponent(noPk)}`);
    if (!result.ok) return;
    currentAllRows = urutkanSesuaiDenganDischargeSequence(result.data || []);
    renderCycleTimeTable();
  }

  // ===== Row-detail edit modal (issue #11) =====

  const operationDetailModalEl = document.getElementById('operationDetailModal');
  let operationDetailModal = null;
  const operationDetailSubtitle = document.getElementById('operationDetailSubtitle');
  const operationDetailBody = document.getElementById('operationDetailBody');
  const operationSaveButton = document.getElementById('operationSaveButton');
  const operationSaveStatus = document.getElementById('operationSaveStatus');

  let currentDetailRowId = null;

  function selectMarkup(field, currentValue, options) {
    const value = String(currentValue ?? '');
    const withCurrent = value !== '' && !options.includes(value) ? [value, ...options] : options;
    return `<select class="form-select form-select-sm" data-operation-field="${esc(field)}">` +
      `<option value="">-- Pilih --</option>` +
      withCurrent.map(opt => `<option value="${esc(opt)}"${opt === value ? ' selected' : ''}>${esc(opt)}</option>`).join('') +
      `</select>`;
  }

  function datetimeLocalValue(raw) {
    const s = String(raw ?? '').trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/);
    return m ? `${m[1]}T${m[2]}` : '';
  }

  function operationFieldWidget(key, meta, currentValue, allRows) {
    const field = esc(key);
    if (meta.calculated) {
      return `<div class="form-control form-control-sm bg-light" data-operation-field="${field}">${displayValue(currentValue)}</div>` +
        `<div class="form-text">Dihitung otomatis: QTY DISC + RC</div>`;
    }
    if (meta.inputType === 'barge-vendor') return selectMarkup(key, currentValue, optionLists.bargeVendorOptions || []);
    if (meta.inputType === 'pbm-vendor') return selectMarkup(key, currentValue, optionLists.pbmVendorOptions || []);
    if (meta.inputType === 'floating-crane') return selectMarkup(key, currentValue, optionLists.floatingCraneOptions || []);
    if (meta.inputType === 'discharge-sequence') {
      const options = Array.from({ length: allRows.length }, (_, i) => String(i + 1));
      return selectMarkup(key, currentValue, options);
    }
    if (meta.inputType === 'yesno') return selectMarkup(key, currentValue, ['Yes', 'No']);
    if (meta.inputType === 'truefalse') return selectMarkup(key, currentValue, ['True', 'False']);
    if (meta.inputType === 'datetime-local') {
      return `<input type="datetime-local" class="form-control form-control-sm" data-operation-field="${field}" value="${esc(datetimeLocalValue(currentValue))}">`;
    }
    if (meta.inputType === 'textarea') {
      return `<textarea class="form-control form-control-sm" rows="2" data-operation-field="${field}">${esc(currentValue)}</textarea>`;
    }
    return `<input type="text" class="form-control form-control-sm" data-operation-field="${field}" value="${esc(currentValue)}">`;
  }

  const TIMELINE_FIELDS = ['arrival_jetty', 'start_loading', 'completed_loading', 'start_mooring', 'end_mooring', 'start_disch', 'completed_disch'];

  // Direct port of validateOperationTimelineInputs (8tluoperation.php:2978-3023).
  function validateOperationTimelineInputs(reportError) {
    const inputs = {};
    for (const field of TIMELINE_FIELDS) {
      inputs[field] = operationDetailBody.querySelector(`[data-operation-field="${field}"]`);
    }
    const timelineInputs = Object.values(inputs);
    if (timelineInputs.some(input => !input)) return true;

    timelineInputs.forEach(input => input.setCustomValidity(''));

    inputs.start_loading.min = inputs.arrival_jetty.value || '';
    inputs.completed_loading.min = inputs.start_loading.value || inputs.arrival_jetty.value || '';
    inputs.end_mooring.min = inputs.start_mooring.value || '';
    inputs.completed_disch.min = inputs.start_disch.value || '';

    if (inputs.arrival_jetty.value && inputs.start_loading.value && inputs.start_loading.value < inputs.arrival_jetty.value) {
      inputs.start_loading.setCustomValidity('Start Loading must be equal to or later than Arrival Jetty.');
    }
    if (inputs.start_loading.value && inputs.completed_loading.value && inputs.completed_loading.value < inputs.start_loading.value) {
      inputs.completed_loading.setCustomValidity('Completed Loading must be equal to or later than Start Loading.');
    }
    if (!inputs.start_loading.value && inputs.arrival_jetty.value && inputs.completed_loading.value && inputs.completed_loading.value < inputs.arrival_jetty.value) {
      inputs.completed_loading.setCustomValidity('Completed Loading must be equal to or later than Arrival Jetty.');
    }
    if (inputs.start_mooring.value && inputs.end_mooring.value && inputs.end_mooring.value < inputs.start_mooring.value) {
      inputs.end_mooring.setCustomValidity('End Mooring must be equal to or later than Start Mooring.');
    }
    if (inputs.start_disch.value && inputs.completed_disch.value && inputs.completed_disch.value < inputs.start_disch.value) {
      inputs.completed_disch.setCustomValidity('Completed Disch must be equal to or later than Start Disch.');
    }

    const invalidInput = timelineInputs.find(input => !input.checkValidity());
    if (invalidInput && reportError) invalidInput.reportValidity();
    return !invalidInput;
  }

  // Mirrors the KTM/MLS restriction rule the server enforces (RESTRICTED_FLOATING_CRANES
  // in src/lib/operation-fields.ts) so users don't hit a late server rejection.
  const RESTRICTED_FLOATING_CRANES = { KTM: 'STV KTM', MLS: 'STV MAESTRO' };

  function applyFloatingCraneRestriction() {
    const pbmSelect = operationDetailBody.querySelector('[data-operation-field="pbm_vendor"]');
    const floatingSelect = operationDetailBody.querySelector('[data-operation-field="floating_crane"]');
    if (!pbmSelect || !floatingSelect) return;

    const restrictedValues = Object.values(RESTRICTED_FLOATING_CRANES);
    const forced = RESTRICTED_FLOATING_CRANES[pbmSelect.value];

    for (const option of floatingSelect.options) {
      if (restrictedValues.includes(option.value)) {
        option.hidden = Boolean(forced) && option.value !== forced;
      }
    }

    if (forced) {
      floatingSelect.value = forced;
      floatingSelect.disabled = true;
    } else {
      floatingSelect.disabled = false;
      if (restrictedValues.includes(floatingSelect.value)) floatingSelect.value = '';
    }
  }

  function updateCalculatedQtyActual() {
    const qtyDiscEl = operationDetailBody.querySelector('[data-operation-field="qty_disc"]');
    const rcEl = operationDetailBody.querySelector('[data-operation-field="rc"]');
    const qtyActualEl = operationDetailBody.querySelector('[data-operation-field="qty_actual"]');
    if (!qtyActualEl) return;
    qtyActualEl.textContent = displayValue(calculateQtyActual({
      qty_disc: qtyDiscEl ? qtyDiscEl.value : '',
      rc: rcEl ? rcEl.value : '',
    }));
  }

  function openOperationDetail(rowId) {
    const row = currentAllRows.find(r => String(r.id) === String(rowId));
    if (!row || !operationDetailModalEl) return;
    if (!operationDetailModal) operationDetailModal = new bootstrap.Modal(operationDetailModalEl);
    currentDetailRowId = rowId;

    operationDetailSubtitle.textContent = `${row.si_barges || ''} — ${row.mothervessel || ''}`;
    operationSaveStatus.textContent = '';
    operationSaveStatus.className = 'me-auto small';

    operationDetailBody.innerHTML = CYCLE_TIME_COLUMNS.map(([key, label]) => {
      const meta = OPERATION_EDIT_META[key];
      const value = getFieldValue(row, key, currentAllRows);
      const widget = meta
        ? operationFieldWidget(key, meta, value, currentAllRows)
        : `<div class="form-control form-control-sm bg-light border-0">${displayValue(columnDisplayValue(row, key, currentAllRows))}</div>`;
      return `<div class="col-md-4 si-detail-row"><label class="form-label small fw-semibold mb-1">${esc(label)}</label>${widget}</div>`;
    }).join('');

    updateCalculatedQtyActual();
    ['qty_disc', 'rc'].forEach(field => {
      const input = operationDetailBody.querySelector(`[data-operation-field="${field}"]`);
      if (input) input.addEventListener('input', updateCalculatedQtyActual);
    });

    const pbmSelect = operationDetailBody.querySelector('[data-operation-field="pbm_vendor"]');
    if (pbmSelect) pbmSelect.addEventListener('change', applyFloatingCraneRestriction);
    applyFloatingCraneRestriction();

    TIMELINE_FIELDS.forEach(field => {
      const input = operationDetailBody.querySelector(`[data-operation-field="${field}"]`);
      if (input) input.addEventListener('input', () => validateOperationTimelineInputs(false));
    });
    validateOperationTimelineInputs(false);

    operationDetailModal.show();
  }

  cycleTimeBody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-row-id]');
    if (tr) openOperationDetail(tr.dataset.rowId);
  });
  cycleTimeBody.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tr = e.target.closest('tr[data-row-id]');
    if (tr) {
      e.preventDefault();
      openOperationDetail(tr.dataset.rowId);
    }
  });

  if (operationSaveButton) {
    operationSaveButton.addEventListener('click', async () => {
      const row = currentAllRows.find(r => String(r.id) === String(currentDetailRowId));
      if (!row) return;

      if (!validateOperationTimelineInputs(true)) {
        operationSaveStatus.textContent = 'Please correct the invalid operation time sequence.';
        operationSaveStatus.className = 'me-auto small text-danger';
        return;
      }

      const data = {};
      operationDetailBody.querySelectorAll('[data-operation-field]').forEach(el => {
        data[el.dataset.operationField] = el.matches('input, textarea, select')
          ? el.value.trim()
          : (el.textContent.trim() === '-' ? '' : el.textContent.trim());
      });

      operationSaveButton.disabled = true;
      operationSaveButton.textContent = 'Saving...';
      operationSaveStatus.textContent = '';

      try {
        const response = await fetch('/tlu-operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_operation_data', sibarges_id: row.id, data }),
        });
        const result = await response.json();
        if (!result.ok) throw new Error(result.msg || 'Gagal menyimpan data operasi.');

        const { operation_remarks, ...operationDataOnly } = result.data || {};
        row.operation_data = JSON.stringify(operationDataOnly);
        row.operation_remarks = operation_remarks || '';
        currentAllRows = urutkanSesuaiDenganDischargeSequence(currentAllRows);
        renderCycleTimeTable();

        operationSaveStatus.textContent = result.msg;
        operationSaveStatus.className = 'me-auto small text-success';
      } catch (error) {
        operationSaveStatus.textContent = error.message;
        operationSaveStatus.className = 'me-auto small text-danger';
      } finally {
        operationSaveButton.disabled = false;
        operationSaveButton.textContent = 'Save';
      }
    });
  }

  // ===== CSV import (IT-only, issue #11) =====

  const operationImportForm = document.getElementById('operationImportForm');
  if (operationImportForm) {
    operationImportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('operationCsvFile');
      const statusEl = document.getElementById('operationCsvStatus');
      const file = fileInput.files[0];
      if (!file) return;

      const fd = new FormData();
      fd.append('action', 'import_operation_csv');
      fd.append('csv', file);

      statusEl.classList.remove('d-none', 'alert-success', 'alert-warning', 'alert-danger');
      statusEl.textContent = 'Mengimpor...';

      try {
        const response = await fetch('/tlu-operation', { method: 'POST', body: fd });
        const result = await response.json();
        statusEl.textContent = result.msg || '';
        statusEl.classList.add(!result.ok ? 'alert-danger' : result.partial ? 'alert-warning' : 'alert-success');
        if (result.ok) {
          fileInput.value = '';
          await reloadCurrentVessel();
        }
      } catch (error) {
        statusEl.textContent = error.message;
        statusEl.classList.add('alert-danger');
      }
    });
  }
}
