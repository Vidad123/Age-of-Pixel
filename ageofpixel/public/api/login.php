<?php
require_once __DIR__ . '/../../src/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'errors' => ['Method not allowed.']], 405);
}
if (!csrf_verify_header()) {
    json_response(['ok' => false, 'errors' => ['Your session expired. Please refresh and try again.']], 403);
}

$body = json_body();

$result = login_user($body['identifier'] ?? '', $body['password'] ?? '');

json_response($result, $result['ok'] ? 200 : 401);
