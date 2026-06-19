<?php
session_start();

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}

/* ========= SELF PATH ========= */
$SELF = "/logistic/Operation/5flf.php";

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
if (isset($_GET['download']) && $_GET['download'] === 'flf_template') {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="flf_template.csv"');

  $out = fopen('php://output', 'w');
  fputcsv($out, ['floating_crane','vendor_flf','pbm','anchorage']);

  // contoh baris
  fputcsv($out, ['FC RATU DEWATA','PSS','FLOATING CRANE','M.BERAU']);
  fputcsv($out, ['STV MAESTRO','MLS','STEVEDORE','M.JAWA']);
  fclose($out);
  exit;
}

/* ========= AJAX API (same file) ========= */
if (isset($_GET['ajax']) && $_GET['ajax'] === '1') {

  $action = $_POST['action'] ?? $_GET['action'] ?? '';

  // ===== LIST + SEARCH =====
  if ($action === 'list') {
    $q = clean($_GET['q'] ?? '');

    $sql = "SELECT floating_crane, vendor_flf, pbm, anchorage FROM flf";
    $types = "";
    $params = [];

    if ($q !== "") {
      $sql .= " WHERE floating_crane LIKE ? OR vendor_flf LIKE ? OR pbm LIKE ? OR anchorage LIKE ?";
      $kw = "%{$q}%";
      $types = "ssss";
      $params = [$kw,$kw,$kw,$kw];
    }

    $sql .= " ORDER BY floating_crane ASC LIMIT 500";

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
    $floating = strtoupper(clean($_POST['floating_crane'] ?? ''));
    $vendor   = clean($_POST['vendor_flf'] ?? '');
    $pbm      = clean($_POST['pbm'] ?? '');
    $anch     = clean($_POST['anchorage'] ?? '');

    if ($floating === "" || $vendor === "" || $pbm === "" || $anch === "") {
      jsonOut(["ok"=>false,"msg"=>"Floating Crane, Vendor, PBM, dan Anchorage wajib diisi."]);
    }

    // duplicate check
    $stmt = $koneksi->prepare("SELECT COUNT(*) c FROM flf WHERE floating_crane=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $floating);
    $stmt->execute();
    $c = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
    $stmt->close();
    if ($c > 0) jsonOut(["ok"=>false,"msg"=>"Floating Crane sudah ada (harus unik)."]);

    $stmt = $koneksi->prepare("INSERT INTO flf (floating_crane, vendor_flf, pbm, anchorage) VALUES (?,?,?,?)");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("ssss", $floating, $vendor, $pbm, $anch);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data FLF berhasil ditambah."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== UPDATE =====
  if ($action === 'update') {
    $floating = strtoupper(clean($_POST['floating_crane'] ?? ''));
    $vendor   = clean($_POST['vendor_flf'] ?? '');
    $pbm      = clean($_POST['pbm'] ?? '');
    $anch     = clean($_POST['anchorage'] ?? '');

    if ($floating === "" || $vendor === "" || $pbm === "" || $anch === "") {
      jsonOut(["ok"=>false,"msg"=>"Data update tidak valid."]);
    }

    $stmt = $koneksi->prepare("UPDATE flf SET vendor_flf=?, pbm=?, anchorage=? WHERE floating_crane=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("ssss", $vendor, $pbm, $anch, $floating);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data FLF berhasil diupdate."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== DELETE =====
  if ($action === 'delete') {
    $floating = strtoupper(clean($_POST['floating_crane'] ?? ''));
    if ($floating === "") jsonOut(["ok"=>false,"msg"=>"Floating Crane kosong."]);

    $stmt = $koneksi->prepare("DELETE FROM flf WHERE floating_crane=?");
    if (!$stmt) jsonOut(["ok"=>false,"msg"=>$koneksi->error]);
    $stmt->bind_param("s", $floating);

    $ok = $stmt->execute();
    $err = $stmt->error;
    $stmt->close();

    jsonOut($ok ? ["ok"=>true,"msg"=>"Data FLF berhasil dihapus."] : ["ok"=>false,"msg"=>$err]);
  }

  // ===== IMPORT CSV (SKIP DUPLICATE floating_crane) =====
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
    $required = ['floating_crane','vendor_flf','pbm','anchorage'];

    foreach ($required as $col) {
      if (!in_array($col, $header, true)) {
        fclose($fh);
        jsonOut(["ok"=>false,"msg"=>"Header CSV salah. Wajib ada kolom: floating_crane, vendor_flf, pbm, anchorage"]);
      }
    }

    $idx = array_flip($header);

    $inserted = 0;
    $skipped  = 0;
    $errors   = 0;

    $stmtIns = $koneksi->prepare("INSERT INTO flf (floating_crane, vendor_flf, pbm, anchorage) VALUES (?,?,?,?)");
    if (!$stmtIns) { fclose($fh); jsonOut(["ok"=>false,"msg"=>"Prepare insert gagal: ".$koneksi->error]); }

    $stmtChk = $koneksi->prepare("SELECT COUNT(*) c FROM flf WHERE floating_crane=?");
    if (!$stmtChk) { fclose($fh); jsonOut(["ok"=>false,"msg"=>"Prepare check gagal: ".$koneksi->error]); }

    while (($row = fgetcsv($fh)) !== false) {
      $floating = strtoupper(clean($row[$idx['floating_crane']] ?? ''));
      $vendor   = clean($row[$idx['vendor_flf']] ?? '');
      $pbm      = clean($row[$idx['pbm']] ?? '');
      $anch     = clean($row[$idx['anchorage']] ?? '');

      if ($floating === "" || $vendor === "" || $pbm === "" || $anch === "") { $errors++; continue; }

      $stmtChk->bind_param("s", $floating);
      $stmtChk->execute();
      $c = (int)($stmtChk->get_result()->fetch_assoc()['c'] ?? 0);
      if ($c > 0) { $skipped++; continue; }

      $stmtIns->bind_param("ssss", $floating, $vendor, $pbm, $anch);
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
$pageTitle = "FLF";
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<div class="content">

  <div class="d-flex align-items-center justify-content-between mb-3">
    <h4 class="m-0">FLF</h4>

    <div class="d-flex gap-2 align-items-center">
      <input id="q" type="text" class="form-control form-control-sm" style="width:320px;"
             placeholder="Search (FC / Vendor / PBM / Anchorage)..." />
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
            Download template dulu, isi datanya, lalu upload. Duplicate <b>Floating Crane</b> akan <b>di-skip</b>.
          </div>
        </div>

        <div class="d-flex gap-2 align-items-center">
          <a class="btn btn-sm btn-outline-primary" href="<?= $SELF ?>?download=flf_template">
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
      <h6 class="mb-3">Input FLF</h6>

      <form id="formCreate" class="row g-2">
        <div class="col-md-4">
          <label class="form-label">Floating Crane</label>
          <input name="floating_crane" class="form-control" placeholder="FC RATU DEWATA" required>
        </div>

        <div class="col-md-2">
          <label class="form-label">Vendor FLF</label>
          <input name="vendor_flf" class="form-control" placeholder="PSS" required>
        </div>

        <div class="col-md-3">
          <label class="form-label">PBM</label>
          <input name="pbm" class="form-control" placeholder="FLOATING CRANE" required>
        </div>

        <div class="col-md-3">
          <label class="form-label">Anchorage</label>
          <input name="anchorage" class="form-control" placeholder="M.BERAU" required>
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
      <h6 class="mb-3">Data FLF</h6>

      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle" id="tbl">
          <thead class="table-light">
            <tr>
              <th style="min-width:220px;">Floating Crane</th>
              <th style="min-width:120px;">Vendor</th>
              <th style="min-width:180px;">PBM</th>
              <th style="min-width:140px;">Anchorage</th>
              <th style="width:190px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="5" class="text-center text-muted">Loading...</td></tr>
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

  const floating = esc(r.floating_crane);
  const vendor   = esc(r.vendor_flf);
  const pbm      = esc(r.pbm);
  const anch     = esc(r.anchorage);

  return `
  <tr data-floating="${floating}">
    <td><input class="form-control form-control-sm" value="${floating}" disabled></td>
    <td><input class="form-control form-control-sm" name="vendor_flf" value="${vendor}"></td>
    <td><input class="form-control form-control-sm" name="pbm" value="${pbm}"></td>
    <td><input class="form-control form-control-sm" name="anchorage" value="${anch}"></td>
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
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger">Error: ${res.msg}</td></tr>`;
    return;
  }
  if (!res.data.length){
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No data</td></tr>`;
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
  const floating_crane = tr.getAttribute('data-floating');

  if (e.target.classList.contains('btnDelete')){
    if (!confirm(`Hapus FLF ${floating_crane}?`)) return;
    const res = await api('delete', { floating_crane });
    if (res.ok){
      showAlert('success', res.msg);
      tr.remove();
      if (!tbody.children.length) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No data</td></tr>`;
    } else {
      showAlert('danger', res.msg);
    }
  }

  if (e.target.classList.contains('btnUpdate')){
    const getVal = (name)=> tr.querySelector(`[name="${name}"]`)?.value ?? '';
    const payload = {
      floating_crane,
      vendor_flf: getVal('vendor_flf'),
      pbm: getVal('pbm'),
      anchorage: getVal('anchorage')
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

loadTable();
</script>

<?php include __DIR__ . "/../includes/footer.php"; ?>
