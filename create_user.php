<?php
session_start();

/* ====== KUNCI AKSES: HANYA IT ====== */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}
if (($_SESSION['divisi'] ?? '') !== 'IT') {
  http_response_code(403);
  die("403 - Access denied");
}

require_once __DIR__ . '/config/database.php';

try {
  $koneksi = db_connect('databasemlp');
} catch (RuntimeException $exception) {
  http_response_code(500);
  die(htmlspecialchars($exception->getMessage(), ENT_QUOTES, 'UTF-8'));
}

/* ====== CONFIG ====== */
$protectedUsers = ['admin']; // username yang tidak boleh dihapus
$sessionUser    = $_SESSION['username'] ?? '';

/* ====== HELPER ====== */
function clean($s){ return trim((string)$s); }
function jsonOut($arr){
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr);
  exit;
}
function tableHasColumn(mysqli $connection, string $table, string $column): bool {
  $stmt = $connection->prepare("
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  ");
  $stmt->bind_param("ss", $table, $column);
  $stmt->execute();
  $count = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
  $stmt->close();

  return $count > 0;
}

/* =========================================================
   AJAX HANDLER
   - list (search realtime)
   - create
   - update
   - delete
========================================================= */
if (isset($_POST['ajax']) && $_POST['ajax'] === '1') {

  $action = $_POST['action'] ?? '';

  // --- LIST (search realtime) ---
  if ($action === 'list') {
    $keyword = clean($_POST['q'] ?? '');
    $hasCreatedAt = tableHasColumn($koneksi, 'usermlp', 'created_at');
    $createdAtSelect = $hasCreatedAt ? "created_at" : "NULL AS created_at";
    $sql = "SELECT username, password, jabatan, divisi, $createdAtSelect FROM usermlp";
    $params = [];
    $types = "";

    if ($keyword !== "") {
      $sql .= " WHERE username LIKE ? OR jabatan LIKE ? OR divisi LIKE ?";
      $kw = "%".$keyword."%";
      $params = [$kw, $kw, $kw];
      $types = "sss";
    }
    $sql .= $hasCreatedAt ? " ORDER BY created_at DESC, username ASC" : " ORDER BY username ASC";

    $stmt = $koneksi->prepare($sql);
    if (!$stmt) jsonOut(['ok'=>false,'msg'=>"Prepare error: ".$koneksi->error]);
    if ($types !== "") $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $res = $stmt->get_result();
    $data = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    $stmt->close();

    jsonOut([
      'ok' => true,
      'data' => $data
    ]);
  }

  // --- CREATE ---
  if ($action === 'create') {
    $username = clean($_POST['username'] ?? '');
    $password = clean($_POST['password'] ?? '');
    $jabatan  = clean($_POST['jabatan'] ?? '');
    $divisi   = clean($_POST['divisi'] ?? '');

    if ($username === "" || $password === "" || $jabatan === "" || $divisi === "") {
      jsonOut(['ok'=>false,'msg'=>"Semua field wajib diisi."]);
    }

    $stmt = $koneksi->prepare("SELECT COUNT(*) AS c FROM usermlp WHERE username=?");
    if (!$stmt) jsonOut(['ok'=>false,'msg'=>"Prepare error: ".$koneksi->error]);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $c = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
    $stmt->close();

    if ($c > 0) jsonOut(['ok'=>false,'msg'=>"Username sudah ada. Pakai username lain."]);

    $stmt = $koneksi->prepare("INSERT INTO usermlp (username, password, jabatan, divisi) VALUES (?,?,?,?)");
    if (!$stmt) jsonOut(['ok'=>false,'msg'=>"Prepare error: ".$koneksi->error]);
    $stmt->bind_param("ssss", $username, $password, $jabatan, $divisi);

    if ($stmt->execute()) {
      $stmt->close();
      jsonOut(['ok'=>true,'msg'=>"User berhasil dibuat."]);
    } else {
      $err = $stmt->error;
      $stmt->close();
      jsonOut(['ok'=>false,'msg'=>"Gagal create user: ".$err]);
    }
  }

  // --- UPDATE (key = old_username) ---
  if ($action === 'update') {
    $old_username = clean($_POST['old_username'] ?? '');
    $username     = clean($_POST['username'] ?? '');
    $password     = clean($_POST['password'] ?? ''); // kosong = tidak ganti
    $jabatan      = clean($_POST['jabatan'] ?? '');
    $divisi       = clean($_POST['divisi'] ?? '');

    if ($old_username === "" || $username === "" || $jabatan === "" || $divisi === "") {
      jsonOut(['ok'=>false,'msg'=>"Data update tidak valid."]);
    }

    // kalau ganti username, cek duplikat
    if ($username !== $old_username) {
      $stmt = $koneksi->prepare("SELECT COUNT(*) AS c FROM usermlp WHERE username=?");
      if (!$stmt) jsonOut(['ok'=>false,'msg'=>"Prepare error: ".$koneksi->error]);
      $stmt->bind_param("s", $username);
      $stmt->execute();
      $c = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
      $stmt->close();

      if ($c > 0) jsonOut(['ok'=>false,'msg'=>"Username sudah dipakai user lain."]);
    }

    if ($password !== "") {
      $stmt = $koneksi->prepare("UPDATE usermlp SET username=?, password=?, jabatan=?, divisi=? WHERE username=?");
      if (!$stmt) jsonOut(['ok'=>false,'msg'=>"Prepare error: ".$koneksi->error]);
      $stmt->bind_param("sssss", $username, $password, $jabatan, $divisi, $old_username);
    } else {
      $stmt = $koneksi->prepare("UPDATE usermlp SET username=?, jabatan=?, divisi=? WHERE username=?");
      if (!$stmt) jsonOut(['ok'=>false,'msg'=>"Prepare error: ".$koneksi->error]);
      $stmt->bind_param("ssss", $username, $jabatan, $divisi, $old_username);
    }

    if ($stmt->execute()) {
      $stmt->close();
      jsonOut(['ok'=>true,'msg'=>"User berhasil diupdate."]);
    } else {
      $err = $stmt->error;
      $stmt->close();
      jsonOut(['ok'=>false,'msg'=>"Gagal update user: ".$err]);
    }
  }

  // --- DELETE (key = username) ---
  if ($action === 'delete') {
    $usernameDel = clean($_POST['username'] ?? '');
    if ($usernameDel === "") jsonOut(['ok'=>false,'msg'=>"Data delete tidak valid."]);

    // proteksi: admin & akun yang sedang login
    if (in_array($usernameDel, $protectedUsers, true)) {
      jsonOut(['ok'=>false,'msg'=>"User '$usernameDel' tidak boleh dihapus (protected)."]);
    }
    if ($usernameDel === $sessionUser) {
      jsonOut(['ok'=>false,'msg'=>"Tidak bisa menghapus akun yang sedang login."]);
    }

    $stmt = $koneksi->prepare("DELETE FROM usermlp WHERE username=?");
    if (!$stmt) jsonOut(['ok'=>false,'msg'=>"Prepare error: ".$koneksi->error]);
    $stmt->bind_param("s", $usernameDel);

    if ($stmt->execute()) {
      $stmt->close();
      jsonOut(['ok'=>true,'msg'=>"User berhasil dihapus."]);
    } else {
      $err = $stmt->error;
      $stmt->close();
      jsonOut(['ok'=>false,'msg'=>"Gagal hapus user: ".$err]);
    }
  }

  jsonOut(['ok'=>false,'msg'=>"Action tidak dikenali."]);
}

/* ====== HALAMAN NORMAL (NON-AJAX) ====== */
$pageTitle = "Create User";
include __DIR__ . "/includes/header.php";
include __DIR__ . "/includes/sidebar.php";
?>

<div class="content">

  <div class="d-flex align-items-center justify-content-between mb-3">
    <h4 class="m-0">Create User</h4>

    <!-- SEARCH REALTIME (TANPA TOMBOL) -->
    <div class="d-flex gap-2" style="max-width:420px; width:100%;">
      <input id="searchBox" type="text" class="form-control form-control-sm"
             placeholder="Search realtime (username / jabatan / divisi)">
      <button id="btnReset" class="btn btn-sm btn-outline-secondary" type="button">Reset</button>
    </div>
  </div>

  <div id="alertBox" class="alert d-none" role="alert"></div>

  <!-- FORM CREATE (AJAX) -->
  <div class="card mb-3">
    <div class="card-body">
      <h6 class="mb-3">Tambah User</h6>

      <form id="formCreate" class="row g-2">
        <div class="col-md-3">
          <label class="form-label">Username</label>
          <input type="text" name="username" class="form-control" required>
        </div>

        <div class="col-md-3">
          <label class="form-label">Password (plain)</label>
          <input type="text" name="password" class="form-control" required>
        </div>

        <div class="col-md-3">
          <label class="form-label">Jabatan</label>
          <select name="jabatan" class="form-select" required>
            <option value="">-- pilih --</option>
            <option>Div. Head</option>
            <option>Dept. Head</option>
            <option>Sect. Head</option>
            <option>SPV</option>
            <option>Staff</option>
          </select>
        </div>

        <div class="col-md-3">
          <label class="form-label">Divisi</label>
          <select name="divisi" class="form-select" required>
            <option value="">-- pilih --</option>
            <option>IT</option>
            <option>Operation</option>
            <option>VM&FAT</option>
            <option>Finance&Accounting</option>
          </select>
        </div>

        <div class="col-12">
          <button class="btn btn-success" type="submit">Create</button>
        </div>
      </form>

    </div>
  </div>

  <!-- TABLE VIEW (AJAX RENDER) -->
  <div class="card">
    <div class="card-body">
      <h6 class="mb-3">Daftar User</h6>

      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead class="table-light">
            <tr>
              <th>Username</th>
              <th>Password</th>
              <th>Jabatan</th>
              <th>Divisi</th>
              <th style="width:170px;">Created</th>
              <th style="width:240px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbodyUsers">
            <tr><td colspan="6" class="text-center text-muted">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="small text-muted mt-2">
        Update & Delete sudah tanpa reload. Password update hanya kalau diisi.
      </div>
    </div>
  </div>

</div>

<script>
/* ===============================
   AJAX UTIL
================================ */
const alertBox = document.getElementById('alertBox');

function showAlert(type, msg){
  alertBox.className = 'alert alert-' + type;
  alertBox.textContent = msg;
  alertBox.classList.remove('d-none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideAlert(){
  alertBox.classList.add('d-none');
}

async function postAjax(payload){
  const form = new URLSearchParams(payload);
  const res = await fetch('/logistic/create_user.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: form.toString()
  });
  return await res.json();
}

/* ===============================
   RENDER TABLE
================================ */
const tbody = document.getElementById('tbodyUsers');
const protectedUsers = <?= json_encode($protectedUsers) ?>;
const sessionUser = <?= json_encode($sessionUser) ?>;

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function rowTemplate(u){
  const username = u.username || '';
  const isProtected = protectedUsers.includes(username) || username === sessionUser;

  const jabOps = ['Div. Head','Dept. Head','Sect. Head','SPV','Staff'];
  const divOps = ['IT','Operation','VM&FAT','Finance&Accounting'];

  const jabSel = jabOps.map(op => {
    const sel = (op === u.jabatan) ? 'selected' : '';
    return `<option ${sel}>${escapeHtml(op)}</option>`;
  }).join('');

  const divSel = divOps.map(op => {
    const sel = (op === u.divisi) ? 'selected' : '';
    return `<option ${sel}>${escapeHtml(op)}</option>`;
  }).join('');

  const delBtn = isProtected
    ? `<button class="btn btn-sm btn-outline-secondary" type="button" disabled title="Protected / sedang login">Delete</button>`
    : `<button class="btn btn-sm btn-outline-danger btnDelete" type="button">Delete</button>`;

  return `
  <tr data-old="${escapeHtml(username)}">
    <td>
      <input class="form-control form-control-sm inpUsername" value="${escapeHtml(username)}" required>
      <input type="hidden" class="oldUsername" value="${escapeHtml(username)}">
    </td>

    <td>
      <input class="form-control form-control-sm inpPassword" placeholder="(kosong = tidak ganti)">
      <div class="small text-muted">Current: ${escapeHtml(u.password)}</div>
    </td>

    <td>
      <select class="form-select form-select-sm selJabatan" required>${jabSel}</select>
    </td>

    <td>
      <select class="form-select form-select-sm selDivisi" required>${divSel}</select>
    </td>

    <td>${escapeHtml(u.created_at || '')}</td>

    <td class="d-flex gap-2">
      <button class="btn btn-sm btn-primary btnUpdate" type="button">Update</button>
      ${delBtn}
    </td>
  </tr>`;
}

async function loadUsers(q=''){
  const r = await postAjax({ ajax:'1', action:'list', q });
  if (!r.ok){
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${escapeHtml(r.msg || 'Error')}</td></tr>`;
    return;
  }

  if (!r.data || r.data.length === 0){
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No data</td></tr>`;
    return;
  }

  tbody.innerHTML = r.data.map(rowTemplate).join('');
}

/* ===============================
   SEARCH REALTIME (DEBOUNCE)
================================ */
const searchBox = document.getElementById('searchBox');
const btnReset  = document.getElementById('btnReset');

let t = null;
searchBox.addEventListener('input', () => {
  hideAlert();
  clearTimeout(t);
  t = setTimeout(() => loadUsers(searchBox.value.trim()), 250);
});

btnReset.addEventListener('click', () => {
  searchBox.value = '';
  hideAlert();
  loadUsers('');
});

/* ===============================
   CREATE (AJAX)
================================ */
const formCreate = document.getElementById('formCreate');
formCreate.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const fd = new FormData(formCreate);
  const payload = {
    ajax:'1',
    action:'create',
    username: (fd.get('username') || '').toString().trim(),
    password: (fd.get('password') || '').toString().trim(),
    jabatan:  (fd.get('jabatan') || '').toString().trim(),
    divisi:   (fd.get('divisi') || '').toString().trim()
  };

  const r = await postAjax(payload);
  if (r.ok){
    showAlert('success', r.msg || 'OK');
    formCreate.reset();
    loadUsers(searchBox.value.trim());
  } else {
    showAlert('danger', r.msg || 'Gagal');
  }
});

/* ===============================
   UPDATE / DELETE (AJAX)
================================ */
tbody.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;

  // UPDATE
  if (e.target.classList.contains('btnUpdate')){
    hideAlert();

    const old_username = tr.querySelector('.oldUsername')?.value?.trim() || '';
    const username     = tr.querySelector('.inpUsername')?.value?.trim() || '';
    const password     = tr.querySelector('.inpPassword')?.value?.trim() || '';
    const jabatan      = tr.querySelector('.selJabatan')?.value?.trim() || '';
    const divisi       = tr.querySelector('.selDivisi')?.value?.trim() || '';

    const r = await postAjax({
      ajax:'1',
      action:'update',
      old_username,
      username,
      password,
      jabatan,
      divisi
    });

    if (r.ok){
      showAlert('success', r.msg || 'Updated');
      // refresh list biar oldUsername ikut ke-update kalau username berubah
      loadUsers(searchBox.value.trim());
    } else {
      showAlert('danger', r.msg || 'Gagal update');
    }
  }

  // DELETE
  if (e.target.classList.contains('btnDelete')){
    hideAlert();

    const old_username = tr.querySelector('.oldUsername')?.value?.trim() || '';
    if (!old_username) return;

    if (!confirm('Hapus user ' + old_username + ' ?')) return;

    const r = await postAjax({ ajax:'1', action:'delete', username: old_username });

    if (r.ok){
      showAlert('success', r.msg || 'Deleted');
      loadUsers(searchBox.value.trim());
    } else {
      showAlert('danger', r.msg || 'Gagal delete');
    }
  }
});

/* ===============================
   INIT
================================ */
loadUsers('');
</script>

<?php
include __DIR__ . "/includes/footer.php";
?>
