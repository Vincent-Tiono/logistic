<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

/* ========= SELF PATH ========= */
$SELF = "/logistic/Operation/4shipper.php";

require_once __DIR__ . '/../config/database.php';

try {
  $koneksi = db_connect('databarging');
} catch (RuntimeException $exception) {
  http_response_code(500);
  die(htmlspecialchars($exception->getMessage(), ENT_QUOTES, 'UTF-8'));
}

/* ========= HELPERS ========= */
function clean($s){ return trim((string)$s); }

function jsonOut($arr){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr);
  exit;
}

/* ========= CSV TEMPLATE DOWNLOAD ========= */
if (isset($_GET['download']) && $_GET['download'] === 'shipper_template') {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="shipper_template.csv"');

  $out = fopen('php://output', 'w');
  fputcsv($out, ['shipper','pt','nama_lengkap']);

  // contoh baris
  fputcsv($out, ['MHU','PT. MULTI HARAPAN UTAMA',"PT MULTI HARAPAN UTAMA\nCFX TOWER LANTAI 3-4, JALAN JENDERAL GATOT SUBROTO,\nKAVELING 35-36,\nKUNINGAN TIMUR, SETIABUDI, KOTA ADM. JAKARTA SELATAN,\nDKI JAKARTA, INDONESIA, 12950"]);
  fputcsv($out, ['CDI','PT. CITRA DAYAK INDAH',"PT CITRA DAYAK INDAH\nJL. RAPAK INDAH PERMAI\nBLOK F NO. 21 LOK BAHU, SUNGAI KUNJANG,\nSAMARINDA, KALIMANTAN TIMUR"]);
  fclose($out);
  exit;
}

/* ========= AJAX API (same file) ========= */
if (isset($_GET['ajax']) && $_GET['ajax'] === '1') {

  $action = $_POST['action'] ?? $_GET['action'] ?? '';

  // ===== LIST + SEARCH =====
  if ($action === 'list') {
    $q = clean($_GET['q'] ?? '');

    $sql = "SELECT shipper, pt, nama_lengkap FROM shipper";
    $types = "";
    $params = [];

    if ($q !== "") {
      $sql .= " WHERE shipper LIKE ? OR pt LIKE ? OR nama_lengkap LIKE ?";
      $kw = "%{$q}%";
      $types = "sss";
      $params = [$kw,$kw,$kw];
    }

    $sql .= " ORDER BY shipper ASC LIMIT 500";

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
    $shipper = strtoupper(clean($_POST['shipper'] ?? ''));
    $pt      = clean($_POST['pt'] ?? '');
    $nama    = clean($_POST['nama_lengkap'] ?? '');

    if ($shipper === "" || $pt === "" || $nama === "") {
      jsonOut(["ok"=>false,"msg"=>"Shipper, PT, dan Nama Lengkap wajib diisi."]);
    }

    // duplicate check
    $stmt = $koneksi->prepare("SELECT COUNT(*) c FROM shipper WHERE shipper=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $shipper);
    $stmt->execute();
    $c = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
    $stmt->close();
    if ($c > 0) jsonOut(["ok"=>false,"msg"=>"Kode Shipper sudah ada (harus unik)."]);

    $stmt = $koneksi->prepare("INSERT INTO shipper (shipper, pt, nama_lengkap) VALUES (?,?,?)");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("sss", $shipper, $pt, $nama);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data shipper berhasil ditambah."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== UPDATE =====
  if ($action === 'update') {
    $shipper = strtoupper(clean($_POST['shipper'] ?? ''));
    $pt      = clean($_POST['pt'] ?? '');
    $nama    = clean($_POST['nama_lengkap'] ?? '');

    if ($shipper === "" || $pt === "" || $nama === "") {
      jsonOut(["ok"=>false,"msg"=>"Data update tidak valid."]);
    }

    $stmt = $koneksi->prepare("UPDATE shipper SET pt=?, nama_lengkap=? WHERE shipper=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("sss", $pt, $nama, $shipper);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data shipper berhasil diupdate."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== DELETE =====
  if ($action === 'delete') {
    $shipper = strtoupper(clean($_POST['shipper'] ?? ''));
    if ($shipper === "") jsonOut(["ok"=>false,"msg"=>"Kode Shipper kosong."]);

    $stmt = $koneksi->prepare("DELETE FROM shipper WHERE shipper=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $shipper);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data shipper berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== IMPORT CSV (SKIP DUPLICATE shipper) =====
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
    $required = ['shipper','pt','nama_lengkap'];

    foreach ($required as $col) {
      if (!in_array($col, $header, true)) {
        fclose($fh);
        jsonOut(["ok"=>false,"msg"=>"Header CSV salah. Wajib ada kolom: shipper, pt, nama_lengkap"]);
      }
    }

    $idx = array_flip($header);

    $inserted = 0;
    $skipped  = 0;
    $errors   = 0;

    $stmtIns = $koneksi->prepare("INSERT INTO shipper (shipper, pt, nama_lengkap) VALUES (?,?,?)");
    if (!$stmtIns) { fclose($fh); jsonOut(["ok"=>false,"msg"=>"Prepare insert gagal: ".$koneksi->error]); }

    $stmtChk = $koneksi->prepare("SELECT COUNT(*) c FROM shipper WHERE shipper=?");
    if (!$stmtChk) { fclose($fh); jsonOut(["ok"=>false,"msg"=>"Prepare check gagal: ".$koneksi->error]); }

    while (($row = fgetcsv($fh)) !== false) {
      $shipper = strtoupper(clean($row[$idx['shipper']] ?? ''));
      $pt      = clean($row[$idx['pt']] ?? '');
      $nama    = clean($row[$idx['nama_lengkap']] ?? '');

      if ($shipper === "" || $pt === "" || $nama === "") { $errors++; continue; }

      // duplicate check
      $stmtChk->bind_param("s", $shipper);
      $stmtChk->execute();
      $c = (int)($stmtChk->get_result()->fetch_assoc()['c'] ?? 0);
      if ($c > 0) { $skipped++; continue; }

      $stmtIns->bind_param("sss", $shipper, $pt, $nama);
      if ($stmtIns->execute()) $inserted++;
      else $errors++;
    }

    fclose($fh);
    $stmtIns->close();
    $stmtChk->close();

    jsonOut(["ok"=>true,"msg"=>"Import selesai. Inserted: {$inserted}, Skipped (duplicate): {$skipped}, Error: {$errors}"]);
  }

  // ===== DELETE ALL (IT only) =====
  if ($action === 'delete_all') {
    $divisi = $_SESSION['divisi'] ?? ($_SESSION['departemen'] ?? ($_SESSION['department'] ?? ''));
    if (strtoupper(trim((string)$divisi)) !== 'IT') {
      jsonOut(["ok"=>false,"msg"=>"Akses ditolak. Hanya Divisi IT yang boleh menghapus semua data."]);
    }

    $ok = $koneksi->query("DELETE FROM shipper");
    $err = $koneksi->error;

    jsonOut($ok ? ["ok"=>true,"msg"=>"Semua data shipper berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
  }

  jsonOut(["ok"=>false,"msg"=>"Unknown action"]);
}

/* ========= NORMAL PAGE ========= */
$pageTitle = "Shipper";
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<div class="content">

  <div class="d-flex align-items-center justify-content-between mb-3">
    <h4 class="m-0">Shipper</h4>
  </div>

  <div id="alertBox" class="alert d-none" role="alert"></div>

  <?php if ($isIT): ?>
  <!-- IMPORT CSV -->
  <div class="card mb-3">
    <div class="card-body">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h6 class="mb-1">Import CSV</h6>
          <div class="small text-muted">
            Download template dulu, isi datanya, lalu upload. Duplicate <b>Shipper</b> akan <b>di-skip</b>.
          </div>
        </div>

        <div class="d-flex gap-2 align-items-center">
          <a class="btn btn-sm btn-outline-primary" href="<?= $SELF ?>?download=shipper_template">
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
        <h6 class="m-0">Input Shipper</h6>
        <button type="button" class="btn btn-sm btn-outline-secondary" id="btnToggleInputForm" aria-expanded="true" aria-controls="inputShipperBody">
          <span id="btnToggleInputFormIcon">&#9650;</span> <span id="btnToggleInputFormLabel">Collapse</span>
        </button>
      </div>

      <div id="inputShipperBody">
      <form id="formCreate" class="row g-2">
        <div class="col-md-2">
          <label class="form-label">Shipper</label>
          <input name="shipper" class="form-control" placeholder="MHU" required>
        </div>

        <div class="col-md-4">
          <label class="form-label">PT</label>
          <input name="pt" class="form-control" placeholder="PT. MULTI HARAPAN UTAMA" required>
        </div>

        <div class="col-md-6">
          <label class="form-label">Nama Lengkap</label>
          <textarea name="nama_lengkap" class="form-control" rows="3"
            placeholder="Alamat / nama lengkap shipper..." required></textarea>
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
        <div class="d-flex align-items-center gap-2">
          <h6 class="m-0">Data Shipper</h6>
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

        <div class="position-relative" style="width:320px;">
          <input id="q" type="text" class="form-control form-control-sm" style="width:100%; padding-right:26px;"
                 placeholder="Search (Shipper / PT / Nama Lengkap)..." />
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
        #tbl th.sortable { cursor: grab; }
        #tbl th.col-selecting, #tbl td.col-selecting { background-color: rgba(13,110,253,.18) !important; }

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
        .table-responsive { max-height: 65vh; overflow-y: auto; }
        #tbl thead th { position: sticky; top: 0; z-index: 2; background-color: #f8f9fa; text-align: left; vertical-align: middle; }
        #tbl thead th.frozen-col { z-index: 3; }
      </style>

      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle" id="tbl">
          <thead class="table-light">
            <tr>
              <th style="min-width:110px;" class="sortable" data-key="shipper" data-type="text" data-label="Shipper"></th>
              <th style="min-width:260px;" class="sortable" data-key="pt" data-type="text" data-label="PT"></th>
              <th class="sortable" data-key="nama_lengkap" data-type="text" data-label="Nama Lengkap"></th>
              <th style="width:190px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="4" class="text-center text-muted">Loading...</td></tr>
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
const inputShipperBody = document.getElementById('inputShipperBody');
const btnToggleInputForm = document.getElementById('btnToggleInputForm');
const btnToggleInputFormIcon = document.getElementById('btnToggleInputFormIcon');
const btnToggleInputFormLabel = document.getElementById('btnToggleInputFormLabel');
const INPUT_FORM_COLLAPSE_KEY = 'shipper_input_form_collapsed';

function setInputFormCollapsed(collapsed){
  if (!inputShipperBody || !btnToggleInputForm) return;
  inputShipperBody.style.display = collapsed ? 'none' : '';
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
    const collapsed = inputShipperBody.style.display !== 'none';
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

  const shipper = esc(r.shipper);
  const pt = esc(r.pt);
  const nama = esc(r.nama_lengkap);

  return `
  <tr data-shipper="${shipper}">
    <td><input class="form-control form-control-sm" value="${shipper}" disabled></td>
    <td><input class="form-control form-control-sm" name="pt" value="${pt}"></td>
    <td><textarea class="form-control form-control-sm" name="nama_lengkap" rows="3">${nama}</textarea></td>
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
    : `<tr><td colspan="4" class="text-center text-muted">No data</td></tr>`;
  applyFreezeStyling();
  applyHiddenColumns();
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

// --- Hidden columns (drag-to-hide) ---
const hiddenColumnsIndicator = document.querySelector('.hidden-columns-indicator');
const hiddenColumnsCountEl = hiddenColumnsIndicator ? hiddenColumnsIndicator.querySelector('.hidden-columns-count') : null;
const hiddenColumnsMenu = hiddenColumnsIndicator ? hiddenColumnsIndicator.querySelector('.hidden-columns-menu') : null;
const COLUMN_DRAG_THRESHOLD = 6; // px of movement before a mousedown counts as a drag, not a click
let hiddenKeys = new Set(); // data-key of columns hidden via drag
let columnDragState = null; // { rects, startIndex, hoverIndex, dragging, confirming }
let hideColumnPopupEl = null;

// hides/shows th + td cells by column position (mirrors applyFreezeStyling's index-matching approach)
function applyHiddenColumns() {
  if (!hiddenColumnsIndicator) return;
  const headerRow = document.querySelector('#tbl thead tr');
  if (!headerRow) return;
  const headerCells = Array.from(headerRow.children);

  headerCells.forEach((th, index) => {
    const key = th.getAttribute('data-key');
    const hidden = !!key && hiddenKeys.has(key);
    th.classList.toggle('d-none', hidden);
    document.querySelectorAll('#tbl tbody tr').forEach(tr => {
      if (tr.children.length < 2) return; // skip "no data"/error placeholder row
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

  const headerRow = document.querySelector('#tbl thead tr');
  const hiddenHeaders = headerRow
    ? Array.from(headerRow.querySelectorAll('th[data-key]')).filter(th => hiddenKeys.has(th.getAttribute('data-key')))
    : [];

  hiddenColumnsMenu.innerHTML = hiddenHeaders.map(th => {
    const key = th.getAttribute('data-key');
    const label = th.getAttribute('data-label') || key;
    const inputId = `hc-tbl-${key}`;
    return `<div class="form-check hidden-column-item">
      <input class="form-check-input hidden-column-checkbox" type="checkbox" checked data-key="${escHtml(key)}" id="${escHtml(inputId)}">
      <label class="form-check-label" for="${escHtml(inputId)}">${escHtml(label)}</label>
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
  const headerRow = document.querySelector('#tbl thead tr');
  if (!headerRow) return;
  const bodyRows = document.querySelectorAll('#tbl tbody tr');
  Array.from(headerRow.children).forEach((th, index) => {
    const key = th.getAttribute('data-key');
    const selected = !!key && keys.has(key);
    th.classList.toggle('col-selecting', selected);
    bodyRows.forEach(tr => {
      if (tr.children.length < 2) return;
      const td = tr.children[index];
      if (td) td.classList.toggle('col-selecting', selected);
    });
  });
}

function clearColumnSelectionHighlight() {
  document.querySelectorAll('#tbl .col-selecting').forEach(el => el.classList.remove('col-selecting'));
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
  const headerRow = document.querySelector('#tbl thead tr');
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
  const sortableThs = Array.from(document.querySelectorAll('#tbl th.sortable'));
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

    if (hiddenColumnsIndicator) {
      th.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.dropdown')) return; // let the sort/filter dropdown toggle work normally
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

async function loadTable(){
  const kw = q.value.trim();
  const res = await api('list', null, `&q=${encodeURIComponent(kw)}`);
  if (!res.ok){
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Error: ${res.msg}</td></tr>`;
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
  const shipper = tr.getAttribute('data-shipper');

  if (e.target.classList.contains('btnDelete')){
    if (!confirm(`Hapus shipper ${shipper}?`)) return;
    const res = await api('delete', { shipper });
    if (res.ok){
      showAlert('success', res.msg);
      originalData = originalData.filter(r => r.shipper !== shipper);
      tr.remove();
      if (!tbody.children.length) tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No data</td></tr>`;
    } else {
      showAlert('danger', res.msg);
    }
  }

  if (e.target.classList.contains('btnUpdate')){
    const getVal = (name)=> tr.querySelector(`[name="${name}"]`)?.value ?? '';
    const payload = {
      shipper,
      pt: getVal('pt'),
      nama_lengkap: getVal('nama_lengkap')
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

let t = null;
q.addEventListener('input', ()=>{
  clearTimeout(t);
  t = setTimeout(loadTable, 200);
});
btnClearQ.addEventListener('click', ()=>{
  q.value = "";
  loadTable();
});

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
    if (!confirm('Hapus SEMUA data shipper? Tindakan ini tidak bisa dibatalkan.')) return;
    const res = await api('delete_all');
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
