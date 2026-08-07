<?php
session_start();
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

require_once __DIR__ . '/../config/database.php';

try {
  $koneksi = db_connect('databarging');
} catch (RuntimeException $exception) {
  http_response_code(500);
  die(htmlspecialchars($exception->getMessage(), ENT_QUOTES, 'UTF-8'));
}

function ensure_fuel_table(mysqli $connection): void
{
  static $checked = false;
  if ($checked) return;

  $connection->query(
    "CREATE TABLE IF NOT EXISTS fuel (
      bulan_tahun VARCHAR(10) NOT NULL,
      periode TINYINT NOT NULL,
      pertamina DECIMAL(15,2) NOT NULL DEFAULT 0,
      ici3 DECIMAL(15,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (bulan_tahun, periode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  $existing = $connection->query("SHOW COLUMNS FROM fuel LIKE 'ici3'");
  if ($existing && $existing->num_rows === 0) {
    $connection->query("ALTER TABLE fuel ADD COLUMN ici3 DECIMAL(15,2) NOT NULL DEFAULT 0");
  }

  $connection->query(
    "CREATE TABLE IF NOT EXISTS fuel_rates (
      tahun SMALLINT NOT NULL,
      ppn_rate DECIMAL(6,3) NOT NULL DEFAULT 11,
      pbbkb_rate DECIMAL(6,3) NOT NULL DEFAULT 7.5,
      pph22_rate DECIMAL(6,3) NOT NULL DEFAULT 0.3,
      PRIMARY KEY (tahun)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  $checked = true;
}

ensure_fuel_table($koneksi);

const DEFAULT_PPN_RATE   = 11;
const DEFAULT_PBBKB_RATE = 7.5;
const DEFAULT_PPH22_RATE = 0.3;
const FUEL_RATE_FIELDS = ['ppn_rate', 'pbbkb_rate', 'pph22_rate'];
const FUEL_VALUE_FIELDS = ['pertamina', 'ici3'];

/* ========= AJAX SAVE ========= */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_fuel') {
  header('Content-Type: application/json');

  $bulanTahun = trim((string)($_POST['bulan_tahun'] ?? ''));
  $periode    = (int)($_POST['periode'] ?? 0);
  $field      = (string)($_POST['field'] ?? 'pertamina');
  $value      = (float)str_replace(',', '', (string)($_POST['value'] ?? '0'));

  if ($bulanTahun === '' || !in_array($periode, [1, 2], true) || !in_array($field, FUEL_VALUE_FIELDS, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input']);
    exit;
  }

  $stmt = $koneksi->prepare(
    "INSERT INTO fuel (bulan_tahun, periode, $field) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE $field = VALUES($field)"
  );
  $stmt->bind_param('sid', $bulanTahun, $periode, $value);
  $stmt->execute();
  $stmt->close();

  echo json_encode(['ok' => true]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_fuel_rate') {
  header('Content-Type: application/json');

  $tahunPost = (int)($_POST['tahun'] ?? 0);
  $field     = (string)($_POST['field'] ?? '');
  $value     = (float)str_replace(',', '', (string)($_POST['value'] ?? '0'));

  if ($tahunPost <= 0 || !in_array($field, FUEL_RATE_FIELDS, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input']);
    exit;
  }

  $stmt = $koneksi->prepare(
    "INSERT INTO fuel_rates (tahun, $field) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE $field = VALUES($field)"
  );
  $stmt->bind_param('id', $tahunPost, $value);
  $stmt->execute();
  $stmt->close();

  echo json_encode(['ok' => true]);
  exit;
}

/* ========= LOAD EXISTING ========= */
$fuelData = [];
$result = $koneksi->query("SELECT bulan_tahun, periode, pertamina, ici3 FROM fuel");
while ($row = $result->fetch_assoc()) {
  $fuelData[$row['bulan_tahun']][(int)$row['periode']] = [
    'pertamina' => (float)$row['pertamina'],
    'ici3'      => (float)$row['ici3'],
  ];
}

$currentYear = (int)date('Y');
$tahun = (int)($_GET['tahun'] ?? $currentYear);
$tahunOptions = range($currentYear, $currentYear + 10);

$ppnRate   = DEFAULT_PPN_RATE;
$pbbkbRate = DEFAULT_PBBKB_RATE;
$pph22Rate = DEFAULT_PPH22_RATE;
$stmt = $koneksi->prepare("SELECT ppn_rate, pbbkb_rate, pph22_rate FROM fuel_rates WHERE tahun = ?");
$stmt->bind_param('i', $tahun);
$stmt->execute();
$rateRow = $stmt->get_result()->fetch_assoc();
$stmt->close();
if ($rateRow) {
  $ppnRate   = (float)$rateRow['ppn_rate'];
  $pbbkbRate = (float)$rateRow['pbbkb_rate'];
  $pph22Rate = (float)$rateRow['pph22_rate'];
}

$pageTitle = "Fuel - MLP Logistic";

include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<div class="content">
  <div class="card shadow-sm mb-3">
    <div class="card-body">
      <h5 class="mb-3">Input</h5>
      <div class="row g-3">
        <div class="col-auto">
          <label for="tahun" class="form-label mb-1">Tahun</label>
          <select id="tahun" class="form-select" style="max-width:150px;" onchange="location.href='?tahun='+this.value">
            <?php foreach ($tahunOptions as $y): ?>
              <option value="<?= $y ?>"<?= $y === $tahun ? ' selected' : '' ?>><?= $y ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="col-auto">
          <label for="ppnRate" class="form-label mb-1">PPN</label>
          <div class="input-group" style="max-width:150px;">
            <input type="text" inputmode="decimal" id="ppnRate" class="form-control rate-input" data-field="ppn_rate" value="<?= htmlspecialchars(rtrim(rtrim(number_format($ppnRate, 3, '.', ''), '0'), '.')) ?>">
            <span class="input-group-text">%</span>
          </div>
        </div>
        <div class="col-auto">
          <label for="pbbkbRate" class="form-label mb-1">PBBKB</label>
          <div class="input-group" style="max-width:150px;">
            <input type="text" inputmode="decimal" id="pbbkbRate" class="form-control rate-input" data-field="pbbkb_rate" value="<?= htmlspecialchars(rtrim(rtrim(number_format($pbbkbRate, 3, '.', ''), '0'), '.')) ?>">
            <span class="input-group-text">%</span>
          </div>
        </div>
        <div class="col-auto">
          <label for="pph22Rate" class="form-label mb-1">PPH22</label>
          <div class="input-group" style="max-width:150px;">
            <input type="text" inputmode="decimal" id="pph22Rate" class="form-control rate-input" data-field="pph22_rate" value="<?= htmlspecialchars(rtrim(rtrim(number_format($pph22Rate, 3, '.', ''), '0'), '.')) ?>">
            <span class="input-group-text">%</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card shadow-sm">
    <div class="card-body p-0">
      <table class="table mb-0 align-middle">
        <thead>
          <tr>
            <th class="py-3 px-4 text-white text-center align-middle" style="background:#0d4d94;">Bulan-Tahun</th>
            <th class="py-3 px-4 text-white text-center align-middle" style="background:#0d4d94;">Periode</th>
            <th class="py-3 px-4 text-white text-center align-middle" style="background:#0d4d94;">Pertamina</th>
            <th class="py-3 px-4 text-white text-center align-middle" style="background:#0d4d94;">PPN</th>
            <th class="py-3 px-4 text-white text-center align-middle" style="background:#0d4d94;">PBBKB</th>
            <th class="py-3 px-4 text-white text-center align-middle" style="background:#0d4d94;">PPH22</th>
            <th class="py-3 px-4 text-white text-center align-middle" style="background:#0d4d94;">Total</th>
            <th class="py-3 px-4 text-white text-center align-middle" style="background:#0d4d94;">ICI-3</th>
          </tr>
        </thead>
        <tbody>
          <?php
          $bulanNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          $yy = substr((string)$tahun, -2);
          $bulanTahun = array_map(fn($m) => "$m-$yy", $bulanNames);
          foreach ($bulanTahun as $bt):
            foreach ([1, 2] as $periode):
              $pertamina = $fuelData[$bt][$periode]['pertamina'] ?? null;
              $ici3      = $fuelData[$bt][$periode]['ici3'] ?? null;
            ?>
            <tr class="fuel-row">
              <?php if ($periode === 1): ?>
              <td class="px-4" rowspan="2"><?= htmlspecialchars($bt) ?></td>
              <?php endif; ?>
              <td class="px-4"><?= $periode ?></td>
              <td class="px-4">
                <input type="text" inputmode="decimal" class="form-control pertamina-input"
                       name="pertamina[<?= htmlspecialchars($bt) ?>][<?= $periode ?>]"
                       data-field="pertamina" data-bulan-tahun="<?= htmlspecialchars($bt) ?>" data-periode="<?= $periode ?>"
                       value="<?= $pertamina !== null && $pertamina !== 0.0 ? number_format($pertamina, 2) : '' ?>">
              </td>
              <td class="px-4"><input type="text" class="form-control ppn-output" readonly tabindex="-1"></td>
              <td class="px-4"><input type="text" class="form-control pbbkb-output" readonly tabindex="-1"></td>
              <td class="px-4"><input type="text" class="form-control pph22-output" readonly tabindex="-1"></td>
              <td class="px-4"><input type="text" class="form-control total-output" readonly tabindex="-1"></td>
              <td class="px-4">
                <input type="text" inputmode="decimal" class="form-control ici3-input"
                       name="ici3[<?= htmlspecialchars($bt) ?>][<?= $periode ?>]"
                       data-field="ici3" data-bulan-tahun="<?= htmlspecialchars($bt) ?>" data-periode="<?= $periode ?>"
                       value="<?= $ici3 !== null && $ici3 !== 0.0 ? number_format($ici3, 2) : '' ?>">
              </td>
            </tr>
          <?php endforeach; endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
  const rateInputs = {
    ppn_rate:   document.getElementById('ppnRate'),
    pbbkb_rate: document.getElementById('pbbkbRate'),
    pph22_rate: document.getElementById('pph22Rate'),
  };

  function parseNumber(str) {
    return parseFloat(String(str).replace(/,/g, '')) || 0;
  }

  function formatNumber(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function calcRow(input) {
    const row = input.closest('tr');

    if (input.value.trim() === '') {
      row.querySelector('.ppn-output').value   = '';
      row.querySelector('.pbbkb-output').value = '';
      row.querySelector('.pph22-output').value = '';
      row.querySelector('.total-output').value = '';
      return;
    }

    const pertamina = parseNumber(input.value);
    const ppnRate   = parseNumber(rateInputs.ppn_rate.value) / 100;
    const pbbkbRate = parseNumber(rateInputs.pbbkb_rate.value) / 100;
    const pph22Rate = parseNumber(rateInputs.pph22_rate.value) / 100;

    const ppn   = pertamina * ppnRate;
    const pbbkb = pertamina * pbbkbRate;
    const pph22 = pertamina * pph22Rate;
    const total = pertamina + ppn + pbbkb + pph22;

    row.querySelector('.ppn-output').value   = formatNumber(ppn);
    row.querySelector('.pbbkb-output').value = formatNumber(pbbkb);
    row.querySelector('.pph22-output').value = formatNumber(pph22);
    row.querySelector('.total-output').value = formatNumber(total);
  }

  function calcAllRows() {
    document.querySelectorAll('.pertamina-input').forEach(calcRow);
  }

  function saveRow(input) {
    const body = new URLSearchParams({
      action: 'save_fuel',
      bulan_tahun: input.dataset.bulanTahun,
      periode: input.dataset.periode,
      field: input.dataset.field,
      value: parseNumber(input.value),
    });
    fetch(window.location.pathname, { method: 'POST', body });
  }

  function saveRate(input) {
    const body = new URLSearchParams({
      action: 'save_fuel_rate',
      tahun: document.getElementById('tahun').value,
      field: input.dataset.field,
      value: parseNumber(input.value),
    });
    fetch(window.location.pathname, { method: 'POST', body });
  }

  document.querySelectorAll('.pertamina-input').forEach(function (input) {
    input.addEventListener('input', function () {
      calcRow(input);
    });

    input.addEventListener('blur', function () {
      if (input.value !== '') {
        input.value = formatNumber(parseNumber(input.value));
      }
      saveRow(input);
    });
  });

  document.querySelectorAll('.ici3-input').forEach(function (input) {
    input.addEventListener('blur', function () {
      if (input.value !== '') {
        input.value = formatNumber(parseNumber(input.value));
      }
      saveRow(input);
    });
  });

  Object.values(rateInputs).forEach(function (input) {
    input.addEventListener('input', calcAllRows);

    input.addEventListener('blur', function () {
      if (input.value !== '') {
        input.value = parseNumber(input.value);
      }
      saveRate(input);
    });
  });

  calcAllRows();
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
