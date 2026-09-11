<?php
/**
 * Central app config. Reads DB credentials from environment variables when
 * present (recommended for real deployments) and falls back to the local
 * defaults below for quick local setup.
 */

$localFile = __DIR__ . '/config.local.php';
$local = is_file($localFile) ? require $localFile : [];
$localDb = is_array($local['db'] ?? null) ? $local['db'] : [];
$localApp = is_array($local['app'] ?? null) ? $local['app'] : [];

$env = static function (string $name, $fallback = null) {
    $value = getenv($name);
    return ($value === false || $value === '') ? $fallback : $value;
};
$adminUsers = $env('ADMIN_USERS', $localApp['admin_users'] ?? 'admin');
if (is_array($adminUsers)) {
    $adminUsers = implode(',', $adminUsers);
}

return [
    'db' => [
        'host' => $env('DB_HOST', $localDb['host'] ?? '127.0.0.1'),
        'port' => (int) $env('DB_PORT', $localDb['port'] ?? 3306),
        'name' => $env('DB_NAME', $localDb['name'] ?? 'AOP'),
        'user' => $env('DB_USER', $localDb['user'] ?? 'root'),
        'pass' => $env('DB_PASS', $localDb['pass'] ?? ''),
        'charset' => $env('DB_CHARSET', $localDb['charset'] ?? 'utf8mb4'),
    ],
    'app' => [
        'name' => 'Age of Pixel',
        'session_name' => $localApp['session_name'] ?? 'ageofpixel_session',
        'admin_users' => array_values(array_filter(array_map('trim', explode(',', (string) $adminUsers)))),
    ],
];
