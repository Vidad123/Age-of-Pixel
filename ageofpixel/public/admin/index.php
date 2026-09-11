<?php
require_once __DIR__ . '/../../src/auth.php';

$user = current_user();
if (!$user) {
    header('Location: ../login.html');
    exit;
}
if (empty($user['is_admin'])) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Administrator access required.';
    exit;
}

header('Location: ../admin.html');
exit;
