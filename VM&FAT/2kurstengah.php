<?php
session_start();
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}
$pageTitle = "Kurs Tengah - MLP Logistic";

/**
 * BI webservice (wskursbi.asmx), HTTP GET form
 * Method: getSubKursLokal3(mts, startdate, enddate)
 * Date format: yyyy-mm-dd
 */
function fetchKursLokal($mts, $startDate, $endDate)
{
  $url = 'https://www.bi.go.id/biwebservice/wskursbi.asmx/getSubKursLokal3?' . http_build_query([
    'mts'       => $mts,
    'startdate' => $startDate,
    'enddate'   => $endDate,
  ]);

  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
  ]);
  $raw = curl_exec($ch);
  $failed = curl_errno($ch) !== 0;

  if ($failed || !$raw) return null; // transient failure, worth retrying

  libxml_use_internal_errors(true);
  $dom = new DOMDocument();
  if (!$dom->loadXML($raw)) return null; // transient failure, worth retrying

  $xp = new DOMXPath($dom);
  $tables = $xp->query('//*[local-name()="Table"]');

  $rows = [];
  foreach ($tables as $t) {
    $tgl  = $xp->query('.//*[local-name()="tgl_subkurslokal"]', $t)->item(0);
    $jual = $xp->query('.//*[local-name()="jual_subkurslokal"]', $t)->item(0);
    $beli = $xp->query('.//*[local-name()="beli_subkurslokal"]', $t)->item(0);
    if (!$tgl || !$jual || !$beli) continue;
    $j = (float)$jual->textContent;
    $b = (float)$beli->textContent;
    $rows[] = [
      'tanggal' => $tgl->textContent,
      'jual'    => $j,
      'beli'    => $b,
      'tengah'  => ($j + $b) / 2,
    ];
  }
  return $rows;
}

function fetchKursLokalCached($mts, $startDate, $endDate, $ttlSeconds = 900)
{
  $cacheDir = __DIR__ . '/cache';
  if (!is_dir($cacheDir)) @mkdir($cacheDir, 0775, true);

  $cacheFile = $cacheDir . '/kurstengah_' . md5($mts . '|' . $startDate . '|' . $endDate) . '.json';

  if (is_file($cacheFile) && (time() - filemtime($cacheFile) < $ttlSeconds)) {
    $cached = json_decode(file_get_contents($cacheFile), true);
    if (is_array($cached)) return $cached;
  }

  $data = fetchKursLokal($mts, $startDate, $endDate);
  if ($data !== null) {
    @file_put_contents($cacheFile, json_encode($data));
  }
  return $data; // null = fetch failed (retry-worthy), [] = fetched OK but no rows
}

function formatTanggalID($isoDate)
{
  static $bulan = [1=>'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  try {
    $dt = new DateTime($isoDate);
  } catch (Exception $e) {
    return $isoDate;
  }
  return $dt->format('j') . ' ' . $bulan[(int)$dt->format('n')] . ' ' . $dt->format('Y');
}

function formatRupiah($n)
{
  return 'Rp' . number_format($n, 2, ',', '.');
}

function validDateStr($s)
{
  if (!$s) return false;
  $dt = DateTime::createFromFormat('Y-m-d', $s);
  return ($dt && $dt->format('Y-m-d') === $s) ? $dt : false;
}

$mts = 'USD';
$tz  = new DateTimeZone('Asia/Jakarta');
$now = new DateTime('now', $tz);

$dariInput   = $_GET['dari'] ?? '';
$sampaiInput = $_GET['sampai'] ?? '';
$dariDt      = validDateStr($dariInput);
$sampaiDt    = validDateStr($sampaiInput);
$isCustomRange = ($dariDt && $sampaiDt);

if ($isCustomRange) {
  $startDate = $dariDt;
  $endDate   = $sampaiDt;
} else {
  $endDate   = (clone $now)->modify('+5 days');
  $startDate = (clone $now)->modify('-45 days');
}

$retry  = max(0, (int)($_GET['retry'] ?? 0));
$fetch  = fetchKursLokalCached($mts, $startDate->format('Y-m-d'), $endDate->format('Y-m-d'));
$fetchFailed = ($fetch === null);
$data = $fetchFailed ? [] : $fetch;

usort($data, fn($a, $b) => strcmp($b['tanggal'], $a['tanggal']));

$perPage    = 15;
$totalRows  = count($data);
$totalPages = max(1, (int)ceil($totalRows / $perPage));
$page       = max(1, (int)($_GET['page'] ?? 1));
$page       = min($page, $totalPages);
$pageData   = array_slice($data, ($page - 1) * $perPage, $perPage);

function pageUrl($page)
{
  $params = $_GET;
  $params['page'] = $page;
  unset($params['retry']);
  return '?' . http_build_query($params);
}

$maxRetries = 5;
$shouldAutoReload = $fetchFailed && $retry < $maxRetries;

if ($shouldAutoReload) {
  $reloadParams = $_GET;
  $reloadParams['retry'] = $retry + 1;
  $reloadUrl = '?' . http_build_query($reloadParams);
}

include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<div class="content">
  <div class="card shadow-sm mb-3">
    <div class="card-body">
      <h5 class="mb-3">Periode</h5>
      <form method="get" class="row g-3 align-items-end">
        <div class="col-auto">
          <label for="dari" class="form-label mb-1">Dari</label>
          <input type="date" id="dari" name="dari" class="form-control" value="<?= htmlspecialchars($dariInput) ?>">
        </div>
        <div class="col-auto">
          <label for="sampai" class="form-label mb-1">Sampai</label>
          <input type="date" id="sampai" name="sampai" class="form-control" value="<?= htmlspecialchars($sampaiInput) ?>">
        </div>
        <div class="col-auto">
          <button type="submit" class="btn btn-primary px-4" style="background:#0d4d94; border-color:#0d4d94;">Cari</button>
        </div>
        <div class="col-auto">
          <a href="<?= htmlspecialchars(basename(__FILE__)) ?>" class="btn btn-outline-secondary px-4">15 Hari Terakhir</a>
        </div>
      </form>
    </div>
  </div>

  <div class="card shadow-sm">
    <div class="card-body p-0">
      <table class="table mb-0 align-middle">
        <thead>
          <tr>
            <th class="py-3 px-4 text-white" style="background:#0d4d94;">Tanggal</th>
            <th class="py-3 px-4 text-white" style="background:#0d4d94;">Kurs Jual</th>
            <th class="py-3 px-4 text-white" style="background:#0d4d94;">Kurs Beli</th>
            <th class="py-3 px-4 text-white" style="background:#0d4d94;">Kurs Tengah</th>
          </tr>
        </thead>
        <tbody>
          <?php if ($shouldAutoReload): ?>
            <tr><td colspan="4" class="text-center text-muted py-4">Loading&hellip;</td></tr>
          <?php elseif ($fetchFailed): ?>
            <tr><td colspan="4" class="text-center text-muted py-4">Gagal memuat data. <a href="?<?= htmlspecialchars(http_build_query(array_merge($_GET, ['retry' => 0]))) ?>">Coba lagi</a>.</td></tr>
          <?php elseif (empty($data)): ?>
            <tr><td colspan="4" class="text-center text-muted py-4">Data tidak tersedia.</td></tr>
          <?php else: foreach ($pageData as $row): ?>
            <tr>
              <td class="px-4"><?= htmlspecialchars(formatTanggalID($row['tanggal'])) ?></td>
              <td class="px-4"><?= htmlspecialchars(formatRupiah($row['jual'])) ?></td>
              <td class="px-4"><?= htmlspecialchars(formatRupiah($row['beli'])) ?></td>
              <td class="px-4"><?= htmlspecialchars(formatRupiah($row['tengah'])) ?></td>
            </tr>
          <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>

    <?php if (!$shouldAutoReload && !$fetchFailed && $totalRows > 0): ?>
      <div class="card-footer d-flex justify-content-between align-items-center bg-white">
        <a href="<?= htmlspecialchars(pageUrl($page - 1)) ?>"
           class="btn btn-outline-secondary btn-sm<?= $page <= 1 ? ' disabled' : '' ?>">&laquo; Sebelumnya</a>
        <span class="text-muted small">Halaman <?= $page ?> dari <?= $totalPages ?></span>
        <a href="<?= htmlspecialchars(pageUrl($page + 1)) ?>"
           class="btn btn-outline-secondary btn-sm<?= $page >= $totalPages ? ' disabled' : '' ?>">Berikutnya &raquo;</a>
      </div>
    <?php endif; ?>
  </div>
</div>

<?php if ($shouldAutoReload): ?>
<script>
  setTimeout(function () {
    window.location.href = <?= json_encode($reloadUrl) ?>;
  }, 2000);
</script>
<?php endif; ?>

<?php include __DIR__ . "/../includes/footer.php"; ?>
