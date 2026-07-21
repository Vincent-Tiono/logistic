<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

require_once __DIR__ . '/../config/database.php';

const COAL_BARGING_SOURCE_DATABASE = 'databarging';
const COAL_BARGING_DATABASE = 'datacoalbarging';
const COAL_BARGING_OPERATION_TABLE = 'coal_barge_operations';
const COAL_BARGING_RC_TABLE = 'coal_barge_rc_rows';
const COAL_BARGING_DELETED_TABLE = 'coal_barge_deleted_rows';

try {
  $koneksi = db_connect(COAL_BARGING_SOURCE_DATABASE);
} catch (RuntimeException $exception) {
  http_response_code(500);
  die(htmlspecialchars($exception->getMessage(), ENT_QUOTES, 'UTF-8'));
}

function ensureCoalBargingDatabase(): void
{
  $host = getenv('DB_HOST') ?: '127.0.0.1';
  $port = (int) (getenv('DB_PORT') ?: 3306);
  $user = getenv('DB_USER') ?: 'logistic_app';
  $password = getenv('DB_PASS');

  if ($password === false || $password === '') {
    throw new RuntimeException('DB_PASS belum diatur.');
  }

  $server = new mysqli($host, $user, $password, '', $port);
  $server->set_charset('utf8mb4');
  $server->query(
    "CREATE DATABASE IF NOT EXISTS `" . COAL_BARGING_DATABASE . "` " .
    "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  );
  $server->select_db(COAL_BARGING_DATABASE);
  $server->query("
    CREATE TABLE IF NOT EXISTS `" . COAL_BARGING_OPERATION_TABLE . "` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `sibarges_id` bigint unsigned NOT NULL,
      `operation_data` json DEFAULT NULL,
      `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
      `created_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uq_coal_barge_operations_sibarges` (`sibarges_id`),
      KEY `idx_coal_barge_operations_created_at` (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");
  $server->query("
    CREATE TABLE IF NOT EXISTS `" . COAL_BARGING_RC_TABLE . "` (
      `id` bigint unsigned NOT NULL AUTO_INCREMENT,
      `source_sibarges_id` bigint unsigned NOT NULL,
      `usage_status` enum('used','unused') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'used',
      `operation_data` json DEFAULT NULL,
      `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
      `created_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_coal_barge_rc_usage_status` (`usage_status`),
      KEY `idx_coal_barge_rc_source_sibarges` (`source_sibarges_id`),
      KEY `idx_coal_barge_rc_created_at` (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");
  $statusColumn = $server->query("SHOW COLUMNS FROM `" . COAL_BARGING_RC_TABLE . "` LIKE 'usage_status'");
  if ($statusColumn && $statusColumn->num_rows === 0) {
    $server->query("
      ALTER TABLE `" . COAL_BARGING_RC_TABLE . "`
      ADD COLUMN `usage_status` enum('used','unused') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'used' AFTER `source_sibarges_id`,
      ADD KEY `idx_coal_barge_rc_usage_status` (`usage_status`)
    ");
  }
  $server->query("
    CREATE TABLE IF NOT EXISTS `" . COAL_BARGING_DELETED_TABLE . "` (
      `sibarges_id` bigint unsigned NOT NULL,
      `deleted_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
      `deleted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`sibarges_id`),
      KEY `idx_coal_barge_deleted_at` (`deleted_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ");
  $server->close();
}

function seedCoalBargingFromTlu(mysqli $coalConnection): void
{
  $coalConnection->query("
    INSERT INTO `" . COAL_BARGING_OPERATION_TABLE . "`
      (sibarges_id, operation_data, remarks, created_by, created_at, updated_at)
    SELECT
      tlu.sibarges_id,
      tlu.operation_data,
      tlu.remarks,
      tlu.created_by,
      tlu.created_at,
      tlu.updated_at
    FROM `" . COAL_BARGING_SOURCE_DATABASE . "`.`barge_operations` tlu
    LEFT JOIN `" . COAL_BARGING_OPERATION_TABLE . "` coal
      ON coal.sibarges_id = tlu.sibarges_id
    WHERE coal.sibarges_id IS NULL
  ");
}

try {
  ensureCoalBargingDatabase();
  $coalKoneksi = db_connect(COAL_BARGING_DATABASE);
  seedCoalBargingFromTlu($coalKoneksi);
} catch (Throwable $exception) {
  http_response_code(500);
  die(htmlspecialchars('Koneksi database Coal Barging gagal: ' . $exception->getMessage(), ENT_QUOTES, 'UTF-8'));
}

function jsonOut($data){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data);
  exit;
}

const TLU_OPERATION_FIELDS = [
  'status_act_rc',
  'status_act_act_rc',
  'qty',
  'qty_disc',
  'rc',
  'qty_actual',
  'pbm_vendor',
  'floating_crane',
  'arrival_jetty',
  'date_jetty',
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
  'sts_spb' => 'STS/ SPB',
  'start_mooring' => 'Start mooring',
  'end_mooring' => 'End mooring',
  'clear_pass' => 'Clear pass',
  'start_mooring_clear_pass' => 'Start Mooring clear pass',
  'cast_off_mooring_clear_pass' => 'Cast off mooring clear pass',
  'ta_barges_actual' => 'TA Barges Actual',
  'ta_mv' => 'TA MV',
  'ta_flf' => 'TA FLF',
  'cargo_readiness_actual' => 'Cargo Readiness Actual',
  'start_disch' => 'Start Disch',
  'completed_disch' => 'Completed Disch',
  'back_to_jetty' => 'Back to jetty'
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
  'POD MV',
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
  'STS/ SPB',
  'Start mooring',
  'End mooring',
  'Mooring Place 1',
  'Clear pass',
  'Start Mooring clear pass',
  'Cast off mooring clear pass',
  'Mooring Place 2',
  'TA Barges Actual',
  'TA MV',
  'TA FLF',
  'Cargo Readiness Actual',
  'Start Disch',
  'Completed Disch',
  'Discharge Sequence',
  'Back to jetty',
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

function operationNumberValue($value): ?float {
  $normalized = str_replace([',', ' '], ['', ''], trim((string)$value));
  return $normalized !== '' && is_numeric($normalized) ? (float)$normalized : null;
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

function tableExportRow($row) {
  $data = decodeOperationData($row['operation_data'] ?? '');
  $qtyDisc = trim((string)($data['qty_disc'] ?? ''));
  $rc = trim((string)($data['rc'] ?? ''));
  $qtyActual = trim((string)($data['qty_actual'] ?? ''));

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
      p.earliest_laycan_start,
      COALESCE(coal.operation_data, tlu.operation_data) AS operation_data,
      COALESCE(coal.remarks, tlu.remarks) AS operation_remarks
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
    LEFT JOIN barge_operations tlu ON tlu.sibarges_id = s.id
    LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_OPERATION_TABLE . "` coal ON coal.sibarges_id = s.id
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
      COALESCE(coal.operation_data, tlu.operation_data) AS operation_data,
      COALESCE(coal.remarks, tlu.remarks) AS operation_remarks
    FROM sibarges s
    LEFT JOIN barge_operations tlu ON tlu.sibarges_id = s.id
    LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_OPERATION_TABLE . "` coal ON coal.sibarges_id = s.id
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
    $data = decodeOperationData($row['operation_data'] ?? '');
    $qtyDisc = trim((string)($data['qty_disc'] ?? ''));
    $rc = trim((string)($data['rc'] ?? ''));
    $qtyActual = trim((string)($data['qty_actual'] ?? ''));

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

/* ========= AJAX: SAVE COAL BARGING ========= */
if (($_GET['action'] ?? '') === 'save_operation_data' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $payload = json_decode(file_get_contents('php://input'), true);
  if (!is_array($payload)) jsonOut(['ok' => false, 'msg' => 'Payload tidak valid.']);

  $rowType = ($payload['row_type'] ?? '') === 'rc' ? 'rc' : 'base';
  $sibargesId = filter_var($payload['sibarges_id'] ?? null, FILTER_VALIDATE_INT);
  $rcRowId = filter_var($payload['rc_row_id'] ?? null, FILTER_VALIDATE_INT);
  if ($rowType === 'rc') {
    if (!$rcRowId) jsonOut(['ok' => false, 'msg' => 'Data RC tidak valid.']);
  } elseif (!$sibargesId) {
    jsonOut(['ok' => false, 'msg' => 'Data barge tidak valid.']);
  }

  $submittedData = is_array($payload['data'] ?? null) ? $payload['data'] : [];
  $operationRemarks = trim((string)($submittedData['operation_remarks'] ?? ''));
  $operationData = [];
  foreach (TLU_OPERATION_FIELDS as $field) {
    $value = trim((string)($submittedData[$field] ?? ''));
    if ($value !== '') $operationData[$field] = $value;
  }

  if ($rowType === 'rc') {
    foreach (['no_pk', 'buyer', 'mothervessel'] as $field) {
      $value = trim((string)($submittedData[$field] ?? ''));
      if ($value === '') {
        unset($operationData[$field]);
      } else {
        $operationData[$field] = $value;
      }
    }
  }

  $qtyDisc = parseOperationNumber($submittedData['qty_disc'] ?? '', 'QTY DISC');
  $rc = parseOperationNumber($submittedData['rc'] ?? '', 'RC');
  $qtyActual = parseOperationNumber($submittedData['qty_actual'] ?? '', 'QTY Laut');
  if ($qtyActual === null) {
    unset($operationData['qty_actual']);
  } else {
    $operationData['qty_actual'] = formatOperationNumber($qtyActual);
  }

  foreach (TLU_DATETIME_FIELDS as $field => $label) {
    $normalizedDateTime = normalizeOperationDateTime($submittedData[$field] ?? '', $label);
    if ($normalizedDateTime === '') {
      unset($operationData[$field]);
    } else {
      $operationData[$field] = $normalizedDateTime;
    }
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

  if ($rowType === 'rc') {
    $check = $coalKoneksi->prepare("
      SELECT rc.id, rc.source_sibarges_id AS sibarges_id, s.no_pk
      FROM `" . COAL_BARGING_RC_TABLE . "` rc
      INNER JOIN `" . COAL_BARGING_SOURCE_DATABASE . "`.`sibarges` s
        ON s.id = rc.source_sibarges_id
      WHERE rc.id = ?
        AND s.record_status = 'ACT'
      LIMIT 1
    ");
    if (!$check) jsonOut(['ok' => false, 'msg' => $coalKoneksi->error]);
    $check->bind_param('i', $rcRowId);
  } else {
    $check = $koneksi->prepare("SELECT id, no_pk FROM sibarges WHERE id = ? AND record_status = 'ACT'");
    if (!$check) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
    $check->bind_param('i', $sibargesId);
  }
  $check->execute();
  $exists = $check->get_result()->fetch_assoc();
  $check->close();
  if (!$exists) jsonOut(['ok' => false, 'msg' => $rowType === 'rc' ? 'Data RC tidak ditemukan.' : 'Data barge tidak ditemukan.']);

  $sequence = trim((string)($submittedData['discharge_sequence'] ?? ''));
  if ($sequence !== '') {
    $countStmt = $koneksi->prepare("
      SELECT
        COUNT(*) + (
          SELECT COUNT(*)
          FROM `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_RC_TABLE . "` rc
          INNER JOIN sibarges s2
            ON s2.id = rc.source_sibarges_id
          WHERE s2.no_pk = ?
            AND s2.record_status = 'ACT'
            AND rc.usage_status = 'used'
        ) AS max_sequence
      FROM sibarges
      WHERE no_pk = ? AND record_status = 'ACT'
    ");
    if (!$countStmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
    $countStmt->bind_param('ss', $exists['no_pk'], $exists['no_pk']);
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
  if ($rowType === 'rc') {
    $stmt = $coalKoneksi->prepare("
      UPDATE `" . COAL_BARGING_RC_TABLE . "`
      SET operation_data = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    ");
  } else {
    $stmt = $coalKoneksi->prepare("
      INSERT INTO `" . COAL_BARGING_OPERATION_TABLE . "` (sibarges_id, operation_data, remarks, created_by)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        operation_data = VALUES(operation_data),
        remarks = VALUES(remarks),
        updated_at = CURRENT_TIMESTAMP
    ");
  }
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $coalKoneksi->error]);

  if ($rowType === 'rc') {
    $stmt->bind_param('ssi', $operationJson, $operationRemarks, $rcRowId);
  } else {
    $stmt->bind_param('isss', $sibargesId, $operationJson, $operationRemarks, $createdBy);
  }
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

/* ========= AJAX: CREATE RC ROW ========= */
if (($_GET['action'] ?? '') === 'create_rc_row' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $payload = json_decode(file_get_contents('php://input'), true);
  if (!is_array($payload)) jsonOut(['ok' => false, 'msg' => 'Payload tidak valid.']);

  $sibargesId = filter_var($payload['sibarges_id'] ?? null, FILTER_VALIDATE_INT);
  if (!$sibargesId) jsonOut(['ok' => false, 'msg' => 'Data barge tidak valid.']);

  $stmt = $koneksi->prepare("
    SELECT
      s.id,
      s.no_pk,
      s.buyer,
      s.mothervessel,
      COALESCE(coal.operation_data, tlu.operation_data) AS operation_data,
      COALESCE(coal.remarks, tlu.remarks) AS operation_remarks
    FROM sibarges s
    LEFT JOIN barge_operations tlu ON tlu.sibarges_id = s.id
    LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_OPERATION_TABLE . "` coal
      ON coal.sibarges_id = s.id
    WHERE s.id = ?
      AND s.record_status = 'ACT'
    LIMIT 1
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
  $stmt->bind_param('i', $sibargesId);
  $stmt->execute();
  $source = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$source) jsonOut(['ok' => false, 'msg' => 'Data barge tidak ditemukan.']);

  $submittedData = is_array($payload['data'] ?? null)
    ? $payload['data']
    : decodeOperationData($payload['operation_data'] ?? '');
  $operationData = [];
  foreach (TLU_OPERATION_FIELDS as $field) {
    $value = trim((string)($submittedData[$field] ?? ''));
    if ($value !== '') $operationData[$field] = $value;
  }

  foreach (TLU_DATETIME_FIELDS as $field => $label) {
    $normalizedDateTime = normalizeOperationDateTime($submittedData[$field] ?? '', $label);
    if ($normalizedDateTime === '') {
      unset($operationData[$field]);
    } else {
      $operationData[$field] = $normalizedDateTime;
    }
  }

  $sourceQtyJetty = operationNumberValue($submittedData['qty'] ?? null);
  $sourceQtyDisc = operationNumberValue($submittedData['qty_disc'] ?? null);
  $sourceQtyLaut = operationNumberValue($submittedData['qty_actual'] ?? null);

  $operationData['qty'] = '0';
  $operationData['qty_disc'] = formatOperationNumber(($sourceQtyJetty ?? 0) - ($sourceQtyDisc ?? 0));
  $operationData['qty_actual'] = formatOperationNumber(($sourceQtyJetty ?? 0) - ($sourceQtyLaut ?? 0));
  $operationData['status_act_rc'] = 'RC';
  $operationData['status_act_act_rc'] = 'ACT&RC';
  unset(
    $operationData['no_pk'],
    $operationData['buyer'],
    $operationData['mothervessel'],
    $operationData['pbm_vendor'],
    $operationData['floating_crane'],
    $operationData['start_disch'],
    $operationData['completed_disch']
  );

  $remarks = trim((string)($payload['operation_remarks'] ?? ''));
  $operationJson = json_encode($operationData, JSON_UNESCAPED_UNICODE);
  $createdBy = (string)$_SESSION['username'];

  $sourceOperationData = decodeOperationData($source['operation_data'] ?? '');
  $sourceOperationData['status_act_act_rc'] = 'ACT&RC';
  $sourceOperationJson = json_encode($sourceOperationData, JSON_UNESCAPED_UNICODE);
  $sourceRemarks = trim((string)($source['operation_remarks'] ?? ''));

  try {
    $coalKoneksi->begin_transaction();

    $stmt = $coalKoneksi->prepare("
      INSERT INTO `" . COAL_BARGING_OPERATION_TABLE . "` (sibarges_id, operation_data, remarks, created_by)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        operation_data = VALUES(operation_data),
        remarks = VALUES(remarks),
        updated_at = CURRENT_TIMESTAMP
    ");
    if (!$stmt) throw new RuntimeException($coalKoneksi->error);
    $stmt->bind_param('isss', $sibargesId, $sourceOperationJson, $sourceRemarks, $createdBy);
    $stmt->execute();
    $stmt->close();

    $stmt = $coalKoneksi->prepare("
      INSERT INTO `" . COAL_BARGING_RC_TABLE . "`
        (source_sibarges_id, usage_status, operation_data, remarks, created_by)
      VALUES (?, 'unused', ?, ?, ?)
    ");
    if (!$stmt) throw new RuntimeException($coalKoneksi->error);
    $stmt->bind_param('isss', $sibargesId, $operationJson, $remarks, $createdBy);
    $stmt->execute();
    $rcRowId = $stmt->insert_id;
    $stmt->close();

    $coalKoneksi->commit();
  } catch (Throwable $exception) {
    $coalKoneksi->rollback();
    jsonOut(['ok' => false, 'msg' => $exception->getMessage()]);
  }

  jsonOut([
    'ok' => true,
    'rc_row_id' => $rcRowId,
    'data' => $operationData,
    'msg' => 'RC berhasil dibuat sebagai unused.'
  ]);
}

/* ========= AJAX: DELETE COAL BARGING ROW ========= */
if (($_GET['action'] ?? '') === 'delete_coal_barging_row' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $payload = json_decode(file_get_contents('php://input'), true);
  if (!is_array($payload)) jsonOut(['ok' => false, 'msg' => 'Payload tidak valid.']);

  $rowType = ($payload['row_type'] ?? '') === 'rc' ? 'rc' : 'base';
  $sibargesId = filter_var($payload['sibarges_id'] ?? null, FILTER_VALIDATE_INT);
  $rcRowId = filter_var($payload['rc_row_id'] ?? null, FILTER_VALIDATE_INT);
  $deletedBy = (string)$_SESSION['username'];

  $deleteScope = ($payload['delete_scope'] ?? '') === 'unused' ? 'unused' : 'main';

  if ($rowType === 'rc') {
    if (!$rcRowId) jsonOut(['ok' => false, 'msg' => 'Data RC tidak valid.']);

    if ($deleteScope === 'unused') {
      $stmt = $coalKoneksi->prepare("
        DELETE FROM `" . COAL_BARGING_RC_TABLE . "`
        WHERE id = ?
          AND usage_status = 'unused'
      ");
      if (!$stmt) jsonOut(['ok' => false, 'msg' => $coalKoneksi->error]);
      $stmt->bind_param('i', $rcRowId);
      $stmt->execute();
      $deleted = $stmt->affected_rows;
      $stmt->close();

      if ($deleted < 1) jsonOut(['ok' => false, 'msg' => 'Data RC tidak ditemukan.']);
      jsonOut(['ok' => true, 'msg' => 'Data RC berhasil dihapus.']);
    }

    $stmt = $coalKoneksi->prepare("
      UPDATE `" . COAL_BARGING_RC_TABLE . "`
      SET usage_status = 'unused',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    ");
    if (!$stmt) jsonOut(['ok' => false, 'msg' => $coalKoneksi->error]);
    $stmt->bind_param('i', $rcRowId);
    $stmt->execute();
    $deleted = $stmt->affected_rows;
    $stmt->close();

    if ($deleted < 1) jsonOut(['ok' => false, 'msg' => 'Data RC tidak ditemukan.']);
    jsonOut(['ok' => true, 'msg' => 'Data RC berhasil dihapus.']);
  }

  if (!$sibargesId) jsonOut(['ok' => false, 'msg' => 'Data barge tidak valid.']);

  $stmt = $koneksi->prepare("SELECT id FROM sibarges WHERE id = ? AND record_status = 'ACT' LIMIT 1");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
  $stmt->bind_param('i', $sibargesId);
  $stmt->execute();
  $source = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$source) jsonOut(['ok' => false, 'msg' => 'Data barge tidak ditemukan.']);

  $stmt = $coalKoneksi->prepare("
    INSERT INTO `" . COAL_BARGING_DELETED_TABLE . "` (sibarges_id, deleted_by)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      deleted_by = VALUES(deleted_by),
      deleted_at = CURRENT_TIMESTAMP
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $coalKoneksi->error]);
  $stmt->bind_param('is', $sibargesId, $deletedBy);
  $stmt->execute();
  $stmt->close();

  $stmt = $coalKoneksi->prepare("
    UPDATE `" . COAL_BARGING_RC_TABLE . "`
    SET usage_status = 'unused', updated_at = CURRENT_TIMESTAMP
    WHERE source_sibarges_id = ?
      AND usage_status = 'used'
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $coalKoneksi->error]);
  $stmt->bind_param('i', $sibargesId);
  $stmt->execute();
  $stmt->close();

  jsonOut(['ok' => true, 'msg' => 'Data berhasil dihapus dari Coal Barging.']);
}

/* ========= AJAX: IMPORT COAL BARGING CSV ========= */
if (($_GET['action'] ?? '') === 'import_from_tlu_operation' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $payload = json_decode(file_get_contents('php://input'), true);
  if (!is_array($payload)) jsonOut(['ok' => false, 'msg' => 'Payload tidak valid.']);

  $noPk = trim((string)($payload['no_pk'] ?? ''));
  if ($noPk === '') jsonOut(['ok' => false, 'msg' => 'Pilih Mother Vessel terlebih dahulu.']);

  $countStmt = $koneksi->prepare("
    SELECT COUNT(*)
    FROM sibarges
    WHERE no_pk = ? AND record_status = 'ACT'
  ");
  if (!$countStmt) jsonOut(['ok' => false, 'msg' => 'Gagal validasi vessel: ' . $koneksi->error]);
  $countStmt->bind_param('s', $noPk);
  $countStmt->execute();
  $countStmt->bind_result($activeBarges);
  $countStmt->fetch();
  $countStmt->close();

  if ((int)$activeBarges === 0) {
    jsonOut(['ok' => false, 'msg' => 'Data SI Barges tidak ditemukan untuk vessel ini.']);
  }

  try {
    $coalKoneksi->begin_transaction();

    $deleteStmt = $coalKoneksi->prepare("
      DELETE coal
      FROM `" . COAL_BARGING_OPERATION_TABLE . "` coal
      INNER JOIN `" . COAL_BARGING_SOURCE_DATABASE . "`.`sibarges` s
        ON s.id = coal.sibarges_id
      WHERE s.no_pk = ?
        AND s.record_status = 'ACT'
    ");
    if (!$deleteStmt) throw new RuntimeException($coalKoneksi->error);
    $deleteStmt->bind_param('s', $noPk);
    $deleteStmt->execute();
    $deleted = $deleteStmt->affected_rows;
    $deleteStmt->close();

    $deleteRcStmt = $coalKoneksi->prepare("
      UPDATE `" . COAL_BARGING_RC_TABLE . "` rc
      INNER JOIN `" . COAL_BARGING_SOURCE_DATABASE . "`.`sibarges` s
        ON s.id = rc.source_sibarges_id
      SET rc.usage_status = 'unused',
          rc.updated_at = CURRENT_TIMESTAMP
      WHERE s.no_pk = ?
        AND s.record_status = 'ACT'
        AND rc.usage_status = 'used'
    ");
    if (!$deleteRcStmt) throw new RuntimeException($coalKoneksi->error);
    $deleteRcStmt->bind_param('s', $noPk);
    $deleteRcStmt->execute();
    $deleted += $deleteRcStmt->affected_rows;
    $deleteRcStmt->close();

    $deleteHiddenStmt = $coalKoneksi->prepare("
      DELETE hidden
      FROM `" . COAL_BARGING_DELETED_TABLE . "` hidden
      INNER JOIN `" . COAL_BARGING_SOURCE_DATABASE . "`.`sibarges` s
        ON s.id = hidden.sibarges_id
      WHERE s.no_pk = ?
        AND s.record_status = 'ACT'
    ");
    if (!$deleteHiddenStmt) throw new RuntimeException($coalKoneksi->error);
    $deleteHiddenStmt->bind_param('s', $noPk);
    $deleteHiddenStmt->execute();
    $deleted += $deleteHiddenStmt->affected_rows;
    $deleteHiddenStmt->close();

    $insertStmt = $coalKoneksi->prepare("
      INSERT INTO `" . COAL_BARGING_OPERATION_TABLE . "`
        (sibarges_id, operation_data, remarks, created_by, created_at, updated_at)
      SELECT
        tlu.sibarges_id,
        tlu.operation_data,
        tlu.remarks,
        tlu.created_by,
        tlu.created_at,
        tlu.updated_at
      FROM `" . COAL_BARGING_SOURCE_DATABASE . "`.`barge_operations` tlu
      INNER JOIN `" . COAL_BARGING_SOURCE_DATABASE . "`.`sibarges` s
        ON s.id = tlu.sibarges_id
      WHERE s.no_pk = ?
        AND s.record_status = 'ACT'
    ");
    if (!$insertStmt) throw new RuntimeException($coalKoneksi->error);
    $insertStmt->bind_param('s', $noPk);
    $insertStmt->execute();
    $inserted = $insertStmt->affected_rows;
    $insertStmt->close();

    $coalKoneksi->commit();
  } catch (Throwable $exception) {
    $coalKoneksi->rollback();
    jsonOut(['ok' => false, 'msg' => 'Import from TLU Operation gagal: ' . $exception->getMessage()]);
  }

  jsonOut([
    'ok' => true,
    'msg' => "Import from TLU Operation selesai. Deleted: {$deleted}, Imported: {$inserted}.",
    'deleted' => $deleted,
    'imported' => $inserted
  ]);
}

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
  $stmtSave = $coalKoneksi->prepare("
    INSERT INTO `" . COAL_BARGING_OPERATION_TABLE . "` (sibarges_id, operation_data, remarks, created_by)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      operation_data = VALUES(operation_data),
      remarks = VALUES(remarks),
      updated_at = CURRENT_TIMESTAMP
  ");
  if (!$stmtFind || !$stmtSave) {
    fclose($fh);
    jsonOut(['ok' => false, 'msg' => 'Prepare import gagal: ' . ($koneksi->error ?: $coalKoneksi->error)]);
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
      $fieldValue = $value($field);
      if ($fieldValue !== '') $operationData[$field] = $fieldValue;
    }

    $qtyDiscRaw = $value('qty_disc');
    $rcRaw = $value('rc');
    $qtyActualRaw = $value('qty_actual');
    $qtyDiscNormalized = str_replace([',', ' '], ['', ''], $qtyDiscRaw);
    $rcNormalized = str_replace([',', ' '], ['', ''], $rcRaw);
    $qtyActualNormalized = str_replace([',', ' '], ['', ''], $qtyActualRaw);
    if ($qtyDiscRaw !== '' && !is_numeric($qtyDiscNormalized)) $rowErrors[] = 'qty_disc harus angka';
    if ($rcRaw !== '' && !is_numeric($rcNormalized)) $rowErrors[] = 'rc harus angka';
    if ($qtyActualRaw !== '' && !is_numeric($qtyActualNormalized)) $rowErrors[] = 'qty_actual harus angka';
    if (!$rowErrors && $qtyActualRaw !== '') {
      $operationData['qty_actual'] = formatOperationNumber((float)$qtyActualNormalized);
    }

    foreach (TLU_DATETIME_FIELDS as $field => $label) {
      $fieldValue = $value($field);
      $normalized = parseOperationDateTimeValue($fieldValue);
      if ($normalized === null) {
        $rowErrors[] = "{$field} tidak valid";
      } elseif ($normalized === '') {
        unset($operationData[$field]);
      } else {
        $operationData[$field] = $normalized;
      }
    }

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

/* ========= AJAX: UNUSED RC OPTIONS ========= */
if (($_GET['action'] ?? '') === 'unused_rc_options') {
  $noPk = trim((string)($_GET['no_pk'] ?? ''));
  if ($noPk === '') jsonOut(['ok' => false, 'msg' => 'No PK wajib dipilih.']);

  $stmt = $koneksi->prepare("
    SELECT
      rc.id AS rc_row_id,
      target.id AS target_sibarges_id,
      target.barge_seq AS target_barge_seq,
      target.jetty_code,
      target.jetty_name,
      target.tugboat AS target_tugboat,
      target.barge AS target_barge,
      target.laycan_start,
      target.laycan_end,
      source.tugboat AS source_tugboat,
      source.barge AS source_barge,
      rc.operation_data,
      rc.remarks AS operation_remarks,
      rc.created_by,
      rc.created_at,
      rc.updated_at
    FROM `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_RC_TABLE . "` rc
    INNER JOIN sibarges source
      ON source.id = rc.source_sibarges_id
      AND source.record_status = 'ACT'
    INNER JOIN sibarges target
      ON target.tugboat = source.tugboat
      AND target.no_pk = ?
      AND target.record_status = 'ACT'
    LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_DELETED_TABLE . "` hidden
      ON hidden.sibarges_id = target.id
    WHERE rc.usage_status = 'unused'
      AND hidden.sibarges_id IS NULL
    ORDER BY target.barge_seq ASC, rc.created_at ASC, rc.id ASC
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
  $stmt->bind_param('s', $noPk);
  $stmt->execute();
  $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $stmt->close();

	  $data = array_map(function($row) {
	    $operationData = decodeOperationData($row['operation_data'] ?? '');
	    return [
	      'rc_row_id' => (int)$row['rc_row_id'],
	      'target_sibarges_id' => (int)$row['target_sibarges_id'],
	      'target_barge_seq' => (int)$row['target_barge_seq'],
	      'row_type' => 'rc',
	      'sibarges_id' => (int)$row['target_sibarges_id'],
	      'no_pk' => $operationData['no_pk'] ?? '',
	      'buyer' => $operationData['buyer'] ?? '',
	      'mothervessel' => $operationData['mothervessel'] ?? '',
	      'jetty_code' => $row['jetty_code'] ?? '',
	      'jetty_name' => $row['jetty_name'] ?? '',
	      'tugboat' => $row['target_tugboat'] ?? '',
      'barge' => $row['target_barge'] ?? '',
      'anchorage' => '',
      'laycan_start' => $row['laycan_start'] ?? '',
      'laycan_end' => $row['laycan_end'] ?? '',
      'operation_data' => $row['operation_data'] ?? '',
      'operation_remarks' => $row['operation_remarks'] ?? '',
      'created_by' => $row['created_by'] ?? '',
      'created_at' => $row['created_at'] ?? '',
      'updated_at' => $row['updated_at'] ?? ''
    ];
  }, $rows);

  jsonOut(['ok' => true, 'data' => $data]);
}

/* ========= AJAX: INPUT UNUSED RC ========= */
if (($_GET['action'] ?? '') === 'input_rc_row' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $payload = json_decode(file_get_contents('php://input'), true);
  if (!is_array($payload)) jsonOut(['ok' => false, 'msg' => 'Payload tidak valid.']);

  $rcRowId = filter_var($payload['rc_row_id'] ?? null, FILTER_VALIDATE_INT);
  $targetSibargesId = filter_var($payload['target_sibarges_id'] ?? null, FILTER_VALIDATE_INT);
  if (!$rcRowId || !$targetSibargesId) jsonOut(['ok' => false, 'msg' => 'Pilihan RC tidak valid.']);

  $stmt = $coalKoneksi->prepare("
    SELECT rc.id, rc.operation_data, source.tugboat AS source_tugboat
    FROM `" . COAL_BARGING_RC_TABLE . "` rc
    INNER JOIN `" . COAL_BARGING_SOURCE_DATABASE . "`.`sibarges` source
      ON source.id = rc.source_sibarges_id
    WHERE rc.id = ?
      AND rc.usage_status = 'unused'
    LIMIT 1
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $coalKoneksi->error]);
  $stmt->bind_param('i', $rcRowId);
  $stmt->execute();
  $rcRow = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$rcRow) jsonOut(['ok' => false, 'msg' => 'RC tidak ditemukan atau sudah digunakan.']);

  $stmt = $koneksi->prepare("
    SELECT
      s.id,
      s.tugboat,
      s.no_pk,
      s.buyer,
      s.mothervessel,
      s.anchorage,
      COALESCE(coal.operation_data, tlu.operation_data) AS operation_data
    FROM sibarges s
    LEFT JOIN barge_operations tlu
      ON tlu.sibarges_id = s.id
    LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_OPERATION_TABLE . "` coal
      ON coal.sibarges_id = s.id
    LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_DELETED_TABLE . "` hidden
      ON hidden.sibarges_id = s.id
    WHERE s.id = ?
      AND s.record_status = 'ACT'
      AND hidden.sibarges_id IS NULL
    LIMIT 1
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);
  $stmt->bind_param('i', $targetSibargesId);
  $stmt->execute();
  $targetRow = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$targetRow) jsonOut(['ok' => false, 'msg' => 'Target TB tidak ditemukan.']);
  if ((string)$targetRow['tugboat'] !== (string)$rcRow['source_tugboat']) {
    jsonOut(['ok' => false, 'msg' => 'RC hanya bisa dipakai untuk TB yang sama.']);
  }

  $operationData = decodeOperationData($rcRow['operation_data'] ?? '');
  foreach (['no_pk', 'buyer', 'mothervessel'] as $field) {
    $operationData[$field] = (string)($targetRow[$field] ?? '');
  }
  $targetOperationData = decodeOperationData($targetRow['operation_data'] ?? '');
  foreach (['pbm_vendor', 'floating_crane', 'start_disch', 'completed_disch'] as $field) {
    $targetValue = trim((string)($targetOperationData[$field] ?? ''));
    if ($targetValue === '') {
      unset($operationData[$field]);
    } else {
      $operationData[$field] = $targetValue;
    }
  }
  $operationJson = json_encode($operationData, JSON_UNESCAPED_UNICODE);

  $stmt = $coalKoneksi->prepare("
    UPDATE `" . COAL_BARGING_RC_TABLE . "`
    SET source_sibarges_id = ?,
        usage_status = 'used',
        operation_data = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND usage_status = 'unused'
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $coalKoneksi->error]);
  $stmt->bind_param('isi', $targetSibargesId, $operationJson, $rcRowId);
  $stmt->execute();
  $updated = $stmt->affected_rows;
  $stmt->close();
  if ($updated < 1) jsonOut(['ok' => false, 'msg' => 'RC gagal dipakai.']);

  jsonOut(['ok' => true, 'msg' => 'RC berhasil dimasukkan.']);
}

/* ========= AJAX: SI BARGES BY MOTHER VESSEL ========= */
if (($_GET['action'] ?? '') === 'si_barges_by_vessel') {
  $no_pk = trim((string)($_GET['no_pk'] ?? ''));
  if ($no_pk === '') jsonOut(['ok' => false, 'msg' => 'No PK wajib dipilih.']);

  $stmt = $koneksi->prepare("
    SELECT *
    FROM (
      SELECT
      s.id AS id,
      s.id AS sibarges_id,
      NULL AS rc_row_id,
      'base' AS row_type,
      0 AS is_rc_clone,
      s.no_pk, s.no_si_vessel, s.buyer, s.mothervessel,
      s.si_type, s.month_num, s.year_num, s.barge_seq, s.si_barges,
      s.tugboat, s.barge, s.anchorage, s.term, s.qty_plan,
      s.laycan_start, s.laycan_end,
      s.jetty_code, s.jetty_name,
      s.shipper_code, s.shipper_name,
      s.record_status, s.remarks,
      s.created_by, s.created_at, s.updated_at,
      coal.id AS operation_id,
      NULL AS arrival_jetty,
      NULL AS commence_loading,
      NULL AS completed_loading,
      NULL AS departure_jetty,
      NULL AS arrival_anchorage,
      NULL AS mooring,
      NULL AS commence_discharging,
      NULL AS completed_discharging,
      NULL AS clear_pass,
      NULL AS qty_ds,
      NULL AS flf,
      NULL AS operation_status,
      COALESCE(coal.operation_data, tlu.operation_data) AS operation_data,
      COALESCE(coal.remarks, tlu.remarks) AS operation_remarks,
      COALESCE(coal.created_by, tlu.created_by) AS operation_created_by,
      COALESCE(coal.created_at, tlu.created_at) AS operation_created_at,
      COALESCE(coal.updated_at, tlu.updated_at) AS operation_updated_at
      FROM sibarges s
      LEFT JOIN barge_operations tlu ON tlu.sibarges_id = s.id
      LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_OPERATION_TABLE . "` coal ON coal.sibarges_id = s.id
      LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_DELETED_TABLE . "` hidden ON hidden.sibarges_id = s.id
      WHERE s.no_pk = ?
        AND s.record_status = 'ACT'
        AND hidden.sibarges_id IS NULL

      UNION ALL

      SELECT
      s.id AS id,
      s.id AS sibarges_id,
      rc.id AS rc_row_id,
      'rc' AS row_type,
      1 AS is_rc_clone,
	      COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.no_pk')), ''), s.no_pk) AS no_pk,
	      s.no_si_vessel,
	      COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.buyer')), ''), s.buyer) AS buyer,
	      COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rc.operation_data, '$.mothervessel')), ''), s.mothervessel) AS mothervessel,
      s.si_type, s.month_num, s.year_num, s.barge_seq, s.si_barges,
      s.tugboat, s.barge, s.anchorage, s.term, s.qty_plan,
      s.laycan_start, s.laycan_end,
      s.jetty_code, s.jetty_name,
      s.shipper_code, s.shipper_name,
      s.record_status, s.remarks,
      s.created_by, s.created_at, s.updated_at,
      rc.id AS operation_id,
      NULL AS arrival_jetty,
      NULL AS commence_loading,
      NULL AS completed_loading,
      NULL AS departure_jetty,
      NULL AS arrival_anchorage,
      NULL AS mooring,
      NULL AS commence_discharging,
      NULL AS completed_discharging,
      NULL AS clear_pass,
      NULL AS qty_ds,
      NULL AS flf,
      NULL AS operation_status,
      rc.operation_data AS operation_data,
      rc.remarks AS operation_remarks,
      rc.created_by AS operation_created_by,
      rc.created_at AS operation_created_at,
      rc.updated_at AS operation_updated_at
      FROM sibarges s
      INNER JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_RC_TABLE . "` rc
        ON rc.source_sibarges_id = s.id
      LEFT JOIN `" . COAL_BARGING_DATABASE . "`.`" . COAL_BARGING_DELETED_TABLE . "` hidden ON hidden.sibarges_id = s.id
      WHERE s.no_pk = ?
        AND s.record_status = 'ACT'
        AND rc.usage_status = 'used'
        AND hidden.sibarges_id IS NULL
    ) coal_rows
    ORDER BY barge_seq ASC, sibarges_id ASC, is_rc_clone DESC, rc_row_id ASC
  ");
  if (!$stmt) jsonOut(['ok' => false, 'msg' => $koneksi->error]);

  $stmt->bind_param('ss', $no_pk, $no_pk);
  $stmt->execute();
  $res = $stmt->get_result();
  $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
  $stmt->close();

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
$pageTitle = "Coal Barging";

/* ========= LAYOUT ========= */
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<main class="main">
  <div class="content">

    <div class="d-flex align-items-center justify-content-between mb-3">
      <h4 class="m-0">Coal Barging</h4>
      <!-- <div class="small text-muted">
        Source: SI Barges → Actual Operation (timestamps, movement, ds, flf, dll)
      </div> -->
    </div>

    <div class="card" id="tluModeSelector">
      <div class="card-body py-5">
        <h5 class="text-center mb-4">Pilih Coal Barging</h5>
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
        <h5 class="m-0">Coal Barging — Input</h5>
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
                <h6 class="mb-1">Export / Import CSV</h6>
                <div class="small text-muted">
                  Download data vessel ini, edit di Excel, lalu import kembali. Jangan mengubah kolom si_barges.
                </div>
              </div>
              <div class="d-flex align-items-center flex-wrap gap-2">
                <a class="btn btn-sm btn-outline-primary" id="downloadOperationCsv" href="#">
                  Download CSV
                </a>
                <button type="button" class="btn btn-sm btn-outline-warning flex-shrink-0" id="importFromTluButton" disabled>
                  Import from TLU Operation
                </button>
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

          <div class="border rounded mb-3" id="unusedRcBox">
            <div class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
              <h6 class="m-0">Unused RC</h6>
              <div class="small text-muted" id="unusedRcCount"></div>
            </div>
            <div class="table-responsive data-barges-horizontal-scroll">
              <table class="table table-sm table-bordered align-middle mb-0" id="unusedRcTable">
                <thead class="table-light">
                  <tr>
                    <th>Insert</th>
                    <th>No.</th>
                    <th class="sortable" data-key="month_vessel" data-type="number" data-label="Month Vessel" data-calculated="true">Month Vessel</th>
                    <th class="sortable" data-key="status_act_rc" data-type="text" data-label="Status ACT/RC" data-edit-field="status_act_rc" data-input-type="status-act-rc">Status ACT/RC</th>
                    <th class="sortable" data-key="status_act_act_rc" data-type="text" data-label="Status ACT/ACT&amp;RC" data-edit-field="status_act_act_rc" data-input-type="status-act-act-rc">Status ACT/ACT&RC</th>
                    <th class="sortable" data-key="laycan_start" data-type="date" data-label="Laycan Start" data-field="laycan_start">Laycan Start</th>
                    <th class="sortable" data-key="laycan_end" data-type="date" data-label="Laycan End" data-field="laycan_end">Laycan End</th>
                    <th class="sortable" data-key="arrival_jetty" data-type="date" data-label="Arrival Jetty" data-edit-field="arrival_jetty" data-input-type="datetime-local">Arrival Jetty</th>
                    <th class="sortable" data-key="date_jetty" data-type="date" data-label="Date Jetty" data-edit-field="date_jetty" data-input-type="date">Date Jetty</th>
                    <th class="sortable" data-key="start_loading" data-type="date" data-label="Start Loading" data-edit-field="start_loading" data-input-type="datetime-local">Start Loading</th>
                    <th class="sortable" data-key="completed_loading" data-type="date" data-label="Completed Loading" data-edit-field="completed_loading" data-input-type="datetime-local">Completed Loading</th>
                    <th class="sortable" data-key="jetty_code" data-type="text" data-label="Jetty" data-field="jetty_code">Jetty</th>
                    <th class="sortable" data-key="tugboat" data-type="text" data-label="Tugboat" data-field="tugboat">Tugboat</th>
                    <th class="sortable" data-key="barge" data-type="text" data-label="Barge" data-field="barge">Barge</th>
                    <th class="sortable" data-key="qty" data-type="number" data-label="QTY Jetty" data-edit-field="qty">QTY Jetty</th>
                    <th class="sortable" data-key="qty_disc" data-type="number" data-label="QTY DISC" data-edit-field="qty_disc">QTY DISC</th>
                    <th class="sortable" data-key="qty_actual" data-type="number" data-label="QTY Laut" data-edit-field="qty_actual">QTY Laut</th>
                    <th class="sortable" data-key="dsr_vs_redraft" data-type="number" data-label="DSR VS Redraft" data-calculated="true">DSR VS Redraft</th>
                    <th class="sortable" data-key="no_pk" data-type="text" data-label="No. Reff" data-field="no_pk">No. Reff</th>
                    <th class="sortable" data-key="buyer" data-type="text" data-label="Buyer" data-field="buyer">Buyer</th>
                    <th class="sortable" data-key="mothervessel" data-type="text" data-label="POD MV" data-field="mothervessel">POD MV</th>
                    <th class="sortable" data-key="pbm_vendor" data-type="text" data-label="PBM Vendor" data-edit-field="pbm_vendor" data-input-type="pbm-vendor">PBM Vendor</th>
                    <th class="sortable" data-key="floating_crane" data-type="text" data-label="Floating Crane" data-edit-field="floating_crane" data-input-type="floating-crane">Floating Crane</th>
                    <th class="sortable" data-key="start_disch" data-type="date" data-label="Start Disch" data-edit-field="start_disch" data-input-type="datetime-local">Start Disch</th>
                    <th class="sortable" data-key="completed_disch" data-type="date" data-label="Completed Disch" data-edit-field="completed_disch" data-input-type="datetime-local">Completed Disch</th>
                    <th class="sortable" data-key="anchorage" data-type="text" data-label="Anchorage" data-field="anchorage">Anchorage</th>
                    <th class="sortable" data-key="operation_remarks" data-type="text" data-label="Remarks" data-edit-field="operation_remarks" data-input-type="textarea">Remarks</th>
                    <th class="sortable" data-key="created_by" data-type="text" data-label="Created By" data-field="created_by">Created By</th>
                    <th class="sortable" data-key="created_at" data-type="date" data-label="Created At" data-field="created_at">Created At</th>
                    <th class="sortable" data-key="updated_at" data-type="date" data-label="Updated At" data-field="updated_at">Updated At</th>
                  </tr>
                </thead>
                <tbody id="unusedRcBody">
                  <tr><td colspan="99" class="text-muted text-center py-2">Tidak ada RC unused untuk TB vessel ini.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="d-flex justify-content-end mb-3">
            <button type="button" class="btn btn-sm btn-outline-secondary" id="sortByDischargeSequence" disabled>
              Urutkan sesuai dengan “Discharge Sequence”.
            </button>
          </div>

          <div class="table-responsive data-barges-horizontal-scroll">
            <table class="table table-bordered align-middle mb-0" id="dataBargesTable">
            <thead class="table-light">
              <tr>
                <th>No.</th>
                <th class="sortable" data-key="month_vessel" data-type="number" data-label="Month Vessel" data-calculated="true">Month Vessel</th>
                <th class="sortable" data-key="status_act_rc" data-type="text" data-label="Status ACT/RC" data-edit-field="status_act_rc" data-input-type="status-act-rc">Status ACT/RC</th>
                <th class="sortable" data-key="status_act_act_rc" data-type="text" data-label="Status ACT/ACT&amp;RC" data-edit-field="status_act_act_rc" data-input-type="status-act-act-rc">Status ACT/ACT&RC</th>
                <th class="sortable" data-key="laycan_start" data-type="date" data-label="Laycan Start" data-field="laycan_start">Laycan Start</th>
                <th class="sortable" data-key="laycan_end" data-type="date" data-label="Laycan End" data-field="laycan_end">Laycan End</th>
                <th class="sortable" data-key="arrival_jetty" data-type="date" data-label="Arrival Jetty" data-edit-field="arrival_jetty" data-input-type="datetime-local">Arrival Jetty</th>
                <th class="sortable" data-key="date_jetty" data-type="date" data-label="Date Jetty" data-edit-field="date_jetty" data-input-type="date">Date Jetty</th>
                <th class="sortable" data-key="start_loading" data-type="date" data-label="Start Loading" data-edit-field="start_loading" data-input-type="datetime-local">Start Loading</th>
                <th class="sortable" data-key="completed_loading" data-type="date" data-label="Completed Loading" data-edit-field="completed_loading" data-input-type="datetime-local">Completed Loading</th>
                <th class="sortable" data-key="jetty_code" data-type="text" data-label="Jetty" data-field="jetty_code">Jetty</th>
                <th class="sortable" data-key="tugboat" data-type="text" data-label="Tugboat" data-field="tugboat">Tugboat</th>
                <th class="sortable" data-key="barge" data-type="text" data-label="Barge" data-field="barge">Barge</th>
                <th class="sortable" data-key="qty" data-type="number" data-label="QTY Jetty" data-edit-field="qty">QTY Jetty</th>
                <th class="sortable" data-key="qty_disc" data-type="number" data-label="QTY DISC" data-edit-field="qty_disc">QTY DISC</th>
                <th class="sortable" data-key="qty_actual" data-type="number" data-label="QTY Laut" data-edit-field="qty_actual">QTY Laut</th>
                <th class="sortable" data-key="dsr_vs_redraft" data-type="number" data-label="DSR VS Redraft" data-calculated="true">DSR VS Redraft</th>
                <th class="sortable" data-key="no_pk" data-type="text" data-label="No. Reff" data-field="no_pk">No. Reff</th>
                <th class="sortable" data-key="buyer" data-type="text" data-label="Buyer" data-field="buyer">Buyer</th>
                <th class="sortable" data-key="mothervessel" data-type="text" data-label="POD MV" data-field="mothervessel">POD MV</th>
                <th class="sortable" data-key="pbm_vendor" data-type="text" data-label="PBM Vendor" data-edit-field="pbm_vendor" data-input-type="pbm-vendor">PBM Vendor</th>
                <th class="sortable" data-key="floating_crane" data-type="text" data-label="Floating Crane" data-edit-field="floating_crane" data-input-type="floating-crane">Floating Crane</th>
                <th class="sortable" data-key="start_disch" data-type="date" data-label="Start Disch" data-edit-field="start_disch" data-input-type="datetime-local">Start Disch</th>
                <th class="sortable" data-key="completed_disch" data-type="date" data-label="Completed Disch" data-edit-field="completed_disch" data-input-type="datetime-local">Completed Disch</th>
                <th class="sortable" data-key="anchorage" data-type="text" data-label="Anchorage" data-field="anchorage">Anchorage</th>
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
        <h5 class="m-0">Coal Barging — Export CSV</h5>
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
        <button type="button" class="btn btn-outline-primary" id="siBargesCreateRcButton">Create RC</button>
        <button type="button" class="btn btn-outline-danger" id="siBargesDeleteButton">Delete</button>
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

  #dataBargesTable,
  #unusedRcTable {
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

  #dataBargesTable thead th,
  #unusedRcTable thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background-color: var(--bs-table-bg, #f8f9fa);
  }

  #dataBargesTable th.sortable, #unusedRcTable th.sortable { white-space: nowrap; }
  #dataBargesTable .th-sort-wrap, #unusedRcTable .th-sort-wrap { display:flex; align-items:center; justify-content:space-between; gap:4px; }
  #dataBargesTable .sort-toggle, #unusedRcTable .sort-toggle { text-decoration:none; line-height:1; opacity:.6; border:none; background:transparent; }
  #dataBargesTable th.sortable.sort-active .sort-toggle, #unusedRcTable th.sortable.sort-active .sort-toggle { opacity:1; font-weight:bold; }
  #dataBargesTable .filter-menu, #unusedRcTable .filter-menu { min-width: 260px; max-height: 80vh; overflow-y: auto; white-space: normal; z-index: 2000; }
  #dataBargesTable .filter-menu .dropdown-header-label, #unusedRcTable .filter-menu .dropdown-header-label { font-weight:bold; font-size:.9rem; color:#212529; padding: .35rem 1rem .15rem; margin:0; }
  #dataBargesTable .filter-menu .sort-option, #unusedRcTable .filter-menu .sort-option { font-size:.8rem; }
  #dataBargesTable .filter-menu .sort-option.active-sort, #unusedRcTable .filter-menu .sort-option.active-sort { font-weight:bold; background-color:#e7f1ff; border-color:#0d6efd; color:#0d6efd; }
  #dataBargesTable .filter-values-list, #unusedRcTable .filter-values-list { max-height: 160px; overflow-y: auto; }
  #dataBargesTable .filter-value-item label, #unusedRcTable .filter-value-item label { cursor:pointer; }
  #dataBargesTable th.sortable.filter-active .sort-toggle, #unusedRcTable th.sortable.filter-active .sort-toggle { opacity:1; font-weight:bold; }
  #dataBargesTable .freeze-toggle.active, #unusedRcTable .freeze-toggle.active { background-color:#0d6efd; border-color:#0d6efd; color:#fff; }
  #dataBargesTable th.frozen-col, #dataBargesTable td.frozen-col,
  #unusedRcTable th.frozen-col, #unusedRcTable td.frozen-col { position: sticky; z-index: 2; background-color: #fff; }
  #dataBargesTable thead th.frozen-col, #unusedRcTable thead th.frozen-col { background-color: var(--bs-table-bg, #f8f9fa); z-index: 3; }
  #dataBargesTable th.frozen-col-last, #dataBargesTable td.frozen-col-last,
  #unusedRcTable th.frozen-col-last, #unusedRcTable td.frozen-col-last { box-shadow: 2px 0 4px -2px rgba(0,0,0,.35); }

  #siBargesBody tr[data-row-index],
  #unusedRcBody tr[data-unused-rc-index] {
    cursor: pointer;
  }

  #siBargesBody tr[data-row-index]:hover > td,
  #unusedRcBody tr[data-unused-rc-index]:hover > td {
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
const siBargesCreateRcButton = document.getElementById('siBargesCreateRcButton');
const siBargesDeleteButton = document.getElementById('siBargesDeleteButton');
const siBargesSaveButton = document.getElementById('siBargesSaveButton');
const siBargesSaveStatus = document.getElementById('siBargesSaveStatus');
const downloadOperationCsv = document.getElementById('downloadOperationCsv');
const exportDataBargesCsv = document.getElementById('exportDataBargesCsv');
const sortByDischargeSequence = document.getElementById('sortByDischargeSequence');
const unusedRcBody = document.getElementById('unusedRcBody');
const unusedRcCount = document.getElementById('unusedRcCount');
const importOperationForm = document.getElementById('importOperationForm');
const operationCsvFile = document.getElementById('operationCsvFile');
const importOperationButton = document.getElementById('importOperationButton');
const importFromTluButton = document.getElementById('importFromTluButton');
const operationCsvStatus = document.getElementById('operationCsvStatus');
const pbmVendorOptions = <?= json_encode($pbmVendorOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const floatingCraneOptions = <?= json_encode($floatingCraneOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const tluVesselPeriods = <?= json_encode($vessels, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const restrictedFloatingCranes = {
  KTM: 'STV KTM',
  MLS: 'STV MAESTRO'
};
let currentSiBargesRows = [];
let currentUnusedRcRows = [];
let currentDetailRowIndex = null;
let currentDetailSource = 'main';

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

  window.location.href = `8coalbarging.php?${params.toString()}`;
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
  ['Month Vessel', null],
  ['Status ACT/RC', null],
  ['Status ACT/ACT&RC', null],
  ['No. Reff', 'no_pk'],
  ['Buyer', 'buyer'],
  ['POD MV', 'mothervessel'],
  ['Jetty', 'jetty_code'],
  ['Tugboat', 'tugboat'],
  ['Barge', 'barge'],
  ['QTY Jetty', null],
  ['QTY DISC', null],
  ['QTY Laut', null],
  ['DSR VS Redraft', null],
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
  ['Start Disch', null],
  ['Completed Disch', null],
  ['Anchorage', 'anchorage'],
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

function statusActRcValue(operationData) {
  const value = String(operationData.status_act_rc ?? '').trim().toUpperCase();
  return value === 'RC' ? 'RC' : 'ACT';
}

function statusActRcSelectMarkup(value, rowIndex = null) {
  const selectedValue = value === 'RC' ? 'RC' : 'ACT';
  const rowAttribute = rowIndex === null ? '' : ` data-row-index="${rowIndex}"`;

  return `
    <select class="form-select form-select-sm statusActRcSelect" data-operation-field="status_act_rc"${rowAttribute}>
      <option value="ACT"${selectedValue === 'ACT' ? ' selected' : ''}>ACT</option>
      <option value="RC"${selectedValue === 'RC' ? ' selected' : ''}>RC</option>
    </select>
  `;
}

function statusActActRcValue(operationData) {
  const savedValue = String(operationData.status_act_act_rc ?? '').trim().toUpperCase();
  if (savedValue === 'ACT&RC') return 'ACT&RC';
  if (savedValue === 'ACT') return 'ACT';

  return statusActRcValue(operationData) === 'RC' ? 'ACT&RC' : 'ACT';
}

function statusActActRcSelectMarkup(value, rowIndex = null) {
  const selectedValue = value === 'ACT&RC' ? 'ACT&RC' : 'ACT';
  const rowAttribute = rowIndex === null ? '' : ` data-row-index="${rowIndex}"`;

  return `
    <select class="form-select form-select-sm statusActActRcSelect" data-operation-field="status_act_act_rc"${rowAttribute}>
      <option value="ACT"${selectedValue === 'ACT' ? ' selected' : ''}>ACT</option>
      <option value="ACT&RC"${selectedValue === 'ACT&RC' ? ' selected' : ''}>ACT&RC</option>
    </select>
  `;
}

function monthVesselFromCompletedDisch(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^\d{4}-(\d{2})-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/);
  if (!match) return '';

  return String(Number(match[1]));
}

function parseOperationNumber(value) {
  const normalized = String(value ?? '').replaceAll(',', '').trim();
  if (normalized === '') return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function dateJettyEffectiveValue(operationData) {
  const stored = String(operationData.date_jetty ?? '').trim();
  if (stored) return stored;

  return String(operationData.completed_loading ?? '').trim();
}

function dateJettyDisplayValue(operationData) {
  return fmtDDMonYY(dateJettyEffectiveValue(operationData), false);
}

function dateInputValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = parseDDMonYYToISO(text);
  return parsed ? parsed.slice(0, 10) : '';
}

function dsrVsRedraftRawValue(data) {
  const qtyDisc = parseOperationNumber(data.qty_disc);
  const qtyLaut = parseOperationNumber(data.qty_actual);
  if (qtyDisc === null || qtyLaut === null) return '';

  return qtyDisc - qtyLaut;
}

function calculateDsrVsRedraft(data) {
  const raw = dsrVsRedraftRawValue(data);
  return raw === '' ? '' : formatDisplayNumber(raw);
}

/* ===== Sort / Filter / Freeze (same behavior as Operation/7tluoperation.php Data Barges table) ===== */

// fields stored directly on the row (everything else lives inside operation_data)
const DIRECT_ROW_FIELDS = new Set([
  'no_pk', 'buyer', 'mothervessel', 'jetty_code', 'tugboat', 'barge', 'anchorage',
  'laycan_start', 'laycan_end', 'operation_remarks',
  'created_by', 'created_at', 'updated_at'
]);

function getFieldValue(row, key) {
  if (DIRECT_ROW_FIELDS.has(key)) return row[key] ?? '';
  const operationData = parseOperationData(row.operation_data);
  switch (key) {
    case 'month_vessel': return monthVesselFromCompletedDisch(operationData.completed_disch);
    case 'status_act_rc': return statusActRcValue(operationData);
    case 'status_act_act_rc': return statusActActRcValue(operationData);
    case 'date_jetty': return dateJettyEffectiveValue(operationData);
    case 'dsr_vs_redraft': return dsrVsRedraftRawValue(operationData);
    default: return operationData[key] ?? '';
  }
}

// display value shown in the table cell for a given column (matches rowMarkup)
function columnDisplayValue(row, key) {
  const raw = getFieldValue(row, key);
  if (key === 'laycan_start' || key === 'laycan_end' || key === 'date_jetty') return fmtDDMonYY(raw, false);
  if (key === 'created_at' || key === 'updated_at') return fmtDDMonYY(raw, true);
  if (operationDateTimeFields.has(key)) return fmtDDMonYY(raw, true);
  if (formattedNumberFields.has(key) || key === 'dsr_vs_redraft') return formatDisplayNumber(raw);
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

// creates an independent sort/filter/freeze controller scoped to one table
// (used for both #dataBargesTable and #unusedRcTable, which share the same column set)
function createDataTableController(tableId) {
  const sortState = { key: null, dir: 0 };
  const filters = {};
  let frozenKey = null;

  function getFilterState(key) {
    if (!filters[key]) filters[key] = { condition: 'none', value: '', excluded: new Set(), autoApply: true };
    return filters[key];
  }

  function isFilterActive(key) {
    const f = filters[key];
    if (!f) return false;
    return (f.condition && f.condition !== 'none') || (f.excluded && f.excluded.size > 0);
  }

  function getUniqueColumnValues(rows, key) {
    const seen = new Set();
    const values = [];
    rows.forEach(row => {
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

  // returns { row, index } pairs, where index is the row's position in the
  // full (unfiltered) array — that's the identifier used by data-row-index /
  // data-unused-rc-index, so click handlers keep working after a client-side sort/filter
  function computeDisplayItems(rows) {
    const items = rows
      .map((row, index) => ({ row, index }))
      .filter(item => rowPassesFilters(item.row));
    if (!sortState.key || sortState.dir === 0) return items;
    const th = document.querySelector(`#${tableId} th[data-key="${sortState.key}"]`);
    const type = th ? th.getAttribute('data-type') : 'text';
    const dir = sortState.dir;
    return items.slice().sort((a, b)=>{
      const va = getSortValue(a.row, sortState.key, type);
      const vb = getSortValue(b.row, sortState.key, type);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function updateSortIndicators() {
    document.querySelectorAll(`#${tableId} th.sortable`).forEach(th=>{
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
    document.querySelectorAll(`#${tableId} th.sortable`).forEach(th=>{
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
    const headerRow = document.querySelector(`#${tableId} thead tr`);
    if (!headerRow) return;
    const headerCells = Array.from(headerRow.children);

    headerCells.forEach(th=>{
      th.classList.remove('frozen-col', 'frozen-col-last');
      th.style.left = '';
    });
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr=>{
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

      document.querySelectorAll(`#${tableId} tbody tr`).forEach(tr=>{
        const td = tr.children[i];
        if (!td) return;
        td.classList.add('frozen-col');
        if (i === frozenIndex) td.classList.add('frozen-col-last');
        td.style.left = `${left}px`;
      });

      left += th.getBoundingClientRect().width;
    }
  }

  function updateSelectAllState(th, rows) {
    const key = th.getAttribute('data-key');
    const f = getFilterState(key);
    const selectAllEl = th.querySelector('.filter-select-all');
    if (!selectAllEl) return;
    const uniqueValues = getUniqueColumnValues(rows, key);
    const excludedCount = uniqueValues.filter(v=> f.excluded.has(v)).length;
    if (excludedCount === 0){ selectAllEl.checked = true; selectAllEl.indeterminate = false; }
    else if (excludedCount === uniqueValues.length){ selectAllEl.checked = false; selectAllEl.indeterminate = false; }
    else { selectAllEl.checked = false; selectAllEl.indeterminate = true; }
  }

  function buildFilterValuesList(th, rows) {
    const key = th.getAttribute('data-key');
    const f = getFilterState(key);
    const listEl = th.querySelector('.filter-values-list');
    const uniqueValues = getUniqueColumnValues(rows, key);

    listEl.innerHTML = uniqueValues.map(v=>{
      const checked = f.excluded.has(v) ? '' : 'checked';
      const escaped = esc(v);
      const labelHtml = v === '' ? '<i>(blank)</i>' : escaped;
      return `<div class="form-check filter-value-item" data-value="${escaped}">
        <input class="form-check-input filter-value-checkbox" type="checkbox" ${checked}>
        <label class="form-check-label">${labelHtml}</label>
      </div>`;
    }).join('');

    updateSelectAllState(th, rows);
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

  function initHeaders(getRows, onChange) {
    document.querySelectorAll(`#${tableId} th.sortable`).forEach(th=>{
      const label = th.getAttribute('data-label') || th.textContent.trim();
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
          sortState.key = dir === 0 ? null : key;
          sortState.dir = dir === 0 ? 0 : dir;
          updateSortIndicators();
          onChange();
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
        buildFilterValuesList(th, getRows());
      });

      conditionEl.addEventListener('change', ()=>{
        f.condition = conditionEl.value;
        updateSortIndicators();
        if (f.autoApply) onChange();
      });

      valueEl.addEventListener('input', ()=>{
        f.value = valueEl.value;
        updateSortIndicators();
        if (f.autoApply) onChange();
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
        const uniqueValues = getUniqueColumnValues(getRows(), key);
        uniqueValues.forEach(v=> checked ? f.excluded.delete(v) : f.excluded.add(v));
        listEl.querySelectorAll('.filter-value-checkbox').forEach(cb=> cb.checked = checked);
        selectAllEl.indeterminate = false;
        updateSortIndicators();
        if (f.autoApply) onChange();
      });

      listEl.addEventListener('change', (e)=>{
        if (!e.target.classList.contains('filter-value-checkbox')) return;
        const item = e.target.closest('.filter-value-item');
        const val = item.getAttribute('data-value');
        if (e.target.checked) f.excluded.delete(val); else f.excluded.add(val);
        updateSelectAllState(th, getRows());
        updateSortIndicators();
        if (f.autoApply) onChange();
      });

      autoApplyEl.addEventListener('change', ()=>{
        f.autoApply = autoApplyEl.checked;
      });

      applyBtn.addEventListener('click', ()=>{
        onChange();
        updateSortIndicators();
        closeDropdown(th);
      });

      clearBtn.addEventListener('click', ()=>{
        f.condition = 'none';
        f.value = '';
        f.excluded.clear();
        syncFilterControls(th);
        buildFilterValuesList(th, getRows());
        updateSortIndicators();
        onChange();
        closeDropdown(th);
      });
    });
    updateSortIndicators();
    updateFreezeButtons();
  }

  return { computeDisplayItems, applyFreezeStyling, initHeaders };
}

const mainTableController = createDataTableController('dataBargesTable');
const unusedRcTableController = createDataTableController('unusedRcTable');
window.addEventListener('resize', ()=>{
  mainTableController.applyFreezeStyling();
  unusedRcTableController.applyFreezeStyling();
});
// deferred: bootstrap.bundle.min.js is loaded later, in includes/footer.php
document.addEventListener('DOMContentLoaded', () => {
  mainTableController.initHeaders(() => currentSiBargesRows, renderMainTable);
  unusedRcTableController.initHeaders(() => currentUnusedRcRows, renderUnusedRcTable);
});

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

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function exportVisibleDataBarges() {
  const headers = [...document.querySelectorAll('#dataBargesTable thead th')]
    .slice(1)
    .map(header => header.dataset.label || header.textContent.trim());
  const dischargeSequenceIndex = headers.indexOf('Discharge Sequence');

  const rows = [...siBargesBody.querySelectorAll('tr[data-row-index]')]
    .map((row, originalIndex) => ({
      originalIndex,
      values: [...row.cells].slice(1).map(cell => {
        const value = cell.querySelector('select')?.value?.trim() || cell.textContent.trim();
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
  const baseRows = rows.filter(row => row.row_type !== 'rc');
  const rcRows = rows.filter(row => row.row_type === 'rc');
  const compareRows = (left, right) => {
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

    const leftSourceId = Number(left.sibarges_id ?? left.id) || 0;
    const rightSourceId = Number(right.sibarges_id ?? right.id) || 0;
    if (leftSourceId !== rightSourceId) {
      return leftSourceId - rightSourceId;
    }

    const leftIsRc = Number(left.is_rc_clone) || 0;
    const rightIsRc = Number(right.is_rc_clone) || 0;
    if (leftIsRc !== rightIsRc) {
      return leftIsRc - rightIsRc;
    }

    return (Number(left.rc_row_id) || 0) - (Number(right.rc_row_id) || 0);
  };

  const rcRowsBySource = rcRows.reduce((groups, row) => {
    const sourceId = String(row.sibarges_id ?? row.id);
    if (!groups.has(sourceId)) groups.set(sourceId, []);
    groups.get(sourceId).push(row);
    return groups;
  }, new Map());

  rcRowsBySource.forEach(group => group.sort(compareRows));

  const groupedRows = [];
  const attachedSourceIds = new Set();
  baseRows.sort(compareRows).forEach(row => {
    const sourceId = String(row.sibarges_id ?? row.id);
    const attachedRcRows = rcRowsBySource.get(sourceId) || [];
    groupedRows.push(...attachedRcRows);
    groupedRows.push(row);
    attachedSourceIds.add(sourceId);
  });

  rcRowsBySource.forEach((group, sourceId) => {
    if (!attachedSourceIds.has(sourceId)) groupedRows.push(...group);
  });

  return groupedRows;
}

function mainRowMarkup(row, rowIndex, displayIndex) {
  const operationData = parseOperationData(row.operation_data);
  const dsrVsRedraft = calculateDsrVsRedraft(operationData);
  const monthVessel = monthVesselFromCompletedDisch(operationData.completed_disch);
  const dateJetty = dateJettyDisplayValue(operationData);
  const statusActRc = statusActRcValue(operationData);
  const statusActActRc = statusActActRcValue(operationData);

  return `
    <tr data-row-index="${rowIndex}" tabindex="0" role="button" aria-label="Buka detail ${esc(row.si_barges)}">
      <td>${displayIndex + 1}</td>
      <td>${displayValue(monthVessel)}</td>
      <td>${statusActRcSelectMarkup(statusActRc, rowIndex)}</td>
      <td>${statusActActRcSelectMarkup(statusActActRc, rowIndex)}</td>
      <td>${displayLaycanDateTime(row.laycan_start)}</td>
      <td>${displayLaycanDateTime(row.laycan_end)}</td>
      ${operationCell(operationData, 'arrival_jetty')}
      <td>${displayValue(dateJetty)}</td>
      ${operationCell(operationData, 'start_loading')}
      ${operationCell(operationData, 'completed_loading')}
      <td title="${esc(row.jetty_name)}">${displayValue(row.jetty_code)}</td>
      <td>${displayValue(row.tugboat)}</td>
      <td>${displayValue(row.barge)}</td>
      ${operationCell(operationData, 'qty')}
      ${operationCell(operationData, 'qty_disc')}
      ${operationCell(operationData, 'qty_actual')}
      <td>${displayValue(dsrVsRedraft)}</td>
      <td>${displayValue(row.no_pk)}</td>
      <td>${displayValue(row.buyer)}</td>
      <td>${displayValue(row.mothervessel)}</td>
      ${operationCell(operationData, 'pbm_vendor')}
      ${operationCell(operationData, 'floating_crane')}
      ${operationCell(operationData, 'start_disch')}
      ${operationCell(operationData, 'completed_disch')}
      <td>${displayValue(row.anchorage)}</td>
      <td>${displayValue(row.operation_remarks)}</td>
      <td>${displayValue(row.created_by)}</td>
      <td>${displayDateTime(row.created_at)}</td>
      <td>${displayDateTime(row.updated_at)}</td>
    </tr>
  `;
}

function renderMainTable() {
  const displayItems = mainTableController.computeDisplayItems(currentSiBargesRows);
  siBargesBody.innerHTML = displayItems.length
    ? displayItems.map(({ row, index }, displayIndex) => mainRowMarkup(row, index, displayIndex)).join('')
    : '<tr><td colspan="99" class="text-center text-muted py-3">Data Barges tidak ditemukan.</td></tr>';
  mainTableController.applyFreezeStyling();
}

function renderSiBargesRows(rows) {
  currentSiBargesRows = urutkanSesuaiDenganDischargeSequence(rows);
  renderMainTable();
}

updateHiddenFieldsSummary();

function setUnusedRcMessage(message = 'Tidak ada RC unused untuk TB vessel ini') {
  unusedRcBody.innerHTML = `<tr><td colspan="99" class="text-muted text-center py-2">${esc(message)}</td></tr>`;
  unusedRcCount.textContent = '';
  currentUnusedRcRows = [];
}

function unusedRcRowMarkup(row, rowIndex, displayIndex) {
  const operationData = parseOperationData(row.operation_data);
  const dsrVsRedraft = calculateDsrVsRedraft(operationData);
  const monthVessel = monthVesselFromCompletedDisch(operationData.completed_disch);
  const dateJetty = dateJettyDisplayValue(operationData);
  const statusActRc = statusActRcValue(operationData);
  const statusActActRc = statusActActRcValue(operationData);

  return `
    <tr data-unused-rc-index="${rowIndex}" tabindex="0" role="button" aria-label="Buka detail unused RC ${esc(row.rc_row_id)}">
      <td>
        <button
          type="button"
          class="btn btn-sm btn-outline-primary insertRcRowButton"
          data-rc-row-id="${esc(row.rc_row_id)}"
          data-target-sibarges-id="${esc(row.target_sibarges_id)}"
        >
          Insert
        </button>
      </td>
      <td>${displayIndex + 1}</td>
      <td>${displayValue(monthVessel)}</td>
      <td>${displayValue(statusActRc)}</td>
      <td>${displayValue(statusActActRc)}</td>
      <td>${displayLaycanDateTime(row.laycan_start)}</td>
      <td>${displayLaycanDateTime(row.laycan_end)}</td>
      ${operationCell(operationData, 'arrival_jetty')}
      <td>${displayValue(dateJetty)}</td>
      ${operationCell(operationData, 'start_loading')}
      ${operationCell(operationData, 'completed_loading')}
      <td title="${esc(row.jetty_name)}">${displayValue(row.jetty_code)}</td>
      <td>${displayValue(row.tugboat)}</td>
      <td>${displayValue(row.barge)}</td>
      ${operationCell(operationData, 'qty')}
      ${operationCell(operationData, 'qty_disc')}
      ${operationCell(operationData, 'qty_actual')}
      <td>${displayValue(dsrVsRedraft)}</td>
      <td>${displayValue(row.no_pk)}</td>
      <td>${displayValue(row.buyer)}</td>
      <td>${displayValue(row.mothervessel)}</td>
      ${operationCell(operationData, 'pbm_vendor')}
      ${operationCell(operationData, 'floating_crane')}
      ${operationCell(operationData, 'start_disch')}
      ${operationCell(operationData, 'completed_disch')}
      <td>${displayValue(row.anchorage)}</td>
      <td>${displayValue(row.operation_remarks)}</td>
      <td>${displayValue(row.created_by)}</td>
      <td>${displayDateTime(row.created_at)}</td>
      <td>${displayDateTime(row.updated_at)}</td>
    </tr>
  `;
}

function renderUnusedRcTable() {
  const displayItems = unusedRcTableController.computeDisplayItems(currentUnusedRcRows);
  unusedRcBody.innerHTML = displayItems.length
    ? displayItems.map(({ row, index }, displayIndex) => unusedRcRowMarkup(row, index, displayIndex)).join('')
    : '<tr><td colspan="99" class="text-muted text-center py-2">Tidak ada data yang cocok dengan filter.</td></tr>';
  unusedRcTableController.applyFreezeStyling();
}

function renderUnusedRcRows(rows) {
  currentUnusedRcRows = rows;
  unusedRcCount.textContent = `${rows.length} data`;
  renderUnusedRcTable();
}

async function loadUnusedRcRows(noPk) {
  setUnusedRcMessage('Loading RC unused...');

  try {
    const response = await fetch(
      `8coalbarging.php?action=unused_rc_options&no_pk=${encodeURIComponent(noPk)}`,
      { headers: { 'X-Requested-With': 'XMLHttpRequest' } }
    );
    const result = await response.json();
    if (!result.ok) throw new Error(result.msg || 'Gagal mengambil RC unused.');

    const options = result.data || [];
    if (!options.length) {
      setUnusedRcMessage();
      return;
    }

    renderUnusedRcRows(options);
  } catch (error) {
    setUnusedRcMessage(error.message);
  }
}

async function loadSelectedVessel() {
  const noPk = noPkSelect.value.trim();

  if (!noPk) {
    siBargesBox.classList.add('d-none');
    siBargesBody.innerHTML = '';
    siBargesCount.textContent = '';
    currentSiBargesRows = [];
    exportDataBargesCsv.disabled = true;
    sortByDischargeSequence.disabled = true;
    importFromTluButton.disabled = true;
    setUnusedRcMessage();
    return;
  }

  downloadOperationCsv.href =
    `8coalbarging.php?download=tlu_operation_template&no_pk=${encodeURIComponent(noPk)}`;
  siBargesBox.classList.remove('d-none');
  siBargesCount.textContent = '';
  exportDataBargesCsv.disabled = true;
  sortByDischargeSequence.disabled = true;
  importFromTluButton.disabled = true;
  setUnusedRcMessage('Loading RC unused...');
  siBargesBody.innerHTML = '<tr><td colspan="99" class="text-center text-muted py-3">Loading...</td></tr>';

  try {
    const response = await fetch(
      `8coalbarging.php?action=si_barges_by_vessel&no_pk=${encodeURIComponent(noPk)}`,
      { headers: { 'X-Requested-With': 'XMLHttpRequest' } }
    );
    const result = await response.json();

    if (!result.ok) throw new Error(result.msg || 'Gagal mengambil Data Barges.');

    const rows = result.data || [];
    siBargesCount.textContent = `${rows.length} data`;

    if (!rows.length) {
      siBargesBody.innerHTML = '<tr><td colspan="99" class="text-center text-muted py-3">Data Barges tidak ditemukan.</td></tr>';
      setUnusedRcMessage();
      return;
    }

    renderSiBargesRows(rows);
    exportDataBargesCsv.disabled = false;
    sortByDischargeSequence.disabled = false;
    importFromTluButton.disabled = false;
    await loadUnusedRcRows(noPk);
  } catch (error) {
    siBargesCount.textContent = '';
    exportDataBargesCsv.disabled = true;
    sortByDischargeSequence.disabled = true;
    importFromTluButton.disabled = true;
    setUnusedRcMessage();
    siBargesBody.innerHTML = `<tr><td colspan="99" class="text-center text-danger py-3">${esc(error.message)}</td></tr>`;
  }
}

exportDataBargesCsv.addEventListener('click', exportVisibleDataBarges);
unusedRcBody.addEventListener('click', async event => {
  const button = event.target.closest('.insertRcRowButton');
  if (!button) {
    const row = event.target.closest('tr[data-unused-rc-index]');
    if (!row) return;
    openSiBargesDetail(Number(row.dataset.unusedRcIndex), 'unused');
    return;
  }

  const rcRowId = Number(button.dataset.rcRowId);
  const targetSibargesId = Number(button.dataset.targetSibargesId);
  if (!rcRowId || !targetSibargesId) return;

  event.stopPropagation();
  button.disabled = true;
  button.textContent = 'Inserting...';
  operationCsvStatus.className = 'alert d-none mt-3 mb-0';

  try {
    const response = await fetch('8coalbarging.php?action=input_rc_row', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        rc_row_id: rcRowId,
        target_sibarges_id: targetSibargesId
      })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.msg || 'Insert RC gagal.');

    operationCsvStatus.textContent = result.msg;
    operationCsvStatus.className = 'alert alert-success mt-3 mb-0';
    await loadSelectedVessel();
  } catch (error) {
    operationCsvStatus.textContent = error.message;
    operationCsvStatus.className = 'alert alert-danger mt-3 mb-0';
    button.disabled = false;
  } finally {
    button.textContent = 'Insert';
  }
});

unusedRcBody.addEventListener('keydown', event => {
  if (event.target.closest('.insertRcRowButton')) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;

  const row = event.target.closest('tr[data-unused-rc-index]');
  if (!row) return;

  event.preventDefault();
  openSiBargesDetail(Number(row.dataset.unusedRcIndex), 'unused');
});
sortByDischargeSequence.addEventListener('click', () => {
  if (!currentSiBargesRows.length) return;
  renderSiBargesRows(currentSiBargesRows);
});

siBargesBody.addEventListener('change', async event => {
  const select = event.target.closest('.statusActRcSelect, .statusActActRcSelect');
  if (!select) return;

  const rowIndex = Number(select.dataset.rowIndex);
  const row = currentSiBargesRows[rowIndex];
  if (!row) return;

  const previousData = parseOperationData(row.operation_data);
  const field = select.dataset.operationField;
  const previousStatus = field === 'status_act_act_rc'
    ? statusActActRcValue(previousData)
    : statusActRcValue(previousData);
  const data = {
    ...previousData,
    [field]: field === 'status_act_act_rc'
      ? (select.value === 'ACT&RC' ? 'ACT&RC' : 'ACT')
      : (select.value === 'RC' ? 'RC' : 'ACT'),
    operation_remarks: row.operation_remarks || ''
  };

  select.disabled = true;

  try {
    const response = await fetch('8coalbarging.php?action=save_operation_data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        sibarges_id: row.sibarges_id || row.id,
        row_type: row.row_type === 'rc' ? 'rc' : 'base',
        rc_row_id: Number(row.rc_row_id) || 0,
        data
      })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.msg || 'Gagal menyimpan status.');

    row.operation_data = result.data;
    row.operation_remarks = result.data.operation_remarks || '';
    renderSiBargesRows(currentSiBargesRows);
  } catch (error) {
    select.value = previousStatus;
    operationCsvStatus.textContent = error.message;
    operationCsvStatus.className = 'alert alert-danger mt-3 mb-0';
  } finally {
    select.disabled = false;
  }
});

importFromTluButton.addEventListener('click', async () => {
  const noPk = noPkSelect.value.trim();
  if (!noPk) return;

  const confirmed = confirm(
    'Overwrite semua data Coal Barging untuk vessel ini dari TLU Operation?'
  );
  if (!confirmed) return;

  operationCsvStatus.className = 'alert d-none mt-3 mb-0';
  importFromTluButton.disabled = true;
  importFromTluButton.textContent = 'Importing...';

  try {
    const response = await fetch('8coalbarging.php?action=import_from_tlu_operation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ no_pk: noPk })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.msg || 'Import from TLU Operation gagal.');

    operationCsvStatus.textContent = result.msg;
    operationCsvStatus.className = 'alert alert-success mt-3 mb-0';
    await loadSelectedVessel();
  } catch (error) {
    operationCsvStatus.textContent = error.message;
    operationCsvStatus.className = 'alert alert-danger mt-3 mb-0';
  } finally {
    importFromTluButton.disabled = false;
    importFromTluButton.textContent = 'Import from TLU Operation';
  }
});

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
    const response = await fetch('8coalbarging.php?action=import_operation_csv', {
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

function openSiBargesDetail(rowIndex, source = 'main') {
  const rows = source === 'unused' ? currentUnusedRcRows : currentSiBargesRows;
  const row = rows[rowIndex];
  if (!row) return;

  const tableRow = source === 'unused'
    ? unusedRcBody.querySelector(`tr[data-unused-rc-index="${rowIndex}"]`)
    : siBargesBody.querySelector(`tr[data-row-index="${rowIndex}"]`);
  if (!tableRow) return;

  const headers = source === 'unused'
    ? [...document.querySelectorAll('#unusedRcTable thead th')].slice(1)
    : [...document.querySelectorAll('#dataBargesTable thead th')];
  const cells = [...tableRow.cells]
    .slice(source === 'unused' ? 1 : 0)
    .map(cell => cell.querySelector('select')?.value?.trim() || cell.textContent.trim());

  currentDetailRowIndex = rowIndex;
  currentDetailSource = source;
  siBargesSaveStatus.textContent = '';
  siBargesSaveStatus.className = 'me-auto small';
  siBargesCreateRcButton.classList.toggle('d-none', source === 'unused' || row.row_type === 'rc');
  siBargesCreateRcButton.disabled = source === 'unused' || row.row_type === 'rc';
  siBargesDeleteButton.classList.remove('d-none');
  siBargesDeleteButton.disabled = false;
  siBargesDeleteButton.textContent = 'Delete';
  siBargesSaveButton.textContent = 'Save';
  siBargesSaveButton.disabled = false;
  siBargesDetailSubtitle.textContent = source === 'unused'
    ? `Unused RC #${row.rc_row_id || '-'} — ${row.tugboat || '-'}`
    : `${row.si_barges || '-'} — ${row.mothervessel || '-'}`;
	  siBargesDetailBody.innerHTML = headers.map((header, index) => {
	    const label = header.dataset.label || header.textContent.trim();
	    const editField = header.dataset.editField;
	    const value = cells[index] === '-' ? '' : (cells[index] ?? '');
	    const isCalculated = header.dataset.calculated === 'true';
	    const inputType = header.dataset.inputType;
	    const rcVesselFields = {
	      'No. Reff': 'no_pk',
	      'Buyer': 'buyer',
	      'POD MV': 'mothervessel'
	    };
	    const isRcVesselField = (source === 'unused' || row.row_type === 'rc') && rcVesselFields[label];
	    const calculatedHelp = label === 'DSR VS Redraft'
	      ? 'Dihitung otomatis: QTY DISC - QTY Laut'
	      : 'Dihitung otomatis';
	    const valueMarkup = isRcVesselField
	      ? `<input type="text" class="form-control" data-operation-field="${esc(rcVesselFields[label])}" value="${esc(value)}">`
	      : isCalculated
	      ? `
	        <div>
	          <div class="si-detail-value fw-semibold" data-operation-field="${esc(editField)}">${esc(value || '-')}</div>
          <div class="form-text">${esc(calculatedHelp)}</div>
        </div>
      `
      : inputType === 'pbm-vendor'
      ? selectMarkup(editField, value, pbmVendorOptions)
      : inputType === 'floating-crane'
      ? selectMarkup(editField, value, floatingCraneOptions)
      : inputType === 'status-act-rc'
      ? statusActRcSelectMarkup(value)
      : inputType === 'status-act-act-rc'
      ? statusActActRcSelectMarkup(value)
      : inputType === 'discharge-sequence'
      ? dischargeSequenceMarkup(editField, value)
      : inputType === 'datetime-local'
      ? `<input type="datetime-local" class="form-control" data-operation-field="${esc(editField)}" value="${esc(datetimeLocalValue(value))}">`
      : inputType === 'date'
      ? `<input type="date" class="form-control" data-operation-field="${esc(editField)}" value="${esc(dateInputValue(value))}">`
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
  const qtyActualInput = siBargesDetailBody.querySelector('[data-operation-field="qty_actual"]');
  const dsrVsRedraftRow = [...siBargesDetailBody.querySelectorAll('.si-detail-row')]
    .find(row => row.querySelector('label')?.textContent.trim() === 'DSR VS Redraft');
  const dsrVsRedraftValue = dsrVsRedraftRow?.querySelector('.si-detail-value');
  const updateDsrVsRedraft = () => {
    if (dsrVsRedraftValue) {
      dsrVsRedraftValue.textContent = calculateDsrVsRedraft({
        qty_disc: qtyDiscInput?.value,
        qty_actual: qtyActualInput?.value
      }) || '-';
    }
  };
  qtyDiscInput?.addEventListener('input', updateDsrVsRedraft);
  qtyActualInput?.addEventListener('input', updateDsrVsRedraft);
  updateDsrVsRedraft();

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

function collectSiBargesDetailData() {
  const data = {};
  siBargesDetailBody.querySelectorAll('[data-operation-field]').forEach(input => {
    const field = input.dataset.operationField;
    if (!field || field === 'undefined') return;

    data[field] = input.matches('input, textarea, select')
      ? input.value.trim()
      : input.textContent.trim() === '-' ? '' : input.textContent.trim();
  });
  return data;
}

siBargesSaveButton.addEventListener('click', async () => {
  const activeRows = currentDetailSource === 'unused' ? currentUnusedRcRows : currentSiBargesRows;
  const row = activeRows[currentDetailRowIndex];
  if (!row) return;

  const data = collectSiBargesDetailData();

  siBargesSaveButton.disabled = true;
  siBargesSaveButton.textContent = 'Saving...';
  siBargesSaveStatus.textContent = '';

  try {
    const response = await fetch('8coalbarging.php?action=save_operation_data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        sibarges_id: row.sibarges_id || row.id,
        row_type: row.row_type === 'rc' ? 'rc' : 'base',
        rc_row_id: Number(row.rc_row_id) || 0,
        data
      })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.msg || 'Gagal menyimpan data operasi.');

	    const savedRowId = row.id;
	    const savedRcRowId = Number(row.rc_row_id) || 0;
	    row.operation_data = result.data;
	    row.operation_remarks = result.data.operation_remarks || '';
	    if (row.row_type === 'rc') {
	      row.no_pk = result.data.no_pk || '';
	      row.buyer = result.data.buyer || '';
	      row.mothervessel = result.data.mothervessel || '';
	    }
	    if (currentDetailSource === 'unused') {
	      renderUnusedRcRows(currentUnusedRcRows);
	      currentDetailRowIndex = currentUnusedRcRows.findIndex(item =>
        (Number(item.rc_row_id) || 0) === savedRcRowId
      );
    } else {
      renderSiBargesRows(currentSiBargesRows);
      currentDetailRowIndex = currentSiBargesRows.findIndex(item =>
        Number(item.id) === Number(savedRowId) &&
        (Number(item.rc_row_id) || 0) === savedRcRowId
      );
    }

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

siBargesCreateRcButton.addEventListener('click', async () => {
  if (currentDetailSource !== 'main') return;
  const row = currentSiBargesRows[currentDetailRowIndex];
  if (!row || row.row_type === 'rc') return;

  const data = {
    ...collectSiBargesDetailData(),
    status_act_rc: 'RC',
    status_act_act_rc: 'ACT&RC'
  };

  siBargesCreateRcButton.disabled = true;
  siBargesCreateRcButton.textContent = 'Creating...';
  siBargesSaveStatus.textContent = '';

  try {
    const response = await fetch('8coalbarging.php?action=create_rc_row', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        sibarges_id: row.sibarges_id || row.id,
        data,
        operation_remarks: data.operation_remarks || row.operation_remarks || ''
      })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.msg || 'Gagal membuat RC.');

    siBargesSaveStatus.textContent = result.msg;
    siBargesSaveStatus.className = 'me-auto small text-success';
    bootstrap.Modal.getOrCreateInstance(siBargesDetailModal).hide();
    await loadSelectedVessel();
  } catch (error) {
    siBargesSaveStatus.textContent = error.message;
    siBargesSaveStatus.className = 'me-auto small text-danger';
  } finally {
    siBargesCreateRcButton.disabled = false;
    siBargesCreateRcButton.textContent = 'Create RC';
  }
});

siBargesDeleteButton.addEventListener('click', async () => {
  const activeRows = currentDetailSource === 'unused' ? currentUnusedRcRows : currentSiBargesRows;
  const row = activeRows[currentDetailRowIndex];
  if (!row) return;

  const confirmed = confirm(
    currentDetailSource === 'unused'
      ? 'Hapus data RC unused ini?'
      : 'Hapus data ini dari Coal Barging?'
  );
  if (!confirmed) return;

  siBargesDeleteButton.disabled = true;
  siBargesDeleteButton.textContent = 'Deleting...';
  siBargesSaveStatus.textContent = '';

  try {
    const response = await fetch('8coalbarging.php?action=delete_coal_barging_row', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        sibarges_id: row.sibarges_id || row.id,
        row_type: row.row_type === 'rc' ? 'rc' : 'base',
        rc_row_id: Number(row.rc_row_id) || 0,
        delete_scope: currentDetailSource === 'unused' ? 'unused' : 'main'
      })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.msg || 'Gagal menghapus data.');

    siBargesSaveStatus.textContent = result.msg;
    siBargesSaveStatus.className = 'me-auto small text-success';
    bootstrap.Modal.getOrCreateInstance(siBargesDetailModal).hide();
    await loadSelectedVessel();
  } catch (error) {
    siBargesSaveStatus.textContent = error.message;
    siBargesSaveStatus.className = 'me-auto small text-danger';
  } finally {
    siBargesDeleteButton.disabled = false;
    siBargesDeleteButton.textContent = 'Delete';
  }
});

siBargesBody.addEventListener('click', event => {
  if (event.target.closest('.statusActRcSelect, .statusActActRcSelect')) return;

  const row = event.target.closest('tr[data-row-index]');
  if (!row) return;
  openSiBargesDetail(Number(row.dataset.rowIndex), 'main');
});

siBargesBody.addEventListener('keydown', event => {
  if (event.target.closest('.statusActRcSelect, .statusActActRcSelect')) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;

  const row = event.target.closest('tr[data-row-index]');
  if (!row) return;

  event.preventDefault();
  openSiBargesDetail(Number(row.dataset.rowIndex), 'main');
});
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
