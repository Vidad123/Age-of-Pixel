<?php
/**
 * Lazy PDO connection, shared across a request.
 */

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $config = require __DIR__ . '/config.php';
        $db = $config['db'];

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $db['host'],
            $db['port'],
            $db['name'],
            $db['charset']
        );

        try {
            self::$pdo = new PDO($dsn, $db['user'], $db['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            error_log('Database connection failed: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');

            $isLocal = in_array($_SERVER['SERVER_ADDR'] ?? '', ['127.0.0.1', '::1'], true)
                || in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1'], true);

            echo json_encode([
                'ok' => false,
                'errors' => [$isLocal
                    ? 'Database connection failed: ' . $e->getMessage()
                    : "The kingdom's archives are unreachable. Please try again shortly."],
            ]);
            exit;
        }

        return self::$pdo;
    }
}
