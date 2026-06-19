<?php
session_start();
if (!isset($_SESSION['username'])) {
  header("Location: login.php");
  exit;
}
$pageTitle = "Home - MLP Logistic";

include __DIR__ . "/includes/header.php";
include __DIR__ . "/includes/sidebar.php";
?>

<div class="content">
  <div class="card shadow-sm">
    <div class="card-body">
      <h5 class="mb-1">Welcome, <?= htmlspecialchars($_SESSION['username']) ?></h5>
      <div class="text-muted">
        Divisi: <?= htmlspecialchars($_SESSION['divisi'] ?? '-') ?> |
        Jabatan: <?= htmlspecialchars($_SESSION['jabatan'] ?? '-') ?>
      </div>
    </div>
  </div>
</div>

<?php include __DIR__ . "/includes/footer.php"; ?>
