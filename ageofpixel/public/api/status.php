<?php
require_once __DIR__ . '/../../src/auth.php';

$user = current_user();

json_response([
    'game' => 'Age of Pixel',
    'version' => '2.0',
    'status' => 'ready',
    'authenticated' => $user !== null,
    'server_time' => gmdate('c'),
]);
