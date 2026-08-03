<?php
session_start();
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}
$pageTitle = "Kurs Tengah - MLP Logistic";

include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/sidebar.php";
?>

<div class="content">
  <div class="card shadow-sm">
    <div class="card-body">
      <h5 class="mb-1">Kurs Tengah</h5>
      <div class="text-muted">Belum ada data.</div>
    </div>
  </div>
</div>

<?php include __DIR__ . "/../includes/footer.php"; ?>
