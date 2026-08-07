<?php

function jsonOut($data){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data);
  exit;
}

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
