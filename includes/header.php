<?php
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($pageTitle)) $pageTitle = "MLP Logistic";

/* fallback divisi/departemen biar ga kosong di topbar */
$divisi = $_SESSION['divisi'] ?? ($_SESSION['departemen'] ?? ($_SESSION['department'] ?? '-'));
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title><?= htmlspecialchars($pageTitle) ?></title>
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- Bootstrap -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

  <style>
    :root{
      --sidebar-expanded: 240px;
      --sidebar-collapsed: 74px;
      --topbar-blue: #1F4E79; /* corporate blue */
      --sidebar-bg: #D9E1F2;  /* excel light blue */
    }

    /* ✅ FIX: pastikan layout full-width & topbar navy sampai ujung */
    html, body { width: 100%; }

    body{
      background:#f5f6f8;
      margin:0;

      /* ✅ FIX PENTING: jangan hidden, nanti tabel lebar gak bisa di-scroll */
      overflow-x: auto;
    }

    /* ================= TOPBAR ================= */
    .topbar{
      position: sticky;
      top: 0;
      z-index: 1000;
      height: 56px;
      display:flex;
      align-items:center;
      padding: 0 12px;
      gap: 10px;
      background: var(--topbar-blue);

      width: 100%;   /* ✅ full bleed */
      left: 0;
      right: 0;
    }

    .hamburger{
      border: 0;
      background: transparent;
      color: #ffffff;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor: pointer;
    }
    .hamburger:hover{ background: rgba(255,255,255,.15); }

    .brand{
      display:flex;
      align-items:center;
      text-decoration:none;
      padding-left: 2px;
    }
    .brand img{
      height: 42px;
      width: auto;
      display: block;
    }

    .topbar-user{
      color: rgba(255,255,255,.95);
      font-weight: 500;
      font-size: 14px;
      white-space: nowrap;
    }

    /* ================= LAYOUT ================= */
    .app{
      display:flex;
      min-height: calc(100vh - 56px);
      align-items: stretch;
      width: 100%;
    }

    /* ================= SIDEBAR ================= */
    .sidebar{
      background: var(--sidebar-bg);
      border-right: 1px solid #e9ecef;
      transition: width .18s ease;
      overflow-x: hidden;
      padding: 10px 8px;

      /* ✅ FIX PENTING: sidebar jangan pernah ke-shrink jadi 0 */
      width: var(--sidebar-expanded);
      flex: 0 0 var(--sidebar-expanded);
    }

    body.sidebar-collapsed .sidebar{
      width: var(--sidebar-collapsed);
      flex-basis: var(--sidebar-collapsed);
    }

    .menu-group-title{
      font-size: 12px;
      color:#6c757d;
      padding: 10px 12px 6px;
      text-transform: uppercase;
      letter-spacing:.04em;
      white-space: nowrap;
    }

    .nav-item-link{
      display:flex;
      align-items:center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      text-decoration:none;
      color:#111;
      white-space: nowrap;
    }
    .nav-item-link:hover{ background: rgba(255,255,255,.65); }

    .nav-icon{
      width: 22px;
      display:inline-flex;
      justify-content:center;
      flex: 0 0 22px;
    }

    .nav-text{ display:inline-block; }

    body.sidebar-collapsed .nav-text,
    body.sidebar-collapsed .menu-group-title{
      display:none;
    }

    .submenu{
      margin-left: 10px;
      padding-left: 10px;
      border-left: 2px solid rgba(0,0,0,.08);
    }

    .submenu .nav-item-link{
      padding: 8px 12px;
      border-radius: 10px;
    }

    .nav-parent{ cursor: pointer; }

    .chev{
      margin-left: auto;
      color: rgba(0,0,0,.55);
      font-size: 12px;
    }

    /* ================= CONTENT ================= */
    .content{
      flex: 1;
      padding: 16px;

      /* ✅ FIX PENTING: biar konten (tabel lebar) bisa scroll, bukan ngecilin sidebar */
      min-width: 0;

      /* ✅ scroll horizontal di area konten */
      overflow-x: auto;
    }

    /* ✅ Bonus: bikin scroll tabel lebih enak */
    .table-responsive{
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
  </style>
</head>
<body>

<!-- ================= TOPBAR ================= -->
<div class="topbar">
  <button class="hamburger" id="btnToggle" aria-label="Toggle sidebar" title="Menu">
    <span style="font-size:22px; line-height:1;">☰</span>
  </button>

  <a class="brand" href="/logistic/home.php" title="Back to Home">
    <img src="/logistic/assets/img/logo/mlp2.png?v=3" alt="MLP">
  </a>

  <div class="ms-auto d-flex align-items-center gap-2">
    <?php if (isset($_SESSION['username'])): ?>
      <span class="topbar-user">
        <?= htmlspecialchars($_SESSION['username']) ?> (<?= htmlspecialchars($divisi) ?>)
      </span>
      <a class="btn btn-light btn-sm" href="/logistic/logout.php">Logout</a>
    <?php endif; ?>
  </div>
</div>

<div class="app">
