<?php
session_start();

// kalau sudah login, lempar ke home
if (isset($_SESSION['username'])) {
    header("Location: home.php");
    exit;
}

$error = '';

// koneksi langsung di sini dulu (sesuai request: 3 file dulu)
$koneksi = mysqli_connect("127.0.0.1", "root", "", "databasemlp", 3306);
if (!$koneksi) {
    die("Koneksi DB gagal: " . mysqli_connect_error());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = trim($_POST['password'] ?? '');

    $stmt = $koneksi->prepare("SELECT username, password, jabatan, divisi FROM usermlp WHERE username = ? LIMIT 1");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res && $res->num_rows === 1) {
        $u = $res->fetch_assoc();

        // password masih plain text
        if ($password === $u['password']) {
            $_SESSION['username'] = $u['username'];
            $_SESSION['jabatan']  = $u['jabatan'];
            $_SESSION['divisi']   = $u['divisi'];

            header("Location: home.php");
            exit;
        } else {
            $error = "Password salah.";
        }
    } else {
        $error = "Username tidak ditemukan.";
    }

    $stmt->close();
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Login - MLP</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container" style="max-width:420px; margin-top:80px;">
    <div class="text-center mb-3">
      <img src="assets/img/logo/mlp.png" alt="MLP" height="55">
      <div class="mt-2 fw-semibold">MLP Logistic</div>
      <div class="text-muted" style="font-size:13px;">Sign in to continue</div>
    </div>

    <div class="card shadow-sm">
      <div class="card-body p-4">
        <?php if ($error): ?>
          <div class="alert alert-danger py-2 mb-3"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <form method="post" autocomplete="off">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <input name="username" class="form-control" required>
          </div>
          <div class="mb-3">
            <label class="form-label">Password</label>
            <input type="password" name="password" class="form-control" required>
          </div>
          <button class="btn btn-primary w-100">Login</button>
        </form>
      </div>
    </div>
  </div>
</body>
</html>
