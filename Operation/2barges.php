<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

/* ========= SELF PATH (penting untuk AJAX & download template) ========= */
$SELF = "/logistic/Operation/2barges.php";

/* ========= DB CONFIG ========= */
$host = "127.0.0.1";
$user = "root";
$pass = "";
$db   = "databarging";
$port = 3306;            // ganti 3306 kalau mysql lo normal

$koneksi = new mysqli($host, $user, $pass, $db, $port);
if ($koneksi->connect_error) die("Koneksi DB gagal: " . $koneksi->connect_error);
$koneksi->set_charset("utf8mb4");

/* ========= HELPERS ========= */
function clean($s){ return trim((string)$s); }

function toDecimal($s){
  $s = clean($s);
  if ($s === "" || $s === "-") return 0;
  $s = str_replace([",", " "], "", $s);      // "8,200" -> "8200"
  if (preg_match('/^\d{1,3}(\.\d{3})+$/', $s)) $s = str_replace(".", "", $s); // "8.200" -> "8200"
  return is_numeric($s) ? (float)$s : 0;
}

function jsonOut($arr){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr);
  exit;
}

/* ========= CSV TEMPLATE DOWNLOAD ========= */
if (isset($_GET['download']) && $_GET['download'] === 'barges_template') {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="barges_template.csv"');

  $out = fopen('php://output', 'w');
  fputcsv($out, ['tugboat','barge','vendor','kontrak','muatan','penalty']);
  fputcsv($out, ['TB. MARINA 2201','BG. MARINE POWER 3037','BMC','DEDICATED','8200','Deadfreight']);
  fputcsv($out, ['TB. MARINA 1605','BG. MARINE POWER 3033','BMC','DEDICATED','8200','Deadfreight']);
  fputcsv($out, ['TB. MARINA 1611','BG. MARINE POWER 3047','BMC','DEDICATED','8200','Deadfreight']);
  fclose($out);
  exit;
}

/* ========= AJAX API (same file) ========= */
if (isset($_GET['ajax']) && $_GET['ajax'] === '1') {

  $action = $_POST['action'] ?? $_GET['action'] ?? '';

  // ===== LIST + SEARCH + SORT =====
  if ($action === 'list') {
    $q = clean($_GET['q'] ?? '');

    // sort whitelist (biar aman dari SQL injection)
    $sort = clean($_GET['sort'] ?? 'tugboat');
    $dir  = strtoupper(clean($_GET['dir'] ?? 'ASC'));
    $allowedSort = ['tugboat','barge','vendor','kontrak','muatan','penalty'];
    if (!in_array($sort, $allowedSort, true)) $sort = 'tugboat';
    if ($dir !== 'ASC' && $dir !== 'DESC') $dir = 'ASC';

    $sql = "SELECT id, tugboat, barge, vendor, kontrak, muatan, penalty
            FROM barges";
    $types = "";
    $params = [];

    if ($q !== "") {
      $sql .= " WHERE tugboat LIKE ? OR barge LIKE ? OR vendor LIKE ? OR kontrak LIKE ? OR penalty LIKE ?";
      $kw = "%{$q}%";
      $types = "sssss";
      $params = [$kw,$kw,$kw,$kw,$kw];
    }

    // sort utama + tie breaker biar stabil
    if ($sort === 'muatan') {
      $sql .= " ORDER BY muatan {$dir}, tugboat ASC, barge ASC, id DESC LIMIT 500";
    } else {
      $sql .= " ORDER BY {$sort} {$dir}, tugboat ASC, barge ASC, id DESC LIMIT 500";
    }

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
    $tugboat = clean($_POST['tugboat'] ?? '');
    $barge   = clean($_POST['barge'] ?? '');
    $vendor  = clean($_POST['vendor'] ?? '');
    $kontrak = clean($_POST['kontrak'] ?? '');
    $muatan  = toDecimal($_POST['muatan'] ?? '');
    $penalty = clean($_POST['penalty'] ?? '');

    if ($tugboat === "" || $barge === "") {
      jsonOut(["ok"=>false,"msg"=>"Tugboat dan Barge wajib diisi."]);
    }

    $stmt = $koneksi->prepare("INSERT INTO barges (tugboat, barge, vendor, kontrak, muatan, penalty)
                               VALUES (?,?,?,?,?,?)");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);

    $stmt->bind_param("ssssds", $tugboat, $barge, $vendor, $kontrak, $muatan, $penalty);
    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data barges berhasil ditambah."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== UPDATE =====
  if ($action === 'update') {
    $id      = (int)($_POST['id'] ?? 0);
    $tugboat = clean($_POST['tugboat'] ?? '');
    $barge   = clean($_POST['barge'] ?? '');
    $vendor  = clean($_POST['vendor'] ?? '');
    $kontrak = clean($_POST['kontrak'] ?? '');
    $muatan  = toDecimal($_POST['muatan'] ?? '');
    $penalty = clean($_POST['penalty'] ?? '');

    if ($id <= 0 || $tugboat === "" || $barge === "") {
      jsonOut(["ok"=>false,"msg"=>"Data update tidak valid."]);
    }

    $stmt = $koneksi->prepare("UPDATE barges
      SET tugboat=?, barge=?, vendor=?, kontrak=?, muatan=?, penalty=?
      WHERE id=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);

    $stmt->bind_param("ssssdsi", $tugboat, $barge, $vendor, $kontrak, $muatan, $penalty, $id);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data barges berhasil diupdate."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== DELETE =====
  if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    if ($id <= 0) jsonOut(["ok"=>false,"msg"=>"ID kosong / tidak valid."]);

    $stmt = $koneksi->prepare("DELETE FROM barges WHERE id=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("i", $id);
    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data barges berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== IMPORT CSV =====
  if ($action === 'import_csv') {
    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
      jsonOut(["ok"=>false,"msg"=>"File CSV tidak valid / gagal upload."]);
    }

    $tmp = $_FILES['csv']['tmp_name'];
    $fh = fopen($tmp, 'r');
    if (!$fh) jsonOut(["ok"=>false,"msg"=>"Tidak bisa membaca file CSV."]);

    $header = fgetcsv($fh);
    if (!$header) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"CSV kosong / header tidak ditemukan."]);
    }

    $header = array_map(fn($h)=> strtolower(trim((string)$h)), $header);

    $required = ['tugboat','barge','vendor','kontrak','muatan','penalty'];
    foreach ($required as $col) {
      if (!in_array($col, $header, true)) {
        fclose($fh);
        jsonOut(["ok"=>false,"msg"=>"Header CSV salah. Wajib ada kolom: ".implode(", ", $required)]);
      }
    }
    $idx = array_flip($header);

    $inserted = 0;
    $errors = 0;

    $stmtIns = $koneksi->prepare("INSERT INTO barges (tugboat, barge, vendor, kontrak, muatan, penalty)
                                  VALUES (?,?,?,?,?,?)");
    if (!$stmtIns) {
      fclose($fh);
      jsonOut(["ok"=>false,"msg"=>"Prepare insert gagal: ".$koneksi->error]);
    }

    while (($row = fgetcsv($fh)) !== false) {
      $tugboat = clean($row[$idx['tugboat']] ?? '');
      $barge   = clean($row[$idx['barge']] ?? '');
      $vendor  = clean($row[$idx['vendor']] ?? '');
      $kontrak = clean($row[$idx['kontrak']] ?? '');
      $muatan  = toDecimal($row[$idx['muatan']] ?? '');
      $penalty = clean($row[$idx['penalty']] ?? '');

      if ($tugboat === "" || $barge === "") { $errors++; continue; }

      $stmtIns->bind_param("ssssds", $tugboat, $barge, $vendor, $kontrak, $muatan, $penalty);
      if ($stmtIns->execute()) $inserted++;
      else $errors++;
    }

    fclose($fh);
    $stmtIns->close();

    jsonOut(["ok"=>true,"msg"=>"Import selesai. Inserted: {$inserted}, Error: {$errors}"]);
  }

  jsonOut(["ok"=>false,"msg"=>"Unknown action"]);
}

/* ========= NORMAL PAGE ========= */
$pageTitle = "Barges";
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<div class="content">

  <div class="d-flex align-items-center justify-content-between mb-3">
    <h4 class="m-0">Barges</h4>

    <div class="d-flex gap-2 align-items-center">
      <input id="q" type="text" class="form-control form-control-sm" style="width:320px;"
             placeholder="Search (TB / BG / Vendor / Kontrak / Penalty)..." />

      <select id="sortBy" class="form-select form-select-sm" style="width:170px;">
        <option value="tugboat">Sort: Tugboat</option>
        <option value="barge">Sort: Barge</option>
        <option value="vendor">Sort: Vendor</option>
        <option value="kontrak">Sort: Kontrak</option>
        <option value="muatan">Sort: Muatan</option>
        <option value="penalty">Sort: Penalty</option>
      </select>

      <select id="sortDir" class="form-select form-select-sm" style="width:110px;">
        <option value="ASC">A → Z</option>
        <option value="DESC">Z → A</option>
      </select>

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
          <div class="small text-muted">Download template dulu, isi datanya, lalu upload.</div>
        </div>

        <div class="d-flex gap-2 align-items-center">
          <a class="btn btn-sm btn-outline-primary" href="<?= $SELF ?>?download=barges_template">
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
      <h6 class="mb-3">Input Barges</h6>

      <form id="formCreate" class="row g-2">
        <div class="col-md-3">
          <label class="form-label">Tugboat</label>
          <input name="tugboat" class="form-control" placeholder="TB. MARINA 2201" required>
        </div>

        <div class="col-md-3">
          <label class="form-label">Barge</label>
          <input name="barge" class="form-control" placeholder="BG. MARINE POWER 3037" required>
        </div>

        <div class="col-md-2">
          <label class="form-label">Vendor</label>
          <input name="vendor" class="form-control" placeholder="BMC">
        </div>

        <div class="col-md-2">
          <label class="form-label">Kontrak</label>
          <input name="kontrak" class="form-control" placeholder="DEDICATED">
        </div>

        <div class="col-md-1">
          <label class="form-label">Muatan</label>
          <input name="muatan" class="form-control" placeholder="8,200">
        </div>

        <div class="col-md-1">
          <label class="form-label">Penalty</label>
          <input name="penalty" class="form-control" placeholder="Deadfreight">
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
      <h6 class="mb-3">Data Barges</h6>

      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle" id="tbl">
          <thead class="table-light">
            <tr>
              <th style="min-width:180px;">Tugboat</th>
              <th style="min-width:220px;">Barge</th>
              <th style="min-width:110px;">Vendor</th>
              <th style="min-width:130px;">Kontrak</th>
              <th style="min-width:110px;">Muatan</th>
              <th style="min-width:140px;">Penalty</th>
              <th style="width:190px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="7" class="text-center text-muted">Loading...</td></tr>
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
const sortBy = document.getElementById('sortBy');
const sortDir = document.getElementById('sortDir');
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

  // ID tetap disimpan di data-id (hidden), tapi tidak ditampilkan di UI
  const id = esc(r.id);

  const tugboat = esc(r.tugboat);
  const barge = esc(r.barge);
  const vendor = esc(r.vendor ?? '');
  const kontrak = esc(r.kontrak ?? '');
  const muatan = esc(r.muatan ?? '0');
  const penalty = esc(r.penalty ?? '');

  return `
  <tr data-id="${id}">
    <td><input class="form-control form-control-sm" name="tugboat" value="${tugboat}"></td>
    <td><input class="form-control form-control-sm" name="barge" value="${barge}"></td>
    <td><input class="form-control form-control-sm" name="vendor" value="${vendor}"></td>
    <td><input class="form-control form-control-sm" name="kontrak" value="${kontrak}"></td>
    <td><input class="form-control form-control-sm" name="muatan" value="${muatan}"></td>
    <td><input class="form-control form-control-sm" name="penalty" value="${penalty}"></td>

    <td class="d-flex gap-2">
      <button class="btn btn-sm btn-primary btnUpdate" type="button">Update</button>
      <button class="btn btn-sm btn-outline-danger btnDelete" type="button">Delete</button>
    </td>
  </tr>`;
}

async function loadTable(){
  const kw = q.value.trim();
  const s  = sortBy.value;
  const d  = sortDir.value;

  const res = await api('list', null,
    `&q=${encodeURIComponent(kw)}&sort=${encodeURIComponent(s)}&dir=${encodeURIComponent(d)}`
  );

  if (!res.ok){
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Error: ${res.msg}</td></tr>`;
    return;
  }
  if (!res.data.length){
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No data</td></tr>`;
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
  const id = tr.getAttribute('data-id');

  if (e.target.classList.contains('btnDelete')){
    if (!confirm(`Hapus data barges ini?`)) return;
    const res = await api('delete', { id });
    if (res.ok){
      showAlert('success', res.msg);
      tr.remove();
      if (!tbody.children.length) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No data</td></tr>`;
    } else {
      showAlert('danger', res.msg);
    }
  }

  if (e.target.classList.contains('btnUpdate')){
    const getVal = (name)=> tr.querySelector(`[name="${name}"]`)?.value ?? '';
    const payload = {
      id,
      tugboat: getVal('tugboat'),
      barge: getVal('barge'),
      vendor: getVal('vendor'),
      kontrak: getVal('kontrak'),
      muatan: getVal('muatan'),
      penalty: getVal('penalty'),
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

// sort change => reload
sortBy.addEventListener('change', loadTable);
sortDir.addEventListener('change', loadTable);

btnReset.addEventListener('click', ()=>{
  q.value = "";
  sortBy.value = "tugboat";
  sortDir.value = "ASC";
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
