<?php
// koneksi.php - central DB connection (MySQLi)
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$DB_HOST = "127.0.0.1";
$DB_USER = "root";
$DB_PASS = "";
$DB_NAME = "databasemlp";
$DB_PORT = 3306;

try {
    $koneksi = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME, $DB_PORT);
    $koneksi->set_charset("utf8mb4");
} catch (mysqli_sql_exception $e) {
    // Jangan tampilkan detail sensitif di produksi (untuk local aman)
    die("Koneksi database gagal: " . $e->getMessage());
}
