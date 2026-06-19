<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

/* ========= SELF PATH (penting untuk AJAX & download template) ========= */
$SELF = "/logistic/Operation/1vessel.php";

/* ========= DB CONFIG ========= */
$host = "127.0.0.1";
$user = "root";
$pass = "";
$db   = "databarging";   // <- pastikan DB lo benar
$port = 3306;            // <- 3306 kalau normal

$koneksi = new mysqli($host, $user, $pass, $db, $port);
if ($koneksi->connect_error) die("Koneksi DB gagal: " . $koneksi->connect_error);
$koneksi->set_charset("utf8mb4");

/* ========= HELPERS ========= */
function clean($s){ return trim((string)$s); }

function cleanAnchorage($s){
  $value = strtoupper(clean($s));
  $allowed = ['MUARA BERAU', 'MUARA JAWA', 'PRIMA ANCHORAGE'];
  return in_array($value, $allowed, true) ? $value : '';
}

function cleanTerm($s){
  $value = strtoupper(clean($s));
  $allowed = ['FOB', 'FAS', 'CIF'];
  return in_array($value, $allowed, true) ? $value : '';
}

function toDate($s){
  $s = clean($s);
  if ($s === "") return null;

  // accept: YYYY-MM-DD
  if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return $s;

  // accept: dd/mmm/yy or dd/mmm/yyyy (05/Nov/25)
  $ts = strtotime($s);
  if ($ts) return date("Y-m-d", $ts);

  return null;
}

function toDecimal($s){
  $s = clean($s);
  if ($s === "" || $s === "-") return 0;

  // remove thousand separator / spaces
  $s = str_replace([",", " "], "", $s);
  return is_numeric($s) ? (float)$s : 0;
}

function jsonOut($arr){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr);
  exit;
}

/* ========= CSV TEMPLATE DOWNLOAD ========= */
if (isset($_GET['download']) && $_GET['download'] === 'vessel_template') {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="vessel_template.csv"');

  $out = fopen('php://output', 'w');
  fputcsv($out, [
    'no_pk','no_si_vessel','buyer','mothervessel','anchorage','term',
    'laycan_start','laycan_end','ta_vessel',
    'single_mt','blending_mt','stowageplan_mt','loading_rate_kontrak'
  ]);

  // contoh baris (optional)
  fputcsv($out, ['G.25-052','060','BCPCL','MV. KENZEN','MUARA BERAU','FOB','2025-11-05','2025-11-14','2025-11-07','60500','0','60500','10000']);
  fputcsv($out, ['M.25-178','160','JAWA POWER','MV. MURSYID','MUARA JAWA','CIF','05/Nov/25','09/Nov/25','04/Nov/25','55000','0','55000','10000']);
  fclose($out);
  exit;
}

/* ========= AJAX API (same file) ========= */
if (isset($_GET['ajax']) && $_GET['ajax'] === '1') {

  $action = $_POST['action'] ?? $_GET['action'] ?? '';

  // ===== LIST + SEARCH =====
  if ($action === 'list') {
    $q = clean($_GET['q'] ?? '');
    $sql = "SELECT no_pk, no_si_vessel, buyer, mothervessel, anchorage, term, laycan_start, laycan_end, ta_vessel,
                   single_mt, blending_mt, stowageplan_mt, loading_rate_kontrak, created_at
            FROM vessel";
    $types = "";
    $params = [];

    if ($q !== "") {
      $sql .= " WHERE no_pk LIKE ? OR no_si_vessel LIKE ? OR buyer LIKE ? OR mothervessel LIKE ? OR anchorage LIKE ? OR term LIKE ?";
      $kw = "%{$q}%";
      $types = "ssssss";
      $params = [$kw,$kw,$kw,$kw,$kw,$kw];
    }

    $sql .= " ORDER BY created_at DESC, no_pk DESC LIMIT 500";

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
    $no_pk        = clean($_POST['no_pk'] ?? '');
    $no_si_vessel = clean($_POST['no_si_vessel'] ?? '');
    $buyer        = clean($_POST['buyer'] ?? '');
    $mothervessel = clean($_POST['mothervessel'] ?? '');
    $anchorage    = cleanAnchorage($_POST['anchorage'] ?? '');
    $term          = cleanTerm($_POST['term'] ?? '');

    $laycan_start = toDate($_POST['laycan_start'] ?? '');
    $laycan_end   = toDate($_POST['laycan_end'] ?? '');
    $ta_vessel    = toDate($_POST['ta_vessel'] ?? '');

    $single   = toDecimal($_POST['single_mt'] ?? '');
    $blending = toDecimal($_POST['blending_mt'] ?? '');
    $stowage  = toDecimal($_POST['stowageplan_mt'] ?? '');
    $loadingRateKontrak = toDecimal($_POST['loading_rate_kontrak'] ?? '');
    if ($stowage == 0) $stowage = $single + $blending;

    if ($no_pk === "" || $no_si_vessel === "" || $buyer === "" || $mothervessel === "" || $anchorage === "" || $term === "") {
      jsonOut(["ok"=>false,"msg"=>"No PK, No SI Vessel, Buyer, MotherVessel, Anchorage, dan Term wajib diisi."]);
    }

    // duplicate check
    $stmt = $koneksi->prepare("SELECT COUNT(*) c FROM vessel WHERE no_pk=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $no_pk);
    $stmt->execute();
    $c = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
    $stmt->close();
    if ($c > 0) {
      jsonOut(["ok"=>false,"msg"=>"No PK sudah ada. Harus unik."]);
    }

    $stmt = $koneksi->prepare("INSERT INTO vessel
      (no_pk, no_si_vessel, buyer, mothervessel, anchorage, term, laycan_start, laycan_end, ta_vessel, single_mt, blending_mt, stowageplan_mt, loading_rate_kontrak)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);

    $stmt->bind_param(
      "sssssssssdddd",
      $no_pk, $no_si_vessel, $buyer, $mothervessel, $anchorage, $term,
      $laycan_start, $laycan_end, $ta_vessel,
      $single, $blending, $stowage, $loadingRateKontrak
    );

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data vessel berhasil ditambah."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== UPDATE =====
  if ($action === 'update') {
    $no_pk        = clean($_POST['no_pk'] ?? '');
    $no_si_vessel = clean($_POST['no_si_vessel'] ?? '');
    $buyer        = clean($_POST['buyer'] ?? '');
    $mothervessel = clean($_POST['mothervessel'] ?? '');
    $anchorage    = cleanAnchorage($_POST['anchorage'] ?? '');
    $term          = cleanTerm($_POST['term'] ?? '');

    $laycan_start = toDate($_POST['laycan_start'] ?? '');
    $laycan_end   = toDate($_POST['laycan_end'] ?? '');
    $ta_vessel    = toDate($_POST['ta_vessel'] ?? '');

    $single   = toDecimal($_POST['single_mt'] ?? '');
    $blending = toDecimal($_POST['blending_mt'] ?? '');
    $stowage  = toDecimal($_POST['stowageplan_mt'] ?? '');
    $loadingRateKontrak = toDecimal($_POST['loading_rate_kontrak'] ?? '');
    if ($stowage == 0) $stowage = $single + $blending;

    if ($no_pk === "" || $no_si_vessel === "" || $buyer === "" || $mothervessel === "" || $anchorage === "" || $term === "") {
      jsonOut(["ok"=>false,"msg"=>"Data update tidak valid."]);
    }

    $stmt = $koneksi->prepare("UPDATE vessel
      SET no_si_vessel=?, buyer=?, mothervessel=?, anchorage=?, term=?, laycan_start=?, laycan_end=?, ta_vessel=?,
          single_mt=?, blending_mt=?, stowageplan_mt=?, loading_rate_kontrak=?
      WHERE no_pk=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);

    $stmt->bind_param(
      "ssssssssdddds",
      $no_si_vessel, $buyer, $mothervessel, $anchorage, $term, $laycan_start, $laycan_end, $ta_vessel,
      $single, $blending, $stowage, $loadingRateKontrak,
      $no_pk
    );

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data vessel berhasil diupdate."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== DELETE =====
  if ($action === 'delete') {
    $no_pk = clean($_POST['no_pk'] ?? '');
    if ($no_pk === "") jsonOut(["ok"=>false,"msg"=>"No PK kosong."]);

    $stmt = $koneksi->prepare("DELETE FROM vessel WHERE no_pk=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $no_pk);
    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data vessel berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== IMPORT CSV (SKIP DUPLICATE no_pk) =====
  if ($action === 'import_csv') {
    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
      jsonOut(["ok"=>false,"msg"=>"File CSV tidak valid / gagal upload."]);
    }

    $tmp = $_FILES['csv']['tmp_name'];
    $fh = fopen($tmp, 'r');
    if (!$fh) jsonOut(["ok"=>false,"msg"=>"Tidak bisa membaca file CSV."]);

    // baca header
    $header = fgetcsv($fh);
    if (!$header) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"CSV kosong / header tidak ditemukan."]);
    }

    $header = array_map(function($h){
      $h = strtolower(trim((string)$h));
      return $h;
    }, $header);

    $required = [
      'no_pk','no_si_vessel','buyer','mothervessel','anchorage','term',
      'laycan_start','laycan_end','ta_vessel',
      'single_mt','blending_mt','stowageplan_mt','loading_rate_kontrak'
    ];

    // validasi header minimal harus mengandung kolom wajib
    foreach ($required as $col) {
      if (!in_array($col, $header, true)) {
        fclose($fh);
        jsonOut(["ok"=>false,"msg"=>"Header CSV salah. Wajib ada kolom: ".implode(", ", $required)]);
      }
    }

    $idx = array_flip($header);

    $inserted = 0;
    $skipped = 0;
    $errors = 0;

    // prepare statement insert
    $stmtIns = $koneksi->prepare("INSERT INTO vessel
      (no_pk, no_si_vessel, buyer, mothervessel, anchorage, term, laycan_start, laycan_end, ta_vessel, single_mt, blending_mt, stowageplan_mt, loading_rate_kontrak)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    if (!$stmtIns) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"Prepare insert gagal: ".$koneksi->error]);
    }

    // duplicate check stmt
    $stmtChk = $koneksi->prepare("SELECT COUNT(*) c FROM vessel WHERE no_pk=?");
    if (!$stmtChk) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"Prepare check gagal: ".$koneksi->error]);
    }

    $line = 1; // header = 1
    while (($row = fgetcsv($fh)) !== false) {
      $line++;

      // ambil value by header name
      $no_pk        = clean($row[$idx['no_pk']] ?? '');
      $no_si_vessel = clean($row[$idx['no_si_vessel']] ?? '');
      $buyer        = clean($row[$idx['buyer']] ?? '');
      $mothervessel = clean($row[$idx['mothervessel']] ?? '');
      $anchorage    = cleanAnchorage($row[$idx['anchorage']] ?? '');
      $term          = cleanTerm($row[$idx['term']] ?? '');

      $laycan_start = toDate($row[$idx['laycan_start']] ?? '');
      $laycan_end   = toDate($row[$idx['laycan_end']] ?? '');
      $ta_vessel    = toDate($row[$idx['ta_vessel']] ?? '');

      $single   = toDecimal($row[$idx['single_mt']] ?? '');
      $blending = toDecimal($row[$idx['blending_mt']] ?? '');
      $stowage  = toDecimal($row[$idx['stowageplan_mt']] ?? '');
      $loadingRateKontrak = toDecimal($row[$idx['loading_rate_kontrak']] ?? '');
      if ($stowage == 0) $stowage = $single + $blending;

      // minimal required
      if ($no_pk === "" || $no_si_vessel === "" || $buyer === "" || $mothervessel === "" || $anchorage === "" || $term === "") {
        $errors++;
        continue;
      }

      // check duplicate
      $stmtChk->bind_param("s", $no_pk);
      $stmtChk->execute();
      $c = (int)($stmtChk->get_result()->fetch_assoc()['c'] ?? 0);
      if ($c > 0) {
        $skipped++;
        continue;
      }

      $stmtIns->bind_param(
        "sssssssssdddd",
        $no_pk, $no_si_vessel, $buyer, $mothervessel, $anchorage, $term,
        $laycan_start, $laycan_end, $ta_vessel,
        $single, $blending, $stowage, $loadingRateKontrak
      );

      if ($stmtIns->execute()) $inserted++;
      else $errors++;
    }

    fclose($fh);
    $stmtIns->close();
    $stmtChk->close();

    jsonOut([
      "ok"=>true,
      "msg"=>"Import selesai. Inserted: {$inserted}, Skipped (duplicate No PK): {$skipped}, Error: {$errors}"
    ]);
  }

  jsonOut(["ok"=>false,"msg"=>"Unknown action"]);
}

/* ========= NORMAL PAGE ========= */
$pageTitle = "Vessel";
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<div class="content">

  <div class="d-flex align-items-center justify-content-between mb-3">
    <h4 class="m-0">Vessel</h4>

    <div class="d-flex gap-2 align-items-center">
      <input id="q" type="text" class="form-control form-control-sm" style="width:320px;"
             placeholder="Search (No PK / SI / Buyer / Vessel / Anchorage / Term)..." />
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
          <div class="small text-muted">
            Download template dulu, isi datanya, lalu upload. Duplicate <b>No PK</b> akan <b>di-skip</b>.
          </div>
        </div>

        <div class="d-flex gap-2 align-items-center">
          <a class="btn btn-sm btn-outline-primary" href="<?= $SELF ?>?download=vessel_template">
            Download Template CSV
          </a>

          <form id="formImport" class="d-flex gap-2 align-items-center">
            <input type="file" name="csv" id="csvFile" class="form-control form-control-sm" accept=".csv" required>
            <button class="btn btn-sm btn-primary" type="submit">Import</button>
          </form>
        </div>
      </div>
    </div>
  </div>

  <!-- FORM INPUT -->
  <div class="card mb-3">
    <div class="card-body">
      <h6 class="mb-3">Input Vessel</h6>

      <form id="formCreate" class="row g-2">
        <div class="col-md-2">
          <label class="form-label">No. PK</label>
          <input name="no_pk" class="form-control" placeholder="G.25-052" required>
        </div>

        <div class="col-md-2">
          <label class="form-label">No. SI Vessel</label>
          <input name="no_si_vessel" class="form-control" placeholder="060" required>
        </div>

        <div class="col-md-3">
          <label class="form-label">Buyer</label>
          <input name="buyer" class="form-control" placeholder="BCPCL" required>
        </div>

        <div class="col-md-3">
          <label class="form-label">MotherVessel</label>
          <input name="mothervessel" class="form-control" placeholder="MV. KENZEN" required>
        </div>

        <div class="col-md-2">
          <label class="form-label">Anchorage</label>
          <select name="anchorage" class="form-select" required>
            <option value="">-- pilih --</option>
            <option value="MUARA BERAU">MUARA BERAU</option>
            <option value="MUARA JAWA">MUARA JAWA</option>
            <option value="PRIMA ANCHORAGE">PRIMA ANCHORAGE</option>
          </select>
        </div>

        <div class="col-md-2">
          <label class="form-label">Term</label>
          <select name="term" class="form-select" required>
            <option value="">-- pilih --</option>
            <option value="FOB">FOB</option>
            <option value="FAS">FAS</option>
            <option value="CIF">CIF</option>
          </select>
        </div>

        <div class="col-md-2">
          <label class="form-label">Laycan Start</label>
          <input name="laycan_start" type="date" class="form-control">
        </div>

        <div class="col-md-2">
          <label class="form-label">Laycan End</label>
          <input name="laycan_end" type="date" class="form-control">
        </div>

        <div class="col-md-2">
          <label class="form-label">TA Vessel</label>
          <input name="ta_vessel" type="date" class="form-control">
        </div>

        <div class="col-md-2">
          <label class="form-label">Single (MT)</label>
          <input name="single_mt" class="form-control" placeholder="60500">
        </div>

        <div class="col-md-2">
          <label class="form-label">Blending (MT)</label>
          <input name="blending_mt" class="form-control" placeholder="0">
        </div>

        <div class="col-md-2">
          <label class="form-label">Stowageplan (MT)</label>
          <input name="stowageplan_mt" class="form-control" placeholder="(auto)">
          <div class="small text-muted">Kalau kosong, auto = Single + Blending</div>
        </div>

        <div class="col-md-2">
          <label class="form-label">Loading Rate Kontrak</label>
          <input name="loading_rate_kontrak" class="form-control" placeholder="0">
        </div>

        <div class="col-12">
          <button class="btn btn-success" type="submit">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- TABLE -->
  <div class="card">
    <div class="card-body">
      <h6 class="mb-3">Data Vessel</h6>

      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle" id="tbl">
          <thead class="table-light">
            <tr>
              <th style="min-width:120px;">No. PK</th>
              <th style="min-width:90px;">No. SI</th>
              <th style="min-width:140px;">Buyer</th>
              <th style="min-width:180px;">MotherVessel</th>
              <th style="min-width:170px;">Anchorage</th>
              <th style="min-width:100px;">Term</th>
              <th style="min-width:130px;">Laycan Start</th>
              <th style="min-width:130px;">Laycan End</th>
              <th style="min-width:120px;">TA Vessel</th>
              <th style="min-width:110px;">Single</th>
              <th style="min-width:110px;">Blending</th>
              <th style="min-width:120px;">Stowageplan</th>
              <th style="min-width:150px;">Loading Rate Kontrak</th>
              <th style="width:190px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="14" class="text-center text-muted">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="small text-muted mt-2">
        Tips: Search langsung ketik di box atas. Update/Delete tanpa reload.
      </div>
    </div>
  </div>

</div>

<script>
const SELF = "<?= $SELF ?>";
const alertBox = document.getElementById('alertBox');
const tbody = document.getElementById('tbody');
const q = document.getElementById('q');
const btnReset = document.getElementById('btnReset');
const formCreate = document.getElementById('formCreate');
const formImport = document.getElementById('formImport');
const csvFile = document.getElementById('csvFile');

function showAlert(type, msg){
  alertBox.className = 'alert alert-' + type;
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
  setTimeout(()=> alertBox.classList.add('d-none'), 3000);
}

async function api(action, data=null, qs=""){
  const url = `${SELF}?ajax=1&action=${encodeURIComponent(action)}${qs}`;
  if (!data){
    const r = await fetch(url);
    return r.json();
  }
  const fd = new FormData();
  for (const k in data) fd.append(k, data[k]);
  fd.append('action', action);

  const r = await fetch(`${SELF}?ajax=1`, { method:'POST', body: fd });
  return r.json();
}

function rowTemplate(r){
  const esc = (s)=> (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

  const no_pk = esc(r.no_pk);
  const no_si = esc(r.no_si_vessel);
  const buyer = esc(r.buyer);
  const mv    = esc(r.mothervessel);
  const anchorage = esc(r.anchorage);
  const term = esc(r.term);

  const ls = esc(r.laycan_start ?? '');
  const le = esc(r.laycan_end ?? '');
  const ta = esc(r.ta_vessel ?? '');

  const single = esc(r.single_mt ?? '0');
  const blend  = esc(r.blending_mt ?? '0');
  const stow   = esc(r.stowageplan_mt ?? '0');
  const loadingRateKontrak = esc(r.loading_rate_kontrak ?? '0');

  return `
  <tr data-pk="${no_pk}">
    <td><input class="form-control form-control-sm" value="${no_pk}" disabled></td>
    <td><input class="form-control form-control-sm" name="no_si_vessel" value="${no_si}"></td>
    <td><input class="form-control form-control-sm" name="buyer" value="${buyer}"></td>
    <td><input class="form-control form-control-sm" name="mothervessel" value="${mv}"></td>
    <td>
      <select class="form-select form-select-sm" name="anchorage">
        <option value="">-- pilih --</option>
        <option value="MUARA BERAU" ${anchorage === 'MUARA BERAU' ? 'selected' : ''}>MUARA BERAU</option>
        <option value="MUARA JAWA" ${anchorage === 'MUARA JAWA' ? 'selected' : ''}>MUARA JAWA</option>
        <option value="PRIMA ANCHORAGE" ${anchorage === 'PRIMA ANCHORAGE' ? 'selected' : ''}>PRIMA ANCHORAGE</option>
      </select>
    </td>
    <td>
      <select class="form-select form-select-sm" name="term">
        <option value="">-- pilih --</option>
        <option value="FOB" ${term === 'FOB' ? 'selected' : ''}>FOB</option>
        <option value="FAS" ${term === 'FAS' ? 'selected' : ''}>FAS</option>
        <option value="CIF" ${term === 'CIF' ? 'selected' : ''}>CIF</option>
      </select>
    </td>

    <td><input class="form-control form-control-sm" type="date" name="laycan_start" value="${ls}"></td>
    <td><input class="form-control form-control-sm" type="date" name="laycan_end" value="${le}"></td>
    <td><input class="form-control form-control-sm" type="date" name="ta_vessel" value="${ta}"></td>

    <td><input class="form-control form-control-sm" name="single_mt" value="${single}"></td>
    <td><input class="form-control form-control-sm" name="blending_mt" value="${blend}"></td>
    <td><input class="form-control form-control-sm" name="stowageplan_mt" value="${stow}"></td>
    <td><input class="form-control form-control-sm" name="loading_rate_kontrak" value="${loadingRateKontrak}"></td>

    <td class="d-flex gap-2">
      <button class="btn btn-sm btn-primary btnUpdate" type="button">Update</button>
      <button class="btn btn-sm btn-outline-danger btnDelete" type="button">Delete</button>
    </td>
  </tr>`;
}

async function loadTable(){
  const kw = q.value.trim();
  const res = await api('list', null, `&q=${encodeURIComponent(kw)}`);
  if (!res.ok){
    tbody.innerHTML = `<tr><td colspan="14" class="text-danger">Error: ${res.msg}</td></tr>`;
    return;
  }
  if (!res.data.length){
    tbody.innerHTML = `<tr><td colspan="14" class="text-center text-muted">No data</td></tr>`;
    return;
  }
  tbody.innerHTML = res.data.map(rowTemplate).join('');
}

formCreate.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(formCreate);
  const data = Object.fromEntries(fd.entries());
  const res = await api('create', data);
  if (res.ok){
    showAlert('success', res.msg);
    formCreate.reset();
    await loadTable();
  } else {
    showAlert('danger', res.msg);
  }
});

tbody.addEventListener('click', async (e)=>{
  const tr = e.target.closest('tr');
  if (!tr) return;
  const no_pk = tr.getAttribute('data-pk');

  if (e.target.classList.contains('btnDelete')){
    if (!confirm(`Hapus vessel ${no_pk}?`)) return;
    const res = await api('delete', { no_pk });
    if (res.ok){
      showAlert('success', res.msg);
      tr.remove();
      if (!tbody.children.length) tbody.innerHTML = `<tr><td colspan="14" class="text-center text-muted">No data</td></tr>`;
    } else {
      showAlert('danger', res.msg);
    }
  }

  if (e.target.classList.contains('btnUpdate')){
    const getVal = (name)=> tr.querySelector(`[name="${name}"]`)?.value ?? '';
    const payload = {
      no_pk,
      no_si_vessel: getVal('no_si_vessel'),
      buyer: getVal('buyer'),
      mothervessel: getVal('mothervessel'),
      anchorage: getVal('anchorage'),
      term: getVal('term'),
      laycan_start: getVal('laycan_start'),
      laycan_end: getVal('laycan_end'),
      ta_vessel: getVal('ta_vessel'),
      single_mt: getVal('single_mt'),
      blending_mt: getVal('blending_mt'),
      stowageplan_mt: getVal('stowageplan_mt'),
      loading_rate_kontrak: getVal('loading_rate_kontrak'),
    };
    const res = await api('update', payload);
    if (res.ok){
      showAlert('success', res.msg);
      await loadTable();
    } else {
      showAlert('danger', res.msg);
    }
  }
});

// auto search (oninput) + debounce
let t = null;
q.addEventListener('input', ()=>{
  clearTimeout(t);
  t = setTimeout(loadTable, 200);
});
btnReset.addEventListener('click', ()=>{
  q.value = "";
  loadTable();
});

// IMPORT CSV (AJAX)
formImport.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!csvFile.files.length){
    showAlert('warning', 'Pilih file CSV dulu.');
    return;
  }

  const fd = new FormData();
  fd.append('action', 'import_csv');
  fd.append('csv', csvFile.files[0]);

  const r = await fetch(`${SELF}?ajax=1`, { method:'POST', body: fd });
  const res = await r.json();

  if (res.ok){
    showAlert('success', res.msg);
    csvFile.value = "";
    await loadTable();
  } else {
    showAlert('danger', res.msg);
  }
});

// first load
loadTable();
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
