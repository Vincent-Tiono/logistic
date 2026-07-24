<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

require_once __DIR__ . '/../config/database.php';

try {
  $koneksi = db_connect('databarging');
  ensure_vessel_schedule_columns($koneksi);
} catch (RuntimeException $exception) {
  http_response_code(500);
  die(htmlspecialchars($exception->getMessage(), ENT_QUOTES, 'UTF-8'));
}

function jsonOut($data){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data);
  exit;
}

const TLU_OPERATION_FIELDS = [
  'qty',
  'qty_disc',
  'rc',
  'qty_actual',
  'pbm_vendor',
  'floating_crane',
  'arrival_jetty',
  'start_loading',
  'completed_loading',
  'lhv',
  'spog_zona_2',
  'pkk',
  'rkbm',
  'sts_spb',
  'start_mooring',
  'end_mooring',
  'mooring_place_1',
  'clear_pass',
  'start_mooring_clear_pass',
  'cast_off_mooring_clear_pass',
  'mooring_place_2',
  'ta_barges_actual',
  'ta_mv',
  'ta_flf',
  'cargo_readiness_actual',
  'start_disch',
  'completed_disch',
  'discharge_sequence',
  'back_to_jetty',
  'waiting_loading_jetty',
  'check_waiting_loading_jetty',
  'barges_arrival_early',
  'waiting_plan_loading',
  'loading_time_jetty',
  'part_1',
  'check_part_1',
  'lhv_time',
  'spog_time',
  'clear_pass_time',
  'part_2',
  'check_part_2',
  'mooring_2',
  'sailing_time',
  'total_waiting_disch_mv',
  'check_total_waiting_disch_mv',
  'waiting_cargo_readiness',
  'waiting_mv',
  'waiting_flf',
  'waiting_queueing',
  'waiting_sequence',
  'other_factor',
  'back_to_jetty_time',
  'loading_rate',
  'disch_time_loading_rate',
  'disch_time_percent',
  'cargo_readiness_p3',
  'pure_time',
  'waiting_cargo_readiness_p3',
  'waiting_mv_p3',
  'waiting_flf_p3',
  'waiting_queuing_p3',
  'waiting_sequence_p3',
  'other_factor_p3',
  'check_waiting_time_disch_mv',
  'total_ct_ltc',
  'laytime',
  'ltc_rate',
  'ltc_day',
  'ltc_total'
];

/* Cycle Time module: editable columns between Floating Crane and Laycan Start. */
const TLU_CYCLE_TIME_FIELDS = [
  'waiting_loading_jetty' => 'Waiting Loading Jetty',
  'check_waiting_loading_jetty' => 'Check Waiting Loading Jetty',
  'barges_arrival_early' => 'Barges Arrival Early',
  'waiting_plan_loading' => 'Waiting Plan Loading',
  'loading_time_jetty' => 'Loading Time Jetty',
  'part_1' => 'Part 1',
  'check_part_1' => 'Check Part 1',
  'lhv_time' => 'LHV Time',
  'spog_time' => 'SPOG Time',
  'clear_pass_time' => 'Clear Pass Time',
  'part_2' => 'Part 2',
  'check_part_2' => 'Check Part 2',
  'mooring_2' => 'Mooring 2',
  'sailing_time' => 'Sailing Time',
  'total_waiting_disch_mv' => 'Total Waiting Disch MV',
  'check_total_waiting_disch_mv' => 'Check Total Waiting Disch MV',
  'waiting_cargo_readiness' => 'Waiting Cargo Readiness (P2)',
  'waiting_mv' => 'Waiting MV (P2)',
  'waiting_flf' => 'Waiting FLF (P2)',
  'waiting_queueing' => 'Waiting Queueing (P2)',
  'waiting_sequence' => 'Waiting Sequence (P2)',
  'other_factor' => 'Other Factor (P2)',
  'back_to_jetty_time' => 'Back to Jetty Time',
  'loading_rate' => 'Loading Rate',
  'disch_time_loading_rate' => 'Disch Time for Loading Rate',
  'disch_time_percent' => 'Disch Time %',
  'cargo_readiness_p3' => 'Cargo Readiness (P3)',
  'pure_time' => 'Pure Time',
  'waiting_cargo_readiness_p3' => 'Waiting Cargo Readiness (P3)',
  'waiting_mv_p3' => 'Waiting MV (P3)',
  'waiting_flf_p3' => 'Waiting FLF (P3)',
  'waiting_queuing_p3' => 'Waiting Queuing (P3)',
  'waiting_sequence_p3' => 'Waiting Sequence (P3)',
  'other_factor_p3' => 'Other Factor (P3)',
  'check_waiting_time_disch_mv' => 'Check Waiting Time Disch MV',
  'total_ct_ltc' => 'Total CT LTC',
  'laytime' => 'Laytime',
  'ltc_rate' => 'LTC Rate',
  'ltc_day' => 'LTC Day',
  'ltc_total' => 'LTC Total'
];

const TLU_CYCLE_TIME_NUMBER_FIELDS = [
  'waiting_loading_jetty',
  'barges_arrival_early',
  'waiting_plan_loading',
  'loading_time_jetty',
  'part_1',
  'lhv_time',
  'spog_time',
  'clear_pass_time',
  'part_2',
  'mooring_2',
  'sailing_time',
  'total_waiting_disch_mv',
  'waiting_cargo_readiness',
  'waiting_mv',
  'waiting_flf',
  'waiting_queueing',
  'waiting_sequence',
  'other_factor',
  'back_to_jetty_time',
  'loading_rate',
  'disch_time_loading_rate',
  'disch_time_percent',
  'cargo_readiness_p3',
  'pure_time',
  'waiting_cargo_readiness_p3',
  'waiting_mv_p3',
  'waiting_flf_p3',
  'waiting_queuing_p3',
  'waiting_sequence_p3',
  'other_factor_p3',
  'total_ct_ltc',
  'laytime',
  'ltc_rate',
  'ltc_day',
  'ltc_total'
];

const TLU_CYCLE_TIME_YESNO_FIELDS = ['check_total_waiting_disch_mv'];
const TLU_CYCLE_TIME_TRUEFALSE_FIELDS = ['check_waiting_loading_jetty', 'check_part_1', 'check_part_2', 'check_waiting_time_disch_mv'];

const TLU_DATETIME_FIELDS = [
  'arrival_jetty' => 'Arrival Jetty',
  'start_loading' => 'Start Loading',
  'completed_loading' => 'Completed Loading',
  'lhv' => 'LHV',
  'spog_zona_2' => 'SPOG ZONA 2',
  'pkk' => 'PKK',
  'rkbm' => 'RKBM',
  'sts_spb' => 'STS/SPB',
  'start_mooring' => 'Start Mooring',
  'end_mooring' => 'End Mooring',
  'clear_pass' => 'Clear Pass',
  'start_mooring_clear_pass' => 'Start Mooring Clear Pass',
  'cast_off_mooring_clear_pass' => 'Cast Off Mooring Clear Pass',
  'ta_barges_actual' => 'TA Barges Actual',
  'ta_mv' => 'TA MV',
  'ta_flf' => 'TA FLF',
  'cargo_readiness_actual' => 'Cargo Readiness Actual',
  'start_disch' => 'Start Disch',
  'completed_disch' => 'Completed Disch',
  'back_to_jetty' => 'Back to Jetty'
];

const TLU_CSV_COLUMNS = [
  'si_barges',
  'no_pk',
  'buyer',
  'mother_vessel',
  'jetty',
  'tugboat',
  'barge',
  'qty',
  'qty_disc',
  'rc',
  'qty_actual',
  'pbm_vendor',
  'floating_crane',
  'laycan_start',
  'laycan_end',
  'arrival_jetty',
  'start_loading',
  'completed_loading',
  'lhv',
  'spog_zona_2',
  'pkk',
  'rkbm',
  'sts_spb',
  'start_mooring',
  'end_mooring',
  'mooring_place_1',
  'clear_pass',
  'start_mooring_clear_pass',
  'cast_off_mooring_clear_pass',
  'mooring_place_2',
  'ta_barges_actual',
  'ta_mv',
  'ta_flf',
  'cargo_readiness_actual',
  'start_disch',
  'completed_disch',
  'discharge_sequence',
  'back_to_jetty',
  'remarks'
];

const TLU_TABLE_EXPORT_HEADERS = [
  'No. Reff',
  'Buyer',
  'Mother Vessel',
  'Jetty',
  'Tugboat',
  'Barge',
  'QTY',
  'QTY DISC',
  'RC',
  'QTY Actual',
  'PBM Vendor',
  'Floating Crane',
  'Laycan Start',
  'Laycan End',
  'Arrival Jetty',
  'Start Loading',
  'Completed Loading',
  'LHV',
  'SPOG ZONA 2',
  'PKK',
  'RKBM',
  'STS/SPB',
  'Start Mooring',
  'End Mooring',
  'Mooring Place 1',
  'Clear Pass',
  'Start Mooring Clear Pass',
  'Cast Off Mooring Clear Pass',
  'Mooring Place 2',
  'TA Barges Actual',
  'TA MV',
  'TA FLF',
  'Cargo Readiness Actual',
  'Start Disch',
  'Completed Disch',
  'Discharge Sequence',
  'Back to Jetty',
  'Remarks',
  'Created By',
  'Created At',
  'Updated At'
];

function parseOperationNumber($value, $label) {
  $value = trim((string)$value);
  if ($value === '') return null;

  $normalized = str_replace([',', ' '], ['', ''], $value);
  if (!is_numeric($normalized)) {
    jsonOut(['ok' => false, 'msg' => $label . ' harus berupa angka.']);
  }

  return (float)$normalized;
}

function formatOperationNumber($value) {
  return rtrim(rtrim(number_format($value, 6, '.', ''), '0'), '.');
}

function formatOperationDisplayNumber($value) {
  $value = trim((string)$value);
  if ($value === '') return '';

  $normalized = str_replace([',', ' '], ['', ''], $value);
  if (!is_numeric($normalized)) return $value;

  return rtrim(rtrim(number_format((float)$normalized, 6, '.', ','), '0'), '.');
}

function validateFlfChoice($koneksi, $column, $value, $label) {
  if ($value === '') return;

  $allowedColumns = ['vendor_flf', 'floating_crane'];
  if (!in_array($column, $allowedColumns, true)) {
    jsonOut(['ok' => false, 'msg' => 'Kolom FLF tidak valid.']);
  }

  $stmt = $koneksi->prepare("SELECT 1 FROM flf WHERE {$column} = ? LIMIT 1");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
  $stmt->bind_param('s', $value);
  $stmt->execute();
  $exists = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$exists) jsonOut(['ok' => false, 'msg' => $label . ' tidak ditemukan pada data FLF.']);
}

function parseOperationDateTimeValue($value) {
  $value = trim((string)$value);
  if ($value === '') return '';

  $formats = [
    '!Y-m-d\TH:i',
    '!Y-m-d H:i',
    '!Y-m-d H:i:s',
    '!Y/m/d H:i',
    '!Y/n/j H:i',
    '!Y/m/d G:i',
    '!Y/n/j G:i',
    '!d/m/Y H:i',
    '!j/n/Y H:i',
    '!d/m/Y G:i',
    '!j/n/Y G:i',
    '!m/d/Y H:i',
    '!d/M/y H:i'
  ];
  foreach ($formats as $format) {
    $date = DateTime::createFromFormat($format, $value);
    $errors = DateTime::getLastErrors();
    if ($date && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
      return $date->format('Y-m-d H:i');
    }
  }

  return null;
}

/* ===== display format dd/Mon/yy [HH:MM] for tables & CSV export ===== */
function formatDisplayDateTime($value, $withTime = true) {
  $value = trim((string)$value);
  if ($value === '') return '';

  $formats = ['!Y-m-d H:i:s', '!Y-m-d H:i', '!Y-m-d\TH:i', '!Y-m-d'];
  $date = null;
  foreach ($formats as $format) {
    $date = DateTime::createFromFormat($format, $value);
    if ($date) break;
  }
  if (!$date) return $value;

  return $withTime ? $date->format('d/M/y H:i') : $date->format('d/M/y');
}

function normalizeOperationDateTime($value, $label) {
  $normalized = parseOperationDateTimeValue($value);
  if ($normalized === null) {
    jsonOut(['ok' => false, 'msg' => $label . ' harus berisi tanggal dan waktu yang valid.']);
  }
  return $normalized;
}

function operationTimelineErrors(array $operationData) {
  $arrivalJetty = trim((string)($operationData['arrival_jetty'] ?? ''));
  $startLoading = trim((string)($operationData['start_loading'] ?? ''));
  $completedLoading = trim((string)($operationData['completed_loading'] ?? ''));
  $startMooring = trim((string)($operationData['start_mooring'] ?? ''));
  $endMooring = trim((string)($operationData['end_mooring'] ?? ''));
  $startDisch = trim((string)($operationData['start_disch'] ?? ''));
  $completedDisch = trim((string)($operationData['completed_disch'] ?? ''));
  $errors = [];

  if ($arrivalJetty !== '' && $startLoading !== '' && strcmp($startLoading, $arrivalJetty) < 0) {
    $errors[] = 'Start Loading harus sama dengan atau setelah Arrival Jetty';
  }
  if ($startLoading !== '' && $completedLoading !== '' && strcmp($completedLoading, $startLoading) < 0) {
    $errors[] = 'Completed Loading harus sama dengan atau setelah Start Loading';
  }
  if ($startLoading === '' && $arrivalJetty !== '' && $completedLoading !== '' && strcmp($completedLoading, $arrivalJetty) < 0) {
    $errors[] = 'Completed Loading harus sama dengan atau setelah Arrival Jetty';
  }
  if ($startMooring !== '' && $endMooring !== '' && strcmp($endMooring, $startMooring) < 0) {
    $errors[] = 'End Mooring harus sama dengan atau setelah Start Mooring';
  }
  if ($startDisch !== '' && $completedDisch !== '' && strcmp($completedDisch, $startDisch) < 0) {
    $errors[] = 'Completed Disch harus sama dengan atau setelah Start Disch';
  }

  return $errors;
}

function detectCsvDelimiter($line) {
  $delimiter = ',';
  $bestCount = 0;
  foreach ([',', ';', "\t"] as $candidate) {
    $count = count(str_getcsv($line, $candidate, '"', '\\'));
    if ($count > $bestCount) {
      $bestCount = $count;
      $delimiter = $candidate;
    }
  }
  return $delimiter;
}

function decodeOperationData($value) {
  if (is_array($value)) return $value;
  $decoded = json_decode((string)$value, true);
  return is_array($decoded) ? $decoded : [];
}

function decodeOperationDataWithVesselDefaults(array $row) {
  $data = decodeOperationData($row['operation_data'] ?? '');
  foreach (['pkk', 'rkbm'] as $field) {
    if (trim((string)($data[$field] ?? '')) !== '') continue;

    $vesselDate = trim((string)($row['vessel_' . $field] ?? ''));
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $vesselDate)) {
      $data[$field] = $vesselDate . ' 00:00';
    }
  }
  return $data;
}

function tableExportRow($row) {
  $data = decodeOperationDataWithVesselDefaults($row);
  $qtyDisc = trim((string)($data['qty_disc'] ?? ''));
  $rc = trim((string)($data['rc'] ?? ''));
  $qtyActual = '';
  if ($qtyDisc !== '' || $rc !== '') {
    $qtyActual = formatOperationNumber(
      (float)str_replace(',', '', $qtyDisc) +
      (float)str_replace(',', '', $rc)
    );
  }

  return [
    $row['no_pk'] ?? '',
    $row['buyer'] ?? '',
    $row['mothervessel'] ?? '',
    $row['jetty_code'] ?? '',
    $row['tugboat'] ?? '',
    $row['barge'] ?? '',
    formatOperationDisplayNumber($data['qty'] ?? ''),
    formatOperationDisplayNumber($qtyDisc),
    formatOperationDisplayNumber($rc),
    formatOperationDisplayNumber($qtyActual),
    $data['pbm_vendor'] ?? '',
    $data['floating_crane'] ?? '',
    formatDisplayDateTime($row['laycan_start'] ?? '', true),
    formatDisplayDateTime($row['laycan_end'] ?? '', true),
    formatDisplayDateTime($data['arrival_jetty'] ?? ''),
    formatDisplayDateTime($data['start_loading'] ?? ''),
    formatDisplayDateTime($data['completed_loading'] ?? ''),
    formatDisplayDateTime($data['lhv'] ?? ''),
    formatDisplayDateTime($data['spog_zona_2'] ?? ''),
    formatDisplayDateTime($data['pkk'] ?? ''),
    formatDisplayDateTime($data['rkbm'] ?? ''),
    formatDisplayDateTime($data['sts_spb'] ?? ''),
    formatDisplayDateTime($data['start_mooring'] ?? ''),
    formatDisplayDateTime($data['end_mooring'] ?? ''),
    $data['mooring_place_1'] ?? '',
    formatDisplayDateTime($data['clear_pass'] ?? ''),
    formatDisplayDateTime($data['start_mooring_clear_pass'] ?? ''),
    formatDisplayDateTime($data['cast_off_mooring_clear_pass'] ?? ''),
    $data['mooring_place_2'] ?? '',
    formatDisplayDateTime($data['ta_barges_actual'] ?? ''),
    formatDisplayDateTime($data['ta_mv'] ?? ''),
    formatDisplayDateTime($data['ta_flf'] ?? ''),
    formatDisplayDateTime($data['cargo_readiness_actual'] ?? ''),
    formatDisplayDateTime($data['start_disch'] ?? ''),
    formatDisplayDateTime($data['completed_disch'] ?? ''),
    $data['discharge_sequence'] ?? '',
    formatDisplayDateTime($data['back_to_jetty'] ?? ''),
    $row['operation_remarks'] ?? '',
    $row['created_by'] ?? '',
    formatDisplayDateTime($row['created_at'] ?? ''),
    formatDisplayDateTime($row['updated_at'] ?? '')
  ];
}

function compareTluExportRows($left, $right) {
  $periodCompare = strcmp(
    (string)$left['earliest_laycan_start'],
    (string)$right['earliest_laycan_start']
  );
  if ($periodCompare !== 0) return $periodCompare;

  $vesselCompare = strcmp(
    (string)$left['no_pk'] . "\0" . (string)$left['mothervessel'],
    (string)$right['no_pk'] . "\0" . (string)$right['mothervessel']
  );
  if ($vesselCompare !== 0) return $vesselCompare;

  $leftData = decodeOperationData($left['operation_data'] ?? '');
  $rightData = decodeOperationData($right['operation_data'] ?? '');
  $leftSequence = trim((string)($leftData['discharge_sequence'] ?? ''));
  $rightSequence = trim((string)($rightData['discharge_sequence'] ?? ''));
  if ($leftSequence === '' && $rightSequence !== '') return 1;
  if ($leftSequence !== '' && $rightSequence === '') return -1;
  if ($leftSequence !== '' && $rightSequence !== '') {
    $sequenceCompare = (int)$leftSequence <=> (int)$rightSequence;
    if ($sequenceCompare !== 0) return $sequenceCompare;
  }

  $bargeSequenceCompare = (int)$left['barge_seq'] <=> (int)$right['barge_seq'];
  return $bargeSequenceCompare !== 0
    ? $bargeSequenceCompare
    : (int)$left['id'] <=> (int)$right['id'];
}

/* ========= GROUPED DATA BARGES CSV EXPORT ========= */
if (($_GET['download'] ?? '') === 'tlu_grouped_export') {
  $scope = trim((string)($_GET['scope'] ?? ''));
  $year = filter_var($_GET['year'] ?? null, FILTER_VALIDATE_INT);
  $month = filter_var($_GET['month'] ?? null, FILTER_VALIDATE_INT);
  $noPk = trim((string)($_GET['no_pk'] ?? ''));

  if (!in_array($scope, ['vessel', 'month', 'year', 'all'], true)) {
    http_response_code(400);
    exit('Pilihan export tidak valid.');
  }
  if (in_array($scope, ['vessel', 'month', 'year'], true) && (!$year || $year < 1900 || $year > 2100)) {
    http_response_code(400);
    exit('Tahun export tidak valid.');
  }
  if (in_array($scope, ['vessel', 'month'], true) && (!$month || $month < 1 || $month > 12)) {
    http_response_code(400);
    exit('Bulan export tidak valid.');
  }
  if ($scope === 'vessel' && $noPk === '') {
    http_response_code(400);
    exit('Mother Vessel wajib dipilih.');
  }

  $sql = "
    SELECT
      s.id, s.no_pk, s.buyer, s.mothervessel, s.jetty_code,
      s.tugboat, s.barge, s.barge_seq, s.laycan_start, s.laycan_end,
      s.created_by, s.created_at, s.updated_at,
      v.pkk AS vessel_pkk, v.rkbm AS vessel_rkbm,
      p.earliest_laycan_start,
      o.operation_data, o.remarks AS operation_remarks
    FROM sibarges s
    INNER JOIN (
      SELECT no_pk, mothervessel, MIN(laycan_start) AS earliest_laycan_start
      FROM sibarges
      WHERE no_pk <> ''
        AND mothervessel <> ''
        AND record_status = 'ACT'
      GROUP BY no_pk, mothervessel
      HAVING MIN(laycan_start) IS NOT NULL
    ) p ON p.no_pk = s.no_pk AND p.mothervessel = s.mothervessel
    INNER JOIN vessel v ON v.no_pk = s.no_pk
    LEFT JOIN barge_operations o ON o.sibarges_id = s.id
    WHERE s.record_status = 'ACT'
  ";

  if ($scope === 'vessel') {
    $sql .= " AND s.no_pk = ? AND YEAR(p.earliest_laycan_start) = ? AND MONTH(p.earliest_laycan_start) = ?";
  } elseif ($scope === 'month') {
    $sql .= " AND YEAR(p.earliest_laycan_start) = ? AND MONTH(p.earliest_laycan_start) = ?";
  } elseif ($scope === 'year') {
    $sql .= " AND YEAR(p.earliest_laycan_start) = ?";
  }

  $stmt = $koneksi->prepare($sql);
  if (!$stmt) {
    http_response_code(500);
    exit($koneksi->error);
  }
  if ($scope === 'vessel') {
    $stmt->bind_param('sii', $noPk, $year, $month);
  } elseif ($scope === 'month') {
    $stmt->bind_param('ii', $year, $month);
  } elseif ($scope === 'year') {
    $stmt->bind_param('i', $year);
  }
  $stmt->execute();
  $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $stmt->close();

  if (!$rows) {
    http_response_code(404);
    exit('Data Barges tidak ditemukan untuk pilihan export ini.');
  }

  usort($rows, 'compareTluExportRows');

  if ($scope === 'vessel') {
    $safeNoPk = preg_replace('/[^A-Za-z0-9._-]+/', '_', $noPk);
    $motherVessel = $rows[0]['mothervessel'] ?? '';
    $safeMotherVessel = trim(preg_replace('/[^A-Za-z0-9 ._-]+/', '_', $motherVessel));
    $filename = "tlu_{$safeNoPk}—{$safeMotherVessel}.csv";
  } elseif ($scope === 'month') {
    $filename = sprintf('tlu_%04d-%02d.csv', $year, $month);
  } elseif ($scope === 'year') {
    $filename = "tlu_{$year}.csv";
  } else {
    $filename = 'tlu_all.csv';
  }

  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="' . $filename . '"');
  echo "\xEF\xBB\xBF";

  $out = fopen('php://output', 'w');
  fputcsv($out, TLU_TABLE_EXPORT_HEADERS, ',', '"', '');
  $previousVessel = null;
  foreach ($rows as $row) {
    $vesselKey = $row['no_pk'] . "\0" . $row['mothervessel'];
    if ($previousVessel !== null && $vesselKey !== $previousVessel) {
      fputcsv($out, [], ',', '"', '');
    }
    fputcsv($out, tableExportRow($row), ',', '"', '');
    $previousVessel = $vesselKey;
  }
  fclose($out);
  exit;
}

/* ========= CSV TEMPLATE DOWNLOAD ========= */
if (($_GET['download'] ?? '') === 'tlu_operation_template') {
  $noPk = trim((string)($_GET['no_pk'] ?? ''));
  if ($noPk === '') {
    http_response_code(400);
    exit('No PK wajib dipilih.');
  }

  $stmt = $koneksi->prepare("
    SELECT
      s.no_pk, s.buyer, s.mothervessel, s.si_barges,
      s.jetty_code, s.tugboat, s.barge, s.laycan_start, s.laycan_end,
      v.pkk AS vessel_pkk, v.rkbm AS vessel_rkbm,
      o.operation_data, o.remarks AS operation_remarks
    FROM sibarges s
    INNER JOIN vessel v ON v.no_pk = s.no_pk
    LEFT JOIN barge_operations o ON o.sibarges_id = s.id
    WHERE s.no_pk = ? AND s.record_status = 'ACT'
    ORDER BY s.barge_seq ASC, s.id ASC
  ");
  if (!$stmt) {
    http_response_code(500);
    exit($koneksi->error);
  }
  $stmt->bind_param('s', $noPk);
  $stmt->execute();
  $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $stmt->close();
  if (!$rows) {
    http_response_code(404);
    exit('Data SI Barges tidak ditemukan untuk vessel ini.');
  }

  $safeNoPk = preg_replace('/[^A-Za-z0-9._-]+/', '_', $noPk);
  $motherVessel = $rows[0]['mothervessel'] ?? '';
  $safeMotherVessel = trim(preg_replace('/[^A-Za-z0-9 ._-]+/', '_', $motherVessel));
  header('Content-Type: text/csv; charset=utf-8');
  header("Content-Disposition: attachment; filename=\"template_tlu_{$safeNoPk}—{$safeMotherVessel}.csv\"");
  echo "\xEF\xBB\xBF";

  $out = fopen('php://output', 'w');
  fputcsv($out, TLU_CSV_COLUMNS, ',', '"', '');
  foreach ($rows as $row) {
    $data = decodeOperationDataWithVesselDefaults($row);
    $qtyDisc = trim((string)($data['qty_disc'] ?? ''));
    $rc = trim((string)($data['rc'] ?? ''));
    $qtyActual = '';
    if ($qtyDisc !== '' || $rc !== '') {
      $qtyActual = formatOperationNumber((float)str_replace(',', '', $qtyDisc) + (float)str_replace(',', '', $rc));
    }

    $csvRow = [
      'si_barges' => $row['si_barges'],
      'no_pk' => $row['no_pk'],
      'buyer' => $row['buyer'],
      'mother_vessel' => $row['mothervessel'],
      'jetty' => $row['jetty_code'],
      'tugboat' => $row['tugboat'],
      'barge' => $row['barge'],
      'qty' => formatOperationDisplayNumber($data['qty'] ?? ''),
      'qty_disc' => formatOperationDisplayNumber($qtyDisc),
      'rc' => formatOperationDisplayNumber($rc),
      'qty_actual' => formatOperationDisplayNumber($qtyActual),
      'pbm_vendor' => $data['pbm_vendor'] ?? '',
      'floating_crane' => $data['floating_crane'] ?? '',
      'laycan_start' => formatDisplayDateTime($row['laycan_start'] ?? '', true),
      'laycan_end' => formatDisplayDateTime($row['laycan_end'] ?? '', true),
      'remarks' => $row['operation_remarks'] ?? ''
    ];
    foreach (TLU_DATETIME_FIELDS as $field => $label) {
      $csvRow[$field] = formatDisplayDateTime($data[$field] ?? '');
    }
    $csvRow['discharge_sequence'] = $data['discharge_sequence'] ?? '';
    $csvRow['mooring_place_1'] = $data['mooring_place_1'] ?? '';
    $csvRow['mooring_place_2'] = $data['mooring_place_2'] ?? '';

    fputcsv($out, array_map(
      fn($column) => $csvRow[$column] ?? '',
      TLU_CSV_COLUMNS
    ), ',', '"', '');
  }
  fclose($out);
  exit;
}

/* ========= AJAX: SAVE TLU OPERATION ========= */
if (($_GET['action'] ?? '') === 'save_operation_data' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $payload = json_decode(file_get_contents('php://input'), true);
  if (!is_array($payload)) jsonOut(['ok' => false, 'msg' => 'Payload tidak valid.']);

  $sibargesId = filter_var($payload['sibarges_id'] ?? null, FILTER_VALIDATE_INT);
  if (!$sibargesId) jsonOut(['ok' => false, 'msg' => 'Data barge tidak valid.']);

  /* Baseline from the existing saved record so a partial save (e.g. from the
     Cycle Time tab, which only submits its own editable columns) doesn't wipe
     out fields owned by the Input tab, and vice versa. */
  $baselineStmt = $koneksi->prepare('SELECT operation_data, remarks FROM barge_operations WHERE sibarges_id = ?');
  if (!$baselineStmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
  $baselineStmt->bind_param('i', $sibargesId);
  $baselineStmt->execute();
  $baselineRow = $baselineStmt->get_result()->fetch_assoc();
  $baselineStmt->close();

  $submittedData = is_array($payload['data'] ?? null) ? $payload['data'] : [];
  $operationRemarks = array_key_exists('operation_remarks', $submittedData)
    ? trim((string)$submittedData['operation_remarks'])
    : (string)($baselineRow['remarks'] ?? '');
  $operationData = decodeOperationData($baselineRow['operation_data'] ?? '');
  foreach (TLU_OPERATION_FIELDS as $field) {
    if (!array_key_exists($field, $submittedData)) continue;
    $value = trim((string)$submittedData[$field]);
    if ($value !== '') {
      $operationData[$field] = $value;
    } else {
      unset($operationData[$field]);
    }
  }

  if (array_key_exists('qty_disc', $submittedData) || array_key_exists('rc', $submittedData)) {
    $qtyDisc = parseOperationNumber($submittedData['qty_disc'] ?? '', 'QTY DISC');
    $rc = parseOperationNumber($submittedData['rc'] ?? '', 'RC');
    if ($qtyDisc === null && $rc === null) {
      unset($operationData['qty_actual']);
    } else {
      $operationData['qty_actual'] = formatOperationNumber(($qtyDisc ?? 0) + ($rc ?? 0));
    }
  }

  foreach (TLU_DATETIME_FIELDS as $field => $label) {
    if (!array_key_exists($field, $submittedData)) continue;
    $normalizedDateTime = normalizeOperationDateTime($submittedData[$field] ?? '', $label);
    if ($normalizedDateTime === '') {
      unset($operationData[$field]);
    } else {
      $operationData[$field] = $normalizedDateTime;
    }
  }

  foreach (TLU_CYCLE_TIME_NUMBER_FIELDS as $field) {
    if (!array_key_exists($field, $submittedData)) continue;
    $value = trim((string)$submittedData[$field]);
    if ($value !== '') parseOperationNumber($value, TLU_CYCLE_TIME_FIELDS[$field]);
  }

  foreach (TLU_CYCLE_TIME_YESNO_FIELDS as $field) {
    if (!array_key_exists($field, $submittedData)) continue;
    $value = trim((string)$submittedData[$field]);
    if ($value !== '' && !in_array($value, ['Yes', 'No'], true)) {
      jsonOut(['ok' => false, 'msg' => TLU_CYCLE_TIME_FIELDS[$field] . ' harus Yes atau No.']);
    }
  }

  foreach (TLU_CYCLE_TIME_TRUEFALSE_FIELDS as $field) {
    if (!array_key_exists($field, $submittedData)) continue;
    $value = trim((string)$submittedData[$field]);
    if ($value !== '' && !in_array($value, ['True', 'False'], true)) {
      jsonOut(['ok' => false, 'msg' => TLU_CYCLE_TIME_FIELDS[$field] . ' harus True atau False.']);
    }
  }

  $timelineErrors = operationTimelineErrors($operationData);
  if ($timelineErrors) {
    jsonOut(['ok' => false, 'msg' => implode('. ', $timelineErrors) . '.']);
  }

  validateFlfChoice($koneksi, 'vendor_flf', $operationData['pbm_vendor'] ?? '', 'PBM Vendor');
  validateFlfChoice($koneksi, 'floating_crane', $operationData['floating_crane'] ?? '', 'Floating Crane');

  $restrictedFloatingCranes = [
    'KTM' => 'STV KTM',
    'MLS' => 'STV MAESTRO'
  ];
  $selectedVendor = $operationData['pbm_vendor'] ?? '';
  if (isset($restrictedFloatingCranes[$selectedVendor])) {
    $operationData['floating_crane'] = $restrictedFloatingCranes[$selectedVendor];
  } elseif (in_array($operationData['floating_crane'] ?? '', array_values($restrictedFloatingCranes), true)) {
    jsonOut([
      'ok' => false,
      'msg' => 'STV KTM hanya untuk vendor KTM dan STV MAESTRO hanya untuk vendor MLS.'
    ]);
  }

  $check = $koneksi->prepare("SELECT id, no_pk FROM sibarges WHERE id = ? AND record_status = 'ACT'");
  if (!$check) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
  $check->bind_param('i', $sibargesId);
  $check->execute();
  $exists = $check->get_result()->fetch_assoc();
  $check->close();
  if (!$exists) jsonOut(['ok' => false, 'msg' => 'Data barge tidak ditemukan.']);

  $sequence = trim((string)($submittedData['discharge_sequence'] ?? ''));
  if ($sequence !== '') {
    $countStmt = $koneksi->prepare("
      SELECT COUNT(*)
      FROM sibarges
      WHERE no_pk = ? AND record_status = 'ACT'
    ");
    if (!$countStmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
    $countStmt->bind_param('s', $exists['no_pk']);
    $countStmt->execute();
    $countStmt->bind_result($maxSequence);
    $countStmt->fetch();
    $countStmt->close();

    if (!ctype_digit($sequence) || (int)$sequence < 1 || (int)$sequence > (int)$maxSequence) {
      jsonOut([
        'ok' => false,
        'msg' => "Discharge Sequence harus antara 1 dan {$maxSequence}."
      ]);
    }
    $operationData['discharge_sequence'] = (string)(int)$sequence;
  }

  $operationJson = json_encode($operationData, JSON_UNESCAPED_UNICODE);
  $createdBy = (string)$_SESSION['username'];
  $stmt = $koneksi->prepare("
    INSERT INTO barge_operations (sibarges_id, operation_data, remarks, created_by)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      operation_data = VALUES(operation_data),
      remarks = VALUES(remarks),
      updated_at = CURRENT_TIMESTAMP
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);

  $stmt->bind_param('isss', $sibargesId, $operationJson, $operationRemarks, $createdBy);
  if (!$stmt->execute()) {
    $message = $stmt->error;
    $stmt->close();
    jsonOut(['ok' => false, 'msg' => $message]);
  }
  $stmt->close();

  $responseData = $operationData;
  $responseData['operation_remarks'] = $operationRemarks;
  jsonOut(['ok' => true, 'data' => $responseData, 'msg' => 'Data operasi berhasil disimpan.']);
}

/* ========= AJAX: IMPORT TLU OPERATION CSV ========= */
if (($_GET['action'] ?? '') === 'import_operation_csv' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $noPk = trim((string)($_POST['no_pk'] ?? ''));
  if ($noPk === '') jsonOut(['ok' => false, 'msg' => 'Pilih Mother Vessel terlebih dahulu.']);
  if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
    jsonOut(['ok' => false, 'msg' => 'File CSV tidak valid atau gagal diunggah.']);
  }

  $fh = fopen($_FILES['csv']['tmp_name'], 'r');
  if (!$fh) jsonOut(['ok' => false, 'msg' => 'File CSV tidak dapat dibaca.']);
  $firstLine = fgets($fh);
  if ($firstLine === false) {
    fclose($fh);
    jsonOut(['ok' => false, 'msg' => 'CSV kosong atau tidak memiliki header.']);
  }

  $delimiter = detectCsvDelimiter($firstLine);
  $header = array_map(function($value) {
    $value = preg_replace('/^\xEF\xBB\xBF/', '', (string)$value);
    return strtolower(trim($value));
  }, str_getcsv($firstLine, $delimiter, '"', '\\'));
  $missing = array_values(array_diff(TLU_CSV_COLUMNS, $header));
  if ($missing) {
    fclose($fh);
    jsonOut(['ok' => false, 'msg' => 'Kolom CSV hilang: ' . implode(', ', $missing)]);
  }
  $idx = array_flip($header);

  $vendorOptions = [];
  $floatingOptions = [];
  $res = $koneksi->query("SELECT DISTINCT vendor_flf FROM flf WHERE vendor_flf <> ''");
  if ($res) $vendorOptions = array_column($res->fetch_all(MYSQLI_ASSOC), 'vendor_flf');
  $res = $koneksi->query("SELECT DISTINCT floating_crane FROM flf WHERE floating_crane <> ''");
  if ($res) $floatingOptions = array_column($res->fetch_all(MYSQLI_ASSOC), 'floating_crane');

  $stmtFind = $koneksi->prepare("
    SELECT id
    FROM sibarges
    WHERE si_barges = ? AND no_pk = ? AND record_status = 'ACT'
    LIMIT 1
  ");
  $stmtSave = $koneksi->prepare("
    INSERT INTO barge_operations (sibarges_id, operation_data, remarks, created_by)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      operation_data = VALUES(operation_data),
      remarks = VALUES(remarks),
      updated_at = CURRENT_TIMESTAMP
  ");
  if (!$stmtFind || !$stmtSave) {
    fclose($fh);
    jsonOut(['ok' => false, 'msg' => 'Prepare import gagal: ' . $koneksi->error]);
  }

  $restrictedFloatingCranes = ['KTM' => 'STV KTM', 'MLS' => 'STV MAESTRO'];
  $countStmt = $koneksi->prepare("
    SELECT COUNT(*)
    FROM sibarges
    WHERE no_pk = ? AND record_status = 'ACT'
  ");
  if (!$countStmt) {
    fclose($fh);
    jsonOut(['ok' => false, 'msg' => 'Gagal menghitung jumlah TB: ' . $koneksi->error]);
  }
  $countStmt->bind_param('s', $noPk);
  $countStmt->execute();
  $countStmt->bind_result($maxDischargeSequence);
  $countStmt->fetch();
  $countStmt->close();

  $createdBy = (string)$_SESSION['username'];
  $updated = 0;
  $errors = 0;
  $errorDetails = [];
  $seenReferences = [];
  $rowNumber = 1;

  while (($row = fgetcsv($fh, 0, $delimiter, '"', '\\')) !== false) {
    $rowNumber++;
    if (!array_filter($row, fn($value) => trim((string)$value) !== '')) continue;

    $value = fn($column) => trim((string)($row[$idx[$column]] ?? ''));
    $siBarges = $value('si_barges');
    $rowErrors = [];

    if ($siBarges === '') {
      $rowErrors[] = 'si_barges kosong';
    } elseif (isset($seenReferences[$siBarges])) {
      $rowErrors[] = 'si_barges duplikat dalam file';
    }
    $seenReferences[$siBarges] = true;

    $stmtFind->bind_param('ss', $siBarges, $noPk);
    $stmtFind->execute();
    $matched = $stmtFind->get_result()->fetch_assoc();
    if (!$matched) $rowErrors[] = 'SI Barges tidak ditemukan pada vessel yang dipilih';

    $operationData = [];
    foreach (TLU_OPERATION_FIELDS as $field) {
      if ($field === 'qty_actual') continue;
      $fieldValue = $value($field);
      if ($fieldValue !== '') $operationData[$field] = $fieldValue;
    }

    $qtyDiscRaw = $value('qty_disc');
    $rcRaw = $value('rc');
    $qtyDiscNormalized = str_replace([',', ' '], ['', ''], $qtyDiscRaw);
    $rcNormalized = str_replace([',', ' '], ['', ''], $rcRaw);
    if ($qtyDiscRaw !== '' && !is_numeric($qtyDiscNormalized)) $rowErrors[] = 'qty_disc harus angka';
    if ($rcRaw !== '' && !is_numeric($rcNormalized)) $rowErrors[] = 'rc harus angka';
    if (!$rowErrors && ($qtyDiscRaw !== '' || $rcRaw !== '')) {
      $operationData['qty_actual'] = formatOperationNumber(
        ($qtyDiscRaw === '' ? 0 : (float)$qtyDiscNormalized) +
        ($rcRaw === '' ? 0 : (float)$rcNormalized)
      );
    }

    foreach (TLU_DATETIME_FIELDS as $field => $label) {
      $fieldValue = $value($field);
      $normalized = parseOperationDateTimeValue($fieldValue);
      if ($normalized === null) {
        $rowErrors[] = "{$field} tidak valid";
        unset($operationData[$field]);
      } elseif ($normalized === '') {
        unset($operationData[$field]);
      } else {
        $operationData[$field] = $normalized;
      }
    }

    $rowErrors = array_merge($rowErrors, operationTimelineErrors($operationData));

    $sequence = $value('discharge_sequence');
    if ($sequence !== '') {
      if (!ctype_digit($sequence) || (int)$sequence < 1 || (int)$sequence > (int)$maxDischargeSequence) {
        $rowErrors[] = "discharge_sequence harus antara 1 dan {$maxDischargeSequence}";
      } else {
        $operationData['discharge_sequence'] = (string)(int)$sequence;
      }
    }

    $vendor = $operationData['pbm_vendor'] ?? '';
    $floating = $operationData['floating_crane'] ?? '';
    if ($vendor !== '' && !in_array($vendor, $vendorOptions, true)) $rowErrors[] = 'pbm_vendor tidak ada di data FLF';
    if ($floating !== '' && !in_array($floating, $floatingOptions, true)) $rowErrors[] = 'floating_crane tidak ada di data FLF';
    if (isset($restrictedFloatingCranes[$vendor])) {
      $operationData['floating_crane'] = $restrictedFloatingCranes[$vendor];
    } elseif (in_array($floating, array_values($restrictedFloatingCranes), true)) {
      $rowErrors[] = 'STV KTM hanya untuk KTM dan STV MAESTRO hanya untuk MLS';
    }

    if ($rowErrors) {
      $errors++;
      if (count($errorDetails) < 10) {
        $errorDetails[] = "Baris {$rowNumber}: " . implode('; ', array_unique($rowErrors));
      }
      continue;
    }

    $sibargesId = (int)$matched['id'];
    $operationJson = json_encode($operationData, JSON_UNESCAPED_UNICODE);
    $remarks = $value('remarks');
    $stmtSave->bind_param('isss', $sibargesId, $operationJson, $remarks, $createdBy);
    if ($stmtSave->execute()) {
      $updated++;
    } else {
      $errors++;
      if (count($errorDetails) < 10) {
        $errorDetails[] = "Baris {$rowNumber}: " . $stmtSave->error;
      }
    }
  }

  fclose($fh);
  $stmtFind->close();
  $stmtSave->close();

  $message = "Import selesai. Updated: {$updated}, Error: {$errors}.";
  if ($errorDetails) $message .= "\n" . implode("\n", $errorDetails);
  jsonOut([
    'ok' => $updated > 0 || $errors === 0,
    'partial' => $errors > 0,
    'updated' => $updated,
    'errors' => $errors,
    'msg' => $message
  ]);
}

/* ========= AJAX: SI BARGES BY MOTHER VESSEL ========= */
if (($_GET['action'] ?? '') === 'si_barges_by_vessel') {
  $no_pk = trim((string)($_GET['no_pk'] ?? ''));
  if ($no_pk === '') jsonOut(['ok' => false, 'msg' => 'No PK wajib dipilih.']);

  $stmt = $koneksi->prepare("
    SELECT
      s.id, s.no_pk, s.no_si_vessel, s.buyer, s.mothervessel,
      s.si_type, s.month_num, s.year_num, s.barge_seq, s.si_barges,
      s.tugboat, s.barge, s.anchorage, s.term, s.qty_plan,
      s.laycan_start, s.laycan_end,
      s.jetty_code, s.jetty_name,
      s.shipper_code, s.shipper_name,
      s.record_status, s.remarks,
      s.created_by, s.created_at, s.updated_at,
      v.pkk AS vessel_pkk,
      v.rkbm AS vessel_rkbm,
      o.id AS operation_id,
      o.arrival_jetty,
      o.commence_loading,
      o.completed_loading,
      o.departure_jetty,
      o.arrival_anchorage,
      o.mooring,
      o.commence_discharging,
      o.completed_discharging,
      o.clear_pass,
      o.qty_ds,
      o.flf,
      o.operation_status,
      o.operation_data,
      o.remarks AS operation_remarks,
      o.created_by AS operation_created_by,
      o.created_at AS operation_created_at,
      o.updated_at AS operation_updated_at
    FROM sibarges s
    INNER JOIN vessel v ON v.no_pk = s.no_pk
    LEFT JOIN barge_operations o ON o.sibarges_id = s.id
    WHERE s.no_pk = ?
      AND s.record_status = 'ACT'
    ORDER BY s.barge_seq ASC, s.id ASC
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);

  $stmt->bind_param('s', $no_pk);
  $stmt->execute();
  $res = $stmt->get_result();
  $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
  $stmt->close();

  foreach ($rows as &$row) {
    $operationData = decodeOperationDataWithVesselDefaults($row);
    $row['operation_data'] = $operationData
      ? json_encode($operationData, JSON_UNESCAPED_UNICODE)
      : null;
  }
  unset($row);

  jsonOut(['ok' => true, 'data' => $rows]);
}

/* Dropdown choices maintained on the FLF page. */
$pbmVendorOptions = [];
$floatingCraneOptions = [];
$res = $koneksi->query("
  SELECT DISTINCT vendor_flf
  FROM flf
  WHERE vendor_flf <> ''
  ORDER BY vendor_flf ASC
");
if ($res) {
  $pbmVendorOptions = array_column($res->fetch_all(MYSQLI_ASSOC), 'vendor_flf');
  $res->free();
}

$res = $koneksi->query("
  SELECT DISTINCT floating_crane
  FROM flf
  WHERE floating_crane <> ''
  ORDER BY floating_crane ASC
");
if ($res) {
  $floatingCraneOptions = array_column($res->fetch_all(MYSQLI_ASSOC), 'floating_crane');
  $res->free();
}

/* Assign each vessel to the period of its earliest active SI Barges Laycan Start. */
$vessels = [];
$res = $koneksi->query("
  SELECT
    no_pk,
    mothervessel,
    MIN(laycan_start) AS earliest_laycan_start,
    YEAR(MIN(laycan_start)) AS laycan_year,
    MONTH(MIN(laycan_start)) AS laycan_month
  FROM sibarges
  WHERE no_pk <> ''
    AND mothervessel <> ''
    AND record_status = 'ACT'
  GROUP BY no_pk, mothervessel
  HAVING earliest_laycan_start IS NOT NULL
  ORDER BY earliest_laycan_start ASC, mothervessel ASC, no_pk ASC
");
if ($res) {
  $vessels = $res->fetch_all(MYSQLI_ASSOC);
  $res->free();
}

/* ========= ALL YEARS / ALL VESSELS TABLE (landing page) ========= */
$allOperationsRows = [];
$res = $koneksi->query("
  SELECT
    s.id, s.no_pk, s.buyer, s.mothervessel, s.jetty_code,
    s.tugboat, s.barge, s.barge_seq, s.laycan_start, s.laycan_end,
    s.created_by, s.created_at, s.updated_at,
    v.pkk AS vessel_pkk, v.rkbm AS vessel_rkbm,
    p.earliest_laycan_start,
    o.operation_data, o.remarks AS operation_remarks
  FROM sibarges s
  INNER JOIN (
    SELECT no_pk, mothervessel, MIN(laycan_start) AS earliest_laycan_start
    FROM sibarges
    WHERE no_pk <> ''
      AND mothervessel <> ''
      AND record_status = 'ACT'
    GROUP BY no_pk, mothervessel
    HAVING MIN(laycan_start) IS NOT NULL
  ) p ON p.no_pk = s.no_pk AND p.mothervessel = s.mothervessel
  INNER JOIN vessel v ON v.no_pk = s.no_pk
  LEFT JOIN barge_operations o ON o.sibarges_id = s.id
  WHERE s.record_status = 'ACT'
");
if ($res) {
  $allOperationsRawRows = $res->fetch_all(MYSQLI_ASSOC);
  $res->free();

  usort($allOperationsRawRows, 'compareTluExportRows');

  $previousVessel = null;
  foreach ($allOperationsRawRows as $row) {
    $vesselKey = $row['no_pk'] . "\0" . $row['mothervessel'];
    if ($previousVessel !== null && $vesselKey !== $previousVessel) {
      $allOperationsRows[] = null;
    }
    $allOperationsRows[] = tableExportRow($row);
    $previousVessel = $vesselKey;
  }
}

/* ========= PAGE META ========= */
$pageTitle = "TLU Operation";

/* ========= LAYOUT ========= */
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<main class="main">
  <div class="content">

    <div class="d-flex align-items-center justify-content-between mb-3">
      <h4 class="m-0">TLU Operation</h4>
      <!-- <div class="small text-muted">
        Source: SI Barges → Actual Operation (timestamps, movement, ds, flf, dll)
      </div> -->
    </div>

    <div class="card" id="tluModeSelector">
      <div class="card-body py-5">
        <h5 class="text-center mb-4">Pilih TLU Operation</h5>
        <div class="d-flex justify-content-center flex-wrap gap-3">
          <button type="button" class="btn btn-primary tlu-mode-button" id="openInputWorkflow">
            Input
          </button>
          <button type="button" class="btn btn-outline-primary tlu-mode-button" id="openCycleTimeWorkflow">
            Cycle Time
          </button>
          <button type="button" class="btn btn-outline-primary tlu-mode-button" id="openExportWorkflow">
            Export CSV
          </button>
        </div>
      </div>
    </div>

    <div class="card mt-3" id="allOperationsCard">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h6 class="m-0">TLU Operation — Semua Tahun &amp; Mother Vessel</h6>
          <div class="small text-muted" id="allOperationsSummary"></div>
        </div>
        <div class="table-responsive data-barges-horizontal-scroll">
          <table class="table table-bordered align-middle mb-0" id="allOperationsTable">
            <thead class="table-light">
              <tr id="allOperationsHeaderRow"></tr>
            </thead>
            <tbody id="allOperationsBody"></tbody>
          </table>
        </div>
        <div class="d-flex align-items-center justify-content-between mt-3">
          <div class="small text-muted" id="allOperationsPageInfo"></div>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary d-none" id="allOperationsPrev">Previous</button>
            <button type="button" class="btn btn-sm btn-outline-secondary d-none" id="allOperationsNext">Next</button>
          </div>
        </div>
      </div>
    </div>

    <div class="d-none" id="tluInputWorkflow">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h5 class="m-0">TLU Operation — Input</h5>
        <button type="button" class="btn btn-sm btn-outline-secondary backToTluMode">
          Kembali
        </button>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3">
              <label for="tlu_year" class="form-label fw-semibold">Pilih Tahun</label>
              <select id="tlu_year" class="form-select">
                <option value="">-- Pilih Tahun --</option>
              </select>
            </div>
            <div class="col-md-3">
              <label for="tlu_month" class="form-label fw-semibold">Pilih Bulan</label>
              <select id="tlu_month" class="form-select" disabled>
                <option value="">-- Pilih Bulan --</option>
              </select>
            </div>
            <div class="col-md-6">
              <label for="no_pk" class="form-label fw-semibold">Pilih Mother Vessel (No PK)</label>
              <select name="no_pk" id="no_pk" class="form-select" disabled>
                <option value="">-- Pilih Mother Vessel --</option>
              </select>
            </div>
          </div>

          <?php if (!$vessels): ?>
            <div class="form-text text-muted">
              Belum ada Mother Vessel dengan Laycan Start pada Data Barges.
            </div>
          <?php endif; ?>
        </div>
      </div>

      <div class="card mt-3 d-none" id="siBargesBox">
        <div class="card-body">
          <div class="d-flex align-items-center gap-2 mb-3">
            <h6 class="m-0">Data Barges</h6>
            <div class="hidden-columns-indicator d-none">
              <span class="badge text-bg-secondary hidden-columns-badge">
                <span class="hidden-columns-count">0</span> columns hidden
              </span>
              <div class="dropdown">
                <button type="button" class="btn btn-sm btn-outline-secondary hidden-columns-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" title="Show hidden columns">+</button>
                <div class="dropdown-menu dropdown-menu-end hidden-columns-menu p-2"></div>
              </div>
            </div>
          </div>

          <div class="border rounded p-3 mb-3">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div>
                <h6 class="mb-1">Import CSV</h6>
                <div class="small text-muted">
                  Download data vessel ini, edit di Excel, lalu import kembali. Jangan mengubah kolom si_barges.
                </div>
              </div>
              <div class="d-flex align-items-center flex-wrap gap-2">
                <a class="btn btn-sm btn-outline-primary" id="downloadOperationCsv" href="#">
                  Download CSV
                </a>
                <form id="importOperationForm" class="d-flex align-items-center flex-nowrap gap-2">
                  <input type="file" class="form-control form-control-sm operation-csv-file" id="operationCsvFile" accept=".csv,text/csv" required>
                  <button type="submit" class="btn btn-sm btn-primary flex-shrink-0" id="importOperationButton">Import CSV</button>
                </form>
              </div>
            </div>
            <div class="alert d-none mt-3 mb-0" id="operationCsvStatus" role="alert"></div>
          </div>

          <div class="alert alert-primary py-2 mb-3" role="note">
            Klik salah satu baris untuk melihat dan mengedit data operasi.
          </div>

          <div class="table-responsive data-barges-horizontal-scroll">
            <table class="table table-bordered align-middle mb-0" id="dataBargesTable">
            <thead class="table-light">
              <tr>
                <th data-label="No.">No.</th>
                <th class="sortable" data-key="no_pk" data-type="text" data-label="No. Reff" data-field="no_pk">No. Reff</th>
                <th class="sortable" data-key="buyer" data-type="text" data-label="Buyer" data-field="buyer">Buyer</th>
                <th class="sortable" data-key="mothervessel" data-type="text" data-label="Mother Vessel" data-field="mothervessel">Mother Vessel</th>
                <th class="sortable" data-key="jetty_code" data-type="text" data-label="Jetty" data-field="jetty_code">Jetty</th>
                <th class="sortable" data-key="tugboat" data-type="text" data-label="Tugboat" data-field="tugboat">Tugboat</th>
                <th class="sortable" data-key="barge" data-type="text" data-label="Barge" data-field="barge">Barge</th>
                <th class="sortable" data-key="qty" data-type="number" data-label="QTY" data-edit-field="qty">QTY</th>
                <th class="sortable" data-key="qty_disc" data-type="number" data-label="QTY DISC" data-edit-field="qty_disc">QTY DISC</th>
                <th class="sortable" data-key="rc" data-type="number" data-label="RC" data-edit-field="rc">RC</th>
                <th class="sortable" data-key="qty_actual" data-type="number" data-label="QTY Actual" data-edit-field="qty_actual" data-calculated="true">QTY Actual</th>
                <th class="sortable" data-key="pbm_vendor" data-type="text" data-label="PBM Vendor" data-edit-field="pbm_vendor" data-input-type="pbm-vendor">PBM Vendor</th>
                <th class="sortable" data-key="floating_crane" data-type="text" data-label="Floating Crane" data-edit-field="floating_crane" data-input-type="floating-crane">Floating Crane</th>
                <th class="sortable" data-key="laycan_start" data-type="date" data-label="Laycan Start" data-field="laycan_start">Laycan Start</th>
                <th class="sortable" data-key="laycan_end" data-type="date" data-label="Laycan End" data-field="laycan_end">Laycan End</th>
                <th class="sortable" data-key="arrival_jetty" data-type="date" data-label="Arrival Jetty" data-edit-field="arrival_jetty" data-input-type="datetime-local">Arrival Jetty</th>
                <th class="sortable" data-key="start_loading" data-type="date" data-label="Start Loading" data-edit-field="start_loading" data-input-type="datetime-local">Start Loading</th>
                <th class="sortable" data-key="completed_loading" data-type="date" data-label="Completed Loading" data-edit-field="completed_loading" data-input-type="datetime-local">Completed Loading</th>
                <th class="sortable" data-key="lhv" data-type="date" data-label="LHV" data-edit-field="lhv" data-input-type="datetime-local">LHV</th>
                <th class="sortable" data-key="spog_zona_2" data-type="date" data-label="SPOG ZONA 2" data-edit-field="spog_zona_2" data-input-type="datetime-local">SPOG ZONA 2</th>
                <th class="sortable" data-key="pkk" data-type="date" data-label="PKK" data-edit-field="pkk" data-input-type="datetime-local">PKK</th>
                <th class="sortable" data-key="rkbm" data-type="date" data-label="RKBM" data-edit-field="rkbm" data-input-type="datetime-local">RKBM</th>
                <th class="sortable" data-key="sts_spb" data-type="date" data-label="STS/SPB" data-edit-field="sts_spb" data-input-type="datetime-local">STS/SPB</th>
                <th class="sortable" data-key="start_mooring" data-type="date" data-label="Start Mooring" data-edit-field="start_mooring" data-input-type="datetime-local">Start Mooring</th>
                <th class="sortable" data-key="end_mooring" data-type="date" data-label="End Mooring" data-edit-field="end_mooring" data-input-type="datetime-local">End Mooring</th>
                <th class="sortable" data-key="mooring_place_1" data-type="text" data-label="Mooring Place 1" data-edit-field="mooring_place_1">Mooring Place 1</th>
                <th class="sortable" data-key="clear_pass" data-type="date" data-label="Clear Pass" data-edit-field="clear_pass" data-input-type="datetime-local">Clear Pass</th>
                <th class="sortable" data-key="start_mooring_clear_pass" data-type="date" data-label="Start Mooring Clear Pass" data-edit-field="start_mooring_clear_pass" data-input-type="datetime-local">Start Mooring Clear Pass</th>
                <th class="sortable" data-key="cast_off_mooring_clear_pass" data-type="date" data-label="Cast Off Mooring Clear Pass" data-edit-field="cast_off_mooring_clear_pass" data-input-type="datetime-local">Cast Off Mooring Clear Pass</th>
                <th class="sortable" data-key="mooring_place_2" data-type="text" data-label="Mooring Place 2" data-edit-field="mooring_place_2">Mooring Place 2</th>
                <th class="sortable" data-key="ta_barges_actual" data-type="date" data-label="TA Barges Actual" data-edit-field="ta_barges_actual" data-input-type="datetime-local">TA Barges Actual</th>
                <th class="sortable" data-key="ta_mv" data-type="date" data-label="TA MV" data-edit-field="ta_mv" data-input-type="datetime-local">TA MV</th>
                <th class="sortable" data-key="ta_flf" data-type="date" data-label="TA FLF" data-edit-field="ta_flf" data-input-type="datetime-local">TA FLF</th>
                <th class="sortable" data-key="cargo_readiness_actual" data-type="date" data-label="Cargo Readiness Actual" data-edit-field="cargo_readiness_actual" data-input-type="datetime-local">Cargo Readiness Actual</th>
                <th class="sortable" data-key="start_disch" data-type="date" data-label="Start Disch" data-edit-field="start_disch" data-input-type="datetime-local">Start Disch</th>
                <th class="sortable" data-key="completed_disch" data-type="date" data-label="Completed Disch" data-edit-field="completed_disch" data-input-type="datetime-local">Completed Disch</th>
                <th class="sortable" data-key="discharge_sequence" data-type="number" data-label="Discharge Sequence" data-edit-field="discharge_sequence" data-input-type="discharge-sequence">Discharge Sequence</th>
                <th class="sortable" data-key="back_to_jetty" data-type="date" data-label="Back to Jetty" data-edit-field="back_to_jetty" data-input-type="datetime-local">Back to Jetty</th>
                <th class="sortable" data-key="operation_remarks" data-type="text" data-label="Remarks" data-edit-field="operation_remarks" data-input-type="textarea">Remarks</th>
                <th class="sortable" data-key="created_by" data-type="text" data-label="Created By" data-field="created_by">Created By</th>
                <th class="sortable" data-key="created_at" data-type="date" data-label="Created At" data-field="created_at">Created At</th>
                <th class="sortable" data-key="updated_at" data-type="date" data-label="Updated At" data-field="updated_at">Updated At</th>
              </tr>
            </thead>
              <tbody id="siBargesBody"></tbody>
            </table>
          </div>
          <div class="d-flex justify-content-end mt-3">
            <button type="button" class="btn btn-sm btn-success" id="exportDataBargesCsv" disabled>
              Export Data Barges CSV
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="d-none" id="tluCycleTimeWorkflow">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h5 class="m-0">TLU Operation — Cycle Time</h5>
        <button type="button" class="btn btn-sm btn-outline-secondary backToTluMode">
          Kembali
        </button>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3">
              <label for="cycle_year" class="form-label fw-semibold">Pilih Tahun</label>
              <select id="cycle_year" class="form-select">
                <option value="">-- Pilih Tahun --</option>
              </select>
            </div>
            <div class="col-md-3">
              <label for="cycle_month" class="form-label fw-semibold">Pilih Bulan</label>
              <select id="cycle_month" class="form-select" disabled>
                <option value="">-- Pilih Bulan --</option>
              </select>
            </div>
            <div class="col-md-6">
              <label for="cycle_no_pk" class="form-label fw-semibold">Pilih Mother Vessel (No PK)</label>
              <select name="cycle_no_pk" id="cycle_no_pk" class="form-select" disabled>
                <option value="">-- Pilih Mother Vessel --</option>
              </select>
            </div>
          </div>

          <?php if (!$vessels): ?>
            <div class="form-text text-muted">
              Belum ada Mother Vessel dengan Laycan Start pada Data Barges.
            </div>
          <?php endif; ?>
        </div>
      </div>

      <div class="card mt-3 d-none" id="cycleTimeBox">
        <div class="card-body">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h6 class="m-0">Data Barges</h6>
            <div class="hidden-columns-indicator d-none">
              <span class="badge text-bg-secondary hidden-columns-badge">
                <span class="hidden-columns-count">0</span> columns hidden
              </span>
              <div class="dropdown">
                <button type="button" class="btn btn-sm btn-outline-secondary hidden-columns-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" title="Show hidden columns">+</button>
                <div class="dropdown-menu dropdown-menu-end hidden-columns-menu p-2"></div>
              </div>
            </div>
          </div>

          <div class="border rounded p-3 mb-3">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div>
                <h6 class="mb-1">Import CSV</h6>
                <div class="small text-muted">
                  Download data vessel ini, edit di Excel, lalu import kembali. Jangan mengubah kolom si_barges.
                </div>
              </div>
              <div class="d-flex align-items-center flex-wrap gap-2">
                <a class="btn btn-sm btn-outline-primary" id="downloadCycleTimeCsv" href="#">
                  Download CSV
                </a>
                <form id="importCycleTimeForm" class="d-flex align-items-center flex-nowrap gap-2">
                  <input type="file" class="form-control form-control-sm operation-csv-file" id="cycleTimeCsvFile" accept=".csv,text/csv" required>
                  <button type="submit" class="btn btn-sm btn-primary flex-shrink-0" id="importCycleTimeButton">Import CSV</button>
                </form>
              </div>
            </div>
            <div class="alert d-none mt-3 mb-0" id="cycleTimeCsvStatus" role="alert"></div>
          </div>

          <div class="alert alert-primary py-2 mb-3" role="note">
            Klik salah satu baris untuk melihat dan mengedit data operasi.
          </div>

          <div class="table-responsive data-barges-horizontal-scroll">
            <table class="table table-bordered align-middle mb-0" id="cycleTimeTable">
            <thead class="table-light">
              <tr>
                <th data-label="No.">No.</th>
                <th class="sortable" data-key="no_pk" data-type="text" data-label="No. Reff" data-field="no_pk">No. Reff</th>
                <th class="sortable" data-key="buyer" data-type="text" data-label="Buyer" data-field="buyer">Buyer</th>
                <th class="sortable" data-key="mothervessel" data-type="text" data-label="Mother Vessel" data-field="mothervessel">Mother Vessel</th>
                <th class="sortable" data-key="jetty_code" data-type="text" data-label="Jetty" data-field="jetty_code">Jetty</th>
                <th class="sortable" data-key="tugboat" data-type="text" data-label="Tugboat" data-field="tugboat">Tugboat</th>
                <th class="sortable" data-key="barge" data-type="text" data-label="Barge" data-field="barge">Barge</th>
                <th class="sortable" data-key="qty" data-type="number" data-label="QTY" data-field="qty">QTY</th>
                <th class="sortable" data-key="qty_disc" data-type="number" data-label="QTY DISC" data-field="qty_disc">QTY DISC</th>
                <th class="sortable" data-key="rc" data-type="number" data-label="RC" data-field="rc">RC</th>
                <th class="sortable" data-key="qty_actual" data-type="number" data-label="QTY Actual" data-field="qty_actual">QTY Actual</th>
                <th class="sortable" data-key="pbm_vendor" data-type="text" data-label="PBM Vendor" data-field="pbm_vendor">PBM Vendor</th>
                <th class="sortable" data-key="floating_crane" data-type="text" data-label="Floating Crane" data-field="floating_crane">Floating Crane</th>
                <th class="sortable cycle-time-editable-col" data-key="waiting_loading_jetty" data-type="number" data-label="Waiting Loading Jetty" data-edit-field="waiting_loading_jetty">Waiting Loading Jetty</th>
                <th class="sortable cycle-time-editable-col" data-key="check_waiting_loading_jetty" data-type="text" data-label="Check Waiting Loading Jetty" data-edit-field="check_waiting_loading_jetty" data-input-type="truefalse">Check Waiting Loading Jetty</th>
                <th class="sortable cycle-time-editable-col" data-key="barges_arrival_early" data-type="number" data-label="Barges Arrival Early" data-edit-field="barges_arrival_early">Barges Arrival Early</th>
                <th class="sortable cycle-time-editable-col" data-key="waiting_plan_loading" data-type="number" data-label="Waiting Plan Loading" data-edit-field="waiting_plan_loading">Waiting Plan Loading</th>
                <th class="sortable cycle-time-editable-col" data-key="loading_time_jetty" data-type="number" data-label="Loading Time Jetty" data-edit-field="loading_time_jetty">Loading Time Jetty</th>
                <th class="sortable" data-key="laycan_start" data-type="date" data-label="Laycan Start" data-field="laycan_start">Laycan Start</th>
                <th class="sortable" data-key="laycan_end" data-type="date" data-label="Laycan End" data-field="laycan_end">Laycan End</th>
                <th class="sortable" data-key="arrival_jetty" data-type="date" data-label="Arrival Jetty" data-field="arrival_jetty">Arrival Jetty</th>
                <th class="sortable" data-key="start_loading" data-type="date" data-label="Start Loading" data-field="start_loading">Start Loading</th>
                <th class="sortable" data-key="completed_loading" data-type="date" data-label="Completed Loading" data-field="completed_loading">Completed Loading</th>
                <th class="sortable cycle-time-editable-col cycle-time-part1-col" data-key="part_1" data-type="number" data-label="Part 1" data-edit-field="part_1">Part 1</th>
                <th class="sortable cycle-time-editable-col cycle-time-part1-col" data-key="check_part_1" data-type="text" data-label="Check Part 1" data-edit-field="check_part_1" data-input-type="truefalse">Check Part 1</th>
                <th class="sortable cycle-time-editable-col cycle-time-part1-col" data-key="lhv_time" data-type="number" data-label="LHV Time" data-edit-field="lhv_time">LHV Time</th>
                <th class="sortable cycle-time-editable-col cycle-time-part1-col" data-key="spog_time" data-type="number" data-label="SPOG Time" data-edit-field="spog_time">SPOG Time</th>
                <th class="sortable cycle-time-editable-col cycle-time-part1-col" data-key="clear_pass_time" data-type="number" data-label="Clear Pass Time" data-edit-field="clear_pass_time">Clear Pass Time</th>
                <th class="sortable" data-key="lhv" data-type="date" data-label="LHV" data-field="lhv">LHV</th>
                <th class="sortable" data-key="spog_zona_2" data-type="date" data-label="SPOG ZONA 2" data-field="spog_zona_2">SPOG ZONA 2</th>
                <th class="sortable" data-key="pkk" data-type="date" data-label="PKK" data-field="pkk">PKK</th>
                <th class="sortable" data-key="rkbm" data-type="date" data-label="RKBM" data-field="rkbm">RKBM</th>
                <th class="sortable" data-key="sts_spb" data-type="date" data-label="STS/SPB" data-field="sts_spb">STS/SPB</th>
                <th class="sortable" data-key="start_mooring" data-type="date" data-label="Start Mooring" data-field="start_mooring">Start Mooring</th>
                <th class="sortable" data-key="end_mooring" data-type="date" data-label="End Mooring" data-field="end_mooring">End Mooring</th>
                <th class="sortable" data-key="mooring_place_1" data-type="text" data-label="Mooring Place 1" data-field="mooring_place_1">Mooring Place 1</th>
                <th class="sortable" data-key="clear_pass" data-type="date" data-label="Clear Pass" data-field="clear_pass">Clear Pass</th>
                <th class="sortable" data-key="start_mooring_clear_pass" data-type="date" data-label="Start Mooring Clear Pass" data-field="start_mooring_clear_pass">Start Mooring Clear Pass</th>
                <th class="sortable" data-key="cast_off_mooring_clear_pass" data-type="date" data-label="Cast Off Mooring Clear Pass" data-field="cast_off_mooring_clear_pass">Cast Off Mooring Clear Pass</th>
                <th class="sortable" data-key="mooring_place_2" data-type="text" data-label="Mooring Place 2" data-field="mooring_place_2">Mooring Place 2</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="part_2" data-type="number" data-label="Part 2" data-edit-field="part_2">Part 2</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="check_part_2" data-type="text" data-label="Check Part 2" data-edit-field="check_part_2" data-input-type="truefalse">Check Part 2</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="mooring_2" data-type="number" data-label="Mooring 2" data-edit-field="mooring_2">Mooring 2</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="sailing_time" data-type="number" data-label="Sailing Time" data-edit-field="sailing_time">Sailing Time</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="total_waiting_disch_mv" data-type="number" data-label="Total Waiting Disch MV" data-edit-field="total_waiting_disch_mv">Total Waiting Disch MV</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="check_total_waiting_disch_mv" data-type="text" data-label="Check Total Waiting Disch MV" data-edit-field="check_total_waiting_disch_mv" data-input-type="yesno">Check Total Waiting Disch MV</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="waiting_cargo_readiness" data-type="number" data-label="Waiting Cargo Readiness (P2)" data-edit-field="waiting_cargo_readiness">Waiting Cargo Readiness (P2)</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="waiting_mv" data-type="number" data-label="Waiting MV (P2)" data-edit-field="waiting_mv">Waiting MV (P2)</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="waiting_flf" data-type="number" data-label="Waiting FLF (P2)" data-edit-field="waiting_flf">Waiting FLF (P2)</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="waiting_queueing" data-type="number" data-label="Waiting Queueing (P2)" data-edit-field="waiting_queueing">Waiting Queueing (P2)</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="waiting_sequence" data-type="number" data-label="Waiting Sequence (P2)" data-edit-field="waiting_sequence">Waiting Sequence (P2)</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="other_factor" data-type="number" data-label="Other Factor (P2)" data-edit-field="other_factor">Other Factor (P2)</th>
                <th class="sortable cycle-time-editable-col cycle-time-part2-col" data-key="back_to_jetty_time" data-type="number" data-label="Back to Jetty Time" data-edit-field="back_to_jetty_time">Back to Jetty Time</th>
                <th class="sortable" data-key="ta_barges_actual" data-type="date" data-label="TA Barges Actual" data-field="ta_barges_actual">TA Barges Actual</th>
                <th class="sortable" data-key="ta_mv" data-type="date" data-label="TA MV" data-field="ta_mv">TA MV</th>
                <th class="sortable" data-key="ta_flf" data-type="date" data-label="TA FLF" data-field="ta_flf">TA FLF</th>
                <th class="sortable" data-key="cargo_readiness_actual" data-type="date" data-label="Cargo Readiness Actual" data-field="cargo_readiness_actual">Cargo Readiness Actual</th>
                <th class="sortable" data-key="start_disch" data-type="date" data-label="Start Disch" data-field="start_disch">Start Disch</th>
                <th class="sortable" data-key="completed_disch" data-type="date" data-label="Completed Disch" data-field="completed_disch">Completed Disch</th>
                <th class="sortable" data-key="discharge_sequence" data-type="number" data-label="Discharge Sequence" data-field="discharge_sequence">Discharge Sequence</th>
                <th class="sortable" data-key="back_to_jetty" data-type="date" data-label="Back to Jetty" data-field="back_to_jetty">Back to Jetty</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="loading_rate" data-type="number" data-label="Loading Rate" data-edit-field="loading_rate">Loading Rate</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="disch_time_loading_rate" data-type="number" data-label="Disch Time for Loading Rate" data-edit-field="disch_time_loading_rate">Disch Time for Loading Rate</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="disch_time_percent" data-type="number" data-label="Disch Time %" data-edit-field="disch_time_percent">Disch Time %</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="cargo_readiness_p3" data-type="number" data-label="Cargo Readiness (P3)" data-edit-field="cargo_readiness_p3">Cargo Readiness (P3)</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="pure_time" data-type="number" data-label="Pure Time" data-edit-field="pure_time">Pure Time</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="waiting_cargo_readiness_p3" data-type="number" data-label="Waiting Cargo Readiness (P3)" data-edit-field="waiting_cargo_readiness_p3">Waiting Cargo Readiness (P3)</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="waiting_mv_p3" data-type="number" data-label="Waiting MV (P3)" data-edit-field="waiting_mv_p3">Waiting MV (P3)</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="waiting_flf_p3" data-type="number" data-label="Waiting FLF (P3)" data-edit-field="waiting_flf_p3">Waiting FLF (P3)</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="waiting_queuing_p3" data-type="number" data-label="Waiting Queuing (P3)" data-edit-field="waiting_queuing_p3">Waiting Queuing (P3)</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="waiting_sequence_p3" data-type="number" data-label="Waiting Sequence (P3)" data-edit-field="waiting_sequence_p3">Waiting Sequence (P3)</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="other_factor_p3" data-type="number" data-label="Other Factor (P3)" data-edit-field="other_factor_p3">Other Factor (P3)</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="check_waiting_time_disch_mv" data-type="text" data-label="Check Waiting Time Disch MV" data-edit-field="check_waiting_time_disch_mv" data-input-type="truefalse">Check Waiting Time Disch MV</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="total_ct_ltc" data-type="number" data-label="Total CT LTC" data-edit-field="total_ct_ltc">Total CT LTC</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="laytime" data-type="number" data-label="Laytime" data-edit-field="laytime">Laytime</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="ltc_rate" data-type="number" data-label="LTC Rate" data-edit-field="ltc_rate">LTC Rate</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="ltc_day" data-type="number" data-label="LTC Day" data-edit-field="ltc_day">LTC Day</th>
                <th class="sortable cycle-time-editable-col cycle-time-loadingrate-col" data-key="ltc_total" data-type="number" data-label="LTC Total" data-edit-field="ltc_total">LTC Total</th>
                <th class="sortable" data-key="operation_remarks" data-type="text" data-label="Remarks" data-field="operation_remarks">Remarks</th>
                <th class="sortable" data-key="created_by" data-type="text" data-label="Created By" data-field="created_by">Created By</th>
                <th class="sortable" data-key="created_at" data-type="date" data-label="Created At" data-field="created_at">Created At</th>
                <th class="sortable" data-key="updated_at" data-type="date" data-label="Updated At" data-field="updated_at">Updated At</th>
              </tr>
            </thead>
              <tbody id="cycleTimeBody"></tbody>
            </table>
          </div>
          <div class="d-flex justify-content-end mt-3">
            <button type="button" class="btn btn-sm btn-success" id="exportCycleTimeCsv" disabled>
              Export Data Barges CSV
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="d-none" id="tluExportWorkflow">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h5 class="m-0">TLU Operation — Export CSV</h5>
        <button type="button" class="btn btn-sm btn-outline-secondary backToTluMode">
          Kembali
        </button>
      </div>
      <div class="card">
        <div class="card-body">
          <h6 class="mb-3">Pilih Cakupan Export</h6>
          <div class="row g-3 mb-4">
            <div class="col-md-6 col-xl-3">
              <label class="export-scope-option h-100">
                <input type="radio" name="tlu_export_scope" value="vessel" checked>
                <span class="fw-semibold">Satu Mother Vessel</span>
                <small class="text-muted">Export seluruh TB dari satu Mother Vessel.</small>
              </label>
            </div>
            <div class="col-md-6 col-xl-3">
              <label class="export-scope-option h-100">
                <input type="radio" name="tlu_export_scope" value="month">
                <span class="fw-semibold">Satu Bulan</span>
                <small class="text-muted">Gabungkan semua Mother Vessel dalam bulan terpilih.</small>
              </label>
            </div>
            <div class="col-md-6 col-xl-3">
              <label class="export-scope-option h-100">
                <input type="radio" name="tlu_export_scope" value="year">
                <span class="fw-semibold">Satu Tahun</span>
                <small class="text-muted">Gabungkan seluruh bulan dan Mother Vessel dalam satu tahun.</small>
              </label>
            </div>
            <div class="col-md-6 col-xl-3">
              <label class="export-scope-option h-100">
                <input type="radio" name="tlu_export_scope" value="all">
                <span class="fw-semibold">Semua Tahun</span>
                <small class="text-muted">Gabungkan seluruh data Mother Vessel dalam satu CSV.</small>
              </label>
            </div>
          </div>

          <div class="row g-3 align-items-end">
            <div class="col-md-3" id="exportYearGroup">
              <label for="export_year" class="form-label fw-semibold">Tahun</label>
              <select id="export_year" class="form-select">
                <option value="">-- Pilih Tahun --</option>
              </select>
            </div>
            <div class="col-md-3" id="exportMonthGroup">
              <label for="export_month" class="form-label fw-semibold">Bulan</label>
              <select id="export_month" class="form-select" disabled>
                <option value="">-- Pilih Bulan --</option>
              </select>
            </div>
            <div class="col-md-4" id="exportVesselGroup">
              <label for="export_no_pk" class="form-label fw-semibold">Mother Vessel (No PK)</label>
              <select id="export_no_pk" class="form-select" disabled>
                <option value="">-- Pilih Mother Vessel --</option>
              </select>
            </div>
            <div class="col-md-2">
              <button type="button" class="btn btn-success w-100" id="downloadGroupedExport">
                Export CSV
              </button>
            </div>
          </div>
          <div class="form-text mt-3">
            Data setiap Mother Vessel diurutkan berdasarkan Discharge Sequence. Satu baris kosong memisahkan Mother Vessel pada export gabungan.
          </div>
          <div class="alert alert-danger d-none mt-3 mb-0" id="groupedExportStatus"></div>
        </div>
      </div>
    </div>

  </div>
</main>

<div class="modal fade" id="siBargesDetailModal" tabindex="-1" aria-labelledby="siBargesDetailTitle" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h5 class="modal-title" id="siBargesDetailTitle">Detail Barges</h5>
          <div class="small text-muted" id="siBargesDetailSubtitle"></div>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body" style="max-height:70vh; overflow-y:auto;">
        <div id="siBargesDetailBody"></div>
      </div>
      <div class="modal-footer">
        <div class="me-auto small" id="siBargesSaveStatus"></div>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" id="siBargesSaveButton">Save</button>
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="cycleTimeDetailModal" tabindex="-1" aria-labelledby="cycleTimeDetailTitle" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h5 class="modal-title" id="cycleTimeDetailTitle">Detail Barges</h5>
          <div class="small text-muted" id="cycleTimeDetailSubtitle"></div>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body" style="max-height:70vh; overflow-y:auto;">
        <div id="cycleTimeDetailBody"></div>
      </div>
      <div class="modal-footer">
        <div class="me-auto small" id="cycleTimeSaveStatus"></div>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" id="cycleTimeSaveButton">Save</button>
      </div>
    </div>
  </div>
</div>

<style>
  /* Keep wide Data Barges columns from widening the whole page/topbar. */
  body {
    overflow-x: hidden;
  }

  .topbar {
    width: 100%;
    max-width: 100vw;
  }

  .main {
    flex: 1 1 auto;
    width: 0;
    min-width: 0;
    max-width: 100%;
  }

  .main > .content {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  #siBargesBox,
  #siBargesBox .card-body {
    min-width: 0;
    max-width: 100%;
  }

  .operation-csv-file {
    width: min(350px, 45vw);
    min-width: 220px;
  }

  .tlu-mode-button {
    min-width: 180px;
    padding: 14px 28px;
    font-size: 1.05rem;
  }

  .export-scope-option {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    cursor: pointer;
  }

  .export-scope-option:has(input:checked) {
    border-color: var(--bs-primary);
    background: rgba(var(--bs-primary-rgb), 0.06);
  }

  .export-scope-option input {
    align-self: flex-start;
  }

  .data-barges-horizontal-scroll {
    width: 100%;
    max-width: 100%;
    max-height: 65vh;
    overflow-x: auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  #dataBargesTable,
  #cycleTimeTable {
    width: max-content;
    min-width: 1900px;
    font-size: 15px;
  }

  #dataBargesTable th,
  #dataBargesTable td,
  #cycleTimeTable th,
  #cycleTimeTable td {
    min-width: 70px;
    padding: 12px 14px;
    white-space: nowrap;
  }

  #dataBargesTable thead th,
  #cycleTimeTable thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: var(--bs-table-bg, #f8f9fa);
    text-align: left;
    vertical-align: middle;
  }

  /* Cycle Time module: editable columns between Floating Crane and Laycan Start get a distinct header color. */
  #cycleTimeTable thead th.cycle-time-editable-col {
    background-color: #fff3cd;
  }

  /* Distinct light header colors for each editable column group, different from each other and from the default (#fff3cd). */
  #cycleTimeTable thead th.cycle-time-editable-col.cycle-time-part1-col {
    background-color: #d0ebff;
  }
  #cycleTimeTable thead th.cycle-time-editable-col.cycle-time-part2-col {
    background-color: #d3f9d8;
  }
  #cycleTimeTable thead th.cycle-time-editable-col.cycle-time-loadingrate-col {
    background-color: #e5d4f5;
  }

  #dataBargesTable th.sortable, #cycleTimeTable th.sortable { white-space: nowrap; }
  #dataBargesTable .th-sort-wrap, #cycleTimeTable .th-sort-wrap { display:flex; align-items:center; justify-content:space-between; gap:4px; }
  #dataBargesTable .sort-toggle, #cycleTimeTable .sort-toggle { text-decoration:none; line-height:1; opacity:.6; border:none; background:transparent; }
  #dataBargesTable th.sortable.sort-active .sort-toggle, #cycleTimeTable th.sortable.sort-active .sort-toggle { opacity:1; font-weight:bold; }
  #cycleTimeTable .formula-info-btn { text-decoration:none; line-height:1; opacity:.6; border:none; background:transparent; padding:0; font-size:.95rem; }
  #cycleTimeTable .formula-info-btn:hover, #cycleTimeTable .formula-info-btn:focus { opacity:1; }
  .wlj-formula-popover { max-width: 320px; }
  .wlj-formula-popover .popover-header { font-weight: 600; }
  .wlj-formula-rules { display:flex; flex-direction:column; gap:.4rem; font-size:.82rem; }
  .wlj-formula-rule { padding-bottom:.35rem; border-bottom:1px dashed #dee2e6; }
  .wlj-formula-rule:last-child { border-bottom:none; padding-bottom:0; }
  #dataBargesTable .filter-menu, #cycleTimeTable .filter-menu { min-width: 260px; max-height: 80vh; overflow-y: auto; white-space: normal; z-index: 2000; }
  #dataBargesTable .filter-menu .dropdown-header-label, #cycleTimeTable .filter-menu .dropdown-header-label { font-weight:bold; font-size:.9rem; color:#212529; padding: .35rem 1rem .15rem; margin:0; }
  #dataBargesTable .filter-menu .sort-option, #cycleTimeTable .filter-menu .sort-option { font-size:.8rem; }
  #dataBargesTable .filter-menu .sort-option.active-sort, #cycleTimeTable .filter-menu .sort-option.active-sort { font-weight:bold; background-color:#e7f1ff; border-color:#0d6efd; color:#0d6efd; }
  #dataBargesTable .filter-values-list, #cycleTimeTable .filter-values-list { max-height: 160px; overflow-y: auto; }
  #dataBargesTable .filter-value-item label, #cycleTimeTable .filter-value-item label { cursor:pointer; }
  #dataBargesTable th.sortable.filter-active .sort-toggle, #cycleTimeTable th.sortable.filter-active .sort-toggle { opacity:1; font-weight:bold; }
  #dataBargesTable .freeze-toggle.active, #cycleTimeTable .freeze-toggle.active { background-color:#0d6efd; border-color:#0d6efd; color:#fff; }
  #dataBargesTable th.frozen-col, #dataBargesTable td.frozen-col,
  #cycleTimeTable th.frozen-col, #cycleTimeTable td.frozen-col { position: sticky; z-index: 2; background-color: #fff; }
  #dataBargesTable thead th.frozen-col, #cycleTimeTable thead th.frozen-col { background-color: var(--bs-table-bg, #f8f9fa); z-index: 3; }
  #dataBargesTable th.frozen-col-last, #dataBargesTable td.frozen-col-last,
  #cycleTimeTable th.frozen-col-last, #cycleTimeTable td.frozen-col-last { box-shadow: 2px 0 4px -2px rgba(0,0,0,.35); }

  #dataBargesTable th.sortable, #cycleTimeTable th.sortable { cursor: grab; }
  #dataBargesTable th.col-selecting, #dataBargesTable td.col-selecting,
  #cycleTimeTable th.col-selecting, #cycleTimeTable td.col-selecting { background-color: rgba(13,110,253,.18) !important; }

  .hidden-columns-indicator:not(.d-none) { display: flex; align-items: center; gap: 6px; }
  .hidden-columns-badge { font-weight: 500; }
  .hidden-columns-toggle { line-height: 1; padding: .1rem .5rem; font-weight: bold; }
  .hidden-columns-menu { min-width: 220px; max-height: 60vh; overflow-y: auto; }
  .hidden-columns-menu .hidden-column-item label { cursor: pointer; }
  .hidden-columns-menu .hidden-columns-unhide-all { margin-top: .25rem; }

  .hide-column-popup {
    position: fixed;
    z-index: 3000;
    background: #212529;
    color: #fff;
    border-radius: 6px;
    padding: 8px 10px;
    box-shadow: 0 6px 16px rgba(0,0,0,.3);
    font-size: .85rem;
    max-width: 220px;
  }
  .hide-column-popup-text { margin-bottom: 6px; white-space: normal; }
  .hide-column-popup .hide-column-popup-btn { width: 100%; }

  #allOperationsTable {
    width: max-content;
    min-width: 100%;
    font-size: 15px;
  }

  #allOperationsTable th,
  #allOperationsTable td {
    min-width: 70px;
    padding: 12px 14px;
    white-space: nowrap;
  }

  #allOperationsTable thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: var(--bs-table-bg, #f8f9fa);
    text-align: left;
    vertical-align: middle;
  }

  #allOperationsTable tr.all-operations-separator td {
    padding: 0;
    height: 25px;
    border-left: 0;
    border-right: 0;
    background-color: #f1f3f5;
  }

  #siBargesBody tr[data-row-id],
  #cycleTimeBody tr[data-row-id] {
    cursor: pointer;
  }

  #siBargesBody tr[data-row-id]:hover > td,
  #cycleTimeBody tr[data-row-id]:hover > td {
    background-color: #eaf2f8;
  }

  .si-detail-row {
    display: grid;
    grid-template-columns: minmax(140px, 32%) 1fr;
    gap: 16px;
    padding: 10px 4px;
    border-bottom: 1px solid #dee2e6;
  }

  .si-detail-row:last-child {
    border-bottom: 0;
  }

  .si-detail-value {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
</style>

<script>
const tluModeSelector = document.getElementById('tluModeSelector');
const allOperationsCard = document.getElementById('allOperationsCard');
const tluInputWorkflow = document.getElementById('tluInputWorkflow');
const tluExportWorkflow = document.getElementById('tluExportWorkflow');
const openInputWorkflow = document.getElementById('openInputWorkflow');
const openExportWorkflow = document.getElementById('openExportWorkflow');
const tluCycleTimeWorkflow = document.getElementById('tluCycleTimeWorkflow');
const openCycleTimeWorkflow = document.getElementById('openCycleTimeWorkflow');
const exportScopeInputs = [...document.querySelectorAll('input[name="tlu_export_scope"]')];
const exportYearGroup = document.getElementById('exportYearGroup');
const exportMonthGroup = document.getElementById('exportMonthGroup');
const exportVesselGroup = document.getElementById('exportVesselGroup');
const exportYearSelect = document.getElementById('export_year');
const exportMonthSelect = document.getElementById('export_month');
const exportNoPkSelect = document.getElementById('export_no_pk');
const downloadGroupedExport = document.getElementById('downloadGroupedExport');
const groupedExportStatus = document.getElementById('groupedExportStatus');
const pbmVendorOptions = <?= json_encode($pbmVendorOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const floatingCraneOptions = <?= json_encode($floatingCraneOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const tluVesselPeriods = <?= json_encode($vessels, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const allOperationsHeaders = <?= json_encode(TLU_TABLE_EXPORT_HEADERS, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const allOperationsData = <?= json_encode($allOperationsRows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const ALL_OPERATIONS_PAGE_SIZE = 100;
let allOperationsCurrentPage = 1;
const restrictedFloatingCranes = {
  KTM: 'STV KTM',
  MLS: 'STV MAESTRO'
};
const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function replaceSelectOptions(select, placeholder, options) {
  select.innerHTML = '';
  select.appendChild(new Option(placeholder, ''));
  options.forEach(option => {
    select.appendChild(new Option(option.label, option.value));
  });
}

const availableYears = [...new Set(
  tluVesselPeriods.map(vessel => String(vessel.laycan_year))
)].sort((left, right) => Number(right) - Number(left));
replaceSelectOptions(
  exportYearSelect,
  '-- Pilih Tahun --',
  availableYears.map(year => ({ value: year, label: year }))
);

function selectedExportScope() {
  return exportScopeInputs.find(input => input.checked)?.value || 'vessel';
}

function updateGroupedExportStatus(message = '') {
  groupedExportStatus.textContent = message;
  groupedExportStatus.classList.toggle('d-none', message === '');
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
    tluVesselPeriods
      .filter(vessel => String(vessel.laycan_year) === selectedYear)
      .map(vessel => Number(vessel.laycan_month))
  )].sort((left, right) => left - right);

  replaceSelectOptions(
    exportMonthSelect,
    '-- Pilih Bulan --',
    months.map(month => ({
      value: String(month),
      label: monthNames[month - 1]
    }))
  );
  exportMonthSelect.disabled = !selectedYear;
  replaceSelectOptions(exportNoPkSelect, '-- Pilih Mother Vessel --', []);
  exportNoPkSelect.disabled = true;
}

function updateExportVessels() {
  const selectedYear = exportYearSelect.value;
  const selectedMonth = exportMonthSelect.value;
  const vessels = tluVesselPeriods.filter(vessel =>
    String(vessel.laycan_year) === selectedYear &&
    String(vessel.laycan_month) === selectedMonth
  );

  replaceSelectOptions(
    exportNoPkSelect,
    '-- Pilih Mother Vessel --',
    vessels.map(vessel => ({
      value: vessel.no_pk,
      label: `${vessel.no_pk} — ${vessel.mothervessel}`
    }))
  );
  exportNoPkSelect.disabled = !selectedMonth;
}

function showTluWorkflow(workflow) {
  tluModeSelector.classList.add('d-none');
  allOperationsCard.classList.add('d-none');
  tluInputWorkflow.classList.toggle('d-none', workflow !== 'input');
  tluCycleTimeWorkflow.classList.toggle('d-none', workflow !== 'cycletime');
  tluExportWorkflow.classList.toggle('d-none', workflow !== 'export');
}

openInputWorkflow.addEventListener('click', () => showTluWorkflow('input'));
openCycleTimeWorkflow.addEventListener('click', () => showTluWorkflow('cycletime'));
openExportWorkflow.addEventListener('click', () => {
  updateExportScopeFields();
  showTluWorkflow('export');
});
document.querySelectorAll('.backToTluMode').forEach(button => {
  button.addEventListener('click', () => {
    tluInputWorkflow.classList.add('d-none');
    tluCycleTimeWorkflow.classList.add('d-none');
    tluExportWorkflow.classList.add('d-none');
    tluModeSelector.classList.remove('d-none');
    allOperationsCard.classList.remove('d-none');
  });
});

exportScopeInputs.forEach(input => {
  input.addEventListener('change', updateExportScopeFields);
});
exportYearSelect.addEventListener('change', () => {
  updateExportMonths();
  updateGroupedExportStatus();
});
exportMonthSelect.addEventListener('change', () => {
  updateExportVessels();
  updateGroupedExportStatus();
});
exportNoPkSelect.addEventListener('change', () => updateGroupedExportStatus());

downloadGroupedExport.addEventListener('click', () => {
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

  const params = new URLSearchParams({
    download: 'tlu_grouped_export',
    scope
  });
  if (scope !== 'all') params.set('year', year);
  if (['vessel', 'month'].includes(scope)) params.set('month', month);
  if (scope === 'vessel') params.set('no_pk', noPk);

  window.location.href = `7tluoperation.php?${params.toString()}`;
});

const siBargesDetailFields = [
  ['No. Reff', 'no_pk'],
  ['Buyer', 'buyer'],
  ['Mother Vessel', 'mothervessel'],
  ['Jetty', 'jetty_code'],
  ['Tugboat', 'tugboat'],
  ['Barge', 'barge'],
  ['QTY', null],
  ['QTY DISC', null],
  ['RC', null],
  ['QTY ACTUAL', null],
  ['PBM Vendor', null],
  ['Floating Crane', null],
  ['Month', 'month_num'],
  ['Year', 'year_num'],
  ['Barge Sequence', 'barge_seq'],
  ['Laycan Start', 'laycan_start'],
  ['Laycan End', 'laycan_end'],
  ['Arrival Jetty', null],
  ['Start Loading', null],
  ['Completed Loading', null],
  ['LHV', null],
  ['SPOG ZONA 2', null],
  ['PKK', null],
  ['RKBM', null],
  ['STS/SPB', null],
  ['Start Mooring', null],
  ['End Mooring', null],
  ['Mooring Place 1', null],
  ['Clear Pass', null],
  ['Start Mooring Clear Pass', null],
  ['Cast Off Mooring Clear Pass', null],
  ['Mooring Place 2', null],
  ['TA Barges Actual', null],
  ['TA MV', null],
  ['TA FLF', null],
  ['Cargo Readiness Actual', null],
  ['Start Disch', null],
  ['Completed Disch', null],
  ['Discharge Sequence', null],
  ['Back to Jetty', null],
  ['Jetty Name', 'jetty_name'],
  ['CARGO', 'shipper_code'],
  ['Shipper Name', 'shipper_name'],
  ['Status', 'record_status'],
  ['Remarks', 'remarks'],
  ['Created By', 'created_by'],
  ['Created At', 'created_at'],
  ['Updated At', 'updated_at'],
  ['Operation ID', 'operation_id'],
  ['Arrival Jetty', 'arrival_jetty'],
  ['Commence Loading', 'commence_loading'],
  ['Completed Loading', 'completed_loading'],
  ['Departure Jetty', 'departure_jetty'],
  ['Arrival Anchorage', 'arrival_anchorage'],
  ['Mooring', 'mooring'],
  ['Commence Discharging', 'commence_discharging'],
  ['Completed Discharging', 'completed_discharging'],
  ['Clear Pass', 'clear_pass'],
  ['Qty DS', 'qty_ds'],
  ['FLF', 'flf'],
  ['Operation Status', 'operation_status'],
  ['Operation Remarks', 'operation_remarks'],
  ['Operation Created By', 'operation_created_by'],
  ['Operation Created At', 'operation_created_at'],
  ['Operation Updated At', 'operation_updated_at']
];

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function displayValue(value) {
  const text = String(value ?? '').trim();
  return text === '' ? '-' : esc(text);
}

/* ===== All Years / All Vessels table (landing page, client-side paginated) ===== */
const allOperationsHeaderRow = document.getElementById('allOperationsHeaderRow');
const allOperationsBody = document.getElementById('allOperationsBody');
const allOperationsSummary = document.getElementById('allOperationsSummary');
const allOperationsPageInfo = document.getElementById('allOperationsPageInfo');
const allOperationsPrev = document.getElementById('allOperationsPrev');
const allOperationsNext = document.getElementById('allOperationsNext');

allOperationsHeaderRow.innerHTML = allOperationsHeaders.map(label => `<th>${esc(label)}</th>`).join('');

function renderAllOperationsPage(page) {
  const totalRows = allOperationsData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / ALL_OPERATIONS_PAGE_SIZE));
  allOperationsCurrentPage = Math.min(Math.max(page, 1), totalPages);

  const start = (allOperationsCurrentPage - 1) * ALL_OPERATIONS_PAGE_SIZE;
  const pageRows = allOperationsData.slice(start, start + ALL_OPERATIONS_PAGE_SIZE);

  allOperationsBody.innerHTML = pageRows.length
    ? pageRows.map(row => row === null
        ? `<tr class="all-operations-separator"><td colspan="${allOperationsHeaders.length}"></td></tr>`
        : `<tr>${row.map(value => `<td>${displayValue(value)}</td>`).join('')}</tr>`
      ).join('')
    : `<tr><td colspan="${allOperationsHeaders.length}" class="text-center text-muted py-3">Data tidak ditemukan.</td></tr>`;

  allOperationsSummary.textContent = totalRows ? `${totalRows} baris` : '';
  allOperationsPageInfo.textContent = totalRows
    ? `Halaman ${allOperationsCurrentPage} dari ${totalPages} (baris ${start + 1}-${Math.min(start + ALL_OPERATIONS_PAGE_SIZE, totalRows)} dari ${totalRows})`
    : '';

  allOperationsPrev.classList.toggle('d-none', allOperationsCurrentPage <= 1);
  allOperationsNext.classList.toggle('d-none', allOperationsCurrentPage >= totalPages);
}

allOperationsPrev.addEventListener('click', () => renderAllOperationsPage(allOperationsCurrentPage - 1));
allOperationsNext.addEventListener('click', () => renderAllOperationsPage(allOperationsCurrentPage + 1));

renderAllOperationsPage(1);

const formattedNumberFields = new Set([
  'qty', 'qty_disc', 'rc', 'qty_actual',
  'waiting_loading_jetty', 'barges_arrival_early', 'waiting_plan_loading',
  'loading_time_jetty', 'part_1', 'lhv_time', 'spog_time', 'clear_pass_time',
  'part_2', 'mooring_2', 'sailing_time', 'total_waiting_disch_mv',
  'waiting_cargo_readiness', 'waiting_mv', 'waiting_flf', 'waiting_queueing',
  'waiting_sequence', 'other_factor', 'back_to_jetty_time',
  'loading_rate', 'disch_time_loading_rate', 'disch_time_percent',
  'cargo_readiness_p3', 'pure_time', 'waiting_cargo_readiness_p3',
  'waiting_mv_p3', 'waiting_flf_p3', 'waiting_queuing_p3',
  'waiting_sequence_p3', 'other_factor_p3',
  'total_ct_ltc', 'laytime', 'ltc_rate', 'ltc_day', 'ltc_total'
]);
const operationDateTimeFields = new Set(<?= json_encode(array_keys(TLU_DATETIME_FIELDS), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>);

// Cycle time columns are always stored/calculated with full raw precision; only their
// table display is rounded to 4 decimals. Addition, subtraction and comparisons between
// these fields must keep using the raw (unrounded) numbers to avoid digit mismatches.
const CYCLE_TIME_4DP_NUMBER_FIELDS = new Set([
  'waiting_loading_jetty', 'barges_arrival_early', 'waiting_plan_loading', 'loading_time_jetty',
  'part_1', 'lhv_time', 'spog_time', 'clear_pass_time'
]);

function formatDisplayNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const normalized = text.replaceAll(',', '').replaceAll(' ', '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return text;

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6
  }).format(Number(normalized));
}

function formatCycleTimeNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const normalized = text.replaceAll(',', '').replaceAll(' ', '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return text;

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4
  }).format(Number(normalized));
}

/* ===== display format dd/Mon/yy [HH:MM] (matches Operation/6sibarges.php convention) ===== */
const DDMONYY_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDDMonYY(val, withTime = false) {
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

/* ===== parse dd/Mon/yy [HH:MM] back to YYYY-MM-DDTHH:MM (for datetime-local inputs) ===== */
function parseDDMonYYToISO(text) {
  const s = String(text ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!m) return '';
  const monIdx = DDMONYY_MONTHS.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
  if (monIdx < 0) return '';
  const dd = m[1].padStart(2, '0');
  const mm = String(monIdx + 1).padStart(2, '0');
  const yyyy = 2000 + parseInt(m[3], 10);
  const hh = m[4] || '00';
  const mi = m[5] || '00';
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/* Laycan Start/End are date-only in the DB; always show them with a 00:00 time. */
function fmtLaycanDateTime(value) {
  const datePart = fmtDDMonYY(value, false);
  if (datePart === '') return '';
  const m = String(value ?? '').trim().match(/(\d{2}):(\d{2})/);
  return `${datePart} ${m ? `${m[1]}:${m[2]}` : '00:00'}`;
}

function displayLaycanDateTime(value) {
  const formatted = fmtLaycanDateTime(value);
  return formatted === '' ? '-' : esc(formatted);
}

function formatOperationDateTimeDisplay(value) {
  return fmtDDMonYY(value, true);
}

function displayDateTime(value) {
  const formatted = fmtDDMonYY(value, true);
  return formatted === '' ? '-' : esc(formatted);
}

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

function operationCell(operationData, field) {
  const value = CYCLE_TIME_4DP_NUMBER_FIELDS.has(field)
    ? formatCycleTimeNumber(operationData[field])
    : formattedNumberFields.has(field)
    ? formatDisplayNumber(operationData[field])
    : operationDateTimeFields.has(field)
    ? formatOperationDateTimeDisplay(operationData[field])
    : operationData[field];

  return `<td>${displayValue(value)}</td>`;
}

function parseOperationNumber(value) {
  const normalized = String(value ?? '').replaceAll(',', '').trim();
  if (normalized === '') return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function calculateQtyActual(data) {
  const qtyDisc = parseOperationNumber(data.qty_disc);
  const rc = parseOperationNumber(data.rc);
  if (qtyDisc === null && rc === null) return '';

  return formatDisplayNumber((qtyDisc ?? 0) + (rc ?? 0));
}

// Default for Waiting Loading Jetty: 0 if Laycan Start is empty, else (Start Loading - Arrival Jetty) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
function calculateWaitingLoadingJetty(laycanStart, data) {
  if (!String(laycanStart ?? '').trim()) return 0;

  const startLoading = Date.parse(String(data.start_loading ?? '').trim().replace(' ', 'T'));
  const arrivalJetty = Date.parse(String(data.arrival_jetty ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(startLoading) || !Number.isFinite(arrivalJetty)) return '';

  return (startLoading - arrivalJetty) / 86400000;
}

// Default for Barges Arrival Early: conditional formula comparing Arrival Jetty against Laycan Start/End.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
function calculateBargesArrivalEarly(row, data) {
  const laycanStartRaw = String(row.laycan_start ?? '').trim();
  if (!laycanStartRaw) return 0;

  const laycanStart = Date.parse(laycanStartRaw.replace(' ', 'T'));
  const laycanEnd = Date.parse(String(row.laycan_end ?? '').trim().replace(' ', 'T'));
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
function calculateWaitingPlanLoading(bargesArrivalEarly, waitingLoadingJetty) {
  if (bargesArrivalEarly === null || waitingLoadingJetty === null) return '';

  const diff = waitingLoadingJetty - bargesArrivalEarly;
  return diff < 0 ? 0 : diff;
}

// Default for Check Waiting Loading Jetty: True if Waiting Loading Jetty equals Barges Arrival Early + Waiting Plan Loading.
// Compares raw (unrounded) numbers with a tiny epsilon for floating-point safety, not the rounded display values.
function calculateCheckWaitingLoadingJetty(waitingLoadingJetty, bargesArrivalEarly, waitingPlanLoading) {
  if (waitingLoadingJetty === null || bargesArrivalEarly === null || waitingPlanLoading === null) return '';

  const sum = bargesArrivalEarly + waitingPlanLoading;
  return Math.abs(waitingLoadingJetty - sum) < 1e-9 ? 'True' : 'False';
}

// Default for Loading Time Jetty: 0 if Completed Loading is empty, else (Completed Loading - Start Loading) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
function calculateLoadingTimeJetty(data) {
  const completedLoadingRaw = String(data.completed_loading ?? '').trim();
  if (!completedLoadingRaw) return 0;

  const completedLoading = Date.parse(completedLoadingRaw.replace(' ', 'T'));
  const startLoading = Date.parse(String(data.start_loading ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(completedLoading) || !Number.isFinite(startLoading)) return '';

  return (completedLoading - startLoading) / 86400000;
}

// Default for Part 1: 0 if Clear Pass is empty, else (Clear Pass - Completed Loading) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
function calculatePart1(data) {
  const clearPassRaw = String(data.clear_pass ?? '').trim();
  if (!clearPassRaw) return 0;

  const clearPass = Date.parse(clearPassRaw.replace(' ', 'T'));
  const completedLoading = Date.parse(String(data.completed_loading ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(clearPass) || !Number.isFinite(completedLoading)) return '';

  return (clearPass - completedLoading) / 86400000;
}

// Default for LHV Time: 0 if LHV is empty, else (LHV - Completed Loading) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
function calculateLhvTime(data) {
  const lhvRaw = String(data.lhv ?? '').trim();
  if (!lhvRaw) return 0;

  const lhv = Date.parse(lhvRaw.replace(' ', 'T'));
  const completedLoading = Date.parse(String(data.completed_loading ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(lhv) || !Number.isFinite(completedLoading)) return '';

  return (lhv - completedLoading) / 86400000;
}

// Default for Clear Pass Time: 0 if Clear Pass is empty, else (Clear Pass - End Mooring) in days.
// Returns the raw (unrounded) number — rounding only happens at display time via formatCycleTimeNumber.
function calculateClearPassTime(data) {
  const clearPassRaw = String(data.clear_pass ?? '').trim();
  if (!clearPassRaw) return 0;

  const clearPass = Date.parse(clearPassRaw.replace(' ', 'T'));
  const endMooring = Date.parse(String(data.end_mooring ?? '').trim().replace(' ', 'T'));
  if (!Number.isFinite(clearPass) || !Number.isFinite(endMooring)) return '';

  return (clearPass - endMooring) / 86400000;
}

// Default for SPOG Time: Part 1 - (LHV Time + Clear Pass Time).
// Inputs/output are raw (unrounded) numbers — rounding only happens at display time via formatCycleTimeNumber.
function calculateSpogTime(part1, lhvTime, clearPassTime) {
  if (part1 === null || lhvTime === null || clearPassTime === null) return '';

  return part1 - (lhvTime + clearPassTime);
}

// Default for Check Part 1: True if Part 1 equals LHV Time + SPOG Time + Clear Pass Time.
// Compares raw (unrounded) numbers with a tiny epsilon for floating-point safety, not the rounded display values.
function calculateCheckPart1(part1, lhvTime, spogTime, clearPassTime) {
  if (part1 === null || lhvTime === null || spogTime === null || clearPassTime === null) return '';

  const sum = lhvTime + spogTime + clearPassTime;
  return Math.abs(part1 - sum) < 1e-9 ? 'True' : 'False';
}

// Cycle time header columns that show a formula info icon/popover; value is the ordered list of rules shown in the popover.
const FORMULA_INFO_RULES = {
  waiting_loading_jetty: [
    'Laycan Start kosong → 0',
    'Lainnya -> Start Loading − Arrival Jetty'
  ],
  waiting_plan_loading: [
    'Barges Arrival Early − Waiting Loading Jetty'
  ],
  loading_time_jetty: [
    'Completed Loading kosong → 0',
    'Lainnya -> Completed Loading − Start Loading'
  ],
  part_1: [
    'Clear Pass kosong → 0',
    'Lainnya -> Clear Pass − Completed Loading'
  ],
  lhv_time: [
    'LHV kosong → 0',
    'Lainnya -> LHV − Completed Loading'
  ],
  clear_pass_time: [
    'Clear Pass kosong → 0',
    'Lainnya -> Clear Pass − End Mooring'
  ],
  spog_time: [
    'Part 1 − (LHV Time + Clear Pass Time)'
  ],
  check_part_1: [
    'Part 1 == LHV Time + SPOG Time + Clear Pass Time'
  ],
  barges_arrival_early: [
    'Laycan Start kosong → 0',
    'Arrival Jetty > Laycan Start dan Arrival Jetty ≥ Laycan End → 0',
    'Laycan Start < Arrival Jetty < Laycan End → Start Loading − Arrival Jetty',
    'Arrival Jetty < Laycan Start dan Start Loading < Laycan Start → Start Loading − Arrival Jetty',
    'Lainnya → Laycan Start − Arrival Jetty'
  ],
  check_waiting_loading_jetty: [
    'Waiting Loading Jetty == Barges Arrival Early + Waiting Plan Loading',
    // 'Waiting Loading Jetty ≠ Barges Arrival Early + Waiting Plan Loading → False'
  ]
};

function selectMarkup(field, value, options) {
  const optionMarkup = options.map(option => `
    <option value="${esc(option)}"${option === value ? ' selected' : ''}>${esc(option)}</option>
  `).join('');

  return `
    <select class="form-select" data-operation-field="${esc(field)}">
      <option value="">-- pilih --</option>
      ${optionMarkup}
    </select>
  `;
}

function datetimeLocalValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const match = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/);
  if (match) return `${match[1]}T${match[2]}`;

  return parseDDMonYYToISO(text);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function dischargeSequenceSortValue(row) {
  const operationData = parseOperationData(row.operation_data);
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
    if (leftBargeSequence !== rightBargeSequence) {
      return leftBargeSequence - rightBargeSequence;
    }

    return (Number(left.id) || 0) - (Number(right.id) || 0);
  });
}

/* ===== Sort / Filter / Freeze (same behavior as Operation/1vessel.php Data Vessel table) ===== */

// fields stored directly on the sibarges row (everything else lives inside operation_data)
const DIRECT_ROW_FIELDS = new Set([
  'no_pk', 'buyer', 'mothervessel', 'jetty_code', 'tugboat', 'barge',
  'laycan_start', 'laycan_end', 'operation_remarks',
  'created_by', 'created_at', 'updated_at'
]);

function getFieldValue(row, key) {
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
  if (key === 'part_1' && !String(operationData.part_1 ?? '').trim()) {
    return calculatePart1(operationData);
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
  return operationData[key] ?? '';
}

// display value shown in the table cell for a given column (matches rowMarkup)
function columnDisplayValue(row, key) {
  const raw = getFieldValue(row, key);
  if (key === 'laycan_start' || key === 'laycan_end') return fmtLaycanDateTime(raw);
  if (key === 'created_at' || key === 'updated_at') return fmtDDMonYY(raw, true);
  if (operationDateTimeFields.has(key)) return fmtDDMonYY(raw, true);
  if (CYCLE_TIME_4DP_NUMBER_FIELDS.has(key)) return formatCycleTimeNumber(raw);
  if (formattedNumberFields.has(key)) return formatDisplayNumber(raw);
  return (raw ?? '').toString();
}

function getSortValue(row, key, type) {
  const value = getFieldValue(row, key);
  if (type === 'number') {
    const n = parseFloat(String(value).replaceAll(',', '').replaceAll(' ', ''));
    return isNaN(n) ? -Infinity : n;
  }
  if (type === 'date') {
    const t = value ? Date.parse(String(value).replace(' ', 'T')) : NaN;
    return isNaN(t) ? -Infinity : t;
  }
  return (value ?? '').toString().toLowerCase();
}

const FILTER_CONDITIONS = {
  equals:            (v, f)=> v === f,
  not_equals:        (v, f)=> v !== f,
  begins_with:       (v, f)=> v.startsWith(f),
  not_begins_with:   (v, f)=> !v.startsWith(f),
  ends_with:         (v, f)=> v.endsWith(f),
  not_ends_with:     (v, f)=> !v.endsWith(f),
  contains:          (v, f)=> v.includes(f),
  not_contains:      (v, f)=> !v.includes(f),
};

const CYCLE_TIME_COLUMN_FIELDS = [
  'waiting_loading_jetty',
  'check_waiting_loading_jetty',
  'barges_arrival_early',
  'waiting_plan_loading',
  'loading_time_jetty'
];

const CYCLE_TIME_COLUMN_FIELDS_LHV = [
  'part_1',
  'check_part_1',
  'lhv_time',
  'spog_time',
  'clear_pass_time'
];

const CYCLE_TIME_COLUMN_FIELDS_PART2 = [
  'part_2',
  'check_part_2',
  'mooring_2',
  'sailing_time',
  'total_waiting_disch_mv',
  'check_total_waiting_disch_mv',
  'waiting_cargo_readiness',
  'waiting_mv',
  'waiting_flf',
  'waiting_queueing',
  'waiting_sequence',
  'other_factor',
  'back_to_jetty_time'
];

const CYCLE_TIME_COLUMN_FIELDS_PART3 = [
  'loading_rate',
  'disch_time_loading_rate',
  'disch_time_percent',
  'cargo_readiness_p3',
  'pure_time',
  'waiting_cargo_readiness_p3',
  'waiting_mv_p3',
  'waiting_flf_p3',
  'waiting_queuing_p3',
  'waiting_sequence_p3',
  'other_factor_p3',
  'check_waiting_time_disch_mv',
  'total_ct_ltc',
  'laytime',
  'ltc_rate',
  'ltc_day',
  'ltc_total'
];

function rowMarkup(row, displayIndex, showCycleTimeColumns = false) {
  const operationData = parseOperationData(row.operation_data);
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
  if (!String(operationData.part_1 ?? '').trim()) {
    operationData.part_1 = calculatePart1(operationData);
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

  return `
    <tr data-row-id="${row.id}" tabindex="0" role="button" aria-label="Buka detail ${esc(row.si_barges)}">
      <td>${displayIndex + 1}</td>
      <td>${displayValue(row.no_pk)}</td>
      <td>${displayValue(row.buyer)}</td>
      <td>${displayValue(row.mothervessel)}</td>
      <td title="${esc(row.jetty_name)}">${displayValue(row.jetty_code)}</td>
      <td>${displayValue(row.tugboat)}</td>
      <td>${displayValue(row.barge)}</td>
      ${operationCell(operationData, 'qty')}
      ${operationCell(operationData, 'qty_disc')}
      ${operationCell(operationData, 'rc')}
      ${operationCell(operationData, 'qty_actual')}
      ${operationCell(operationData, 'pbm_vendor')}
      ${operationCell(operationData, 'floating_crane')}
      ${showCycleTimeColumns ? CYCLE_TIME_COLUMN_FIELDS.map(field => operationCell(operationData, field)).join('') : ''}
      <td>${displayLaycanDateTime(row.laycan_start)}</td>
      <td>${displayLaycanDateTime(row.laycan_end)}</td>
      ${operationCell(operationData, 'arrival_jetty')}
      ${operationCell(operationData, 'start_loading')}
      ${operationCell(operationData, 'completed_loading')}
      ${showCycleTimeColumns ? CYCLE_TIME_COLUMN_FIELDS_LHV.map(field => operationCell(operationData, field)).join('') : ''}
      ${operationCell(operationData, 'lhv')}
      ${operationCell(operationData, 'spog_zona_2')}
      ${operationCell(operationData, 'pkk')}
      ${operationCell(operationData, 'rkbm')}
      ${operationCell(operationData, 'sts_spb')}
      ${operationCell(operationData, 'start_mooring')}
      ${operationCell(operationData, 'end_mooring')}
      ${operationCell(operationData, 'mooring_place_1')}
      ${operationCell(operationData, 'clear_pass')}
      ${operationCell(operationData, 'start_mooring_clear_pass')}
      ${operationCell(operationData, 'cast_off_mooring_clear_pass')}
      ${operationCell(operationData, 'mooring_place_2')}
      ${showCycleTimeColumns ? CYCLE_TIME_COLUMN_FIELDS_PART2.map(field => operationCell(operationData, field)).join('') : ''}
      ${operationCell(operationData, 'ta_barges_actual')}
      ${operationCell(operationData, 'ta_mv')}
      ${operationCell(operationData, 'ta_flf')}
      ${operationCell(operationData, 'cargo_readiness_actual')}
      ${operationCell(operationData, 'start_disch')}
      ${operationCell(operationData, 'completed_disch')}
      ${operationCell(operationData, 'discharge_sequence')}
      ${operationCell(operationData, 'back_to_jetty')}
      ${showCycleTimeColumns ? CYCLE_TIME_COLUMN_FIELDS_PART3.map(field => operationCell(operationData, field)).join('') : ''}
      <td>${displayValue(row.operation_remarks)}</td>
      <td>${displayValue(row.created_by)}</td>
      <td>${displayDateTime(row.created_at)}</td>
      <td>${displayDateTime(row.updated_at)}</td>
    </tr>
  `;
}

function closeDropdown(th) {
  const toggleBtn = th.querySelector('.sort-toggle');
  if (!toggleBtn) return;
  const dd = bootstrap.Dropdown.getOrCreateInstance(toggleBtn);
  dd.hide();
}

function createOperationWorkflow(cfg) {
  const yearSelect = document.getElementById(cfg.year);
  const monthSelect = document.getElementById(cfg.month);
  const noPkSelect = document.getElementById(cfg.noPk);
  const box = document.getElementById(cfg.box);
  const table = document.getElementById(cfg.table);
  const body = document.getElementById(cfg.body);
  const downloadCsv = document.getElementById(cfg.downloadCsv);
  const exportCsvButton = document.getElementById(cfg.exportCsv);
  const importForm = document.getElementById(cfg.importForm);
  const csvFileInput = document.getElementById(cfg.csvFileInput);
  const importButton = document.getElementById(cfg.importButton);
  const csvStatus = document.getElementById(cfg.csvStatus);
  const detailModal = document.getElementById(cfg.detailModal);
  const detailSubtitle = document.getElementById(cfg.detailSubtitle);
  const detailBody = document.getElementById(cfg.detailBody);
  const saveButton = document.getElementById(cfg.saveButton);
  const saveStatus = document.getElementById(cfg.saveStatus);

  // present only for tables opted into the drag-to-hide-columns feature (currently cycleTimeTable)
  const hiddenColumnsIndicator = box.querySelector('.hidden-columns-indicator');
  const hiddenColumnsCountEl = hiddenColumnsIndicator ? hiddenColumnsIndicator.querySelector('.hidden-columns-count') : null;
  const hiddenColumnsMenu = hiddenColumnsIndicator ? hiddenColumnsIndicator.querySelector('.hidden-columns-menu') : null;
  const COLUMN_DRAG_THRESHOLD = 6; // px of movement before a mousedown counts as a drag, not a click

  let currentRows = [];
  let currentDetailRowId = null;
  let sortState = { key: null, dir: 0 }; // dir: 0 = default (unsorted), 1 = ascending, -1 = descending
  let filters = {}; // key -> { condition, value, excluded:Set(display values), autoApply }
  let frozenKey = null; // data-key of the rightmost frozen column (that column + all to its left are frozen), or null
  let hiddenKeys = new Set(); // data-key of columns hidden via drag
  let columnDragState = null; // { th, key, label, startX, startY, dragging }
  let hideColumnPopupEl = null;

  replaceSelectOptions(
    yearSelect,
    '-- Pilih Tahun --',
    availableYears.map(year => ({ value: year, label: year }))
  );

  function resetSelectedVessel() {
    noPkSelect.value = '';
    noPkSelect.dispatchEvent(new Event('change'));
  }

  yearSelect.addEventListener('change', () => {
    const selectedYear = yearSelect.value;
    const availableMonths = [...new Set(
      tluVesselPeriods
        .filter(vessel => String(vessel.laycan_year) === selectedYear)
        .map(vessel => Number(vessel.laycan_month))
    )].sort((left, right) => left - right);

    replaceSelectOptions(
      monthSelect,
      '-- Pilih Bulan --',
      availableMonths.map(month => ({
        value: String(month),
        label: monthNames[month - 1]
      }))
    );
    monthSelect.disabled = !selectedYear;
    replaceSelectOptions(noPkSelect, '-- Pilih Mother Vessel --', []);
    noPkSelect.disabled = true;
    resetSelectedVessel();
  });

  monthSelect.addEventListener('change', () => {
    const selectedYear = yearSelect.value;
    const selectedMonth = monthSelect.value;
    const matchingVessels = tluVesselPeriods.filter(vessel =>
      String(vessel.laycan_year) === selectedYear &&
      String(vessel.laycan_month) === selectedMonth
    );

    replaceSelectOptions(
      noPkSelect,
      '-- Pilih Mother Vessel --',
      matchingVessels.map(vessel => ({
        value: vessel.no_pk,
        label: `${vessel.no_pk} — ${vessel.mothervessel}`
      }))
    );
    noPkSelect.disabled = !selectedMonth;
    resetSelectedVessel();
  });

  function dischargeSequenceMarkup(field, value) {
    const options = Array.from(
      { length: currentRows.length },
      (_, index) => String(index + 1)
    );
    return selectMarkup(field, value, options);
  }

  function validateOperationTimelineInputs(reportError = false) {
    const arrivalJettyInput = detailBody.querySelector('[data-operation-field="arrival_jetty"]');
    const startLoadingInput = detailBody.querySelector('[data-operation-field="start_loading"]');
    const completedLoadingInput = detailBody.querySelector('[data-operation-field="completed_loading"]');
    const startMooringInput = detailBody.querySelector('[data-operation-field="start_mooring"]');
    const endMooringInput = detailBody.querySelector('[data-operation-field="end_mooring"]');
    const startDischInput = detailBody.querySelector('[data-operation-field="start_disch"]');
    const completedDischInput = detailBody.querySelector('[data-operation-field="completed_disch"]');
    const timelineInputs = [
      arrivalJettyInput,
      startLoadingInput,
      completedLoadingInput,
      startMooringInput,
      endMooringInput,
      startDischInput,
      completedDischInput
    ];
    if (timelineInputs.some(input => !input)) return true;

    timelineInputs.forEach(input => input.setCustomValidity(''));

    startLoadingInput.min = arrivalJettyInput.value || '';
    completedLoadingInput.min = startLoadingInput.value || arrivalJettyInput.value || '';
    endMooringInput.min = startMooringInput.value || '';
    completedDischInput.min = startDischInput.value || '';

    if (arrivalJettyInput.value && startLoadingInput.value && startLoadingInput.value < arrivalJettyInput.value) {
      startLoadingInput.setCustomValidity('Start Loading must be equal to or later than Arrival Jetty.');
    }
    if (startLoadingInput.value && completedLoadingInput.value && completedLoadingInput.value < startLoadingInput.value) {
      completedLoadingInput.setCustomValidity('Completed Loading must be equal to or later than Start Loading.');
    }
    if (!startLoadingInput.value && arrivalJettyInput.value && completedLoadingInput.value && completedLoadingInput.value < arrivalJettyInput.value) {
      completedLoadingInput.setCustomValidity('Completed Loading must be equal to or later than Arrival Jetty.');
    }
    if (startMooringInput.value && endMooringInput.value && endMooringInput.value < startMooringInput.value) {
      endMooringInput.setCustomValidity('End Mooring must be equal to or later than Start Mooring.');
    }
    if (startDischInput.value && completedDischInput.value && completedDischInput.value < startDischInput.value) {
      completedDischInput.setCustomValidity('Completed Disch must be equal to or later than Start Disch.');
    }

    const invalidInput = timelineInputs.find(input => !input.checkValidity());
    if (invalidInput && reportError) invalidInput.reportValidity();
    return !invalidInput;
  }

  function exportVisibleData() {
    const headers = [...table.querySelectorAll('thead th')]
      .slice(1)
      .map(header => header.dataset.label || header.textContent.trim());
    const dischargeSequenceIndex = headers.indexOf('Discharge Sequence');

    const rows = [...body.querySelectorAll('tr[data-row-id]')]
      .map((row, originalIndex) => ({
        originalIndex,
        values: [...row.cells].slice(1).map(cell => {
          const value = cell.textContent.trim();
          return value === '-' ? '' : value;
        })
      }))
      .sort((left, right) => {
        const leftSequence = left.values[dischargeSequenceIndex] || '';
        const rightSequence = right.values[dischargeSequenceIndex] || '';

        if (!leftSequence && !rightSequence) return left.originalIndex - right.originalIndex;
        if (!leftSequence) return 1;
        if (!rightSequence) return -1;

        return Number(leftSequence) - Number(rightSequence) || left.originalIndex - right.originalIndex;
      });

    if (!rows.length) return;

    const csv = [
      headers.map(csvCell).join(','),
      ...rows.map(row => row.values.map(csvCell).join(','))
    ].join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const noPk = noPkSelect.value.trim();
    const safeNoPk = noPk.replace(/[^A-Za-z0-9._-]+/g, '_');
    const selectedVessel = tluVesselPeriods.find(vessel => vessel.no_pk === noPk);
    const safeMotherVessel = (selectedVessel?.mothervessel || '').trim().replace(/[^A-Za-z0-9 ._-]+/g, '_').trim();

    link.href = url;
    link.download = safeNoPk ? `tlu_${safeNoPk}—${safeMotherVessel}.csv` : 'tlu_export.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getFilterState(key) {
    if (!filters[key]) filters[key] = { condition: 'none', value: '', excluded: new Set(), autoApply: true };
    return filters[key];
  }

  function isFilterActive(key) {
    const f = filters[key];
    if (!f) return false;
    return (f.condition && f.condition !== 'none') || (f.excluded && f.excluded.size > 0);
  }

  function getUniqueColumnValues(key) {
    const seen = new Set();
    const values = [];
    currentRows.forEach(row => {
      const v = columnDisplayValue(row, key);
      if (!seen.has(v)) { seen.add(v); values.push(v); }
    });
    return values;
  }

  function rowPassesFilters(row) {
    for (const key in filters) {
      const f = filters[key];
      if (!f || !isFilterActive(key)) continue;
      const display = columnDisplayValue(row, key);

      if (f.condition && f.condition !== 'none') {
        const fn = FILTER_CONDITIONS[f.condition];
        if (fn && !fn(display.toLowerCase(), (f.value || '').toLowerCase())) return false;
      }

      if (f.excluded && f.excluded.has(display)) return false;
    }
    return true;
  }

  function computeDisplayData() {
    const filtered = currentRows.filter(rowPassesFilters);
    if (!sortState.key || sortState.dir === 0) return filtered;
    const th = table.querySelector(`th[data-key="${sortState.key}"]`);
    const type = th ? th.getAttribute('data-type') : 'text';
    const dir = sortState.dir;
    return filtered.sort((a, b) => {
      const va = getSortValue(a, sortState.key, type);
      const vb = getSortValue(b, sortState.key, type);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function renderTable() {
    const displayData = computeDisplayData();
    body.innerHTML = displayData.length
      ? displayData.map((row, index) => rowMarkup(row, index, cfg.showCycleTimeColumns)).join('')
      : '<tr><td colspan="99" class="text-center text-muted py-3">Data Barges tidak ditemukan.</td></tr>';
    applyHiddenColumns();
    applyFreezeStyling();
  }

  function updateSortIndicators() {
    table.querySelectorAll('th.sortable').forEach(th => {
      const key = th.getAttribute('data-key');
      const active = key === sortState.key && sortState.dir !== 0;
      const filterActive = isFilterActive(key);
      th.classList.toggle('sort-active', active);
      th.classList.toggle('filter-active', filterActive);
      const toggleBtn = th.querySelector('.sort-toggle');
      if (toggleBtn) {
        toggleBtn.innerHTML = active ? (sortState.dir === 1 ? '&#9650;' : '&#9660;') : '&#8645;';
        toggleBtn.classList.toggle('text-primary', filterActive);
      }
      th.querySelectorAll('.sort-option').forEach(opt => {
        const dir = parseInt(opt.getAttribute('data-dir'), 10);
        opt.classList.toggle('active-sort', active ? dir === sortState.dir : dir === 0);
      });
    });
  }

  function updateFreezeButtons() {
    table.querySelectorAll('th.sortable').forEach(th => {
      const key = th.getAttribute('data-key');
      const btn = th.querySelector('.freeze-toggle');
      if (!btn) return;
      const isBoundary = key === frozenKey;
      btn.textContent = isBoundary ? 'Unfreeze Column' : 'Freeze Column';
      btn.classList.toggle('active', isBoundary);
    });
  }

  // pins the frozen column + all columns to its left in place while the table
  // scrolls horizontally (sticky offsets are computed from actual rendered widths,
  // since column widths aren't fixed)
  function applyFreezeStyling() {
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    const headerCells = Array.from(headerRow.children);

    headerCells.forEach(th => {
      th.classList.remove('frozen-col', 'frozen-col-last');
      th.style.left = '';
    });
    table.querySelectorAll('tbody tr').forEach(tr => {
      Array.from(tr.children).forEach(td => {
        td.classList.remove('frozen-col', 'frozen-col-last');
        td.style.position = '';
        td.style.left = '';
      });
    });

    if (!frozenKey) return;

    const frozenIndex = headerCells.findIndex(th => th.getAttribute('data-key') === frozenKey);
    if (frozenIndex === -1) return;

    let left = 0;
    for (let i = 0; i <= frozenIndex; i++) {
      const th = headerCells[i];
      th.classList.add('frozen-col');
      if (i === frozenIndex) th.classList.add('frozen-col-last');
      th.style.left = `${left}px`;

      table.querySelectorAll('tbody tr').forEach(tr => {
        const td = tr.children[i];
        if (!td) return;
        td.classList.add('frozen-col');
        if (i === frozenIndex) td.classList.add('frozen-col-last');
        td.style.left = `${left}px`;
      });

      left += th.getBoundingClientRect().width;
    }
  }
  window.addEventListener('resize', () => applyFreezeStyling());

  // hides/shows th + td cells by column position (mirrors applyFreezeStyling's index-matching approach)
  function applyHiddenColumns() {
    if (!hiddenColumnsIndicator) return;
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    const headerCells = Array.from(headerRow.children);

    headerCells.forEach((th, index) => {
      const key = th.getAttribute('data-key');
      const hidden = !!key && hiddenKeys.has(key);
      th.classList.toggle('d-none', hidden);
      table.querySelectorAll('tbody tr[data-row-id]').forEach(tr => {
        const td = tr.children[index];
        if (td) td.classList.toggle('d-none', hidden);
      });
    });
  }

  function renderHiddenColumnsMenu() {
    if (!hiddenColumnsIndicator) return;
    const count = hiddenKeys.size;
    hiddenColumnsIndicator.classList.toggle('d-none', count === 0);
    hiddenColumnsCountEl.textContent = count;

    const headerRow = table.querySelector('thead tr');
    const hiddenHeaders = headerRow
      ? Array.from(headerRow.querySelectorAll('th[data-key]')).filter(th => hiddenKeys.has(th.getAttribute('data-key')))
      : [];

    hiddenColumnsMenu.innerHTML = hiddenHeaders.map(th => {
      const key = th.getAttribute('data-key');
      const label = th.getAttribute('data-label') || key;
      const inputId = `hc-${cfg.table}-${key}`;
      return `<div class="form-check hidden-column-item">
        <input class="form-check-input hidden-column-checkbox" type="checkbox" checked data-key="${esc(key)}" id="${esc(inputId)}">
        <label class="form-check-label" for="${esc(inputId)}">${esc(label)}</label>
      </div>`;
    }).join('') + (hiddenHeaders.length
      ? `<button type="button" class="btn btn-sm btn-outline-secondary w-100 hidden-columns-unhide-all">Unhide all</button>`
      : '');
  }

  function unhideColumn(key) {
    hiddenKeys.delete(key);
    applyHiddenColumns();
    renderHiddenColumnsMenu();
  }

  if (hiddenColumnsMenu) {
    hiddenColumnsMenu.addEventListener('change', (e) => {
      if (!e.target.classList.contains('hidden-column-checkbox')) return;
      if (!e.target.checked) unhideColumn(e.target.getAttribute('data-key'));
    });
    hiddenColumnsMenu.addEventListener('click', (e) => {
      if (!e.target.classList.contains('hidden-columns-unhide-all')) return;
      hiddenKeys.clear();
      applyHiddenColumns();
      renderHiddenColumnsMenu();
    });
  }

  // returns the data-keys currently spanned by the in-progress column drag selection
  function getColumnSelectionKeys() {
    if (!columnDragState) return [];
    const lo = Math.min(columnDragState.startIndex, columnDragState.hoverIndex);
    const hi = Math.max(columnDragState.startIndex, columnDragState.hoverIndex);
    return columnDragState.rects.slice(lo, hi + 1).map(r => r.key);
  }

  function applyColumnSelectionHighlight() {
    const keys = new Set(getColumnSelectionKeys());
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    const bodyRows = table.querySelectorAll('tbody tr[data-row-id]');
    Array.from(headerRow.children).forEach((th, index) => {
      const key = th.getAttribute('data-key');
      const selected = !!key && keys.has(key);
      th.classList.toggle('col-selecting', selected);
      bodyRows.forEach(tr => {
        const td = tr.children[index];
        if (td) td.classList.toggle('col-selecting', selected);
      });
    });
  }

  function clearColumnSelectionHighlight() {
    table.querySelectorAll('.col-selecting').forEach(el => el.classList.remove('col-selecting'));
  }

  function positionHideColumnPopup(x, y) {
    if (!hideColumnPopupEl) return;
    const left = Math.min(x + 16, window.innerWidth - 240);
    const top = Math.min(y + 16, window.innerHeight - 90);
    hideColumnPopupEl.style.left = `${left}px`;
    hideColumnPopupEl.style.top = `${top}px`;
  }

  function updateHideColumnPopupContent() {
    if (!hideColumnPopupEl) return;
    const keys = getColumnSelectionKeys();
    const headerRow = table.querySelector('thead tr');
    const label = keys.length === 1 && headerRow
      ? (headerRow.querySelector(`th[data-key="${keys[0]}"]`)?.getAttribute('data-label') || keys[0])
      : '';
    const textEl = hideColumnPopupEl.querySelector('.hide-column-popup-text');
    const btnEl = hideColumnPopupEl.querySelector('.hide-column-popup-btn');
    textEl.textContent = keys.length === 1 ? `Hide "${label}" column?` : `Hide ${keys.length} columns?`;
    btnEl.textContent = keys.length === 1 ? 'Hide column' : 'Hide columns';
  }

  function openHideColumnPopup(x, y) {
    if (hideColumnPopupEl) return;
    const popup = document.createElement('div');
    popup.className = 'hide-column-popup';
    popup.innerHTML = `
      <div class="hide-column-popup-text"></div>
      <button type="button" class="btn btn-sm btn-danger hide-column-popup-btn"></button>
    `;
    document.body.appendChild(popup);
    hideColumnPopupEl = popup;
    popup.querySelector('.hide-column-popup-btn').addEventListener('click', confirmHideColumnSelection);
    updateHideColumnPopupContent();
    positionHideColumnPopup(x, y);
  }

  function closeHideColumnPopup() {
    if (!hideColumnPopupEl) return;
    hideColumnPopupEl.remove();
    hideColumnPopupEl = null;
  }

  function attachSelectionDismissListeners() {
    setTimeout(() => {
      document.addEventListener('mousedown', handleColumnSelectionOutsideClick, true);
      document.addEventListener('keydown', handleColumnSelectionEscape, true);
    }, 0);
  }

  function detachSelectionDismissListeners() {
    document.removeEventListener('mousedown', handleColumnSelectionOutsideClick, true);
    document.removeEventListener('keydown', handleColumnSelectionEscape, true);
  }

  function handleColumnSelectionOutsideClick(e) {
    if (hideColumnPopupEl && hideColumnPopupEl.contains(e.target)) return;
    cancelColumnSelection();
  }

  function handleColumnSelectionEscape(e) {
    if (e.key === 'Escape') cancelColumnSelection();
  }

  function cancelColumnSelection() {
    clearColumnSelectionHighlight();
    closeHideColumnPopup();
    detachSelectionDismissListeners();
    columnDragState = null;
    document.body.style.cursor = '';
  }

  function confirmHideColumnSelection() {
    const keys = getColumnSelectionKeys();
    cancelColumnSelection();
    keys.forEach(key => hiddenKeys.add(key));
    applyHiddenColumns();
    renderHiddenColumnsMenu();
  }

  let columnDragRafPending = false;
  let columnDragLastEvent = null;

  function handleColumnDragMove(e) {
    if (!columnDragState || columnDragState.confirming) return;
    columnDragLastEvent = e;
    if (columnDragRafPending) return;
    columnDragRafPending = true;
    requestAnimationFrame(processColumnDragMove);
  }

  function processColumnDragMove() {
    columnDragRafPending = false;
    const e = columnDragLastEvent;
    if (!columnDragState || columnDragState.confirming || !e) return;

    if (!columnDragState.dragging) {
      const dx = e.clientX - columnDragState.startX;
      const dy = e.clientY - columnDragState.startY;
      if (Math.hypot(dx, dy) < COLUMN_DRAG_THRESHOLD) return;
      columnDragState.dragging = true;
      document.body.style.cursor = 'grabbing';
    }

    let hoverIndex = columnDragState.rects.findIndex(r => e.clientX >= r.rect.left && e.clientX < r.rect.right);
    if (hoverIndex === -1) {
      hoverIndex = e.clientX < columnDragState.rects[0].rect.left ? 0 : columnDragState.rects.length - 1;
    }
    columnDragState.hoverIndex = hoverIndex;

    applyColumnSelectionHighlight();
    openHideColumnPopup(e.clientX, e.clientY);
    updateHideColumnPopupContent();
    positionHideColumnPopup(e.clientX, e.clientY);
  }

  function handleColumnDragEnd() {
    if (!columnDragState) return;
    document.body.style.cursor = '';
    if (!columnDragState.dragging) {
      // plain click with no drag motion — nothing was selected, nothing to confirm
      columnDragState = null;
      return;
    }
    // freeze the selection in place; only the popup button or an outside click/Escape resolves it now
    columnDragState.confirming = true;
    attachSelectionDismissListeners();
  }

  function startColumnDrag(e, key) {
    cancelColumnSelection();
    const sortableThs = Array.from(table.querySelectorAll('th.sortable'));
    const rects = sortableThs.map(t => ({
      key: t.getAttribute('data-key'),
      rect: t.getBoundingClientRect()
    }));
    const startIndex = rects.findIndex(r => r.key === key);
    if (startIndex === -1) return;
    columnDragState = {
      startX: e.clientX, startY: e.clientY,
      dragging: false, confirming: false,
      rects, startIndex, hoverIndex: startIndex
    };
  }

  if (hiddenColumnsIndicator) {
    document.addEventListener('mousemove', handleColumnDragMove);
    document.addEventListener('mouseup', handleColumnDragEnd);
  }

  function updateSelectAllState(th) {
    const key = th.getAttribute('data-key');
    const f = getFilterState(key);
    const selectAllEl = th.querySelector('.filter-select-all');
    if (!selectAllEl) return;
    const uniqueValues = getUniqueColumnValues(key);
    const excludedCount = uniqueValues.filter(v => f.excluded.has(v)).length;
    if (excludedCount === 0) { selectAllEl.checked = true; selectAllEl.indeterminate = false; }
    else if (excludedCount === uniqueValues.length) { selectAllEl.checked = false; selectAllEl.indeterminate = false; }
    else { selectAllEl.checked = false; selectAllEl.indeterminate = true; }
  }

  function buildFilterValuesList(th) {
    const key = th.getAttribute('data-key');
    const f = getFilterState(key);
    const listEl = th.querySelector('.filter-values-list');
    const uniqueValues = getUniqueColumnValues(key);

    listEl.innerHTML = uniqueValues.map(v => {
      const checked = f.excluded.has(v) ? '' : 'checked';
      const escaped = esc(v);
      const labelHtml = v === '' ? '<i>(blank)</i>' : escaped;
      return `<div class="form-check filter-value-item" data-value="${escaped}">
        <input class="form-check-input filter-value-checkbox" type="checkbox" ${checked}>
        <label class="form-check-label">${labelHtml}</label>
      </div>`;
    }).join('');

    updateSelectAllState(th);
  }

  function syncFilterControls(th) {
    const key = th.getAttribute('data-key');
    const f = getFilterState(key);
    const conditionEl = th.querySelector('.filter-condition');
    const valueEl = th.querySelector('.filter-value');
    const searchEl = th.querySelector('.filter-search');
    const autoApplyEl = th.querySelector('.filter-auto-apply');
    if (conditionEl) conditionEl.value = f.condition;
    if (valueEl) valueEl.value = f.value;
    if (searchEl) searchEl.value = '';
    if (autoApplyEl) autoApplyEl.checked = f.autoApply;
    th.querySelectorAll('.filter-value-item').forEach(item => item.classList.remove('d-none'));
  }

  function initSortableHeaders() {
    table.querySelectorAll('th.sortable').forEach(th => {
      const label = th.getAttribute('data-label');
      const key = th.getAttribute('data-key');

      th.innerHTML = `
        <div class="th-sort-wrap">
          <span>${label}</span>
          <div class="dropdown">
            <button type="button" class="btn btn-sm p-0 sort-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" title="Sort / Filter ${label}">&#8645;</button>
            <div class="dropdown-menu dropdown-menu-end filter-menu">
              <p class="dropdown-header-label">Freeze</p>
              <div class="px-3 pb-2">
                <button type="button" class="btn btn-sm btn-outline-secondary w-100 freeze-toggle">Freeze</button>
              </div>

              <hr class="dropdown-divider">

              <p class="dropdown-header-label">Sort</p>
              <div class="px-3 pb-2">
                <div class="d-flex gap-1">
                  <button type="button" class="btn btn-sm btn-outline-secondary flex-fill sort-option" data-dir="0">Default</button>
                  <button type="button" class="btn btn-sm btn-outline-secondary flex-fill sort-option" data-dir="1">Ascending</button>
                  <button type="button" class="btn btn-sm btn-outline-secondary flex-fill sort-option" data-dir="-1">Descending</button>
                </div>
              </div>

              <hr class="dropdown-divider">

              <p class="dropdown-header-label">Filter</p>
              <div class="px-3 pb-2">
                <div class="d-flex gap-1 mb-2">
                  <select class="form-select form-select-sm filter-condition">
                    <option value="none">Choose One</option>
                    <option value="equals">Equals</option>
                    <option value="not_equals">Does Not Equal</option>
                    <option value="begins_with">Begins With</option>
                    <option value="not_begins_with">Does Not Begin With</option>
                    <option value="ends_with">Ends With</option>
                    <option value="not_ends_with">Does Not End With</option>
                    <option value="contains">Contains</option>
                    <option value="not_contains">Does Not Contain</option>
                  </select>
                  <input type="text" class="form-control form-control-sm filter-value" placeholder="Value">
                </div>

                <div class="input-group input-group-sm mb-2">
                  <span class="input-group-text">&#128269;</span>
                  <input type="text" class="form-control filter-search" placeholder="Search">
                </div>

                <div class="form-check mb-1">
                  <input class="form-check-input filter-select-all" type="checkbox" checked>
                  <label class="form-check-label fw-semibold">(Select All)</label>
                </div>

                <div class="filter-values-list border rounded p-1 mb-2"></div>

                <div class="form-check mb-2">
                  <input class="form-check-input filter-auto-apply" type="checkbox" checked>
                  <label class="form-check-label">Auto Apply</label>
                </div>

                <div class="d-flex justify-content-between gap-2">
                  <button type="button" class="btn btn-sm btn-primary flex-fill filter-apply">Apply Filter</button>
                  <button type="button" class="btn btn-sm btn-outline-secondary flex-fill filter-clear">Clear Filter</button>
                </div>
              </div>
            </div>
          </div>
          ${FORMULA_INFO_RULES[key] ? `
            <button type="button" class="btn btn-sm p-0 formula-info-btn" aria-label="Formula ${esc(label)}">&#9432;</button>
          ` : ''}
        </div>`;

      if (FORMULA_INFO_RULES[key]) {
        const formulaBtn = th.querySelector('.formula-info-btn');
        const formulaPopover = new bootstrap.Popover(formulaBtn, {
          trigger: 'click',
          html: true,
          placement: 'bottom',
          container: 'body',
          customClass: 'wlj-formula-popover',
          content: `
            <div class="wlj-formula-rules">
              ${FORMULA_INFO_RULES[key].map(rule => `<div class="wlj-formula-rule">${esc(rule)}</div>`).join('')}
            </div>
          `
        });
        formulaBtn.addEventListener('click', e => e.stopPropagation());
        document.addEventListener('click', e => {
          if (formulaBtn.contains(e.target) || e.target.closest('.popover')) return;
          formulaPopover.hide();
        });
      }

      const toggleBtn = th.querySelector('.sort-toggle');
      new bootstrap.Dropdown(toggleBtn, {
        popperConfig: (defaultConfig) => ({ ...defaultConfig, strategy: 'fixed' })
      });

      const freezeBtn = th.querySelector('.freeze-toggle');
      freezeBtn.addEventListener('click', () => {
        frozenKey = (frozenKey === key) ? null : key;
        updateFreezeButtons();
        applyFreezeStyling();
        closeDropdown(th);
      });

      th.querySelectorAll('.sort-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.preventDefault();
          const dir = parseInt(opt.getAttribute('data-dir'), 10);
          sortState = dir === 0 ? { key: null, dir: 0 } : { key, dir };
          updateSortIndicators();
          renderTable();
          closeDropdown(th);
        });
      });

      const f = getFilterState(key);
      const conditionEl = th.querySelector('.filter-condition');
      const valueEl = th.querySelector('.filter-value');
      const searchEl = th.querySelector('.filter-search');
      const selectAllEl = th.querySelector('.filter-select-all');
      const listEl = th.querySelector('.filter-values-list');
      const autoApplyEl = th.querySelector('.filter-auto-apply');
      const applyBtn = th.querySelector('.filter-apply');
      const clearBtn = th.querySelector('.filter-clear');
      const dropdownWrap = th.querySelector('.dropdown');

      dropdownWrap.addEventListener('show.bs.dropdown', () => {
        syncFilterControls(th);
        buildFilterValuesList(th);
      });

      conditionEl.addEventListener('change', () => {
        f.condition = conditionEl.value;
        updateSortIndicators();
        if (f.autoApply) renderTable();
      });

      valueEl.addEventListener('input', () => {
        f.value = valueEl.value;
        updateSortIndicators();
        if (f.autoApply) renderTable();
      });

      searchEl.addEventListener('input', () => {
        const term = searchEl.value.trim().toLowerCase();
        listEl.querySelectorAll('.filter-value-item').forEach(item => {
          const val = (item.getAttribute('data-value') || '').toLowerCase();
          item.classList.toggle('d-none', term !== '' && !val.includes(term));
        });
      });

      selectAllEl.addEventListener('change', () => {
        const checked = selectAllEl.checked;
        const uniqueValues = getUniqueColumnValues(key);
        uniqueValues.forEach(v => checked ? f.excluded.delete(v) : f.excluded.add(v));
        listEl.querySelectorAll('.filter-value-checkbox').forEach(cb => cb.checked = checked);
        selectAllEl.indeterminate = false;
        updateSortIndicators();
        if (f.autoApply) renderTable();
      });

      listEl.addEventListener('change', (e) => {
        if (!e.target.classList.contains('filter-value-checkbox')) return;
        const item = e.target.closest('.filter-value-item');
        const val = item.getAttribute('data-value');
        if (e.target.checked) f.excluded.delete(val); else f.excluded.add(val);
        updateSelectAllState(th);
        updateSortIndicators();
        if (f.autoApply) renderTable();
      });

      autoApplyEl.addEventListener('change', () => {
        f.autoApply = autoApplyEl.checked;
      });

      applyBtn.addEventListener('click', () => {
        renderTable();
        updateSortIndicators();
        closeDropdown(th);
      });

      clearBtn.addEventListener('click', () => {
        f.condition = 'none';
        f.value = '';
        f.excluded.clear();
        syncFilterControls(th);
        buildFilterValuesList(th);
        updateSortIndicators();
        renderTable();
        closeDropdown(th);
      });

      if (hiddenColumnsIndicator) {
        th.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          if (e.target.closest('.dropdown')) return; // let the sort/filter dropdown toggle work normally
          if (e.target.closest('.formula-info-btn')) return; // let the formula popover toggle work normally
          e.preventDefault();
          startColumnDrag(e, key);
        });
      }
    });
    updateSortIndicators();
    updateFreezeButtons();
    renderHiddenColumnsMenu();
  }
  // deferred: bootstrap.bundle.min.js is loaded later, in includes/footer.php
  document.addEventListener('DOMContentLoaded', initSortableHeaders);

  async function loadSelectedVessel() {
    const noPk = noPkSelect.value.trim();

    if (!noPk) {
      box.classList.add('d-none');
      body.innerHTML = '';
      currentRows = [];
      exportCsvButton.disabled = true;
      return;
    }

    downloadCsv.href =
      `7tluoperation.php?download=tlu_operation_template&no_pk=${encodeURIComponent(noPk)}`;
    box.classList.remove('d-none');
    exportCsvButton.disabled = true;
    body.innerHTML = '<tr><td colspan="99" class="text-center text-muted py-3">Loading...</td></tr>';

    try {
      const response = await fetch(
        `7tluoperation.php?action=si_barges_by_vessel&no_pk=${encodeURIComponent(noPk)}`,
        { headers: { 'X-Requested-With': 'XMLHttpRequest' } }
      );
      const result = await response.json();

      if (!result.ok) throw new Error(result.msg || 'Gagal mengambil Data Barges.');

      const rows = result.data || [];

      if (!rows.length) {
        body.innerHTML = '<tr><td colspan="99" class="text-center text-muted py-3">Data Barges tidak ditemukan.</td></tr>';
        return;
      }

      currentRows = urutkanSesuaiDenganDischargeSequence(rows);
      renderTable();
      exportCsvButton.disabled = false;
    } catch (error) {
      exportCsvButton.disabled = true;
      body.innerHTML = `<tr><td colspan="99" class="text-center text-danger py-3">${esc(error.message)}</td></tr>`;
    }
  }

  exportCsvButton.addEventListener('click', exportVisibleData);

  noPkSelect.addEventListener('change', () => {
    csvStatus.classList.add('d-none');
    csvStatus.textContent = '';
    csvFileInput.value = '';
    loadSelectedVessel();
  });

  importForm.addEventListener('submit', async event => {
    event.preventDefault();
    const noPk = noPkSelect.value.trim();
    if (!noPk || !csvFileInput.files.length) return;

    const formData = new FormData();
    formData.append('no_pk', noPk);
    formData.append('csv', csvFileInput.files[0]);

    importButton.disabled = true;
    importButton.textContent = 'Importing...';
    csvStatus.className = 'alert d-none mt-3 mb-0';

    try {
      const response = await fetch('7tluoperation.php?action=import_operation_csv', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.msg || 'Import CSV gagal.');

      csvStatus.textContent = result.msg;
      csvStatus.className =
        `alert ${result.partial ? 'alert-warning' : 'alert-success'} mt-3 mb-0`;
      csvFileInput.value = '';
      await loadSelectedVessel();
    } catch (error) {
      csvStatus.textContent = error.message;
      csvStatus.className = 'alert alert-danger mt-3 mb-0';
    } finally {
      importButton.disabled = false;
      importButton.textContent = 'Import CSV';
    }
  });

  function openDetail(rowId) {
    const row = currentRows.find(item => item.id === rowId);
    if (!row) return;

    const tableRow = body.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!tableRow) return;

    const headers = [...table.querySelectorAll('thead th')];
    const cells = [...tableRow.cells].map(cell => cell.textContent.trim());

    currentDetailRowId = rowId;
    saveStatus.textContent = '';
    saveStatus.className = 'me-auto small';
    detailSubtitle.textContent = `${row.si_barges || '-'} — ${row.mothervessel || '-'}`;
    detailBody.innerHTML = headers.map((header, index) => {
      const label = header.dataset.label || header.textContent.trim();
      const editField = header.dataset.editField;
      const value = cells[index] === '-' ? '' : (cells[index] ?? '');
      const isCalculated = header.dataset.calculated === 'true';
      const inputType = header.dataset.inputType;
      const valueMarkup = isCalculated
        ? `
          <div>
            <div class="si-detail-value fw-semibold" data-operation-field="${esc(editField)}">${esc(value || '-')}</div>
            <div class="form-text">Dihitung otomatis: QTY DISC + RC</div>
          </div>
        `
        : inputType === 'pbm-vendor'
        ? selectMarkup(editField, value, pbmVendorOptions)
        : inputType === 'floating-crane'
        ? selectMarkup(editField, value, floatingCraneOptions)
        : inputType === 'discharge-sequence'
        ? dischargeSequenceMarkup(editField, value)
        : inputType === 'yesno'
        ? selectMarkup(editField, value, ['Yes', 'No'])
        : inputType === 'truefalse'
        ? selectMarkup(editField, value, ['True', 'False'])
        : inputType === 'datetime-local'
        ? `<input type="datetime-local" class="form-control" data-operation-field="${esc(editField)}" value="${esc(datetimeLocalValue(value))}">`
        : inputType === 'textarea'
        ? `<textarea class="form-control" data-operation-field="${esc(editField)}" rows="3">${esc(value)}</textarea>`
        : editField
        ? `<input type="text" class="form-control" data-operation-field="${esc(editField)}" value="${esc(value)}">`
        : `<div class="si-detail-value">${esc(value || '-')}</div>`;

      return `
        <div class="si-detail-row">
          <label class="fw-semibold text-muted">${esc(label)}</label>
          ${valueMarkup}
        </div>
      `;
    }).join('');

    const qtyDiscInput = detailBody.querySelector('[data-operation-field="qty_disc"]');
    const rcInput = detailBody.querySelector('[data-operation-field="rc"]');
    const qtyActualInput = detailBody.querySelector('[data-operation-field="qty_actual"]');
    const updateQtyActual = () => {
      if (!qtyActualInput) return;
      const calculatedValue = calculateQtyActual({
        qty_disc: qtyDiscInput?.value,
        rc: rcInput?.value
      });
      qtyActualInput.textContent = calculatedValue || '-';
    };
    qtyDiscInput?.addEventListener('input', updateQtyActual);
    rcInput?.addEventListener('input', updateQtyActual);
    updateQtyActual();

    [
      'arrival_jetty',
      'start_loading',
      'completed_loading',
      'start_mooring',
      'end_mooring',
      'start_disch',
      'completed_disch'
    ].forEach(field => {
      detailBody
        .querySelector(`[data-operation-field="${field}"]`)
        ?.addEventListener('input', () => validateOperationTimelineInputs(false));
    });
    validateOperationTimelineInputs(false);

    const pbmVendorSelect = detailBody.querySelector('[data-operation-field="pbm_vendor"]');
    const floatingCraneSelect = detailBody.querySelector('[data-operation-field="floating_crane"]');
    const applyFloatingCraneRestriction = () => {
      if (!pbmVendorSelect || !floatingCraneSelect) return;

      const requiredFloatingCrane = restrictedFloatingCranes[pbmVendorSelect.value];
      const reservedFloatingCranes = Object.values(restrictedFloatingCranes);

      [...floatingCraneSelect.options].forEach(option => {
        const isReserved = reservedFloatingCranes.includes(option.value);
        const isAllowedReservedOption = option.value === requiredFloatingCrane;
        option.hidden = isReserved && !isAllowedReservedOption;
        option.disabled = isReserved && !isAllowedReservedOption;
      });

      if (requiredFloatingCrane) {
        floatingCraneSelect.value = requiredFloatingCrane;
        floatingCraneSelect.disabled = true;
        floatingCraneSelect.setAttribute('aria-disabled', 'true');
      } else {
        floatingCraneSelect.disabled = false;
        floatingCraneSelect.removeAttribute('aria-disabled');
        if (reservedFloatingCranes.includes(floatingCraneSelect.value)) {
          floatingCraneSelect.value = '';
        }
      }
    };
    pbmVendorSelect?.addEventListener('change', applyFloatingCraneRestriction);
    applyFloatingCraneRestriction();

    bootstrap.Modal.getOrCreateInstance(detailModal).show();
  }

  saveButton.addEventListener('click', async () => {
    if (cfg.readOnly && !cfg.showCycleTimeColumns) return;

    const row = currentRows.find(item => item.id === currentDetailRowId);
    if (!row) return;

    if (!validateOperationTimelineInputs(true)) {
      saveStatus.textContent = 'Please correct the invalid operation time sequence.';
      saveStatus.className = 'me-auto small text-danger';
      return;
    }

    const data = {};
    detailBody.querySelectorAll('[data-operation-field]').forEach(input => {
      data[input.dataset.operationField] = input.matches('input, textarea, select')
        ? input.value.trim()
        : input.textContent.trim() === '-' ? '' : input.textContent.trim();
    });

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    saveStatus.textContent = '';

    try {
      const response = await fetch('7tluoperation.php?action=save_operation_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ sibarges_id: row.id, data })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.msg || 'Gagal menyimpan data operasi.');

      row.operation_data = result.data;
      row.operation_remarks = result.data.operation_remarks || '';
      currentRows = urutkanSesuaiDenganDischargeSequence(currentRows);
      renderTable();

      saveStatus.textContent = result.msg;
      saveStatus.className = 'me-auto small text-success';
    } catch (error) {
      saveStatus.textContent = error.message;
      saveStatus.className = 'me-auto small text-danger';
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save';
    }
  });

  body.addEventListener('click', event => {
    const row = event.target.closest('tr[data-row-id]');
    if (!row) return;
    openDetail(Number(row.dataset.rowId));
  });

  body.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const row = event.target.closest('tr[data-row-id]');
    if (!row) return;

    event.preventDefault();
    openDetail(Number(row.dataset.rowId));
  });
}

createOperationWorkflow({
  year: 'tlu_year', month: 'tlu_month', noPk: 'no_pk',
  box: 'siBargesBox', table: 'dataBargesTable', body: 'siBargesBody',
  downloadCsv: 'downloadOperationCsv', exportCsv: 'exportDataBargesCsv',
  importForm: 'importOperationForm', csvFileInput: 'operationCsvFile',
  importButton: 'importOperationButton', csvStatus: 'operationCsvStatus',
  detailModal: 'siBargesDetailModal', detailSubtitle: 'siBargesDetailSubtitle',
  detailBody: 'siBargesDetailBody', saveButton: 'siBargesSaveButton', saveStatus: 'siBargesSaveStatus'
});

createOperationWorkflow({
  year: 'cycle_year', month: 'cycle_month', noPk: 'cycle_no_pk',
  box: 'cycleTimeBox', table: 'cycleTimeTable', body: 'cycleTimeBody',
  readOnly: true,
  showCycleTimeColumns: true,
  downloadCsv: 'downloadCycleTimeCsv', exportCsv: 'exportCycleTimeCsv',
  importForm: 'importCycleTimeForm', csvFileInput: 'cycleTimeCsvFile',
  importButton: 'importCycleTimeButton', csvStatus: 'cycleTimeCsvStatus',
  detailModal: 'cycleTimeDetailModal', detailSubtitle: 'cycleTimeDetailSubtitle',
  detailBody: 'cycleTimeDetailBody', saveButton: 'cycleTimeSaveButton', saveStatus: 'cycleTimeSaveStatus'
});
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
