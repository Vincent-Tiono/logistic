<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

/* ========= SELF PATH ========= */
$SELF = "/logistic/Operation/3jetty.php";

/* ========= DB CONFIG ========= */
$host = "127.0.0.1";
$user = "root";
$pass = "";
$db   = "databarging";
$port = 3306; // samain kayak project lo

$koneksi = new mysqli($host, $user, $pass, $db, $port);
if ($koneksi->connect_error) die("Koneksi DB gagal: " . $koneksi->connect_error);
$koneksi->set_charset("utf8mb4");

/* ========= HELPERS ========= */
function clean($s){ return trim((string)$s); }

function jsonOut($arr){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr);
  exit;
}

/* ========= CSV TEMPLATE DOWNLOAD ========= */
if (isset($_GET['download']) && $_GET['download'] === 'jetty_template') {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="jetty_template.csv"');

  $out = fopen('php://output', 'w');
  fputcsv($out, ['jetty','nama_panjang']);

  // contoh baris
  fputcsv($out, ['ABK','JETTY PT ANUGERAH BARA KALTIM, EAST KALIMANTAN, INDONESIA']);
  fputcsv($out, ['LKCT','JETTY LOA KULU COAL TERMINAL, EAST KALIMANTAN, INDONESIA']);
  fclose($out);
  exit;
}

/* ========= AJAX API (same file) ========= */
if (isset($_GET['ajax']) && $_GET['ajax'] === '1') {

  $action = $_POST['action'] ?? $_GET['action'] ?? '';

  // ===== LIST + SEARCH =====
  if ($action === 'list') {
    $q = clean($_GET['q'] ?? '');

    $sql = "SELECT jetty, nama_panjang FROM jetty";
    $types = "";
    $params = [];

    if ($q !== "") {
      $sql .= " WHERE jetty LIKE ? OR nama_panjang LIKE ?";
      $kw = "%{$q}%";
      $types = "ss";
      $params = [$kw,$kw];
    }

    $sql .= " ORDER BY jetty ASC LIMIT 500";

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
    $jetty = strtoupper(clean($_POST['jetty'] ?? ''));
    $nama  = clean($_POST['nama_panjang'] ?? '');

    if ($jetty === "" || $nama === "") {
      jsonOut(["ok"=>false,"msg"=>"Jetty & Nama Panjang wajib diisi."]);
    }

    // duplicate check
    $stmt = $koneksi->prepare("SELECT COUNT(*) c FROM jetty WHERE jetty=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $jetty);
    $stmt->execute();
    $c = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
    $stmt->close();
    if ($c > 0) jsonOut(["ok"=>false,"msg"=>"Kode Jetty sudah ada (harus unik)."]);

    $stmt = $koneksi->prepare("INSERT INTO jetty (jetty, nama_panjang) VALUES (?,?)");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("ss", $jetty, $nama);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data jetty berhasil ditambah."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== UPDATE =====
  if ($action === 'update') {
    $jetty = strtoupper(clean($_POST['jetty'] ?? ''));
    $nama  = clean($_POST['nama_panjang'] ?? '');

    if ($jetty === "" || $nama === "") {
      jsonOut(["ok"=>false,"msg"=>"Data update tidak valid."]);
    }

    $stmt = $koneksi->prepare("UPDATE jetty SET nama_panjang=? WHERE jetty=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("ss", $nama, $jetty);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data jetty berhasil diupdate."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== DELETE =====
  if ($action === 'delete') {
    $jetty = strtoupper(clean($_POST['jetty'] ?? ''));
    if ($jetty === "") jsonOut(["ok"=>false,"msg"=>"Kode Jetty kosong."]);

    $stmt = $koneksi->prepare("DELETE FROM jetty WHERE jetty=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $jetty);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data jetty berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== IMPORT CSV (SKIP DUPLICATE jetty) =====
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
    $required = ['jetty','nama_panjang'];

    foreach ($required as $col) {
      if (!in_array($col, $header, true)) {
        fclose($fh);
        jsonOut(["ok"=>false,"msg"=>"Header CSV salah. Wajib ada kolom: jetty, nama_panjang"]);
      }
    }

    $idx = array_flip($header);

    $inserted = 0;
    $skipped  = 0;
    $errors   = 0;

    $stmtIns = $koneksi->prepare("INSERT INTO jetty (jetty, nama_panjang) VALUES (?,?)");
    if (!$stmtIns) { fclose($fh); jsonOut(["ok"=>false,"msg"=>"Prepare insert gagal: ".$koneksi->error]); }

    $stmtChk = $koneksi->prepare("SELECT COUNT(*) c FROM jetty WHERE jetty=?");
    if (!$stmtChk) { fclose($fh); jsonOut(["ok"=>false,"msg"=>"Prepare check gagal: ".$koneksi->error]); }

    while (($row = fgetcsv($fh)) !== false) {
      $jetty = strtoupper(clean($row[$idx['jetty']] ?? ''));
      $nama  = clean($row[$idx['nama_panjang']] ?? '');

      if ($jetty === "" || $nama === "") { $errors++; continue; }

      // duplicate check
      $stmtChk->bind_param("s", $jetty);
      $stmtChk->execute();
      $c = (int)($stmtChk->get_result()->fetch_assoc()['c'] ?? 0);
      if ($c > 0) { $skipped++; continue; }

      $stmtIns->bind_param("ss", $jetty, $nama);
      if ($stmtIns->execute()) $inserted++;
      else $errors++;
    }

    fclose($fh);
    $stmtIns->close();
    $stmtChk->close();

    jsonOut(["ok"=>true,"msg"=>"Import selesai. Inserted: {$inserted}, Skipped (duplicate): {$skipped}, Error: {$errors}"]);
  }

  jsonOut(["ok"=>false,"msg"=>"Unknown action"]);
}

/* ========= NORMAL PAGE ========= */
$pageTitle = "Jetty";
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<div class="content">

  <div class="d-flex align-items-center justify-content-between mb-3">
    <h4 class="m-0">Jetty</h4>

    <div class="d-flex gap-2 align-items-center">
      <input id="q" type="text" class="form-control form-control-sm" style="width:320px;"
             placeholder="Search (Jetty / Nama Panjang)..." />
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
            Download template dulu, isi datanya, lalu upload. Duplicate <b>Jetty</b> akan <b>di-skip</b>.
          </div>
        </div>

        <div class="d-flex gap-2 align-items-center">
          <a class="btn btn-sm btn-outline-primary" href="<?= $SELF ?>?download=jetty_template">
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
      <h6 class="mb-3">Input Jetty</h6>

      <form id="formCreate" class="row g-2">
        <div class="col-md-2">
          <label class="form-label">Jetty</label>
          <input name="jetty" class="form-control" placeholder="ABK" required>
        </div>

        <div class="col-md-10">
          <label class="form-label">Nama Panjang</label>
          <input name="nama_panjang" class="form-control" placeholder="JETTY PT ...." required>
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
      <h6 class="mb-3">Data Jetty</h6>

      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle" id="tbl">
          <thead class="table-light">
            <tr>
              <th style="min-width:90px;">Jetty</th>
              <th>Nama Panjang</th>
              <th style="width:190px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="3" class="text-center text-muted">Loading...</td></tr>
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

  const jetty = esc(r.jetty);
  const nama  = esc(r.nama_panjang);

  return `
  <tr data-jetty="${jetty}">
    <td><input class="form-control form-control-sm" value="${jetty}" disabled></td>
    <td><input class="form-control form-control-sm" name="nama_panjang" value="${nama}"></td>
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
    tbody.innerHTML = `<tr><td colspan="3" class="text-danger">Error: ${res.msg}</td></tr>`;
    return;
  }
  if (!res.data.length){
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No data</td></tr>`;
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
  const jetty = tr.getAttribute('data-jetty');

  if (e.target.classList.contains('btnDelete')){
    if (!confirm(`Hapus jetty ${jetty}?`)) return;
    const res = await api('delete', { jetty });
    if (res.ok){
      showAlert('success', res.msg);
      tr.remove();
      if (!tbody.children.length) tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No data</td></tr>`;
    } else {
      showAlert('danger', res.msg);
    }
  }

  if (e.target.classList.contains('btnUpdate')){
    const nama = tr.querySelector(`[name="nama_panjang"]`)?.value ?? '';
    const payload = { jetty, nama_panjang: nama };
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

loadTable();
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
