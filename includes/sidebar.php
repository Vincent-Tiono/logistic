<?php
if (session_status() === PHP_SESSION_NONE) session_start();

/**
 * ============================
 * SAFE SESSION READ (fallback)
 * ============================
 * Kadang page tertentu nyimpen role di key yang beda:
 * - divisi
 * - departemen
 * - department
 * - jabatan (kalau lo pernah pakai itu)
 */
$divisi = $_SESSION['divisi'] ?? ($_SESSION['departemen'] ?? ($_SESSION['department'] ?? ''));
$divisi = trim((string)$divisi);

/** Anggap IT kalau divisi/departemen = IT (case-insensitive) */
$isIT = (strtoupper($divisi) === 'IT');

/* detect current path */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '';
$pathLower = strtolower($path);

/* Operation area? */
$isOperationPage = (strpos($pathLower, '/logistic/operation/') === 0);

/* auto-open submenu when in Operation pages */
$opSubDisplay = $isOperationPage ? 'block' : 'none';

/* active helper (case-insensitive) */
function isActive($needle){
  $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '';
  return (stripos($path, $needle) === 0) ? ' active' : '';
}

/* permission helper */
function canAccess($divisi, $target){
  $d = strtoupper(trim((string)$divisi));
  $t = strtoupper(trim((string)$target));
  return ($d === $t);
}
?>

<nav class="sidebar" id="sidebar">

  <!-- ===== MAIN ===== -->
  <div class="menu-group-title">Main</div>

  <a class="nav-item-link<?= isActive('/logistic/home.php') ?>" href="/logistic/home.php">
    <span class="nav-icon">🏠</span>
    <span class="nav-text">Home</span>
  </a>

  <!-- ===== MODULES ===== -->
  <div class="menu-group-title">Modules</div>

  <?php if ($isIT || canAccess($divisi, 'Operation')): ?>
    <!-- OPERATION (PARENT) -->
    <button type="button"
            class="nav-item-link nav-parent<?= $isOperationPage ? ' active' : '' ?>"
            onclick="toggleSubmenu('opSub')"
            style="cursor:pointer; border:0; background:transparent; width:100%; text-align:left;">
      <span class="nav-icon">⚓</span>
      <span class="nav-text">Operation</span>
      <span class="chev">▾</span>
    </button>

    <!-- SUBMENU -->
    <div id="opSub" class="submenu" style="display:<?= $opSubDisplay ?>; padding-left:6px;">

      <a class="nav-item-link<?= isActive('/logistic/Operation/1vessel.php') ?>" href="/logistic/Operation/1vessel.php">
        <span class="nav-icon">🚢</span>
        <span class="nav-text">Vessel</span>
      </a>

      <a class="nav-item-link<?= isActive('/logistic/Operation/2barges.php') ?>" href="/logistic/Operation/2barges.php">
        <span class="nav-icon">🛶</span>
        <span class="nav-text">Barges</span>
      </a>

      <a class="nav-item-link<?= isActive('/logistic/Operation/3jetty.php') ?>" href="/logistic/Operation/3jetty.php">
        <span class="nav-icon">🏗️</span>
        <span class="nav-text">Jetty</span>
      </a>

      <a class="nav-item-link<?= isActive('/logistic/Operation/4shipper.php') ?>" href="/logistic/Operation/4shipper.php">
        <span class="nav-icon">📦</span>
        <span class="nav-text">Shipper</span>
      </a>

      <a class="nav-item-link<?= isActive('/logistic/Operation/5flf.php') ?>" href="/logistic/Operation/5flf.php">
        <span class="nav-icon">⚙️</span>
        <span class="nav-text">FLF</span>
      </a>

      <a class="nav-item-link<?= isActive('/logistic/Operation/6sibarges.php') ?>" href="/logistic/Operation/6sibarges.php">
        <span class="nav-icon">🧾</span>
        <span class="nav-text">SI Barges</span>
      </a>

      <!-- ✅ NEW MENU -->
      <a class="nav-item-link<?= isActive('/logistic/Operation/7tluoperation.php') ?>" href="/logistic/Operation/7tluoperation.php">
        <span class="nav-icon">🧭</span>
        <span class="nav-text">TLU Operation</span>
      </a>

    </div>
  <?php endif; ?>

  <?php if ($isIT || canAccess($divisi, 'VM&FAT')): ?>
    <a class="nav-item-link<?= isActive('/logistic/VM/') ?>" href="/logistic/VM/">
      <span class="nav-icon">📊</span>
      <span class="nav-text">VM & FAT</span>
    </a>
  <?php endif; ?>

  <?php if ($isIT || canAccess($divisi, 'Finance&Accounting') || canAccess($divisi, 'Finance & Accounting')): ?>
    <a class="nav-item-link<?= isActive('/logistic/Finance/') ?>" href="/logistic/Finance/">
      <span class="nav-icon">💰</span>
      <span class="nav-text">Finance & Accounting</span>
    </a>
  <?php endif; ?>

  <?php if ($isIT): ?>
    <div class="menu-group-title">IT</div>

    <a class="nav-item-link<?= isActive('/logistic/create_user.php') ?>" href="/logistic/create_user.php">
      <span class="nav-icon">👤</span>
      <span class="nav-text">Create User</span>
    </a>
  <?php endif; ?>

</nav>
