// Export CSV card: scope picker (vessel/month/year/all) + grouped, scoped
// CSV download. Split out of views/tlu-operation.ejs's inline script — see
// docs/adr/0004-tlu-operation-view-submodules.md.
//
// Port of the legacy Export tab's scope picker + downloadGroupedExport
// handler (8tluoperation.php:1600-1672, 1955-2078, 2109-2176). CSV column
// order/labels come from CYCLE_TIME_COLUMNS (this port's single source of
// truth), not a DOM scrape of #cycleTimeTable's header — see issue #12.
import {
  CYCLE_TIME_COLUMNS, headerKeys, groupRowsByVessel, buildRowValues,
  fetchJson, replaceSelectOptions, monthNames, availableYearsFrom,
} from '/assets/js/tlu-operation-shared.mjs';

// Matches csvCell (8tluoperation.php:2693-2696).
function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

// Matches the Blob-download trigger in the legacy downloadGroupedExport
// handler (8tluoperation.php:2161-2169).
function triggerCsvDownload(filename, csvLines) {
  const blob = new Blob([`﻿${csvLines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function init({ vesselPeriods }) {
  const exportScopeInputs = [...document.querySelectorAll('input[name="tlu_export_scope"]')];
  const exportYearGroup = document.getElementById('exportYearGroup');
  const exportMonthGroup = document.getElementById('exportMonthGroup');
  const exportVesselGroup = document.getElementById('exportVesselGroup');
  const exportYearSelect = document.getElementById('export_year');
  const exportMonthSelect = document.getElementById('export_month');
  const exportNoPkSelect = document.getElementById('export_no_pk');
  const downloadGroupedExport = document.getElementById('downloadGroupedExport');
  const groupedExportStatus = document.getElementById('groupedExportStatus');

  const availableYears = availableYearsFrom(vesselPeriods);
  replaceSelectOptions(exportYearSelect, '-- Pilih Tahun --', availableYears.map(y => ({ value: y, label: y })));

  function selectedExportScope() {
    return exportScopeInputs.find(input => input.checked)?.value || 'vessel';
  }

  function updateGroupedExportStatus(message = '', variant = 'danger') {
    groupedExportStatus.textContent = message;
    groupedExportStatus.classList.toggle('d-none', message === '');
    groupedExportStatus.classList.toggle('alert-danger', variant === 'danger');
    groupedExportStatus.classList.toggle('alert-info', variant === 'info');
  }

  function updateExportScopeFields() {
    const scope = selectedExportScope();
    exportYearGroup.classList.toggle('d-none', scope === 'all');
    exportMonthGroup.classList.toggle('d-none', !['vessel', 'month'].includes(scope));
    exportVesselGroup.classList.toggle('d-none', scope !== 'vessel');
    updateGroupedExportStatus();
  }

  function updateExportMonths() {
    const selectedYear = exportYearSelect.value;
    const months = [...new Set(
      vesselPeriods.filter(v => String(v.laycan_year) === selectedYear).map(v => Number(v.laycan_month))
    )].sort((a, b) => a - b);
    replaceSelectOptions(exportMonthSelect, '-- Pilih Bulan --', months.map(m => ({ value: String(m), label: monthNames[m - 1] })));
    exportMonthSelect.disabled = !selectedYear;
    replaceSelectOptions(exportNoPkSelect, '-- Pilih Mother Vessel --', []);
    exportNoPkSelect.disabled = true;
  }

  function updateExportVessels() {
    const selectedYear = exportYearSelect.value;
    const selectedMonth = exportMonthSelect.value;
    const vessels = vesselPeriods.filter(v =>
      String(v.laycan_year) === selectedYear && String(Number(v.laycan_month)) === String(Number(selectedMonth))
    );
    replaceSelectOptions(
      exportNoPkSelect,
      '-- Pilih Mother Vessel --',
      vessels.map(v => ({ value: v.no_pk, label: `${v.no_pk} — ${v.mothervessel}` }))
    );
    exportNoPkSelect.disabled = !selectedMonth;
  }

  exportScopeInputs.forEach(input => input.addEventListener('change', updateExportScopeFields));
  exportYearSelect.addEventListener('change', () => { updateExportMonths(); updateGroupedExportStatus(); });
  exportMonthSelect.addEventListener('change', () => { updateExportVessels(); updateGroupedExportStatus(); });
  exportNoPkSelect.addEventListener('change', () => updateGroupedExportStatus());
  updateExportScopeFields();

  downloadGroupedExport.addEventListener('click', async () => {
    const scope = selectedExportScope();
    const year = exportYearSelect.value;
    const month = exportMonthSelect.value;
    const noPk = exportNoPkSelect.value;

    if (scope !== 'all' && !year) {
      updateGroupedExportStatus('Pilih tahun terlebih dahulu.');
      return;
    }
    if (['vessel', 'month'].includes(scope) && !month) {
      updateGroupedExportStatus('Pilih bulan terlebih dahulu.');
      return;
    }
    if (scope === 'vessel' && !noPk) {
      updateGroupedExportStatus('Pilih Mother Vessel terlebih dahulu.');
      return;
    }

    const params = new URLSearchParams({ ajax: '1', action: 'tlu_grouped_export_data', scope });
    if (scope !== 'all') params.set('year', year);
    if (['vessel', 'month'].includes(scope)) params.set('month', month);
    if (scope === 'vessel') params.set('no_pk', noPk);

    downloadGroupedExport.disabled = true;
    updateGroupedExportStatus('Menyiapkan export...', 'info');

    try {
      const result = await fetchJson(`/tlu-operation?${params.toString()}`);
      if (!result.ok) throw new Error(result.msg || 'Gagal export.');

      // Rows arrive vessel-defaulted but NOT cycle-time-computed — compute here,
      // grouped per vessel so cross-row formulas (loading rate, disch time) see
      // only their own vessel's siblings, matching ADR-0001.
      const headerLabels = CYCLE_TIME_COLUMNS.map(([, label]) => label);
      const csvLines = [headerLabels.map(csvCell).join(',')];
      groupRowsByVessel(result.rows).forEach((group, groupIndex) => {
        if (groupIndex > 0) csvLines.push('');
        group.forEach((row, rowIndexInVessel) => {
          csvLines.push(buildRowValues(row, group, rowIndexInVessel, headerKeys).map(csvCell).join(','));
        });
      });

      triggerCsvDownload(result.filename, csvLines);
      updateGroupedExportStatus('');
    } catch (error) {
      updateGroupedExportStatus(error.message || 'Gagal export.', 'danger');
    } finally {
      downloadGroupedExport.disabled = false;
    }
  });
}
