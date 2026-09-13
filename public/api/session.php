<?php
require_once __DIR__ . '/../../src/auth.php';

$token = csrf_token(); // also refreshes the readable csrf_token cookie
$user = current_user();

json_response([
    'ok' => true,
    'authenticated' => $user !== null,
    'user' => $user,
]);
