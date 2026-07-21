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
  'back_to_jetty'
];

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
    formatDisplayDateTime($row['laycan_start'] ?? '', false),
    formatDisplayDateTime($row['laycan_end'] ?? '', false),
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

  usort($rows, function($left, $right) {
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
  });

  if ($scope === 'vessel') {
    $safeNoPk = preg_replace('/[^A-Za-z0-9._-]+/', '_', $noPk);
    $filename = "tlu_data_barges_{$safeNoPk}.csv";
  } elseif ($scope === 'month') {
    $filename = sprintf('tlu_data_barges_%04d-%02d.csv', $year, $month);
  } elseif ($scope === 'year') {
    $filename = "tlu_data_barges_{$year}.csv";
  } else {
    $filename = 'tlu_data_barges_all.csv';
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
  header('Content-Type: text/csv; charset=utf-8');
  header("Content-Disposition: attachment; filename=\"tlu_operation_{$safeNoPk}.csv\"");
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
      'laycan_start' => formatDisplayDateTime($row['laycan_start'] ?? '', false),
      'laycan_end' => formatDisplayDateTime($row['laycan_end'] ?? '', false),
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

  $submittedData = is_array($payload['data'] ?? null) ? $payload['data'] : [];
  $operationRemarks = trim((string)($submittedData['operation_remarks'] ?? ''));
  $operationData = [];
  foreach (TLU_OPERATION_FIELDS as $field) {
    $value = trim((string)($submittedData[$field] ?? ''));
    if ($value !== '') $operationData[$field] = $value;
  }

  $qtyDisc = parseOperationNumber($submittedData['qty_disc'] ?? '', 'QTY DISC');
  $rc = parseOperationNumber($submittedData['rc'] ?? '', 'RC');
  if ($qtyDisc === null && $rc === null) {
    unset($operationData['qty_actual']);
  } else {
    $operationData['qty_actual'] = formatOperationNumber(($qtyDisc ?? 0) + ($rc ?? 0));
  }

  foreach (TLU_DATETIME_FIELDS as $field => $label) {
    $normalizedDateTime = normalizeOperationDateTime($submittedData[$field] ?? '', $label);
    if ($normalizedDateTime === '') {
      unset($operationData[$field]);
    } else {
      $operationData[$field] = $normalizedDateTime;
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
          <button type="button" class="btn btn-outline-primary tlu-mode-button" id="openExportWorkflow">
            Export CSV
          </button>
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
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h6 class="m-0">Data Barges</h6>
            <div class="small text-muted text-end">
              <div id="siBargesHiddenFields"></div>
              <div id="siBargesCount"></div>
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

  #dataBargesTable {
    width: max-content;
    min-width: 1900px;
    font-size: 15px;
  }

  #dataBargesTable th,
  #dataBargesTable td {
    min-width: 70px;
    padding: 12px 14px;
    white-space: nowrap;
  }

  #dataBargesTable thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: var(--bs-table-bg, #f8f9fa);
  }

  #dataBargesTable th.sortable { white-space: nowrap; }
  #dataBargesTable .th-sort-wrap { display:flex; align-items:center; justify-content:space-between; gap:4px; }
  #dataBargesTable .sort-toggle { text-decoration:none; line-height:1; opacity:.6; border:none; background:transparent; }
  #dataBargesTable th.sortable.sort-active .sort-toggle { opacity:1; font-weight:bold; }
  #dataBargesTable .filter-menu { min-width: 260px; max-height: 80vh; overflow-y: auto; white-space: normal; z-index: 2000; }
  #dataBargesTable .filter-menu .dropdown-header-label { font-weight:bold; font-size:.9rem; color:#212529; padding: .35rem 1rem .15rem; margin:0; }
  #dataBargesTable .filter-menu .sort-option { font-size:.8rem; }
  #dataBargesTable .filter-menu .sort-option.active-sort { font-weight:bold; background-color:#e7f1ff; border-color:#0d6efd; color:#0d6efd; }
  #dataBargesTable .filter-values-list { max-height: 160px; overflow-y: auto; }
  #dataBargesTable .filter-value-item label { cursor:pointer; }
  #dataBargesTable th.sortable.filter-active .sort-toggle { opacity:1; font-weight:bold; }
  #dataBargesTable .freeze-toggle.active { background-color:#0d6efd; border-color:#0d6efd; color:#fff; }
  #dataBargesTable th.frozen-col, #dataBargesTable td.frozen-col { position: sticky; z-index: 2; background-color: #fff; }
  #dataBargesTable thead th.frozen-col { background-color: var(--bs-table-bg, #f8f9fa); z-index: 3; }
  #dataBargesTable th.frozen-col-last, #dataBargesTable td.frozen-col-last { box-shadow: 2px 0 4px -2px rgba(0,0,0,.35); }

  #siBargesBody tr[data-row-id] {
    cursor: pointer;
  }

  #siBargesBody tr[data-row-id]:hover > td {
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
const tluInputWorkflow = document.getElementById('tluInputWorkflow');
const tluExportWorkflow = document.getElementById('tluExportWorkflow');
const openInputWorkflow = document.getElementById('openInputWorkflow');
const openExportWorkflow = document.getElementById('openExportWorkflow');
const tluYearSelect = document.getElementById('tlu_year');
const tluMonthSelect = document.getElementById('tlu_month');
const noPkSelect = document.getElementById('no_pk');
const exportScopeInputs = [...document.querySelectorAll('input[name="tlu_export_scope"]')];
const exportYearGroup = document.getElementById('exportYearGroup');
const exportMonthGroup = document.getElementById('exportMonthGroup');
const exportVesselGroup = document.getElementById('exportVesselGroup');
const exportYearSelect = document.getElementById('export_year');
const exportMonthSelect = document.getElementById('export_month');
const exportNoPkSelect = document.getElementById('export_no_pk');
const downloadGroupedExport = document.getElementById('downloadGroupedExport');
const groupedExportStatus = document.getElementById('groupedExportStatus');
const siBargesBox = document.getElementById('siBargesBox');
const siBargesBody = document.getElementById('siBargesBody');
const siBargesCount = document.getElementById('siBargesCount');
const siBargesHiddenFields = document.getElementById('siBargesHiddenFields');
const siBargesDetailModal = document.getElementById('siBargesDetailModal');
const siBargesDetailSubtitle = document.getElementById('siBargesDetailSubtitle');
const siBargesDetailBody = document.getElementById('siBargesDetailBody');
const siBargesSaveButton = document.getElementById('siBargesSaveButton');
const siBargesSaveStatus = document.getElementById('siBargesSaveStatus');
const downloadOperationCsv = document.getElementById('downloadOperationCsv');
const exportDataBargesCsv = document.getElementById('exportDataBargesCsv');
const importOperationForm = document.getElementById('importOperationForm');
const operationCsvFile = document.getElementById('operationCsvFile');
const importOperationButton = document.getElementById('importOperationButton');
const operationCsvStatus = document.getElementById('operationCsvStatus');
const pbmVendorOptions = <?= json_encode($pbmVendorOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const floatingCraneOptions = <?= json_encode($floatingCraneOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const tluVesselPeriods = <?= json_encode($vessels, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const restrictedFloatingCranes = {
  KTM: 'STV KTM',
  MLS: 'STV MAESTRO'
};
let currentSiBargesRows = [];
let currentDetailRowId = null;
let sortState = { key: null, dir: 0 }; // dir: 0 = default (unsorted), 1 = ascending, -1 = descending
let filters = {}; // key -> { condition, value, excluded:Set(display values), autoApply }
let frozenKey = null; // data-key of the rightmost frozen column (that column + all to its left are frozen), or null

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

function resetSelectedVessel() {
  noPkSelect.value = '';
  noPkSelect.dispatchEvent(new Event('change'));
}

const availableYears = [...new Set(
  tluVesselPeriods.map(vessel => String(vessel.laycan_year))
)].sort((left, right) => Number(right) - Number(left));
replaceSelectOptions(
  tluYearSelect,
  '-- Pilih Tahun --',
  availableYears.map(year => ({ value: year, label: year }))
);
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
  tluInputWorkflow.classList.toggle('d-none', workflow !== 'input');
  tluExportWorkflow.classList.toggle('d-none', workflow !== 'export');
}

openInputWorkflow.addEventListener('click', () => showTluWorkflow('input'));
openExportWorkflow.addEventListener('click', () => {
  updateExportScopeFields();
  showTluWorkflow('export');
});
document.querySelectorAll('.backToTluMode').forEach(button => {
  button.addEventListener('click', () => {
    tluInputWorkflow.classList.add('d-none');
    tluExportWorkflow.classList.add('d-none');
    tluModeSelector.classList.remove('d-none');
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

tluYearSelect.addEventListener('change', () => {
  const selectedYear = tluYearSelect.value;
  const availableMonths = [...new Set(
    tluVesselPeriods
      .filter(vessel => String(vessel.laycan_year) === selectedYear)
      .map(vessel => Number(vessel.laycan_month))
  )].sort((left, right) => left - right);

  replaceSelectOptions(
    tluMonthSelect,
    '-- Pilih Bulan --',
    availableMonths.map(month => ({
      value: String(month),
      label: monthNames[month - 1]
    }))
  );
  tluMonthSelect.disabled = !selectedYear;
  replaceSelectOptions(noPkSelect, '-- Pilih Mother Vessel --', []);
  noPkSelect.disabled = true;
  resetSelectedVessel();
});

tluMonthSelect.addEventListener('change', () => {
  const selectedYear = tluYearSelect.value;
  const selectedMonth = tluMonthSelect.value;
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

const siBargesAvailableHiddenFields = [
  { label: 'No SI Vessel', keys: ['no_si_vessel'] },
  { label: 'Type', keys: ['si_type'] },
  { label: 'Month', keys: ['month_num'] },
  { label: 'Year', keys: ['year_num'] },
  { label: 'Barge Sequence', keys: ['barge_seq'] },
  { label: 'SI Barges', keys: ['si_barges'] },
  { label: 'Anchorage', keys: ['anchorage'] },
  { label: 'Term', keys: ['term'] },
  { label: 'Qty Plan', keys: ['qty_plan'] },
  { label: 'Jetty Name', keys: ['jetty_name'] },
  { label: 'Shipper', keys: ['shipper_code'] },
  { label: 'Shipper Name', keys: ['shipper_name'] },
  { label: 'Status', keys: ['record_status'] },
  {
    label: 'Actual Operation Details',
    keys: [
      'operation_id', 'arrival_jetty', 'commence_loading', 'completed_loading',
      'departure_jetty', 'arrival_anchorage', 'mooring', 'commence_discharging',
      'completed_discharging', 'clear_pass', 'qty_ds', 'flf', 'operation_status',
      'operation_remarks', 'operation_created_by', 'operation_created_at',
      'operation_updated_at'
    ]
  }
];

function updateHiddenFieldsSummary() {
  const visibleFields = new Set(
    [...document.querySelectorAll('#siBargesBox thead [data-field]')]
      .map(header => header.dataset.field)
  );
  const hiddenLabels = siBargesAvailableHiddenFields
    .filter(field => field.keys.every(key => !visibleFields.has(key)))
    .map(field => field.label);

  siBargesHiddenFields.textContent = `Hidden: ${hiddenLabels.join(' / ')}`;
}

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

const formattedNumberFields = new Set(['qty', 'qty_disc', 'rc', 'qty_actual']);
const operationDateTimeFields = new Set(<?= json_encode(array_keys(TLU_DATETIME_FIELDS), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>);

function formatDisplayNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const normalized = text.replaceAll(',', '').replaceAll(' ', '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return text;

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6
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

function displayLaycanDateTime(value) {
  const formatted = fmtDDMonYY(value, false);
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
  const value = formattedNumberFields.has(field)
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

function dischargeSequenceMarkup(field, value) {
  const options = Array.from(
    { length: currentSiBargesRows.length },
    (_, index) => String(index + 1)
  );
  return selectMarkup(field, value, options);
}

function datetimeLocalValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const match = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/);
  if (match) return `${match[1]}T${match[2]}`;

  return parseDDMonYYToISO(text);
}

function validateOperationTimelineInputs(reportError = false) {
  const arrivalJettyInput = siBargesDetailBody.querySelector('[data-operation-field="arrival_jetty"]');
  const startLoadingInput = siBargesDetailBody.querySelector('[data-operation-field="start_loading"]');
  const completedLoadingInput = siBargesDetailBody.querySelector('[data-operation-field="completed_loading"]');
  const startMooringInput = siBargesDetailBody.querySelector('[data-operation-field="start_mooring"]');
  const endMooringInput = siBargesDetailBody.querySelector('[data-operation-field="end_mooring"]');
  const startDischInput = siBargesDetailBody.querySelector('[data-operation-field="start_disch"]');
  const completedDischInput = siBargesDetailBody.querySelector('[data-operation-field="completed_disch"]');
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

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function exportVisibleDataBarges() {
  const headers = [...document.querySelectorAll('#dataBargesTable thead th')]
    .slice(1)
    .map(header => header.dataset.label || header.textContent.trim());
  const dischargeSequenceIndex = headers.indexOf('Discharge Sequence');

  const rows = [...siBargesBody.querySelectorAll('tr[data-row-id]')]
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
  const safeNoPk = noPkSelect.value.trim().replace(/[^A-Za-z0-9._-]+/g, '_');

  link.href = url;
  link.download = `data_barges_discharge_sequence_${safeNoPk || 'export'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  return operationData[key] ?? '';
}

// display value shown in the table cell for a given column (matches rowMarkup)
function columnDisplayValue(row, key) {
  const raw = getFieldValue(row, key);
  if (key === 'laycan_start' || key === 'laycan_end') return fmtDDMonYY(raw, false);
  if (key === 'created_at' || key === 'updated_at') return fmtDDMonYY(raw, true);
  if (operationDateTimeFields.has(key)) return fmtDDMonYY(raw, true);
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

function getFilterState(key) {
  if (!filters[key]) filters[key] = { condition: 'none', value: '', excluded: new Set(), autoApply: true };
  return filters[key];
}

function isFilterActive(key) {
  const f = filters[key];
  if (!f) return false;
  return (f.condition && f.condition !== 'none') || (f.excluded && f.excluded.size > 0);
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

function getUniqueColumnValues(key) {
  const seen = new Set();
  const values = [];
  currentSiBargesRows.forEach(row => {
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
  const filtered = currentSiBargesRows.filter(rowPassesFilters);
  if (!sortState.key || sortState.dir === 0) return filtered;
  const th = document.querySelector(`#dataBargesTable th[data-key="${sortState.key}"]`);
  const type = th ? th.getAttribute('data-type') : 'text';
  const dir = sortState.dir;
  return filtered.sort((a, b)=>{
    const va = getSortValue(a, sortState.key, type);
    const vb = getSortValue(b, sortState.key, type);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

function rowMarkup(row, displayIndex) {
  const operationData = parseOperationData(row.operation_data);
  operationData.qty_actual = calculateQtyActual(operationData);

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
      <td>${displayLaycanDateTime(row.laycan_start)}</td>
      <td>${displayLaycanDateTime(row.laycan_end)}</td>
      ${operationCell(operationData, 'arrival_jetty')}
      ${operationCell(operationData, 'start_loading')}
      ${operationCell(operationData, 'completed_loading')}
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
      ${operationCell(operationData, 'ta_barges_actual')}
      ${operationCell(operationData, 'ta_mv')}
      ${operationCell(operationData, 'ta_flf')}
      ${operationCell(operationData, 'cargo_readiness_actual')}
      ${operationCell(operationData, 'start_disch')}
      ${operationCell(operationData, 'completed_disch')}
      ${operationCell(operationData, 'discharge_sequence')}
      ${operationCell(operationData, 'back_to_jetty')}
      <td>${displayValue(row.operation_remarks)}</td>
      <td>${displayValue(row.created_by)}</td>
      <td>${displayDateTime(row.created_at)}</td>
      <td>${displayDateTime(row.updated_at)}</td>
    </tr>
  `;
}

function renderTable() {
  const displayData = computeDisplayData();
  siBargesBody.innerHTML = displayData.length
    ? displayData.map((row, index) => rowMarkup(row, index)).join('')
    : '<tr><td colspan="99" class="text-center text-muted py-3">Data Barges tidak ditemukan.</td></tr>';
  applyFreezeStyling();
}

function updateSortIndicators() {
  document.querySelectorAll('#dataBargesTable th.sortable').forEach(th=>{
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
    th.querySelectorAll('.sort-option').forEach(opt=>{
      const dir = parseInt(opt.getAttribute('data-dir'), 10);
      opt.classList.toggle('active-sort', active ? dir === sortState.dir : dir === 0);
    });
  });
}

function closeDropdown(th) {
  const toggleBtn = th.querySelector('.sort-toggle');
  if (!toggleBtn) return;
  const dd = bootstrap.Dropdown.getOrCreateInstance(toggleBtn);
  dd.hide();
}

function updateFreezeButtons() {
  document.querySelectorAll('#dataBargesTable th.sortable').forEach(th=>{
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
  const headerRow = document.querySelector('#dataBargesTable thead tr');
  if (!headerRow) return;
  const headerCells = Array.from(headerRow.children);

  headerCells.forEach(th=>{
    th.classList.remove('frozen-col', 'frozen-col-last');
    th.style.left = '';
  });
  document.querySelectorAll('#dataBargesTable tbody tr').forEach(tr=>{
    Array.from(tr.children).forEach(td=>{
      td.classList.remove('frozen-col', 'frozen-col-last');
      td.style.position = '';
      td.style.left = '';
    });
  });

  if (!frozenKey) return;

  const frozenIndex = headerCells.findIndex(th=> th.getAttribute('data-key') === frozenKey);
  if (frozenIndex === -1) return;

  let left = 0;
  for (let i = 0; i <= frozenIndex; i++){
    const th = headerCells[i];
    th.classList.add('frozen-col');
    if (i === frozenIndex) th.classList.add('frozen-col-last');
    th.style.left = `${left}px`;

    document.querySelectorAll('#dataBargesTable tbody tr').forEach(tr=>{
      const td = tr.children[i];
      if (!td) return;
      td.classList.add('frozen-col');
      if (i === frozenIndex) td.classList.add('frozen-col-last');
      td.style.left = `${left}px`;
    });

    left += th.getBoundingClientRect().width;
  }
}
window.addEventListener('resize', ()=> applyFreezeStyling());

function updateSelectAllState(th) {
  const key = th.getAttribute('data-key');
  const f = getFilterState(key);
  const selectAllEl = th.querySelector('.filter-select-all');
  if (!selectAllEl) return;
  const uniqueValues = getUniqueColumnValues(key);
  const excludedCount = uniqueValues.filter(v=> f.excluded.has(v)).length;
  if (excludedCount === 0){ selectAllEl.checked = true; selectAllEl.indeterminate = false; }
  else if (excludedCount === uniqueValues.length){ selectAllEl.checked = false; selectAllEl.indeterminate = false; }
  else { selectAllEl.checked = false; selectAllEl.indeterminate = true; }
}

function buildFilterValuesList(th) {
  const key = th.getAttribute('data-key');
  const f = getFilterState(key);
  const listEl = th.querySelector('.filter-values-list');
  const uniqueValues = getUniqueColumnValues(key);

  listEl.innerHTML = uniqueValues.map(v=>{
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
  th.querySelectorAll('.filter-value-item').forEach(item=> item.classList.remove('d-none'));
}

function initSortableHeaders() {
  document.querySelectorAll('#dataBargesTable th.sortable').forEach(th=>{
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
      </div>`;

    // popper strategy "fixed" escapes the .table-responsive/.data-barges-horizontal-scroll overflow-x:auto
    // clipping (and lets flip-to-top work against the real viewport, not the clipped box)
    const toggleBtn = th.querySelector('.sort-toggle');
    new bootstrap.Dropdown(toggleBtn, {
      popperConfig: (defaultConfig) => ({ ...defaultConfig, strategy: 'fixed' })
    });

    // ----- Freeze -----
    const freezeBtn = th.querySelector('.freeze-toggle');
    freezeBtn.addEventListener('click', ()=>{
      frozenKey = (frozenKey === key) ? null : key;
      updateFreezeButtons();
      applyFreezeStyling();
      closeDropdown(th);
    });

    // ----- Sort -----
    th.querySelectorAll('.sort-option').forEach(opt=>{
      opt.addEventListener('click', (e)=>{
        e.preventDefault();
        const dir = parseInt(opt.getAttribute('data-dir'), 10);
        sortState = dir === 0 ? { key: null, dir: 0 } : { key, dir };
        updateSortIndicators();
        renderTable();
        closeDropdown(th);
      });
    });

    // ----- Filter -----
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

    dropdownWrap.addEventListener('show.bs.dropdown', ()=>{
      syncFilterControls(th);
      buildFilterValuesList(th);
    });

    conditionEl.addEventListener('change', ()=>{
      f.condition = conditionEl.value;
      updateSortIndicators();
      if (f.autoApply) renderTable();
    });

    valueEl.addEventListener('input', ()=>{
      f.value = valueEl.value;
      updateSortIndicators();
      if (f.autoApply) renderTable();
    });

    searchEl.addEventListener('input', ()=>{
      const term = searchEl.value.trim().toLowerCase();
      listEl.querySelectorAll('.filter-value-item').forEach(item=>{
        const val = (item.getAttribute('data-value') || '').toLowerCase();
        item.classList.toggle('d-none', term !== '' && !val.includes(term));
      });
    });

    selectAllEl.addEventListener('change', ()=>{
      const checked = selectAllEl.checked;
      const uniqueValues = getUniqueColumnValues(key);
      uniqueValues.forEach(v=> checked ? f.excluded.delete(v) : f.excluded.add(v));
      listEl.querySelectorAll('.filter-value-checkbox').forEach(cb=> cb.checked = checked);
      selectAllEl.indeterminate = false;
      updateSortIndicators();
      if (f.autoApply) renderTable();
    });

    listEl.addEventListener('change', (e)=>{
      if (!e.target.classList.contains('filter-value-checkbox')) return;
      const item = e.target.closest('.filter-value-item');
      const val = item.getAttribute('data-value');
      if (e.target.checked) f.excluded.delete(val); else f.excluded.add(val);
      updateSelectAllState(th);
      updateSortIndicators();
      if (f.autoApply) renderTable();
    });

    autoApplyEl.addEventListener('change', ()=>{
      f.autoApply = autoApplyEl.checked;
    });

    applyBtn.addEventListener('click', ()=>{
      renderTable();
      updateSortIndicators();
      closeDropdown(th);
    });

    clearBtn.addEventListener('click', ()=>{
      f.condition = 'none';
      f.value = '';
      f.excluded.clear();
      syncFilterControls(th);
      buildFilterValuesList(th);
      updateSortIndicators();
      renderTable();
      closeDropdown(th);
    });
  });
  updateSortIndicators();
  updateFreezeButtons();
}
// deferred: bootstrap.bundle.min.js is loaded later, in includes/footer.php
document.addEventListener('DOMContentLoaded', initSortableHeaders);

updateHiddenFieldsSummary();

async function loadSelectedVessel() {
  const noPk = noPkSelect.value.trim();

  if (!noPk) {
    siBargesBox.classList.add('d-none');
    siBargesBody.innerHTML = '';
    siBargesCount.textContent = '';
    currentSiBargesRows = [];
    exportDataBargesCsv.disabled = true;
    return;
  }

  downloadOperationCsv.href =
    `7tluoperation.php?download=tlu_operation_template&no_pk=${encodeURIComponent(noPk)}`;
  siBargesBox.classList.remove('d-none');
  siBargesCount.textContent = '';
  exportDataBargesCsv.disabled = true;
  siBargesBody.innerHTML = '<tr><td colspan="99" class="text-center text-muted py-3">Loading...</td></tr>';

  try {
    const response = await fetch(
      `7tluoperation.php?action=si_barges_by_vessel&no_pk=${encodeURIComponent(noPk)}`,
      { headers: { 'X-Requested-With': 'XMLHttpRequest' } }
    );
    const result = await response.json();

    if (!result.ok) throw new Error(result.msg || 'Gagal mengambil Data Barges.');

    const rows = result.data || [];
    siBargesCount.textContent = `${rows.length} data`;

    if (!rows.length) {
      siBargesBody.innerHTML = '<tr><td colspan="99" class="text-center text-muted py-3">Data Barges tidak ditemukan.</td></tr>';
      return;
    }

    currentSiBargesRows = urutkanSesuaiDenganDischargeSequence(rows);
    renderTable();
    exportDataBargesCsv.disabled = false;
  } catch (error) {
    siBargesCount.textContent = '';
    exportDataBargesCsv.disabled = true;
    siBargesBody.innerHTML = `<tr><td colspan="99" class="text-center text-danger py-3">${esc(error.message)}</td></tr>`;
  }
}

exportDataBargesCsv.addEventListener('click', exportVisibleDataBarges);

noPkSelect.addEventListener('change', () => {
  operationCsvStatus.classList.add('d-none');
  operationCsvStatus.textContent = '';
  operationCsvFile.value = '';
  loadSelectedVessel();
});

importOperationForm.addEventListener('submit', async event => {
  event.preventDefault();
  const noPk = noPkSelect.value.trim();
  if (!noPk || !operationCsvFile.files.length) return;

  const formData = new FormData();
  formData.append('no_pk', noPk);
  formData.append('csv', operationCsvFile.files[0]);

  importOperationButton.disabled = true;
  importOperationButton.textContent = 'Importing...';
  operationCsvStatus.className = 'alert d-none mt-3 mb-0';

  try {
    const response = await fetch('7tluoperation.php?action=import_operation_csv', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: formData
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.msg || 'Import CSV gagal.');

    operationCsvStatus.textContent = result.msg;
    operationCsvStatus.className =
      `alert ${result.partial ? 'alert-warning' : 'alert-success'} mt-3 mb-0`;
    operationCsvFile.value = '';
    await loadSelectedVessel();
  } catch (error) {
    operationCsvStatus.textContent = error.message;
    operationCsvStatus.className = 'alert alert-danger mt-3 mb-0';
  } finally {
    importOperationButton.disabled = false;
    importOperationButton.textContent = 'Import CSV';
  }
});

function openSiBargesDetail(rowId) {
  const row = currentSiBargesRows.find(item => item.id === rowId);
  if (!row) return;

  const tableRow = siBargesBody.querySelector(`tr[data-row-id="${rowId}"]`);
  if (!tableRow) return;

  const headers = [...document.querySelectorAll('#dataBargesTable thead th')];
  const cells = [...tableRow.cells]
    .map(cell => cell.textContent.trim());

  currentDetailRowId = rowId;
  siBargesSaveStatus.textContent = '';
  siBargesSaveStatus.className = 'me-auto small';
  siBargesDetailSubtitle.textContent = `${row.si_barges || '-'} — ${row.mothervessel || '-'}`;
  siBargesDetailBody.innerHTML = headers.map((header, index) => {
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

  const qtyDiscInput = siBargesDetailBody.querySelector('[data-operation-field="qty_disc"]');
  const rcInput = siBargesDetailBody.querySelector('[data-operation-field="rc"]');
  const qtyActualInput = siBargesDetailBody.querySelector('[data-operation-field="qty_actual"]');
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
    siBargesDetailBody
      .querySelector(`[data-operation-field="${field}"]`)
      ?.addEventListener('input', () => validateOperationTimelineInputs(false));
  });
  validateOperationTimelineInputs(false);

  const pbmVendorSelect = siBargesDetailBody.querySelector('[data-operation-field="pbm_vendor"]');
  const floatingCraneSelect = siBargesDetailBody.querySelector('[data-operation-field="floating_crane"]');
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

  bootstrap.Modal.getOrCreateInstance(siBargesDetailModal).show();
}

siBargesSaveButton.addEventListener('click', async () => {
  const row = currentSiBargesRows.find(item => item.id === currentDetailRowId);
  if (!row) return;

  if (!validateOperationTimelineInputs(true)) {
    siBargesSaveStatus.textContent = 'Please correct the invalid operation time sequence.';
    siBargesSaveStatus.className = 'me-auto small text-danger';
    return;
  }

  const data = {};
  siBargesDetailBody.querySelectorAll('[data-operation-field]').forEach(input => {
    data[input.dataset.operationField] = input.matches('input, textarea, select')
      ? input.value.trim()
      : input.textContent.trim() === '-' ? '' : input.textContent.trim();
  });

  siBargesSaveButton.disabled = true;
  siBargesSaveButton.textContent = 'Saving...';
  siBargesSaveStatus.textContent = '';

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
    currentSiBargesRows = urutkanSesuaiDenganDischargeSequence(currentSiBargesRows);
    renderTable();

    siBargesSaveStatus.textContent = result.msg;
    siBargesSaveStatus.className = 'me-auto small text-success';
  } catch (error) {
    siBargesSaveStatus.textContent = error.message;
    siBargesSaveStatus.className = 'me-auto small text-danger';
  } finally {
    siBargesSaveButton.disabled = false;
    siBargesSaveButton.textContent = 'Save';
  }
});

siBargesBody.addEventListener('click', event => {
  const row = event.target.closest('tr[data-row-id]');
  if (!row) return;
  openSiBargesDetail(Number(row.dataset.rowId));
});

siBargesBody.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  const row = event.target.closest('tr[data-row-id]');
  if (!row) return;

  event.preventDefault();
  openSiBargesDetail(Number(row.dataset.rowId));
});
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
