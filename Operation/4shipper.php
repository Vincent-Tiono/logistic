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

    <div class="d-flex gap-2 align-items-center">
      <input id="q" type="text" class="form-control form-control-sm" style="width:320px;"
             placeholder="Search (Shipper / PT / Nama Lengkap)..." />
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

  <!-- FORM INPUT -->
  <div class="card mb-3">
    <div class="card-body">
      <h6 class="mb-3">Input Shipper</h6>

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

  <!-- TABLE -->
  <div class="card">
    <div class="card-body">
      <h6 class="mb-3">Data Shipper</h6>

      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle" id="tbl">
          <thead class="table-light">
            <tr>
              <th style="min-width:110px;">Shipper</th>
              <th style="min-width:260px;">PT</th>
              <th>Nama Lengkap</th>
              <th style="width:190px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="4" class="text-center text-muted">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="small text-muted mt-2">
        Tips: Search langsung ketik di box atas. Update/Delete tanpa reload.
      </div>

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
const btnReset = document.getElementById('btnReset');
const formCreate = document.getElementById('formCreate');
const formImport = document.getElementById('formImport');
const csvFile = document.getElementById('csvFile');
const btnDeleteAll = document.getElementById('btnDeleteAll');

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

async function loadTable(){
  const kw = q.value.trim();
  const res = await api('list', null, `&q=${encodeURIComponent(kw)}`);
  if (!res.ok){
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Error: ${res.msg}</td></tr>`;
    return;
  }
  if (!res.data.length){
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No data</td></tr>`;
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
  const shipper = tr.getAttribute('data-shipper');

  if (e.target.classList.contains('btnDelete')){
    if (!confirm(`Hapus shipper ${shipper}?`)) return;
    const res = await api('delete', { shipper });
    if (res.ok){
      showAlert('success', res.msg);
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
btnReset.addEventListener('click', ()=>{
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
