<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

/**
 * Open a MySQL connection using environment-based credentials.
 *
 * Before starting PHP, set DB_PASS to the password for DB_USER:
 *   DB_USER=logistic_app DB_PASS='your-password' php -S localhost:8000
 */
function db_connect(string $database): mysqli
{
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $port = (int) (getenv('DB_PORT') ?: 3306);
    $user = getenv('DB_USER') ?: 'logistic_app';
    $password = getenv('DB_PASS') ?: 'user123';
    
    if ($password === false || $password === '') {
        throw new RuntimeException(
            'DB_PASS belum diatur. Jalankan server PHP dengan environment variable DB_USER dan DB_PASS.'
        );
    }

    try {
        $connection = new mysqli($host, $user, $password, $database, $port);
        $connection->set_charset('utf8mb4');

        return $connection;
    } catch (mysqli_sql_exception $exception) {
        error_log('Database connection failed: ' . $exception->getMessage());

        throw new RuntimeException(
            sprintf(
                'Koneksi database "%s" gagal. Periksa DB_HOST, DB_PORT, DB_USER, DB_PASS, dan hak akses user MySQL.',
                $database
            ),
            0,
            $exception
        );
    }
}

/**
 * Keep existing installations compatible with vessel-level TLU schedule dates.
 */
function ensure_vessel_schedule_columns(mysqli $connection): void
{
    static $checkedDatabases = [];

    $result = $connection->query('SELECT DATABASE() AS db_name');
    $databaseRow = $result->fetch_assoc();
    $database = (string) ($databaseRow['db_name'] ?? '');
    if ($database === '' || isset($checkedDatabases[$database])) {
        return;
    }

    try {
        $statement = $connection->prepare(
            "SELECT COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = ?
               AND TABLE_NAME = 'vessel'
               AND COLUMN_NAME IN ('pkk', 'rkbm')"
        );
        $statement->bind_param('s', $database);
        $statement->execute();
        $existing = array_column(
            $statement->get_result()->fetch_all(MYSQLI_ASSOC),
            'COLUMN_NAME'
        );
        $statement->close();

        $alterParts = [];
        if (!in_array('pkk', $existing, true)) {
            $alterParts[] = 'ADD COLUMN pkk date DEFAULT NULL AFTER ta_vessel';
        }
        if (!in_array('rkbm', $existing, true)) {
            $alterParts[] = 'ADD COLUMN rkbm date DEFAULT NULL AFTER pkk';
        }

        if ($alterParts) {
            $connection->query('ALTER TABLE vessel ' . implode(', ', $alterParts));
        }

        $checkedDatabases[$database] = true;
    } catch (Throwable $exception) {
        throw new RuntimeException(
            'Gagal menyiapkan kolom PKK/RKBM pada data Vessel.',
            0,
            $exception
        );
    }
}
