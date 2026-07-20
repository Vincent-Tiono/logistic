<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

/* ========= SELF PATH ========= */
$SELF = "/logistic/Operation/6sibarges.php";

require_once __DIR__ . '/../config/database.php';

try {
  $koneksi = db_connect('databarging');
} catch (RuntimeException $exception) {
  http_response_code(500);
  die(htmlspecialchars($exception->getMessage(), ENT_QUOTES, 'UTF-8'));
}

/* ========= HELPERS ========= */
function clean($s){ return trim((string)$s); }
function cleanCode($s){ return strtoupper(trim((string)$s)); }

function toDecimal($s){
  $s = clean($s);
  if ($s === "" || $s === "-") return 0;
  $s = str_replace([",", " "], "", $s);
  if (preg_match('/^\d{1,3}(\.\d{3})+$/', $s)) $s = str_replace(".", "", $s);
  return is_numeric($s) ? (float)$s : 0;
}

/**
 * Accept:
 * - YYYY-MM-DD
 * - dd/mmm/yy  (16/Dec/25) or (16/DEC/25)
 * - dd/mmm/yyyy
 */
function parseDateAny($s){
  $s = clean($s);
  if ($s === "") return null;

  // 1) yyyy-mm-dd
  $dt = DateTime::createFromFormat('Y-m-d', $s);
  if ($dt && $dt->format('Y-m-d') === $s) return $dt->format('Y-m-d');

  // normalize separators
  $s2 = str_replace(['-', '.', ' '], '/', $s);
  $parts = explode('/', $s2);

  // 2) dd/mmm/yy or dd/mmm/yyyy
  if (count($parts) === 3) {
    $d = $parts[0];
    $m = strtoupper($parts[1]);
    $y = $parts[2];

    $map = [
      'JAN'=>1,'FEB'=>2,'MAR'=>3,'APR'=>4,'MAY'=>5,'JUN'=>6,
      'JUL'=>7,'AUG'=>8,'SEP'=>9,'OCT'=>10,'NOV'=>11,'DEC'=>12
    ];
    if (isset($map[$m])) {
      $day = (int)$d;
      $mon = (int)$map[$m];
      $year = (int)$y;
      if ($year < 100) $year += 2000;
      if (checkdate($mon, $day, $year)) {
        return sprintf('%04d-%02d-%02d', $year, $mon, $day);
      }
    }
  }

  // fallback strtotime
  $ts = strtotime($s);
  if ($ts !== false) return date('Y-m-d', $ts);
  return null;
}

function addDaysYmd($ymd, $days){
  if (!$ymd) return null;
  $dt = DateTime::createFromFormat('Y-m-d', $ymd);
  if (!$dt) return null;
  $dt->modify(($days >= 0 ? '+' : '').$days.' day');
  return $dt->format('Y-m-d');
}

function romawiBulan($month){
  $arr = [1=>'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  return $arr[(int)$month] ?? '';
}

function jsonOut($arr){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr);
  exit;
}

function ensureDiscardStatusAllowed(mysqli $koneksi){
  $dbName = '';
  $res = $koneksi->query("SELECT DATABASE() AS db_name");
  if ($res) {
    $row = $res->fetch_assoc();
    $dbName = (string)($row['db_name'] ?? '');
  }
  if ($dbName === '') return [false, 'Database aktif tidak ditemukan.'];

  $stmt = $koneksi->prepare("
    SELECT COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA=? AND TABLE_NAME='sibarges' AND COLUMN_NAME='record_status'
    LIMIT 1
  ");
  if (!$stmt) return [false, 'Gagal cek status enum: ' . $koneksi->error];
  $stmt->bind_param("s", $dbName);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  $columnType = (string)($row['COLUMN_TYPE'] ?? '');
  if (strpos($columnType, "'DISCARD'") === false) {
    $ok = $koneksi->query("ALTER TABLE sibarges MODIFY record_status enum('ACT','CANCEL','DISCARD') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACT'");
    if (!$ok) return [false, 'Gagal update enum record_status: ' . $koneksi->error];
  }

  /*
   * A discarded row keeps its original SI number for audit purposes. The next
   * active row may therefore reuse that number after the sequence is closed.
   * A generated value keeps uniqueness enforced for ACT/CANCEL rows while
   * allowing discarded audit copies to retain the same SI.
   */
  $stmt = $koneksi->prepare("
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA=? AND TABLE_NAME='sibarges' AND COLUMN_NAME='active_si_barges'
    LIMIT 1
  ");
  if (!$stmt) return [false, 'Gagal cek kolom SI Barges aktif: ' . $koneksi->error];
  $stmt->bind_param("s", $dbName);
  $stmt->execute();
  $hasActiveSiColumn = (bool)$stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$hasActiveSiColumn) {
    $ok = $koneksi->query("ALTER TABLE sibarges ADD COLUMN active_si_barges varchar(120) GENERATED ALWAYS AS (CASE WHEN record_status <> 'DISCARD' THEN si_barges ELSE NULL END) STORED");
    if (!$ok) return [false, 'Gagal menyiapkan kolom SI Barges aktif: ' . $koneksi->error];
  }

  $stmt = $koneksi->prepare("
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA=? AND TABLE_NAME='sibarges' AND INDEX_NAME='uq_active_si_barges'
    LIMIT 1
  ");
  if (!$stmt) return [false, 'Gagal cek index SI Barges aktif: ' . $koneksi->error];
  $stmt->bind_param("s", $dbName);
  $stmt->execute();
  $hasActiveUniqueIndex = (bool)$stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$hasActiveUniqueIndex) {
    $ok = $koneksi->query("ALTER TABLE sibarges ADD UNIQUE INDEX uq_active_si_barges (active_si_barges)");
    if (!$ok) return [false, 'Gagal menjaga keunikan SI Barges aktif: ' . $koneksi->error];
  }

  $stmt = $koneksi->prepare("
    SELECT NON_UNIQUE
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA=? AND TABLE_NAME='sibarges' AND INDEX_NAME='uq_si_barges'
    LIMIT 1
  ");
  if (!$stmt) return [false, 'Gagal cek index SI Barges: ' . $koneksi->error];
  $stmt->bind_param("s", $dbName);
  $stmt->execute();
  $indexRow = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if ($indexRow && (int)$indexRow['NON_UNIQUE'] === 0) {
    $stmt = $koneksi->prepare("
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA=? AND TABLE_NAME='sibarges' AND INDEX_NAME='idx_si_barges'
      LIMIT 1
    ");
    if (!$stmt) return [false, 'Gagal cek index SI Barges: ' . $koneksi->error];
    $stmt->bind_param("s", $dbName);
    $stmt->execute();
    $hasLookupIndex = (bool)$stmt->get_result()->fetch_assoc();
    $stmt->close();

    $alterSql = "ALTER TABLE sibarges DROP INDEX uq_si_barges";
    if (!$hasLookupIndex) $alterSql .= ", ADD INDEX idx_si_barges (si_barges)";
    if (!$koneksi->query($alterSql)) {
      return [false, 'Gagal menyiapkan penomoran DISCARD SI: ' . $koneksi->error];
    }
  }

  return [true, ''];
}

function renumberNonDiscardedSibarges(mysqli $koneksi, $noPk){
  $stmt = $koneksi->prepare("SELECT
      id, no_si_vessel, si_type, month_num, year_num, barge_seq, si_barges
    FROM sibarges
    WHERE no_pk=? AND record_status <> 'DISCARD'
    ORDER BY barge_seq ASC, id ASC
    FOR UPDATE");
  if (!$stmt) throw new RuntimeException($koneksi->error);
  $stmt->bind_param("s", $noPk);
  if (!$stmt->execute()) throw new RuntimeException($stmt->error);
  $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $stmt->close();

  $stmtUpdate = $koneksi->prepare("UPDATE sibarges SET barge_seq=?, si_barges=? WHERE id=?");
  if (!$stmtUpdate) throw new RuntimeException($koneksi->error);

  $renumbered = 0;
  foreach ($rows as $index => $row) {
    $newSeq = $index + 1;
    $siType = cleanCode($row['si_type'] ?? '');
    $romanMonth = romawiBulan((int)($row['month_num'] ?? 0));
    $year = (int)($row['year_num'] ?? 0);
    $noSiVessel = clean($row['no_si_vessel'] ?? '');
    if ($siType === '' || $romanMonth === '' || $year <= 0 || $noSiVessel === '') {
      $stmtUpdate->close();
      throw new RuntimeException('Data SI Barges tidak lengkap saat merapikan nomor urut.');
    }

    $newSiBarges = "SI-{$siType}/{$romanMonth}/{$year}/{$noSiVessel}/{$newSeq}";
    if ((int)$row['barge_seq'] === $newSeq && (string)$row['si_barges'] === $newSiBarges) continue;

    $id = (int)$row['id'];
    $stmtUpdate->bind_param("isi", $newSeq, $newSiBarges, $id);
    if (!$stmtUpdate->execute()) {
      $error = $stmtUpdate->error;
      $stmtUpdate->close();
      throw new RuntimeException($error);
    }
    $renumbered++;
  }
  $stmtUpdate->close();

  return $renumbered;
}

function pdfText($text){
  $text = (string)$text;
  $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
  $converted = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
  return $converted !== false ? $converted : $text;
}

function pdfWrap($text, $maxLen = 84){
  $text = trim((string)$text);
  if ($text === '') return [''];

  $wrapped = [];
  foreach (preg_split('/\r?\n/', $text) as $paragraph) {
    $paragraph = trim($paragraph);
    if ($paragraph === '') {
      $wrapped[] = '';
      continue;
    }

    $words = preg_split('/\s+/', $paragraph);
    $line = '';
    foreach ($words as $word) {
      $candidate = $line === '' ? $word : $line . ' ' . $word;
      if (strlen($candidate) > $maxLen) {
        if ($line !== '') $wrapped[] = $line;
        $line = $word;
      } else {
        $line = $candidate;
      }
    }
    if ($line !== '') $wrapped[] = $line;
  }

  return $wrapped ?: [''];
}

function pdfApproxTextWidth($text, $fontSize){
  $width = 0;
  foreach (str_split((string)$text) as $ch) {
    if ($ch === ' ') $width += 0.278;
    elseif (ctype_upper($ch)) $width += 0.667;
    elseif (ctype_lower($ch)) $width += 0.500;
    elseif (ctype_digit($ch)) $width += 0.556;
    elseif (in_array($ch, ['.', ',', ':', ';', "'"], true)) $width += 0.278;
    elseif (in_array($ch, ['-', '/', '(', ')'], true)) $width += 0.333;
    else $width += 0.500;
  }
  return $width * $fontSize;
}

function pdfLogoJpegData($pngPath, $targetWidth = 210){
  if (!is_file($pngPath)) {
    $fallback = imagecreatetruecolor(1, 1);
    $white = imagecolorallocate($fallback, 255, 255, 255);
    imagefilledrectangle($fallback, 0, 0, 1, 1, $white);
    ob_start();
    imagejpeg($fallback, null, 90);
    $jpeg = ob_get_clean();
    return [$jpeg ?: '', 1, 1];
  }

  $src = @imagecreatefrompng($pngPath);
  if (!$src) {
    $fallback = imagecreatetruecolor(1, 1);
    $white = imagecolorallocate($fallback, 255, 255, 255);
    imagefilledrectangle($fallback, 0, 0, 1, 1, $white);
    ob_start();
    imagejpeg($fallback, null, 90);
    $jpeg = ob_get_clean();
    return [$jpeg ?: '', 1, 1];
  }

  $srcW = imagesx($src);
  $srcH = imagesy($src);
  $targetWidth = max(1, (int)$targetWidth);
  $targetHeight = max(1, (int)round($srcH * ($targetWidth / max(1, $srcW))));

  $dst = imagecreatetruecolor($targetWidth, $targetHeight);
  $white = imagecolorallocate($dst, 255, 255, 255);
  imagefilledrectangle($dst, 0, 0, $targetWidth, $targetHeight, $white);
  imagecopyresampled($dst, $src, 0, 0, 0, 0, $targetWidth, $targetHeight, $srcW, $srcH);

  ob_start();
  imagejpeg($dst, null, 92);
  $jpeg = ob_get_clean();

  return [$jpeg ?: '', $targetWidth, $targetHeight];
}

function outputSimplePdf($title, array $fields, $filename){
  $pageWidth = 595;
  $pageHeight = 842;
  $pageMargin = 60;
  $rightEdge = $pageWidth - $pageMargin;

  $logoFile = strtoupper(clean($fields['SI Type'] ?? 'SJN')) === 'SNP' ? 'snp.png' : 'sjn.png';
  $logoWidth = $logoFile === 'snp.png' ? 160 : 210;
  [$logoJpeg, $logoW, $logoH] = pdfLogoJpegData(__DIR__ . '/../assets/img/logo/' . $logoFile, $logoWidth);

  $siNo = clean($fields['SI Barges'] ?? '');
  $date = clean($fields['Document Date'] ?? '');

  $shipper = trim(clean($fields['Shipper'] ?? ''));
  $portOfLoading = trim(clean($fields['Port of Loading'] ?? ''));
  $portOfDischarge = trim(clean($fields['Port of Discharge'] ?? ''));
  $bargeNomination = trim(clean($fields['Barge Nomination'] ?? ''));
  $laycan = trim(clean($fields['Laycan'] ?? ''));
  $estLoadingDate = trim(clean($fields['Est. Loading Date'] ?? ''));
  $quantity = trim(clean($fields['Quantity'] ?? ''));

  if ($shipper === '') $shipper = '[Shipper]';
  if ($date === '') $date = '[Date]';
  if ($portOfLoading === '') $portOfLoading = '[Port of Loading]';
  if ($portOfDischarge === '') $portOfDischarge = '[Port of Discharge]';
  if ($bargeNomination === '') $bargeNomination = '[Barge Nomination]';
  if ($laycan === '') $laycan = '[Laycan]';
  if ($estLoadingDate === '') $estLoadingDate = '00 00 00 - 00 00 00';
  if ($quantity === '') $quantity = '[Quantity]';

  $docLines = [];
  $docLines[] = 'BT';
  $docLines[] = '0 0 0 rg';

  $add = function($font, $size, $x, $y, $text) use (&$docLines) {
    $docLines[] = sprintf('/%s %d Tf', $font, $size);
    $docLines[] = sprintf('1 0 0 1 %d %d Tm', $x, $y);
    $docLines[] = '(' . pdfText($text) . ') Tj';
  };

  $addWrapped = function($font, $size, $x, $y, $text, $maxChars, $lineStep) use (&$docLines, $add) {
    $lines = pdfWrap($text, $maxChars);
    $cursorY = $y;
    foreach ($lines as $line) {
      $add($font, $size, $x, $cursorY, $line);
      $cursorY -= $lineStep;
    }
    return $cursorY;
  };

  $addJustifiedWrapped = function($font, $size, $x, $y, $text, $maxChars, $lineStep, $targetWidth) use (&$docLines, $add) {
    $lines = pdfWrap($text, $maxChars);
    $cursorY = $y;
    $lastIndex = count($lines) - 1;

    foreach ($lines as $index => $line) {
      $line = trim($line);
      $spaceCount = substr_count($line, ' ');
      $lineWidth = pdfApproxTextWidth($line, $size);
      $canJustify = $index < $lastIndex && $spaceCount > 0 && $lineWidth < $targetWidth;

      if ($canJustify) {
        $wordSpacing = ($targetWidth - $lineWidth) / $spaceCount;
        $docLines[] = sprintf('%0.3f Tw', $wordSpacing);
        $add($font, $size, $x, $cursorY, $line);
        $docLines[] = '0 Tw';
      } else {
        $add($font, $size, $x, $cursorY, $line);
      }

      $cursorY -= $lineStep;
    }

    return $cursorY;
  };

  $docLines[] = 'ET';
  if ($logoJpeg !== '') {
    $logoX = $rightEdge - $logoW;
    $logoY = 842 - 30 - $logoH;
    $docLines[] = 'q';
    $docLines[] = sprintf('%0.2f 0 0 %0.2f %0.2f %0.2f cm', $logoW, $logoH, $logoX, $logoY);
    $docLines[] = '/Im1 Do';
    $docLines[] = 'Q';
  }
  $docLines[] = 'BT';

  $add('F2', 18, 170, 715, 'SHIPPING INSTRUCTION');

  $add('F1', 9, $pageMargin, 638, 'Date');
  $add('F1', 9, 160, 638, ': ' . $date);
  $add('F1', 9, $pageMargin, 624, 'No.');
  $add('F1', 9, 160, 624, ': ' . ($siNo !== '' ? $siNo : '[No.]'));

  $add('F1', 9, $pageMargin, 590, 'Dear Sir / Madam,');
  $add('F1', 9, $pageMargin, 576, 'Please find our shipment detail as follows :');

  $y = 548;
  $lineGap = 18;
  $labelX = $pageMargin;
  $valueX = 202;
  $valueTextX = $valueX + 12;
  $valueMaxChars = 60;
  $valueTextWidth = $rightEdge - $valueTextX;

  $items = [
    ['1. Shipper', $shipper],
    ['2. Consignee', 'TO ORDER'],
    ['3. Notify Party', 'TO ORDER'],
    ['4. Port of Loading', $portOfLoading],
    ['5. Port of Discharge', $portOfDischarge],
    ['6. Barge Nomination', $bargeNomination],
    ['7. Laycan', $laycan],
    ['8. Est. Loading Date', $estLoadingDate],
    ['9. Description of Goods', 'INDONESIAN STEAM COAL IN BULK'],
    ['10. Quantity', $quantity],
    ['11. Term of Delivery', 'Transhipment'],
    ['12. Type of Vessel', ''],
  ];

  foreach ($items as [$label, $value]) {
    $add('F1', 9, $labelX, $y, $label);
    $add('F1', 9, $valueX, $y, ':');
    $y = $addJustifiedWrapped('F1', 9, $valueTextX, $y, $value, $valueMaxChars, 12, $valueTextWidth);
    $y -= 6;
  }

  $y -= 6;
  $add('F1', 9, $pageMargin, $y, 'Shipping documents :');
  $y -= 14;
  $docMaxChars = 120;
  $docSubX = $pageMargin + 18;
  $docSubMaxChars = 120;

  $y = $addWrapped('F1', 8.2, $pageMargin, $y, '1. Bill of Lading "Clean on Board" (3 Original + 7 Copy Non Negotiable) Marked Freight Payable', $docMaxChars, 11) - 3;
  $y = $addWrapped('F1', 8.2, $pageMargin, $y, '2. Cargo Manifest (3 Original + 7 Copy Non Negotiable)', $docMaxChars, 11) - 3;
  $y = $addWrapped('F1', 8.2, $pageMargin, $y, '3. IIA Certificates ( ASTM Standard )', $docMaxChars, 11) - 3;
  $y = $addWrapped('F1', 8.0, $docSubX, $y, 'a.   Certificate of Sampling and Analysis (COA); issued by SURVEYOR (1 Original + 7 Copy)', $docSubMaxChars, 10) - 2;
  $y = $addWrapped('F1', 8.0, $docSubX, $y, 'b.   Certificate of Weight (COW); issued by SURVEYOR (1 Original + 7 Copy)', $docSubMaxChars, 10) - 2;
  $y = $addWrapped('F1', 8.0, $docSubX, $y, 'c.   Draft Survey Report (DSR); issued by SURVEYOR (1 Original + 7 Copy)', $docSubMaxChars, 10) - 2;
  $y = $addWrapped('F1', 8.0, $docSubX, $y, 'd.   Certificate of Hold Cleanliness ; issued by SURVEYOR (1 Original + 7 Copy)', $docSubMaxChars, 10) - 2;
  $y = $addWrapped('F1', 8.0, $docSubX, $y, 'e.   Certificate of Origin; issued by SURVEYOR (1 Original + 7 Copy)', $docSubMaxChars, 10) - 3;
  $y = $addWrapped('F1', 8.2, $pageMargin, $y, '4. Certificate of Origin (COO); issued by Chamber of Commerce (1 Original + 1 Triplicate + 7 Copy NonNegotiable)', $docMaxChars, 11);

  $y -= 24;
  $add('F1', 9, $pageMargin, $y, 'Please use appropriately.');

  $y -= 70;
  $add('F1', 9, $pageMargin, $y, 'Yours Faithfully,');
  $add('F1', 9, $pageMargin, $y - 14, 'Admin');

  $docLines[] = 'ET';

  $content = implode("\n", $docLines);
  $objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    sprintf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 7 0 R >>', $pageWidth, $pageHeight),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /XObject /Subtype /Image /Width ' . (int)$logoW . ' /Height ' . (int)$logoH . ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($logoJpeg) . " >>\nstream\n" . $logoJpeg . "\nendstream",
    '<< /Length ' . strlen($content) . " >>\nstream\n" . $content . "\nendstream",
  ];

  $pdf = "%PDF-1.4\n";
  $offsets = [0];
  foreach ($objects as $index => $object) {
    $offsets[] = strlen($pdf);
    $pdf .= ($index + 1) . " 0 obj\n" . $object . "\nendobj\n";
  }

  $xrefPos = strlen($pdf);
  $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
  $pdf .= sprintf("%010d 65535 f \n", 0);
  for ($i = 1; $i < count($offsets); $i++) {
    $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
  }
  $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n" . $xrefPos . "\n%%EOF";

  if (function_exists('ini_set')) {
    @ini_set('display_errors', '0');
  }
  while (ob_get_level() > 0) {
    ob_end_clean();
  }

  header('Content-Type: application/pdf');
  header('Content-Disposition: attachment; filename="' . $filename . '"');
  header('Content-Length: ' . strlen($pdf));
  echo $pdf;
  exit;
}

function fkGuardJetty($koneksi, $jetty_code){
  $stmt = $koneksi->prepare("SELECT jetty, nama_panjang FROM jetty WHERE jetty=? LIMIT 1");
  if (!$stmt) return [false, null, "DB error: ".$koneksi->error];
  $stmt->bind_param("s", $jetty_code);
  $stmt->execute();
  $r = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$r) {
    return [false, null, "Jetty code tidak valid: '{$jetty_code}' (HEX: ".bin2hex($jetty_code).")"];
  }
  return [true, $r['nama_panjang'] ?? null, ""];
}

function fkGuardShipper($koneksi, $shipper_code){
  $stmt = $koneksi->prepare("SELECT shipper, nama_lengkap FROM shipper WHERE shipper=? LIMIT 1");
  if (!$stmt) return [false, null, "DB error: ".$koneksi->error];
  $stmt->bind_param("s", $shipper_code);
  $stmt->execute();
  $r = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$r) {
    return [false, null, "Shipper code tidak valid: '{$shipper_code}' (HEX: ".bin2hex($shipper_code).")"];
  }
  return [true, $r['nama_lengkap'] ?? null, ""];
}

function formatPdfDateDmy($ymd){
  $ymd = trim((string)$ymd);
  if ($ymd === '') return '';

  $dt = DateTime::createFromFormat('Y-m-d', $ymd);
  if (!$dt) return '';

  return $dt->format('d m y');
}

function formatPdfDocumentDate($ymd){
  $ymd = trim((string)$ymd);
  if ($ymd === '') return '';

  $dt = DateTime::createFromFormat('Y-m-d', $ymd);
  if (!$dt) return '';

  $dt->modify('-1 day');
  return strtoupper($dt->format('d M Y'));
}

function getSibargesPdfFields($row){
  $anchorage = trim($row['anchorage'] ?? '');
  $mothervessel = trim($row['mothervessel'] ?? '');
  $tugboat = trim($row['tugboat'] ?? '');
  $barge = trim($row['barge'] ?? '');
  $portOfDischarge = trim($anchorage . ', EAST KALIMANTAN, TRANSHIPMENT TO ' . $mothervessel . ' OR SUBS');
  $bargeNomination = trim($tugboat . ' / ' . $barge);
  $laycanStart = formatPdfDateDmy($row['laycan_start'] ?? '');
  $laycanEnd = formatPdfDateDmy($row['laycan_end'] ?? '');
  $laycan = trim($laycanStart . ' - ' . $laycanEnd);
  $documentDate = formatPdfDocumentDate($row['laycan_start'] ?? '');
  $qty = (float)($row['qty_plan'] ?? 0);
  $qtyText = $qty > 0 ? number_format($qty, 0, '.', ',') . ' MT +/- 10%' : '';

  return [
    'SI Barges' => $row['si_barges'] ?? '',
    'Document Date' => $documentDate,
    'No PK' => $row['no_pk'] ?? '',
    'No SI Vessel' => $row['no_si_vessel'] ?? '',
    'Buyer' => $row['buyer'] ?? '',
    'Mother Vessel' => $row['mothervessel'] ?? '',
    'SI Type' => $row['si_type'] ?? '',
    'Tugboat' => $row['tugboat'] ?? '',
    'Barge' => $row['barge'] ?? '',
    'Qty Plan' => $row['qty_plan'] ?? '',
    'Quantity' => $qtyText,
    'Jetty' => trim(($row['jetty_code'] ?? '') . ' - ' . ($row['jetty_name'] ?? '')),
    'Port of Loading' => trim($row['jetty_name'] ?? $row['jetty_code'] ?? ''),
    'Port of Discharge' => $portOfDischarge,
    'Barge Nomination' => $bargeNomination,
    'Laycan' => $laycan,
    'Shipper' => preg_replace('/\s+/', ' ', trim(($row['shipper_code'] ?? '') . ' - ' . ($row['shipper_name'] ?? ''))),
    'Laycan Start' => $row['laycan_start'] ?? '',
    'Laycan End' => $row['laycan_end'] ?? '',
    'Status' => $row['record_status'] ?? '',
    'Remarks' => $row['remarks'] ?? '',
    'Created By' => $row['created_by'] ?? '',
    'Created At' => $row['created_at'] ?? '',
  ];
}

/* ========= CSV TEMPLATE DOWNLOAD ========= */
if (isset($_GET['download']) && $_GET['download'] === 'sibarges_template') {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="sibarges_template.csv"');

  $out = fopen('php://output', 'w');
  fputcsv($out, [
    'no_pk','si_type','tugboat','barge','anchorage','qty_plan','jetty_code','shipper_code','laycan_start','laycan_end','record_status','remarks'
  ]);
  fputcsv($out, [
    'G.25-052','SJN','TB. PRIMA STAR 16','BG. TAURUS 11','MUARA BERAU','9000','CAM','MHU','2025-12-16','2025-12-17','ACT','Plan awal'
  ]);
  fputcsv($out, [
    'G.25-052','SJN','TB. PRIMA STAR 16','BG. TAURUS 12','MUARA JAWA','9000','CAM','MHU','16/Dec/25','17/Dec/25','CANCEL','Cancel karena perubahan lineup'
  ]);
  fclose($out);
  exit;
}

if (isset($_GET['download']) && $_GET['download'] === 'si_pdf') {
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) {
    http_response_code(400);
    exit('ID tidak valid.');
  }

  $stmt = $koneksi->prepare("SELECT
      id, no_pk, no_si_vessel, buyer, mothervessel,
      si_type, month_num, year_num, barge_seq, si_barges,
      tugboat, barge,
      COALESCE(
        NULLIF(anchorage, ''),
        (
          SELECT s2.anchorage
          FROM sibarges s2
          WHERE s2.no_pk = sibarges.no_pk
            AND NULLIF(s2.anchorage, '') IS NOT NULL
          ORDER BY s2.id DESC
          LIMIT 1
        )
      ) AS anchorage,
      qty_plan,
      jetty_code, jetty_name,
      shipper_code, shipper_name,
      laycan_start, laycan_end,
      record_status, remarks,
      created_by, created_at, updated_at
    FROM sibarges WHERE id=? LIMIT 1");
  if (!$stmt) {
    http_response_code(500);
    exit('DB error: ' . $koneksi->error);
  }

  $stmt->bind_param('i', $id);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$row) {
    http_response_code(404);
    exit('Data SI Barges tidak ditemukan.');
  }

  $filename = preg_replace('/[^A-Za-z0-9._-]+/', '_', ($row['si_barges'] ?? ('si_barges_' . $id))) . '.pdf';
  outputSimplePdf('SI Barges Detail', getSibargesPdfFields($row), $filename);
}

/* ========= AJAX API ========= */
if (isset($_GET['ajax']) && $_GET['ajax'] === '1') {

  $action = $_POST['action'] ?? $_GET['action'] ?? '';

  // ===== GET vessel detail by no_pk =====
  if ($action === 'vessel_get') {
    $no_pk = clean($_GET['no_pk'] ?? '');
    if ($no_pk === "") jsonOut(["ok"=>false,"msg"=>"no_pk kosong"]);

    $stmt = $koneksi->prepare("SELECT no_pk, no_si_vessel, buyer, mothervessel, anchorage, term FROM vessel WHERE no_pk=? LIMIT 1");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $no_pk);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) jsonOut(["ok"=>false,"msg"=>"Vessel tidak ditemukan untuk no_pk: ".$no_pk]);
    jsonOut(["ok"=>true,"data"=>$row]);
  }

  // ===== Tugboat suggestions (distinct) =====
  if ($action === 'tug_list') {
    $q = clean($_GET['q'] ?? '');
    $sql = "SELECT DISTINCT tugboat AS v FROM barges WHERE tugboat IS NOT NULL AND tugboat<>''";
    $types = "";
    $params = [];
    if ($q !== "") {
      $sql .= " AND tugboat LIKE ?";
      $kw = "%{$q}%";
      $types = "s";
      $params = [$kw];
    }
    $sql .= " ORDER BY tugboat ASC LIMIT 60";
    $stmt = $koneksi->prepare($sql);
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    if ($types !== "") $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    $stmt->close();
    $vals = array_map(fn($r)=>$r['v'], $rows);
    jsonOut(["ok"=>true,"data"=>$vals]);
  }

  // ===== Barge suggestions (distinct) =====
  if ($action === 'barge_list') {
    $q = clean($_GET['q'] ?? '');
    $sql = "SELECT DISTINCT barge AS v FROM barges WHERE barge IS NOT NULL AND barge<>''";
    $types = "";
    $params = [];
    if ($q !== "") {
      $sql .= " AND barge LIKE ?";
      $kw = "%{$q}%";
      $types = "s";
      $params = [$kw];
    }
    $sql .= " ORDER BY barge ASC LIMIT 60";
    $stmt = $koneksi->prepare($sql);
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    if ($types !== "") $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    $stmt->close();
    $vals = array_map(fn($r)=>$r['v'], $rows);
    jsonOut(["ok"=>true,"data"=>$vals]);
  }

  // ===== LIST + SEARCH + SORT =====
  if ($action === 'list') {
    $q = clean($_GET['q'] ?? '');
    $filter_month = clean($_GET['filter_month'] ?? '');
    $filter_no_pk = clean($_GET['filter_no_pk'] ?? '');
    $filter_discarded = clean($_GET['filter_discarded'] ?? 'hide');
    $sort_by = clean($_GET['sort_by'] ?? 'created_at');
    $sort_dir = strtoupper(clean($_GET['sort_dir'] ?? 'DESC'));
    if (!in_array($sort_dir, ['ASC','DESC'], true)) $sort_dir = 'DESC';

    $allowedSort = [
      'si_barges','no_pk','buyer','mothervessel','tugboat','barge','anchorage',
      'qty_plan','jetty_code','shipper_code','record_status','laycan_start','laycan_end','created_at'
    ];
    if (!in_array($sort_by, $allowedSort, true)) $sort_by = 'created_at';

    $sql = "SELECT
              id, no_pk, no_si_vessel, buyer, mothervessel,
              si_type, month_num, year_num, barge_seq, si_barges,
              tugboat, barge, term, anchorage, qty_plan,
              jetty_code, jetty_name,
              shipper_code, shipper_name,
              laycan_start, laycan_end,
              record_status, remarks,
              created_by, created_at, updated_at
            FROM sibarges";

    $types = "";
    $params = [];
    $where = [];

    if ($q !== "") {
      $where[] = "(
        si_barges LIKE ? OR
        no_pk LIKE ? OR
        no_si_vessel LIKE ? OR
        buyer LIKE ? OR
        mothervessel LIKE ? OR
        tugboat LIKE ? OR
        barge LIKE ? OR
        jetty_code LIKE ? OR
        shipper_code LIKE ? OR
        record_status LIKE ?
      )";
      $kw = "%{$q}%";
      $types .= "ssssssssss";
      $params = [$kw,$kw,$kw,$kw,$kw,$kw,$kw,$kw,$kw,$kw];
    }

    if (preg_match('/^(\d{4})-(\d{2})$/', $filter_month, $m)) {
      $where[] = "year_num = ? AND month_num = ?";
      $types .= "ii";
      $params[] = (int)$m[1];
      $params[] = (int)$m[2];
    }

    if ($filter_no_pk !== "") {
      $where[] = "no_pk = ?";
      $types .= "s";
      $params[] = $filter_no_pk;
    }

    if ($filter_discarded === 'only') {
      $where[] = "record_status = 'DISCARD'";
    } elseif ($filter_discarded !== 'all') {
      $where[] = "record_status <> 'DISCARD'";
    }

    if ($where) {
      $sql .= " WHERE " . implode(" AND ", $where);
    }

    $sql .= " ORDER BY {$sort_by} {$sort_dir}, id DESC LIMIT 800";

    $stmt = $koneksi->prepare($sql);
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    if ($types !== "") $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    $stmt->close();

    jsonOut(["ok"=>true,"data"=>$rows]);
  }

  // ===== CREATE =====
  if ($action === 'create') {
    $no_pk     = clean($_POST['no_pk'] ?? '');
    $si_type   = cleanCode($_POST['si_type'] ?? 'SJN');

    $tugboat   = clean($_POST['tugboat'] ?? '');
    $barge     = clean($_POST['barge'] ?? '');
    $qty_plan  = toDecimal($_POST['qty_plan'] ?? '');

    $jetty_code   = cleanCode($_POST['jetty_code'] ?? '');
    $shipper_code = cleanCode($_POST['shipper_code'] ?? '');

    $laycan_start = parseDateAny($_POST['laycan_start'] ?? '');
    $laycan_end_in = clean($_POST['laycan_end'] ?? '');
    $laycan_end = parseDateAny($laycan_end_in);

    // enforce end = start + 1
    if ($laycan_start) {
      $laycan_end = addDaysYmd($laycan_start, 1);
    }

    $record_status = strtoupper(clean($_POST['record_status'] ?? 'ACT'));
    if (!in_array($record_status, ['ACT','CANCEL'], true)) $record_status = 'ACT';

    $remarks = clean($_POST['remarks'] ?? '');

    if ($no_pk === "") jsonOut(["ok"=>false,"msg"=>"No PK wajib diisi."]);
    if (!in_array($si_type, ['SJN','SNP'], true)) jsonOut(["ok"=>false,"msg"=>"SI Type harus SJN atau SNP."]);
    if ($tugboat === "" || $barge === "") jsonOut(["ok"=>false,"msg"=>"Tugboat dan Barge wajib diisi."]);
    if ($jetty_code === "") jsonOut(["ok"=>false,"msg"=>"Jetty wajib dipilih."]);
    if ($shipper_code === "") jsonOut(["ok"=>false,"msg"=>"Shipper wajib dipilih."]);
    if (!$laycan_start) jsonOut(["ok"=>false,"msg"=>"Laycan Start tidak valid."]);
    if (!$laycan_end) jsonOut(["ok"=>false,"msg"=>"Laycan End tidak valid."]);

    [$okJ, $jetty_name, $msgJ] = fkGuardJetty($koneksi, $jetty_code);
    if (!$okJ) jsonOut(["ok"=>false,"msg"=>$msgJ]);

    [$okS, $shipper_name, $msgS] = fkGuardShipper($koneksi, $shipper_code);
    if (!$okS) jsonOut(["ok"=>false,"msg"=>$msgS]);

    $stmtV = $koneksi->prepare("SELECT no_si_vessel, buyer, mothervessel, anchorage, term FROM vessel WHERE no_pk=? LIMIT 1");
    if (!$stmtV) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmtV->bind_param("s", $no_pk);
    $stmtV->execute();
    $v = $stmtV->get_result()->fetch_assoc();
    $stmtV->close();
    if (!$v) jsonOut(["ok"=>false,"msg"=>"Data vessel tidak ditemukan untuk no_pk: {$no_pk}"]);

    $no_si_vessel = $v['no_si_vessel'];
    $buyer = $v['buyer'];
    $mothervessel = $v['mothervessel'];
    $anchorage = clean($v['anchorage'] ?? '');
    $term = cleanCode($v['term'] ?? '');
    if (!in_array($anchorage, ['MUARA BERAU','MUARA JAWA','PRIMA ANCHORAGE'], true)) {
      jsonOut(["ok"=>false,"msg"=>"Anchorage vessel belum diisi atau tidak valid. Update Anchorage di halaman Vessel terlebih dahulu."]);
    }
    if (!in_array($term, ['FOB','FAS','CIF'], true)) {
      jsonOut(["ok"=>false,"msg"=>"Term vessel belum diisi atau tidak valid. Update Term di halaman Vessel terlebih dahulu."]);
    }

    $month_num = (int)date('n', strtotime($laycan_start));
    $year_num  = (int)date('Y', strtotime($laycan_start));
    $romawi = romawiBulan($month_num);

    $stmtSeq = $koneksi->prepare("SELECT COALESCE(MAX(barge_seq),0) AS mx FROM sibarges WHERE no_pk=? AND record_status <> 'DISCARD'");
    if (!$stmtSeq) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmtSeq->bind_param("s", $no_pk);
    $stmtSeq->execute();
    $mx = $stmtSeq->get_result()->fetch_assoc();
    $stmtSeq->close();
    $barge_seq = ((int)($mx['mx'] ?? 0)) + 1;

    $si_barges = "SI-{$si_type}/{$romawi}/{$year_num}/{$no_si_vessel}/{$barge_seq}";

    $created_by = $_SESSION['username'];

    $sqlIns = "INSERT INTO sibarges (
        no_pk, no_si_vessel, buyer, mothervessel,
        si_type, month_num, year_num, barge_seq, si_barges,
      tugboat, barge, term, anchorage, qty_plan,
        laycan_start, laycan_end,
        jetty_code, jetty_name,
        shipper_code, shipper_name,
        record_status, remarks,
        created_by
      ) VALUES (?,?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?, ?,?, ?,?, ?,?, ?,?)";

    $stmt = $koneksi->prepare($sqlIns);
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);

    $stmt->bind_param(
      str_repeat('s', 5) . str_repeat('i', 3) . str_repeat('s', 5) . 'd' . str_repeat('s', 9),
      $no_pk, $no_si_vessel, $buyer, $mothervessel,
      $si_type, $month_num, $year_num, $barge_seq, $si_barges,
      $tugboat, $barge, $term, $anchorage, $qty_plan,
      $laycan_start, $laycan_end,
      $jetty_code, $jetty_name,
      $shipper_code, $shipper_name,
      $record_status, $remarks,
      $created_by
    );

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"SI Barges berhasil dibuat: {$si_barges}"] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== UPDATE =====
  if ($action === 'update') {
    $id = (int)($_POST['id'] ?? 0);
    if ($id <= 0) jsonOut(["ok"=>false,"msg"=>"ID tidak valid."]);

    $tugboat  = clean($_POST['tugboat'] ?? '');
    $barge    = clean($_POST['barge'] ?? '');
    $term = cleanCode($_POST['term'] ?? '');
    $anchorage = clean($_POST['anchorage'] ?? '');
    $qty_plan = toDecimal($_POST['qty_plan'] ?? '');

    $jetty_code   = cleanCode($_POST['jetty_code'] ?? '');
    $shipper_code = cleanCode($_POST['shipper_code'] ?? '');

    $laycan_start = parseDateAny($_POST['laycan_start'] ?? '');
    $laycan_end = null;

    if ($laycan_start) $laycan_end = addDaysYmd($laycan_start, 1);

    $record_status = strtoupper(clean($_POST['record_status'] ?? 'ACT'));
    if (!in_array($record_status, ['ACT','CANCEL'], true)) $record_status = 'ACT';

    $remarks = clean($_POST['remarks'] ?? '');

    $stmtStatus = $koneksi->prepare("SELECT record_status FROM sibarges WHERE id=? LIMIT 1");
    if (!$stmtStatus) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmtStatus->bind_param("i", $id);
    $stmtStatus->execute();
    $currentStatusRow = $stmtStatus->get_result()->fetch_assoc();
    $stmtStatus->close();
    if (!$currentStatusRow) jsonOut(["ok"=>false,"msg"=>"Data SI Barges tidak ditemukan."]);
    if (($currentStatusRow['record_status'] ?? '') === 'DISCARD') {
      jsonOut(["ok"=>false,"msg"=>"SI Barges status DISCARD tidak bisa diubah kembali ke ACT/CANCEL."]);
    }

    if ($tugboat === "" || $barge === "") jsonOut(["ok"=>false,"msg"=>"Tugboat/Barge wajib diisi."]);
    if (!in_array($term, ['FOB','FAS','CIF'], true)) jsonOut(["ok"=>false,"msg"=>"Term wajib dipilih."]);
    if (!in_array($anchorage, ['MUARA BERAU','MUARA JAWA','PRIMA ANCHORAGE'], true)) jsonOut(["ok"=>false,"msg"=>"Anchorage wajib dipilih."]);
    if ($jetty_code === "") jsonOut(["ok"=>false,"msg"=>"Jetty wajib diisi."]);
    if ($shipper_code === "") jsonOut(["ok"=>false,"msg"=>"Shipper wajib diisi."]);
    if (!$laycan_start) jsonOut(["ok"=>false,"msg"=>"Laycan Start tidak valid. (pakai YYYY-MM-DD atau 16/Dec/25)"]);
    if (!$laycan_end) jsonOut(["ok"=>false,"msg"=>"Laycan End tidak valid."]);

    [$okJ, $jetty_name, $msgJ] = fkGuardJetty($koneksi, $jetty_code);
    if (!$okJ) jsonOut(["ok"=>false,"msg"=>$msgJ]);

    [$okS, $shipper_name, $msgS] = fkGuardShipper($koneksi, $shipper_code);
    if (!$okS) jsonOut(["ok"=>false,"msg"=>$msgS]);

    $month_num = (int)date('n', strtotime($laycan_start));
    $year_num  = (int)date('Y', strtotime($laycan_start));

    $stmt = $koneksi->prepare("UPDATE sibarges SET
      tugboat=?, barge=?, term=?, anchorage=?, qty_plan=?,
        laycan_start=?, laycan_end=?,
        month_num=?, year_num=?,
        jetty_code=?, jetty_name=?,
        shipper_code=?, shipper_name=?,
        record_status=?, remarks=?
      WHERE id=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);

    $stmt->bind_param(
      str_repeat('s', 4) . 'd' . str_repeat('s', 2) . str_repeat('i', 2) . str_repeat('s', 6) . 'i',
      $tugboat, $barge, $term, $anchorage, $qty_plan,
      $laycan_start, $laycan_end,
      $month_num, $year_num,
      $jetty_code, $jetty_name,
      $shipper_code, $shipper_name,
      $record_status, $remarks,
      $id
    );

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data SI Barges berhasil diupdate."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== CHANGE VESSEL =====
  if ($action === 'change_vessel') {
    $id = (int)($_POST['id'] ?? 0);
    $target_no_pk = clean($_POST['no_pk'] ?? '');

    if ($id <= 0) jsonOut(["ok"=>false,"msg"=>"ID tidak valid."]);
    if ($target_no_pk === "") jsonOut(["ok"=>false,"msg"=>"Vessel wajib dipilih."]);

    [$discardReady, $discardMsg] = ensureDiscardStatusAllowed($koneksi);
    if (!$discardReady) jsonOut(["ok"=>false,"msg"=>$discardMsg]);

    $stmt = $koneksi->prepare("SELECT
        id, no_pk, no_si_vessel, buyer, mothervessel,
        si_type, month_num, year_num, barge_seq, si_barges,
        tugboat, barge, term, anchorage, qty_plan,
        laycan_start, laycan_end,
        jetty_code, jetty_name,
        shipper_code, shipper_name,
        record_status, remarks
      FROM sibarges
      WHERE id=? LIMIT 1");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $current = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$current) jsonOut(["ok"=>false,"msg"=>"Data SI Barges tidak ditemukan."]);
    if (($current['record_status'] ?? '') === 'DISCARD') {
      jsonOut(["ok"=>false,"msg"=>"SI Barges yang sudah DISCARD tidak bisa dipindahkan lagi."]);
    }
    if ($target_no_pk === (string)$current['no_pk']) {
      jsonOut(["ok"=>false,"msg"=>"Pilih vessel yang berbeda dari vessel saat ini."]);
    }

    $stmtV = $koneksi->prepare("SELECT no_pk, no_si_vessel, buyer, mothervessel, anchorage, term FROM vessel WHERE no_pk=? LIMIT 1");
    if (!$stmtV) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmtV->bind_param("s", $target_no_pk);
    $stmtV->execute();
    $target = $stmtV->get_result()->fetch_assoc();
    $stmtV->close();
    if (!$target) jsonOut(["ok"=>false,"msg"=>"Data vessel tidak ditemukan untuk no_pk: {$target_no_pk}"]);

    $stmtSeq = $koneksi->prepare("SELECT COALESCE(MAX(barge_seq),0) AS mx FROM sibarges WHERE no_pk=? AND record_status <> 'DISCARD'");
    if (!$stmtSeq) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmtSeq->bind_param("s", $target_no_pk);
    $stmtSeq->execute();
    $mx = $stmtSeq->get_result()->fetch_assoc();
    $stmtSeq->close();
    $new_seq = ((int)($mx['mx'] ?? 0)) + 1;

    $si_type = cleanCode($current['si_type'] ?? 'SJN');
    $month_num = (int)($current['month_num'] ?? 0);
    $year_num = (int)($current['year_num'] ?? 0);
    $romawi = romawiBulan($month_num);
    if ($si_type === "" || $romawi === "" || $year_num <= 0) {
      jsonOut(["ok"=>false,"msg"=>"Data SI Barges lama tidak lengkap untuk generate nomor SI baru."]);
    }

    $new_si_barges = "SI-{$si_type}/{$romawi}/{$year_num}/{$target['no_si_vessel']}/{$new_seq}";
    $target_anchorage = clean($target['anchorage'] ?? '');
    $target_term = cleanCode($target['term'] ?? '');
    $new_term = $target_term === '' ? ($current['term'] ?? null) : $target_term;
    $new_anchorage = $target_anchorage === '' ? ($current['anchorage'] ?? null) : $target_anchorage;
    $new_no_pk = $target['no_pk'];
    $new_no_si_vessel = $target['no_si_vessel'];
    $new_buyer = $target['buyer'];
    $new_mothervessel = $target['mothervessel'];
    $new_tugboat = $current['tugboat'];
    $new_barge = $current['barge'];
    $new_qty_plan = (float)$current['qty_plan'];
    $new_laycan_start = $current['laycan_start'];
    $new_laycan_end = $current['laycan_end'];
    $new_jetty_code = $current['jetty_code'];
    $new_jetty_name = $current['jetty_name'];
    $new_shipper_code = $current['shipper_code'];
    $new_shipper_name = $current['shipper_name'];
    $new_record_status = $current['record_status'] === 'CANCEL' ? 'CANCEL' : 'ACT';
    $new_remarks = $current['remarks'];
    $created_by = $_SESSION['username'];

    $koneksi->begin_transaction();
    try {
      $stmtIns = $koneksi->prepare("INSERT INTO sibarges (
          no_pk, no_si_vessel, buyer, mothervessel,
          si_type, month_num, year_num, barge_seq, si_barges,
          tugboat, barge, term, anchorage, qty_plan,
          laycan_start, laycan_end,
          jetty_code, jetty_name,
          shipper_code, shipper_name,
          record_status, remarks,
          created_by
        ) VALUES (?,?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?, ?,?, ?,?, ?,?, ?,?)");
      if (!$stmtIns) throw new RuntimeException($koneksi->error);

      $stmtIns->bind_param(
        str_repeat('s', 5) . str_repeat('i', 3) . str_repeat('s', 5) . 'd' . str_repeat('s', 9),
        $new_no_pk, $new_no_si_vessel, $new_buyer, $new_mothervessel,
        $si_type, $month_num, $year_num, $new_seq, $new_si_barges,
        $new_tugboat, $new_barge, $new_term, $new_anchorage, $new_qty_plan,
        $new_laycan_start, $new_laycan_end,
        $new_jetty_code, $new_jetty_name,
        $new_shipper_code, $new_shipper_name,
        $new_record_status, $new_remarks,
        $created_by
      );
      if (!$stmtIns->execute()) throw new RuntimeException($stmtIns->error);
      $stmtIns->close();

      $discard_status = 'DISCARD';
      $stmtDiscard = $koneksi->prepare("UPDATE sibarges SET record_status=? WHERE id=?");
      if (!$stmtDiscard) throw new RuntimeException($koneksi->error);
      $stmtDiscard->bind_param("si", $discard_status, $id);
      if (!$stmtDiscard->execute()) throw new RuntimeException($stmtDiscard->error);
      $stmtDiscard->close();

      $renumbered = renumberNonDiscardedSibarges($koneksi, (string)$current['no_pk']);

      $koneksi->commit();
      $renumberMsg = $renumbered > 0 ? " {$renumbered} nomor SI berikutnya sudah dirapikan." : "";
      jsonOut(["ok"=>true,"msg"=>"Vessel berhasil diubah. Original SI disimpan sebagai DISCARD. SI Barges baru: {$new_si_barges}.{$renumberMsg}"]);
    } catch (Throwable $e) {
      $koneksi->rollback();
      jsonOut(["ok"=>false,"msg"=>"Gagal change vessel: ".$e->getMessage()]);
    }
  }

  // ===== DELETE =====
  if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    if ($id <= 0) jsonOut(["ok"=>false,"msg"=>"ID tidak valid."]);

    $stmt = $koneksi->prepare("DELETE FROM sibarges WHERE id=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("i", $id);
    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data SI Barges berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== IMPORT CSV =====
  if ($action === 'import_csv') {
    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
      jsonOut(["ok"=>false,"msg"=>"File CSV tidak valid / gagal upload."]);
    }

    $tmp = $_FILES['csv']['tmp_name'];
    $fh = fopen($tmp, 'r');
    if (!$fh) jsonOut(["ok"=>false,"msg"=>"Tidak bisa membaca file CSV."]);

    $firstLine = fgets($fh);
    if ($firstLine === false) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"CSV kosong / header tidak ditemukan."]);
    }

    $delimiter = ',';
    $bestCount = 0;
    foreach ([',', ';', "\t"] as $candidateDelimiter) {
      $count = count(str_getcsv($firstLine, $candidateDelimiter, '"', '\\'));
      if ($count > $bestCount) {
        $bestCount = $count;
        $delimiter = $candidateDelimiter;
      }
    }

    $header = str_getcsv($firstLine, $delimiter, '"', '\\');
    if (!$header) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"CSV kosong / header tidak ditemukan."]);
    }

    $header = array_map(function($h){
      $h = preg_replace('/^\xEF\xBB\xBF/', '', (string)$h);
      return strtolower(trim($h));
    }, $header);

    $required = ['no_pk','si_type','tugboat','barge','anchorage','qty_plan','jetty_code','shipper_code','laycan_start','laycan_end','record_status','remarks'];
    $missing = [];
    foreach ($required as $col) {
      if (!in_array($col, $header, true)) {
        $missing[] = $col;
      }
    }
    if ($missing) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"Header CSV salah. Kolom hilang: ".implode(", ", $missing)."\\nWajib ada kolom: ".implode(", ", $required)]);
    }
    $idx = array_flip($header);

    $inserted = 0;
    $errors = 0;
    $errorDetails = [];
    $seqCache = [];

    $stmtV = $koneksi->prepare("SELECT no_si_vessel, buyer, mothervessel, term FROM vessel WHERE no_pk=? LIMIT 1");
    $stmtJ = $koneksi->prepare("SELECT nama_panjang FROM jetty WHERE jetty=? LIMIT 1");
    $stmtS = $koneksi->prepare("SELECT nama_lengkap FROM shipper WHERE shipper=? LIMIT 1");
    $stmtMax = $koneksi->prepare("SELECT COALESCE(MAX(barge_seq),0) mx FROM sibarges WHERE no_pk=? AND record_status <> 'DISCARD'");
    if (!$stmtV || !$stmtJ || !$stmtS || !$stmtMax) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"Prepare lookup gagal: ".$koneksi->error]);
    }

    $sqlIns = "INSERT INTO sibarges (
        no_pk, no_si_vessel, buyer, mothervessel,
        si_type, month_num, year_num, barge_seq, si_barges,
      tugboat, barge, term, anchorage, qty_plan,
        laycan_start, laycan_end,
        jetty_code, jetty_name,
        shipper_code, shipper_name,
        record_status, remarks, created_by
      ) VALUES (?,?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?, ?,?, ?,?, ?,?, ?,?)";

    $stmtIns = $koneksi->prepare($sqlIns);
    if (!$stmtIns) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"Prepare insert gagal: ".$koneksi->error]);
    }

    $created_by = $_SESSION['username'];
    $rowNumber = 1;

    $addImportError = function($rowNumber, $reason) use (&$errors, &$errorDetails) {
      $errors++;
      if (count($errorDetails) < 10) {
        $errorDetails[] = "Baris {$rowNumber}: {$reason}";
      }
    };

    while (($row = fgetcsv($fh, 0, $delimiter, '"', '\\')) !== false) {
      $rowNumber++;
      $hasValue = false;
      foreach ($row as $cell) {
        if (trim((string)$cell) !== '') {
          $hasValue = true;
          break;
        }
      }
      if (!$hasValue) continue;

      $no_pk   = clean($row[$idx['no_pk']] ?? '');
      $si_type = cleanCode($row[$idx['si_type']] ?? 'SJN');
      $tugboat = clean($row[$idx['tugboat']] ?? '');
      $barge   = clean($row[$idx['barge']] ?? '');
      $anchorage = clean($row[$idx['anchorage']] ?? '');
      $qty_plan = toDecimal($row[$idx['qty_plan']] ?? '');

      $jetty_code = cleanCode($row[$idx['jetty_code']] ?? '');
      $shipper_code = cleanCode($row[$idx['shipper_code']] ?? '');

      $laycan_start = parseDateAny($row[$idx['laycan_start']] ?? '');
      $laycan_end = $laycan_start ? addDaysYmd($laycan_start, 1) : null;

      $record_status = strtoupper(clean($row[$idx['record_status']] ?? 'ACT'));
      if (!in_array($record_status, ['ACT','CANCEL'], true)) $record_status = 'ACT';

      $remarks = clean($row[$idx['remarks']] ?? '');

      $rowErrors = [];
      if ($no_pk === "") $rowErrors[] = "no_pk kosong";
      if (!in_array($si_type, ['SJN','SNP'], true)) $rowErrors[] = "si_type harus SJN atau SNP";
      if ($tugboat === "") $rowErrors[] = "tugboat kosong";
      if ($barge === "") $rowErrors[] = "barge kosong";
      if (!in_array($anchorage, ['MUARA BERAU','MUARA JAWA','PRIMA ANCHORAGE'], true)) $rowErrors[] = "anchorage tidak valid";
      if (!$laycan_start || !$laycan_end) $rowErrors[] = "laycan_start tidak valid";
      if ($jetty_code === "") $rowErrors[] = "jetty_code kosong";
      if ($shipper_code === "") $rowErrors[] = "shipper_code kosong";
      if ($rowErrors) {
        $addImportError($rowNumber, implode("; ", $rowErrors));
        continue;
      }

      $stmtV->bind_param("s", $no_pk);
      $stmtV->execute();
      $v = $stmtV->get_result()->fetch_assoc();
      if (!$v) {
        $addImportError($rowNumber, "Data vessel tidak ditemukan untuk no_pk {$no_pk}");
        continue;
      }

      $stmtJ->bind_param("s", $jetty_code);
      $stmtJ->execute();
      $j = $stmtJ->get_result()->fetch_assoc();
      if (!$j) {
        $addImportError($rowNumber, "Jetty tidak ditemukan untuk kode {$jetty_code}");
        continue;
      }
      $jetty_name = $j['nama_panjang'] ?? null;

      $stmtS->bind_param("s", $shipper_code);
      $stmtS->execute();
      $s = $stmtS->get_result()->fetch_assoc();
      if (!$s) {
        $addImportError($rowNumber, "Shipper tidak ditemukan untuk kode {$shipper_code}");
        continue;
      }
      $shipper_name = $s['nama_lengkap'] ?? null;

      $no_si_vessel = $v['no_si_vessel'];
      $buyer = $v['buyer'];
      $mothervessel = $v['mothervessel'];
      $term = cleanCode($v['term'] ?? '');
      if (!in_array($term, ['FOB','FAS','CIF'], true)) {
        $addImportError($rowNumber, "Term vessel tidak valid untuk no_pk {$no_pk}");
        continue;
      }

      $month_num = (int)date('n', strtotime($laycan_start));
      $year_num  = (int)date('Y', strtotime($laycan_start));
      $romawi = romawiBulan($month_num);

      if (!isset($seqCache[$no_pk])) {
        $stmtMax->bind_param("s", $no_pk);
        $stmtMax->execute();
        $mx = $stmtMax->get_result()->fetch_assoc();
        $seqCache[$no_pk] = (int)($mx['mx'] ?? 0);
      }
      $seqCache[$no_pk]++;
      $barge_seq = $seqCache[$no_pk];

      $si_barges = "SI-{$si_type}/{$romawi}/{$year_num}/{$no_si_vessel}/{$barge_seq}";

      $stmtIns->bind_param(
        str_repeat('s', 5) . str_repeat('i', 3) . str_repeat('s', 5) . 'd' . str_repeat('s', 9),
        $no_pk, $no_si_vessel, $buyer, $mothervessel,
        $si_type, $month_num, $year_num, $barge_seq, $si_barges,
        $tugboat, $barge, $term, $anchorage, $qty_plan,
        $laycan_start, $laycan_end,
        $jetty_code, $jetty_name,
        $shipper_code, $shipper_name,
        $record_status, $remarks,
        $created_by
      );

      if ($stmtIns->execute()) $inserted++;
      else $addImportError($rowNumber, $stmtIns->error ?: "Insert gagal");
    }

    fclose($fh);
    $stmtIns->close();
    if ($stmtV) $stmtV->close();
    if ($stmtJ) $stmtJ->close();
    if ($stmtS) $stmtS->close();
    if ($stmtMax) $stmtMax->close();

    $msg = "Import selesai. Inserted: {$inserted}, Error: {$errors}";
    if ($errorDetails) $msg .= "\\n" . implode("\\n", $errorDetails);
    jsonOut(["ok"=>true,"partial"=>$errors > 0,"inserted"=>$inserted,"errors"=>$errors,"msg"=>$msg]);
  }

  // ===== DELETE ALL (IT only) =====
  if ($action === 'delete_all') {
    $divisi = $_SESSION['divisi'] ?? ($_SESSION['departemen'] ?? ($_SESSION['department'] ?? ''));
    if (strtoupper(trim((string)$divisi)) !== 'IT') {
      jsonOut(["ok"=>false,"msg"=>"Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data."]);
    }

    $ok = $koneksi->query("DELETE FROM sibarges");
    $err = $koneksi->error;

    jsonOut($ok ? ["ok"=>true,"msg"=>"Semua data SI Barges berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
  }

  jsonOut(["ok"=>false,"msg"=>"Unknown action"]);
}

/* ========= NORMAL PAGE ========= */
// server render dropdown data
$vesselRows = [];
$res = $koneksi->query("SELECT no_pk, no_si_vessel, buyer, mothervessel, anchorage, term FROM vessel ORDER BY no_pk DESC LIMIT 1200");
if ($res) $vesselRows = $res->fetch_all(MYSQLI_ASSOC);

$jettyRows = [];
$res = $koneksi->query("SELECT jetty, nama_panjang FROM jetty ORDER BY jetty ASC");
if ($res) $jettyRows = $res->fetch_all(MYSQLI_ASSOC);

$shipperRows = [];
$res = $koneksi->query("SELECT shipper, pt, nama_lengkap FROM shipper ORDER BY shipper ASC");
if ($res) $shipperRows = $res->fetch_all(MYSQLI_ASSOC);

$pageTitle = "SI Barges";
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<style>
  /* Keep this page inside the viewport so the topbar does not end early. */
  body{
    overflow-x: hidden;
  }

  .topbar{
    width: 100%;
    max-width: 100vw;
  }

  .main{
    flex: 1 1 auto;
    width: 0;
    min-width: 0;
    max-width: 100%;
  }

  .main > .content{
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  .si-horizontal-scroll{
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .si-input-width{
    min-width: 1280px;
  }

  #tbl{
    min-width: 1800px;
  }
</style>

<main class="main">
  <div class="content">

    <div class="d-flex align-items-center justify-content-between mb-3">
      <h4 class="m-0">SI Barges</h4>

      <div class="d-flex gap-2 align-items-center flex-wrap">
        <select id="sortBy" class="form-select form-select-sm" style="width:180px;">
          <option value="created_at">Sort: Created</option>
          <option value="si_barges">Sort: SI Barges</option>
          <option value="mothervessel">Sort: Vessel</option>
          <option value="tugboat">Sort: Tugboat</option>
          <option value="barge">Sort: Barge</option>
          <option value="jetty_code">Sort: Jetty</option>
          <option value="shipper_code">Sort: Shipper</option>
          <option value="record_status">Sort: Status</option>
          <option value="laycan_start">Sort: Laycan Start</option>
        </select>

        <select id="sortDir" class="form-select form-select-sm" style="width:110px;">
          <option value="DESC">DESC</option>
          <option value="ASC">ASC</option>
        </select>

        <input id="q" type="text" class="form-control form-control-sm" style="width:320px;"
              placeholder="Search (SI / Vessel / TB / BG / Jetty / Shipper / Status)..." />
        <button class="btn btn-sm btn-outline-secondary" id="btnReset" type="button">Reset</button>
      </div>
    </div>

    <div id="alertBox" class="alert d-none" role="alert"></div>

    <!-- IMPORT CSV -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h6 class="mb-1">Import CSV</h6>
            <div class="small text-muted">Download template dulu, isi datanya, lalu upload. SI Barges auto generate per vessel.</div>
          </div>

          <div class="d-flex gap-2 align-items-center">
            <a class="btn btn-sm btn-outline-primary" href="<?= $SELF ?>?download=sibarges_template">
              Download Template CSV
            </a>

            <form id="formImport" class="d-flex gap-2 align-items-center">
              <input type="file" name="csv" id="csvFile" class="form-control form-control-sm" accept=".csv" required>
              <button class="btn btn-sm btn-primary" type="submit">Import</button>
            </form>
          </div>
        </div>
        <div id="importAlertBox" class="alert d-none mt-3 mb-0" role="alert"></div>
      </div>
    </div>

    <!-- FORM INPUT -->
    <div class="card mb-3">
      <div class="si-horizontal-scroll">
        <div class="card-body si-input-width">
          <h6 class="mb-3">Input SI Barges</h6>

          <form id="formCreate" class="row g-2">

          <!-- Row 1 -->
          <div class="col-lg-2">
            <label class="form-label mb-1">Cari Vessel (no_pk / nama)</label>
            <input id="vesselSearch" class="form-control form-control-sm" placeholder="contoh: M.25-283 / SAKURA" autocomplete="off">
            <div class="form-text small">Ketik → dropdown “Vessel (No PK)” terfilter. Enter → auto pilih hasil pertama.</div>
          </div>

          <div class="col-lg-3">
            <label class="form-label mb-1">Vessel (No PK)</label>
            <select name="no_pk" id="no_pk" class="form-select form-select-sm" required>
              <option value="">-- pilih --</option>
              <?php foreach ($vesselRows as $v): ?>
                <option
                  value="<?= htmlspecialchars($v['no_pk']) ?>"
                  data-text="<?= htmlspecialchars(strtolower($v['no_pk'].' '.$v['mothervessel'].' '.$v['buyer'].' '.$v['no_si_vessel'])) ?>">
                  <?= htmlspecialchars($v['no_pk']) ?> — <?= htmlspecialchars($v['mothervessel']) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="col-lg-3 col-6">
            <label class="form-label mb-1">Anchorage</label>
            <input id="anchorage" class="form-control form-control-sm" disabled>
          </div>

          <div class="col-lg-2 col-6">
            <label class="form-label mb-1">No SI Vessel</label>
            <input name="no_si_vessel" id="no_si_vessel" class="form-control form-control-sm" disabled>
          </div>

          <div class="col-lg-2 col-6">
            <label class="form-label mb-1">SI Type</label>
            <select name="si_type" class="form-select form-select-sm" required>
              <option value="SJN">SJN</option>
              <option value="SNP">SNP</option>
            </select>
          </div>

          <!-- Hidden (tetap lookup) -->
          <input type="hidden" id="buyer" value="">
          <input type="hidden" id="mothervessel" value="">

          <hr class="my-2">

          <!-- Row 2 -->
          <div class="col-lg-4">
            <label class="form-label mb-1">Tugboat (search dari master)</label>
            <input name="tugboat" id="tugboat" class="form-control form-control-sm" required placeholder="TB. ..."
                   list="dlTugboat" autocomplete="off">
            <datalist id="dlTugboat"></datalist>
            <div class="form-text small">Bisa pilih dari saran, tapi tetap bebas edit (TB bisa gandeng BG mana pun).</div>
          </div>

          <div class="col-lg-4">
            <label class="form-label mb-1">Barge (search dari master)</label>
            <input name="barge" id="barge" class="form-control form-control-sm" required placeholder="BG. ..."
                   list="dlBarge" autocomplete="off">
            <datalist id="dlBarge"></datalist>
          </div>

          <div class="col-lg-2 col-6">
            <label class="form-label mb-1">Qty Plan</label>
            <input name="qty_plan" id="qty_plan" class="form-control form-control-sm" placeholder="9000" required>
          </div>

          <div class="col-lg-2 col-6">
            <label class="form-label mb-1">Status</label>
            <select name="record_status" class="form-select form-select-sm">
              <option value="ACT">ACT</option>
              <option value="CANCEL">CANCEL</option>
            </select>
          </div>

          <!-- Row 3 -->
          <div class="col-lg-3 col-6">
            <label class="form-label mb-1">Jetty</label>
            <select name="jetty_code" class="form-select form-select-sm" required>
              <option value="">-- pilih --</option>
              <?php foreach ($jettyRows as $j): ?>
                <option value="<?= htmlspecialchars($j['jetty']) ?>" title="<?= htmlspecialchars($j['nama_panjang']) ?>">
                  <?= htmlspecialchars($j['jetty']) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="col-lg-3 col-6">
            <label class="form-label mb-1">Shipper</label>
            <select name="shipper_code" class="form-select form-select-sm" required>
              <option value="">-- pilih --</option>
              <?php foreach ($shipperRows as $s): ?>
                <option value="<?= htmlspecialchars($s['shipper']) ?>" title="<?= htmlspecialchars($s['nama_lengkap']) ?>">
                  <?= htmlspecialchars($s['shipper']) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="col-lg-3 col-6">
            <label class="form-label mb-1">Laycan Start</label>
            <input type="date" name="laycan_start" id="laycan_start" class="form-control form-control-sm" required>
          </div>

          <div class="col-lg-3 col-6">
            <label class="form-label mb-1">Laycan End (+1)</label>
            <input type="date" name="laycan_end" id="laycan_end" class="form-control form-control-sm" required readonly>
          </div>

          <div class="col-12">
            <label class="form-label mb-1">Remarks (optional)</label>
            <input name="remarks" class="form-control form-control-sm" placeholder="optional">
          </div>

          <div class="col-12 mt-2">
            <button class="btn btn-success" type="submit">Save</button>
          </div>

          </form>
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div class="card">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <h6 class="m-0">Data SI Barges</h6>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <input id="filterMonth" type="month" class="form-control form-control-sm" style="width:150px;" aria-label="Filter month">
            <select id="filterMotherVessel" class="form-select form-select-sm" style="width:280px;" aria-label="Filter mother vessel">
              <option value="">All Mother Vessel</option>
              <?php foreach ($vesselRows as $v): ?>
                <option value="<?= htmlspecialchars($v['no_pk']) ?>">
                  <?= htmlspecialchars($v['no_pk']) ?> — <?= htmlspecialchars($v['mothervessel']) ?>
                </option>
              <?php endforeach; ?>
            </select>
            <select id="filterDiscardedSI" class="form-select form-select-sm" style="width:150px;" aria-label="Filter discarded SI">
              <option value="hide">ACT+CANCEL SI</option>
              <option value="only">DISCARD SI</option>
              <option value="all">All SI</option>
            </select>
            <button class="btn btn-sm btn-outline-secondary" id="btnFilterReset" type="button">Reset Filters</button>
            <div class="small text-muted">Hidden: No PK / No SI Vessel / Buyer / Type / Remarks</div>
          </div>
        </div>

        <div class="table-responsive si-horizontal-scroll">
          <table class="table table-sm table-bordered align-middle" id="tbl" style="font-size:12px;">
            <thead class="table-light">
              <tr>
                <th style="min-width:210px;">SI Barges</th>
                <th style="min-width:190px;">Mother Vessel</th>
                <th style="min-width:170px;">Tugboat</th>
                <th style="min-width:210px;">Barge</th>
                <th style="min-width:150px;">Anchorage</th>
                <th style="min-width:90px;">Qty</th>
                <th style="min-width:95px;">Jetty</th>
                <th style="min-width:80px;">Shipper</th>
                <th style="min-width:120px;">Laycan Start</th>
                <th style="min-width:120px;">Laycan End</th>
                <th style="min-width:90px;">Status</th>
                <th style="width:280px;">Action</th>
              </tr>
            </thead>
            <tbody id="tbody">
              <tr><td colspan="12" class="text-center text-muted">Loading...</td></tr>
            </tbody>
          </table>
        </div>

        <div class="small text-muted mt-2">
          Tips: Search langsung ketik. Sort pakai dropdown. Update/Delete tanpa reload.
        </div>

        <?php if ($isIT): ?>
        <div class="d-flex justify-content-end mt-3">
          <button class="btn btn-sm btn-danger" id="btnDeleteAll" type="button">Delete All</button>
        </div>
        <?php endif; ?>
      </div>
    </div>

  </div>
</main>

<div class="modal fade" id="changeVesselModal" tabindex="-1" aria-labelledby="changeVesselTitle" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h5 class="modal-title" id="changeVesselTitle">Change Vessel</h5>
          <div class="small text-muted" id="changeVesselCurrent"></div>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <label class="form-label mb-1" for="changeVesselSearch">Cari Vessel (no_pk / nama)</label>
        <input id="changeVesselSearch" class="form-control form-control-sm mb-2" placeholder="contoh: M.26-006 / MARINER" autocomplete="off">

        <label class="form-label mb-1" for="changeVesselNoPk">Vessel (No PK)</label>
        <select id="changeVesselNoPk" class="form-select form-select-sm">
          <option value="">-- pilih --</option>
        </select>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-sm btn-primary" id="btnSaveChangeVessel">Save Change</button>
      </div>
    </div>
  </div>
</div>

<script>
const SELF = "<?= $SELF ?>";
const JETTY_OPTIONS = <?= json_encode($jettyRows, JSON_UNESCAPED_UNICODE); ?>;
const VESSEL_OPTIONS = <?= json_encode($vesselRows, JSON_UNESCAPED_UNICODE); ?>;

const alertBox = document.getElementById('alertBox');
const tbody = document.getElementById('tbody');
const q = document.getElementById('q');
const btnReset = document.getElementById('btnReset');
const sortBy = document.getElementById('sortBy');
const sortDir = document.getElementById('sortDir');
const filterMonth = document.getElementById('filterMonth');
const filterMotherVessel = document.getElementById('filterMotherVessel');
const filterDiscardedSI = document.getElementById('filterDiscardedSI');
const btnFilterReset = document.getElementById('btnFilterReset');
const changeVesselSearch = document.getElementById('changeVesselSearch');
const changeVesselNoPk = document.getElementById('changeVesselNoPk');
const changeVesselCurrent = document.getElementById('changeVesselCurrent');
const btnSaveChangeVessel = document.getElementById('btnSaveChangeVessel');
const changeVesselModalEl = document.getElementById('changeVesselModal');
let changeVesselModal = null;
let changeVesselRowId = "";

const formCreate = document.getElementById('formCreate');
const formImport = document.getElementById('formImport');
const csvFile = document.getElementById('csvFile');
const btnDeleteAll = document.getElementById('btnDeleteAll');
const importAlertBox = document.getElementById('importAlertBox');

const no_pk = document.getElementById('no_pk');
const no_si_vessel = document.getElementById('no_si_vessel');
const anchorage = document.getElementById('anchorage');
const buyerHidden = document.getElementById('buyer');
const mothervesselHidden = document.getElementById('mothervessel');

const vesselSearch = document.getElementById('vesselSearch');

const tugboat = document.getElementById('tugboat');
const barge = document.getElementById('barge');
const dlTugboat = document.getElementById('dlTugboat');
const dlBarge = document.getElementById('dlBarge');

const laycanStart = document.getElementById('laycan_start');
const laycanEnd = document.getElementById('laycan_end');

function showAlert(type, msg){
  alertBox.className = 'alert alert-' + type;
  alertBox.style.whiteSpace = 'pre-line';
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
  setTimeout(()=> alertBox.classList.add('d-none'), msg.length > 120 ? 12000 : 3500);
}

function showImportAlert(type, msg){
  importAlertBox.className = 'alert alert-' + type + ' mt-3 mb-0';
  importAlertBox.style.whiteSpace = 'pre-line';
  importAlertBox.textContent = msg;
  importAlertBox.classList.remove('d-none');
  showAlert(type, msg);
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function apiGet(action, qs=""){
  const url = `${SELF}?ajax=1&action=${encodeURIComponent(action)}${qs}`;
  const r = await fetch(url);
  return r.json();
}

async function apiPost(action, data){
  const fd = new FormData();
  fd.append('action', action);
  for (const k in data) fd.append(k, data[k]);
  const r = await fetch(`${SELF}?ajax=1`, { method:'POST', body: fd });
  return r.json();
}

function esc(s){
  return (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

/* ===== format date dd/Mon/yy (display) ===== */
function fmtDDMonYY(val){
  if (!val) return '';
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return val;
  const y = m[1].slice(-2);
  const mm = parseInt(m[2], 10);
  const dd = m[3];
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mm-1] || '';
  return `${dd}/${mon}/${y}`;
}

/* ===== parse dd/Mon/yy or YYYY-MM-DD to Date ===== */
function parseAnyToDate(s){
  s = (s ?? '').toString().trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso){
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2}|\d{4})$/);
  if (m){
    const dd = parseInt(m[1], 10);
    const mon = m[2].toLowerCase();
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    const map = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const mm = map[mon];
    if (!mm) return null;
    const d = new Date(yy, mm-1, dd);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function addDaysToDDMonYY(startStr, days){
  const d = parseAnyToDate(startStr);
  if (!d) return '';
  d.setDate(d.getDate() + days);
  const dd = String(d.getDate()).padStart(2,'0');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mon}/${yy}`;
}

function renderJettySelect(selected){
  const sel = (selected ?? '').toString().trim().toUpperCase();
  let html = `<select class="form-select form-select-sm" name="jetty_code" style="min-width:90px;">`;
  html += `<option value="">--</option>`;
  for (const j of JETTY_OPTIONS){
    const code = (j.jetty ?? '').toString().trim().toUpperCase();
    const title = (j.nama_panjang ?? '').toString();
    const isSel = (code === sel) ? 'selected' : '';
    html += `<option value="${esc(code)}" title="${esc(title)}" ${isSel}>${esc(code)}</option>`;
  }
  html += `</select>`;
  return html;
}

/* ===== Table row template ===== */
function rowTemplate(r){
  const id = esc(r.id);
  const layS = fmtDDMonYY(r.laycan_start);
  const layE = fmtDDMonYY(r.laycan_end);
  const isDiscard = r.record_status === 'DISCARD';
  const statusControl = isDiscard
    ? `<input class="form-control form-control-sm" name="record_status" value="DISCARD" disabled>`
    : `<select class="form-select form-select-sm" name="record_status">
        <option value="ACT" ${r.record_status==='ACT'?'selected':''}>ACT</option>
        <option value="CANCEL" ${r.record_status==='CANCEL'?'selected':''}>CANCEL</option>
      </select>`;
  const changeVesselButton = isDiscard
    ? ''
    : `<button class="btn btn-sm btn-outline-primary btnChangeVessel" type="button">Change Vessel</button>`;

  return `
  <tr data-id="${id}">
    <td>
      <input type="hidden" name="no_pk_current" value="${esc(r.no_pk)}">
      <input type="hidden" name="term" value="${esc(r.term)}">
      <input class="form-control form-control-sm" value="${esc(r.si_barges)}" disabled>
    </td>
    <td><input class="form-control form-control-sm" value="${esc(r.mothervessel)}" disabled></td>

    <td><input class="form-control form-control-sm" name="tugboat" value="${esc(r.tugboat)}"></td>
    <td><input class="form-control form-control-sm" name="barge" value="${esc(r.barge)}"></td>
    <td>
      <select class="form-select form-select-sm" name="anchorage">
        <option value="" ${!r.anchorage?'selected':''}>--</option>
        <option value="MUARA BERAU" ${r.anchorage==='MUARA BERAU'?'selected':''}>MUARA BERAU</option>
        <option value="MUARA JAWA" ${r.anchorage==='MUARA JAWA'?'selected':''}>MUARA JAWA</option>
        <option value="PRIMA ANCHORAGE" ${r.anchorage==='PRIMA ANCHORAGE'?'selected':''}>PRIMA ANCHORAGE</option>
      </select>
    </td>
    <td><input class="form-control form-control-sm" name="qty_plan" value="${esc(r.qty_plan)}"></td>

    <td>${renderJettySelect(r.jetty_code)}</td>

    <td><input class="form-control form-control-sm" name="shipper_code" value="${esc(r.shipper_code)}" title="${esc(r.shipper_name)}" placeholder="MHU"></td>

    <td><input class="form-control form-control-sm" name="laycan_start" value="${esc(layS)}" placeholder="16/Dec/25"></td>
    <td><input class="form-control form-control-sm" name="laycan_end" value="${esc(layE)}" placeholder="17/Dec/25" readonly></td>

    <td>
      ${statusControl}
    </td>

    <td class="d-flex gap-2 flex-wrap">
      <button class="btn btn-sm btn-primary btnUpdate" type="button">Update</button>
      ${changeVesselButton}
      <a class="btn btn-sm btn-outline-secondary btnDownload" href="${SELF}?download=si_pdf&id=${id}" download>Download SI</a>
      <button class="btn btn-sm btn-outline-danger btnDelete" type="button">Delete</button>
    </td>
  </tr>`;
}

function renderChangeVesselOptions(keyword = "", selectedNoPk = ""){
  const kw = keyword.trim().toLowerCase();
  const selected = selectedNoPk.trim();
  let firstValue = "";
  let html = `<option value="">-- pilih --</option>`;

  for (const v of VESSEL_OPTIONS){
    const noPk = (v.no_pk ?? '').toString();
    const mv = (v.mothervessel ?? '').toString();
    const buyer = (v.buyer ?? '').toString();
    const noSi = (v.no_si_vessel ?? '').toString();
    const haystack = `${noPk} ${mv} ${buyer} ${noSi}`.toLowerCase();
    if (kw && !haystack.includes(kw)) continue;
    if (!firstValue) firstValue = noPk;
    const isSelected = noPk === selected ? 'selected' : '';
    html += `<option value="${esc(noPk)}" ${isSelected}>${esc(noPk)} — ${esc(mv)}</option>`;
  }

  changeVesselNoPk.innerHTML = html;
  return firstValue;
}

function openChangeVesselModal(tr){
  changeVesselRowId = tr.getAttribute('data-id') || "";
  const currentNoPk = tr.querySelector('[name="no_pk_current"]')?.value ?? "";
  const currentMv = tr.children[1]?.querySelector('input')?.value ?? "";
  changeVesselCurrent.textContent = currentNoPk ? `Current: ${currentNoPk} - ${currentMv}` : '';
  changeVesselSearch.value = "";
  renderChangeVesselOptions("", currentNoPk);
  if (window.bootstrap?.Modal) {
    changeVesselModal = bootstrap.Modal.getOrCreateInstance(changeVesselModalEl);
    changeVesselModal.show();
  } else {
    changeVesselModalEl.classList.add('show');
    changeVesselModalEl.style.display = 'block';
    changeVesselModalEl.removeAttribute('aria-hidden');
    changeVesselModalEl.setAttribute('aria-modal', 'true');
  }
  setTimeout(()=> changeVesselSearch.focus(), 150);
}

function hideChangeVesselModal(){
  if (changeVesselModal) {
    changeVesselModal.hide();
    return;
  }
  changeVesselModalEl.classList.remove('show');
  changeVesselModalEl.style.display = 'none';
  changeVesselModalEl.setAttribute('aria-hidden', 'true');
  changeVesselModalEl.removeAttribute('aria-modal');
}

async function loadTable(){
  const kw = q.value.trim();
  const sb = sortBy.value;
  const sd = sortDir.value;
  const fm = filterMonth.value;
  const fv = filterMotherVessel.value;
  const fd = filterDiscardedSI.value;

  const res = await apiGet(
    'list',
    `&q=${encodeURIComponent(kw)}&sort_by=${encodeURIComponent(sb)}&sort_dir=${encodeURIComponent(sd)}&filter_month=${encodeURIComponent(fm)}&filter_no_pk=${encodeURIComponent(fv)}&filter_discarded=${encodeURIComponent(fd)}`
  );
  if (!res.ok){
    tbody.innerHTML = `<tr><td colspan="12" class="text-danger">Error: ${esc(res.msg)}</td></tr>`;
    return;
  }
  if (!res.data.length){
    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted">No data</td></tr>`;
    return;
  }
  tbody.innerHTML = res.data.map(rowTemplate).join('');
}

/* ===== Vessel dropdown change → auto fill ===== */
no_pk.addEventListener('change', async ()=>{
  const v = no_pk.value.trim();
  no_si_vessel.value = "";
  anchorage.value = "";
  buyerHidden.value = "";
  mothervesselHidden.value = "";
  if (!v) return;

  const res = await apiGet('vessel_get', `&no_pk=${encodeURIComponent(v)}`);
  if (!res.ok){
    showAlert('danger', res.msg);
    return;
  }
  no_si_vessel.value = res.data.no_si_vessel ?? '';
  anchorage.value = res.data.anchorage ?? '';
  buyerHidden.value = res.data.buyer ?? '';
  mothervesselHidden.value = res.data.mothervessel ?? '';
});

/* ===== Vessel Search filter + Enter auto-select ===== */
function filterVesselOptions(){
  const kw = vesselSearch.value.trim().toLowerCase();
  const opts = no_pk.querySelectorAll('option');
  let firstVisibleValue = "";
  opts.forEach((opt, idx)=>{
    if (idx === 0) return;
    const text = opt.getAttribute('data-text') || '';
    const show = (!kw || text.includes(kw));
    opt.style.display = show ? '' : 'none';
    if (show && !firstVisibleValue) firstVisibleValue = opt.value;
  });
  return firstVisibleValue;
}
vesselSearch.addEventListener('input', filterVesselOptions);
vesselSearch.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter'){
    e.preventDefault();
    const v = filterVesselOptions();
    if (v){
      no_pk.value = v;
      no_pk.dispatchEvent(new Event('change'));
    }
  }
});

changeVesselSearch.addEventListener('input', ()=>{
  renderChangeVesselOptions(changeVesselSearch.value, changeVesselNoPk.value);
});
changeVesselSearch.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter'){
    e.preventDefault();
    const firstValue = renderChangeVesselOptions(changeVesselSearch.value, changeVesselNoPk.value);
    if (firstValue) changeVesselNoPk.value = firstValue;
  }
});
btnSaveChangeVessel.addEventListener('click', async ()=>{
  const targetNoPk = changeVesselNoPk.value.trim();
  if (!changeVesselRowId || !targetNoPk){
    showAlert('warning', 'Pilih vessel terlebih dahulu.');
    return;
  }

  btnSaveChangeVessel.disabled = true;
  const res = await apiPost('change_vessel', { id: changeVesselRowId, no_pk: targetNoPk });
  btnSaveChangeVessel.disabled = false;

  if (res.ok){
    hideChangeVesselModal();
    showAlert('success', res.msg);
    await loadTable();
  } else {
    showAlert('danger', res.msg);
  }
});

/* ===== Laycan: end = start + 1 day ===== */
function addDaysISO(iso, days){
  if (!iso) return '';
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
laycanStart.addEventListener('change', ()=>{
  laycanEnd.value = addDaysISO(laycanStart.value, 1);
});

/* ===== Tug/Barge suggestions (datalist) ===== */
let tugT=null, barT=null;
tugboat.addEventListener('input', ()=>{
  clearTimeout(tugT);
  tugT=setTimeout(async ()=>{
    const kw = tugboat.value.trim();
    const res = await apiGet('tug_list', `&q=${encodeURIComponent(kw)}`);
    if (!res.ok) return;
    dlTugboat.innerHTML = res.data.map(v=> `<option value="${esc(v)}"></option>`).join('');
  }, 180);
});
barge.addEventListener('input', ()=>{
  clearTimeout(barT);
  barT=setTimeout(async ()=>{
    const kw = barge.value.trim();
    const res = await apiGet('barge_list', `&q=${encodeURIComponent(kw)}`);
    if (!res.ok) return;
    dlBarge.innerHTML = res.data.map(v=> `<option value="${esc(v)}"></option>`).join('');
  }, 180);
});

/* ===== Create ===== */
formCreate.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(formCreate);

  if (laycanStart.value && !laycanEnd.value) {
    laycanEnd.value = addDaysISO(laycanStart.value, 1);
  }

  const data = Object.fromEntries(fd.entries());
  const res = await apiPost('create', data);

  if (res.ok){
    showAlert('success', res.msg);

    formCreate.reset();
    no_si_vessel.value = "";
    anchorage.value = "";
    buyerHidden.value = "";
    mothervesselHidden.value = "";
    laycanEnd.value = "";

    await loadTable();
    no_pk.focus();
  } else {
    showAlert('danger', res.msg);
  }
});

/* ===== Update/Delete in table ===== */
tbody.addEventListener('click', async (e)=>{
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.getAttribute('data-id');

  if (e.target.classList.contains('btnChangeVessel')){
    openChangeVesselModal(tr);
  }

  if (e.target.classList.contains('btnDelete')){
    if (!confirm(`Hapus SI Barges ini?`)) return;
    const res = await apiPost('delete', { id });
    if (res.ok){
      showAlert('success', res.msg);
      tr.remove();
      if (!tbody.children.length) tbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted">No data</td></tr>`;
    } else {
      showAlert('danger', res.msg);
    }
  }

  if (e.target.classList.contains('btnUpdate')){
    const getVal = (name)=> tr.querySelector(`[name="${name}"]`)?.value ?? '';

    const startStr = getVal('laycan_start');
    const endStr = addDaysToDDMonYY(startStr, 1);
    const endEl = tr.querySelector(`[name="laycan_end"]`);
    if (endEl) endEl.value = endStr;

    const payload = {
      id,
      tugboat: getVal('tugboat'),
      barge: getVal('barge'),
      term: getVal('term'),
      anchorage: getVal('anchorage'),
      qty_plan: getVal('qty_plan'),
      jetty_code: getVal('jetty_code'),      // sekarang dari dropdown
      shipper_code: getVal('shipper_code').trim().toUpperCase(),
      laycan_start: startStr,
      laycan_end: endStr,
      record_status: getVal('record_status'),
      remarks: '',
    };

    const res = await apiPost('update', payload);
    if (res.ok){
      showAlert('success', res.msg);
      await loadTable();
    } else {
      showAlert('danger', res.msg);
    }
  }
});

/* ===== Search/Sort ===== */
let t = null;
q.addEventListener('input', ()=>{
  clearTimeout(t);
  t = setTimeout(loadTable, 200);
});
btnReset.addEventListener('click', ()=>{
  q.value = "";
  filterMonth.value = "";
  filterMotherVessel.value = "";
  filterDiscardedSI.value = "hide";
  loadTable();
});
sortBy.addEventListener('change', loadTable);
sortDir.addEventListener('change', loadTable);
filterMonth.addEventListener('change', loadTable);
filterMotherVessel.addEventListener('change', loadTable);
filterDiscardedSI.addEventListener('change', loadTable);
btnFilterReset.addEventListener('click', ()=>{
  filterMonth.value = "";
  filterMotherVessel.value = "";
  filterDiscardedSI.value = "hide";
  loadTable();
});

/* ===== Import CSV ===== */
formImport.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!csvFile.files.length){
    showImportAlert('warning', 'Pilih file CSV dulu.');
    return;
  }

  const fd = new FormData();
  fd.append('action', 'import_csv');
  fd.append('csv', csvFile.files[0]);

  const r = await fetch(`${SELF}?ajax=1`, { method:'POST', body: fd });
  const res = await r.json();

  if (res.ok){
    showImportAlert(res.partial ? 'warning' : 'success', res.msg);
    csvFile.value = "";
    await loadTable();
  } else {
    showImportAlert('danger', res.msg);
  }
});

if (btnDeleteAll){
  btnDeleteAll.addEventListener('click', async ()=>{
    if (!confirm('Hapus SEMUA data SI Barges? Tindakan ini tidak bisa dibatalkan.')) return;
    const res = await apiPost('delete_all', {});
    if (res.ok){
      showAlert('success', res.msg);
      await loadTable();
    } else {
      showAlert('danger', res.msg);
    }
  });
}

loadTable();
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
