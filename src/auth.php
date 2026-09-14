<?php
/**
 * Authentication helpers: session bootstrap, register/login/logout,
 * JSON body/response helpers, and CSRF protection for the JSON API
 * consumed by the static HTML front end.
 */

require_once __DIR__ . '/Database.php';

function app_config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $config = app_config();

    $forwardedProto = strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '');
    $isHttps = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || $forwardedProto === 'https';

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $isHttps,
    ]);

    session_name($config['app']['session_name']);
    session_start();
}

/** Read a JSON request body as an associative array. */
function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Send a JSON response and stop execution. */
function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * CSRF token: kept in the session (source of truth) and mirrored into a
 * readable cookie so front-end JS can attach it as a header on POSTs
 * (double-submit pattern). The session cookie itself stays httpOnly.
 */
function csrf_token(): string
{
    start_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    $forwardedProto = strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '');
    $isHttps = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || $forwardedProto === 'https';
    setcookie('csrf_token', $_SESSION['csrf_token'], [
        'expires' => 0,
        'path' => '/',
        'httponly' => false,
        'samesite' => 'Lax',
        'secure' => $isHttps,
    ]);
    return $_SESSION['csrf_token'];
}

function csrf_verify_header(): bool
{
    start_session();
    $submitted = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return !empty($_SESSION['csrf_token']) && $submitted !== '' && hash_equals($_SESSION['csrf_token'], $submitted);
}

function current_user(): ?array
{
    start_session();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $username = $_SESSION['username'] ?? '';
    $role = $_SESSION['role'] ?? 'user';
    return [
        'id' => $_SESSION['user_id'],
        'username' => $username,
        'role' => $role,
        'is_admin' => $role === 'admin',
    ];
}

/** For API endpoints: require login or short-circuit with a 401 JSON reply. */
function require_login_api(): array
{
    $user = current_user();
    if (!$user) {
        json_response(['ok' => false, 'errors' => ['You must be signed in.']], 401);
    }
    return $user;
}

/**
 * @return array{ok: bool, errors: string[]}
 */
function register_user(string $username, string $email, string $password, string $confirm): array
{
    $errors = [];

    $username = trim($username);
    $email = trim($email);

    if ($username === '' || !preg_match('/^[A-Za-z0-9_]{3,32}$/', $username)) {
        $errors[] = 'Username must be 3-32 characters (letters, numbers, underscore only).';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Enter a valid email address.';
    }
    if (strlen($password) < 8) {
        $errors[] = 'Password must be at least 8 characters.';
    }
    if ($password !== $confirm) {
        $errors[] = 'Passwords do not match.';
    }

    if ($errors) {
        return ['ok' => false, 'errors' => $errors];
    }

    $pdo = Database::connection();

    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = :u OR email = :e LIMIT 1');
    $stmt->execute(['u' => $username, 'e' => $email]);
    if ($stmt->fetch()) {
        return ['ok' => false, 'errors' => ['That username or email is already taken.']];
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    $admins = app_config()['app']['admin_users'] ?? ['admin'];
    $role = in_array(strtolower($username), array_map('strtolower', $admins), true) ? 'admin' : 'user';
    $stmt = $pdo->prepare(
        'INSERT INTO users (username, display_name, email, password_hash, role) VALUES (:u, :u2, :e, :p, :r)'
    );
    $stmt->execute(['u' => $username, 'u2' => $username, 'e' => $email, 'p' => $hash, 'r' => $role]);

    return ['ok' => true, 'errors' => []];
}

/**
 * @return array{ok: bool, errors: string[]}
 */
function login_user(string $usernameOrEmail, string $password): array
{
    $usernameOrEmail = trim($usernameOrEmail);
    if ($usernameOrEmail === '' || $password === '') {
        return ['ok' => false, 'errors' => ['Enter your username/email and password.']];
    }

    $pdo = Database::connection();
    $stmt = $pdo->prepare('SELECT id, username, password_hash, role FROM users WHERE username = :u OR email = :e LIMIT 1');
    $stmt->execute(['u' => $usernameOrEmail, 'e' => $usernameOrEmail]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        return ['ok' => false, 'errors' => ['Incorrect username/email or password.']];
    }

    start_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role'] = $user['role'] ?? 'user';
    unset($_SESSION['csrf_token']); // rotate CSRF token on privilege change

    $update = $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id');
    $update->execute(['id' => $user['id']]);

    return ['ok' => true, 'errors' => [], 'user' => ['id' => $user['id'], 'username' => $user['username'], 'role' => $_SESSION['role'], 'is_admin' => $_SESSION['role'] === 'admin']];
}

function logout_user(): void
{
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    setcookie('csrf_token', '', time() - 42000, '/');
    session_destroy();
}
