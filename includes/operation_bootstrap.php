<?php
session_start();

require_once __DIR__ . '/operation_helpers.php';

/* ========= AUTH (minimal) ========= */
if (!isset($_SESSION['username'])) {
  header("Location: /logistic/login.php");
  exit;
}
