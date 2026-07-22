<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

/* ========= SELF PATH (penting untuk AJAX & download template) ========= */
$SELF = "/logistic/Operation/2barges.php";

require_once __DIR__ . '/../config/database.php';

try {
  $koneksi = db_connect('databarging');
} catch (RuntimeException $exception) {
  http_response_code(500);
  die(htmlspecialchars($exception->getMessage(), ENT_QUOTES, 'UTF-8'));
}

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
    $divisi = $_SESSION['divisi'] ?? ($_SESSION['departemen'] ?? ($_SESSION['department'] ?? ''));
    if (strtoupper(trim((string)$divisi)) !== 'IT') {
      jsonOut(["ok"=>false,"msg"=>"Akses ditolak. Hanya Divisi IT yang boleh import CSV."]);
    }

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

  // ===== DELETE ALL (IT only) =====
  if ($action === 'delete_all') {
    $divisi = $_SESSION['divisi'] ?? ($_SESSION['departemen'] ?? ($_SESSION['department'] ?? ''));
    if (strtoupper(trim((string)$divisi)) !== 'IT') {
      jsonOut(["ok"=>false,"msg"=>"Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data."]);
    }

    $ok = $koneksi->query("DELETE FROM barges");
    $err = $koneksi->error;

    jsonOut($ok ? ["ok"=>true,"msg"=>"Semua data barges berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
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
  </div>

  <div id="alertBox" class="alert d-none" role="alert"></div>

  <?php if ($isIT): ?>
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
  <?php endif; ?>

  <!-- FORM INPUT -->
  <div class="card mb-3">
    <div class="card-body">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h6 class="m-0">Input Barges</h6>
        <button type="button" class="btn btn-sm btn-outline-secondary" id="btnToggleInputForm" aria-expanded="true" aria-controls="inputBargesBody">
          <span id="btnToggleInputFormIcon">&#9650;</span> <span id="btnToggleInputFormLabel">Collapse</span>
        </button>
      </div>

      <div id="inputBargesBody">
      <form id="formCreate" class="row g-2">
        <div class="col-md-2">
          <label class="form-label">Tugboat</label>
          <input name="tugboat" class="form-control" placeholder="TB. MARINA 2201" required>
        </div>

        <div class="col-md-2">
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

        <div class="col-md-2">
          <label class="form-label">Muatan</label>
          <input name="muatan" class="form-control" placeholder="8,200">
        </div>

        <div class="col-md-2">
          <label class="form-label">Penalty</label>
          <input name="penalty" class="form-control" placeholder="Deadfreight">
        </div>

        <div class="col-12">
          <button class="btn btn-success" type="submit">Save</button>
        </div>
      </form>
      </div>
    </div>
  </div>

  <!-- TABLE -->
  <div class="card">
    <div class="card-body">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h6 class="m-0">Data Barges</h6>

        <div class="position-relative" style="width:320px;">
          <input id="q" type="text" class="form-control form-control-sm" style="width:100%; padding-right:26px;"
                 placeholder="Search (Tugboat / Barge)..." />
          <button type="button" id="btnClearQ" title="Clear search"
                  style="position:absolute; right:4px; top:50%; transform:translateY(-50%); width:18px; height:18px; padding:0; line-height:1; font-size:12px; color:#6c757d; background:#fff; border:1px solid #ced4da; border-radius:3px; cursor:pointer;">&times;</button>
        </div>
      </div>

      <style>
        #tbl th.sortable { white-space: nowrap; }
        #tbl .th-sort-wrap { display:flex; align-items:center; justify-content:space-between; gap:4px; }
        #tbl .sort-toggle { text-decoration:none; line-height:1; opacity:.6; border:none; background:transparent; }
        #tbl th.sortable.sort-active .sort-toggle { opacity:1; font-weight:bold; }
        #tbl .filter-menu { min-width: 260px; max-height: 80vh; overflow-y: auto; white-space: normal; z-index: 2000; }
        #tbl .filter-menu .dropdown-header-label { font-weight:bold; font-size:.9rem; color:#212529; padding: .35rem 1rem .15rem; margin:0; }
        #tbl .filter-menu .sort-option { font-size:.8rem; }
        #tbl .filter-menu .sort-option.active-sort { font-weight:bold; background-color:#e7f1ff; border-color:#0d6efd; color:#0d6efd; }
        #tbl .filter-values-list { max-height: 160px; overflow-y: auto; }
        #tbl .filter-value-item label { cursor:pointer; }
        #tbl th.sortable.filter-active .sort-toggle { opacity:1; font-weight:bold; }
        #tbl .freeze-toggle.active { background-color:#0d6efd; border-color:#0d6efd; color:#fff; }
        #tbl th.frozen-col, #tbl td.frozen-col { position: sticky; z-index: 2; background-color: #fff; }
        #tbl thead th.frozen-col { background-color: #f8f9fa; z-index: 3; }
        #tbl th.frozen-col-last, #tbl td.frozen-col-last { box-shadow: 2px 0 4px -2px rgba(0,0,0,.35); }
        .table-responsive { max-height: 65vh; overflow-y: auto; }
        #tbl thead th { position: sticky; top: 0; z-index: 2; background-color: #f8f9fa; text-align: left; vertical-align: middle; }
        #tbl thead th.frozen-col { z-index: 3; }
      </style>

      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle" id="tbl">
          <thead class="table-light">
            <tr>
              <th style="min-width:180px;" class="sortable" data-key="tugboat" data-type="text" data-label="Tugboat"></th>
              <th style="min-width:220px;" class="sortable" data-key="barge" data-type="text" data-label="Barge"></th>
              <th style="min-width:110px;" class="sortable" data-key="vendor" data-type="text" data-label="Vendor"></th>
              <th style="min-width:130px;" class="sortable" data-key="kontrak" data-type="text" data-label="Kontrak"></th>
              <th style="min-width:110px;" class="sortable" data-key="muatan" data-type="number" data-label="Muatan"></th>
              <th style="min-width:140px;" class="sortable" data-key="penalty" data-type="text" data-label="Penalty"></th>
              <th style="width:190px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="7" class="text-center text-muted">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <!-- <div class="small text-muted mt-2">
        Tips: Search langsung ketik di box atas. Update/Delete tanpa reload.
      </div> -->

      <?php if ($isIT): ?>
      <div class="d-flex justify-content-end mt-3">
        <button class="btn btn-sm btn-danger" id="btnDeleteAll" type="button">Delete All</button>
      </div>
      <?php endif; ?>
    </div>
  </div>

</div>

<script>
const SELF = "<?= $SELF ?>";
const alertBox = document.getElementById('alertBox');
const tbody = document.getElementById('tbody');
const q = document.getElementById('q');
const btnClearQ = document.getElementById('btnClearQ');
const formCreate = document.getElementById('formCreate');
const formImport = document.getElementById('formImport');
const csvFile = document.getElementById('csvFile');
const btnDeleteAll = document.getElementById('btnDeleteAll');
const inputBargesBody = document.getElementById('inputBargesBody');
const btnToggleInputForm = document.getElementById('btnToggleInputForm');
const btnToggleInputFormIcon = document.getElementById('btnToggleInputFormIcon');
const btnToggleInputFormLabel = document.getElementById('btnToggleInputFormLabel');
const INPUT_FORM_COLLAPSE_KEY = 'barges_input_form_collapsed';

function setInputFormCollapsed(collapsed){
  if (!inputBargesBody || !btnToggleInputForm) return;
  inputBargesBody.style.display = collapsed ? 'none' : '';
  btnToggleInputForm.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  if (btnToggleInputFormIcon) btnToggleInputFormIcon.innerHTML = collapsed ? '&#9660;' : '&#9650;';
  if (btnToggleInputFormLabel) btnToggleInputFormLabel.textContent = collapsed ? 'Expand' : 'Collapse';
  try { localStorage.setItem(INPUT_FORM_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) {}
}

if (btnToggleInputForm) {
  let startCollapsed = false;
  try { startCollapsed = localStorage.getItem(INPUT_FORM_COLLAPSE_KEY) === '1'; } catch (e) {}
  setInputFormCollapsed(startCollapsed);
  btnToggleInputForm.addEventListener('click', () => {
    const collapsed = inputBargesBody.style.display !== 'none';
    setInputFormCollapsed(collapsed);
  });
}

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

let originalData = []; // as-loaded (insertion) order, per current search
let sortState = { key: null, dir: 0 }; // dir: 0 = default (unsorted), 1 = ascending, -1 = descending
let filters = {}; // key -> { condition, value, excluded:Set(display values), autoApply }
let frozenKey = null; // data-key of the rightmost frozen column (that column + all to its left are frozen), or null

function getSortValue(r, key, type){
  const v = r[key];
  if (type === 'number'){
    const n = parseFloat(v);
    return isNaN(n) ? -Infinity : n;
  }
  if (type === 'date'){
    const t = v ? Date.parse((v + '').replace(' ', 'T')) : NaN;
    return isNaN(t) ? -Infinity : t;
  }
  return (v ?? '').toString().toLowerCase();
}

// display value shown in the table cell for a given column (matches rowTemplate)
function columnDisplayValue(r, key){
  if (key === 'muatan'){
    return (r[key] ?? '0').toString();
  }
  return (r[key] ?? '').toString();
}

function getFilterState(key){
  if (!filters[key]) filters[key] = { condition: 'none', value: '', excluded: new Set(), autoApply: true };
  return filters[key];
}

function isFilterActive(key){
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

function getUniqueColumnValues(key){
  const seen = new Set();
  const values = [];
  originalData.forEach(r=>{
    const v = columnDisplayValue(r, key);
    if (!seen.has(v)){ seen.add(v); values.push(v); }
  });
  return values;
}

function rowPassesFilters(r){
  for (const key in filters){
    const f = filters[key];
    if (!f || !isFilterActive(key)) continue;
    const display = columnDisplayValue(r, key);

    if (f.condition && f.condition !== 'none'){
      const fn = FILTER_CONDITIONS[f.condition];
      if (fn && !fn(display.toLowerCase(), (f.value || '').toLowerCase())) return false;
    }

    if (f.excluded && f.excluded.has(display)) return false;
  }
  return true;
}

function computeDisplayData(){
  const filtered = originalData.filter(rowPassesFilters);
  if (!sortState.key || sortState.dir === 0) return filtered;
  const th = document.querySelector(`#tbl th[data-key="${sortState.key}"]`);
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

function renderTable(){
  const data = computeDisplayData();
  tbody.innerHTML = data.length
    ? data.map(rowTemplate).join('')
    : `<tr><td colspan="7" class="text-center text-muted">No data</td></tr>`;
  applyFreezeStyling();
}

function updateSortIndicators(){
  document.querySelectorAll('#tbl th.sortable').forEach(th=>{
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

function closeDropdown(th){
  const toggleBtn = th.querySelector('.sort-toggle');
  if (!toggleBtn) return;
  const dd = bootstrap.Dropdown.getOrCreateInstance(toggleBtn);
  dd.hide();
}

function updateFreezeButtons(){
  document.querySelectorAll('#tbl th.sortable').forEach(th=>{
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
function applyFreezeStyling(){
  const headerRow = document.querySelector('#tbl thead tr');
  if (!headerRow) return;
  const headerCells = Array.from(headerRow.children);

  headerCells.forEach(th=>{
    th.classList.remove('frozen-col', 'frozen-col-last');
    th.style.position = '';
    th.style.left = '';
  });
  document.querySelectorAll('#tbody tr').forEach(tr=>{
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

    document.querySelectorAll('#tbody tr').forEach(tr=>{
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

function escHtml(s){
  return (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

function updateSelectAllState(th){
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

function buildFilterValuesList(th){
  const key = th.getAttribute('data-key');
  const f = getFilterState(key);
  const listEl = th.querySelector('.filter-values-list');
  const uniqueValues = getUniqueColumnValues(key);

  listEl.innerHTML = uniqueValues.map(v=>{
    const checked = f.excluded.has(v) ? '' : 'checked';
    const esc = escHtml(v);
    const labelHtml = v === '' ? '<i>(blank)</i>' : esc;
    return `<div class="form-check filter-value-item" data-value="${esc}">
      <input class="form-check-input filter-value-checkbox" type="checkbox" ${checked}>
      <label class="form-check-label">${labelHtml}</label>
    </div>`;
  }).join('');

  updateSelectAllState(th);
}

function syncFilterControls(th){
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

function initSortableHeaders(){
  document.querySelectorAll('#tbl th.sortable').forEach(th=>{
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

    // popper strategy "fixed" escapes the .table-responsive/.content overflow-x:auto
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

    // ----- Sort (unchanged behavior) -----
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

async function loadTable(){
  const kw = q.value.trim();
  const res = await api('list', null, `&q=${encodeURIComponent(kw)}`);
  if (!res.ok){
    tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Error: ${res.msg}</td></tr>`;
    return;
  }
  originalData = res.data;
  renderTable();
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
      originalData = originalData.filter(r => String(r.id) !== id);
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

btnClearQ.addEventListener('click', ()=>{
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

if (btnDeleteAll){
  btnDeleteAll.addEventListener('click', async ()=>{
    if (!confirm('Hapus SEMUA data barges? Tindakan ini tidak bisa dibatalkan.')) return;
    const res = await api('delete_all');
    if (res.ok){
      showAlert('success', res.msg);
      await loadTable();
    } else {
      showAlert('danger', res.msg);
    }
  });
}

// first load
loadTable();
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
