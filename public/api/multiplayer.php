<?php
require_once __DIR__ . '/../../src/auth.php';

$user = require_login_api();
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !csrf_verify_header()) {
    json_response(['ok' => false, 'errors' => ['Invalid request token. Refresh the page and try again.']], 403);
}

$body = json_body();
$action = (string)($body['action'] ?? '');
$pdo = Database::connection();

function room_code(PDO $pdo): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        $stmt = $pdo->prepare('SELECT 1 FROM multiplayer_matches WHERE room_code = :code');
        $stmt->execute(['code' => $code]);
    } while ($stmt->fetchColumn());
    return $code;
}

function load_room(PDO $pdo, string $code): ?array {
    $stmt = $pdo->prepare('SELECT * FROM multiplayer_matches WHERE room_code = :code LIMIT 1');
    $stmt->execute(['code' => $code]);
    $room = $stmt->fetch();
    return $room ?: null;
}

function room_payload(PDO $pdo, array $room, int $userId): array {
    $stmt = $pdo->prepare('SELECT mp.slot, mp.user_id, u.username FROM multiplayer_players mp JOIN users u ON u.id = mp.user_id WHERE mp.match_id = :id ORDER BY mp.slot');
    $stmt->execute(['id' => $room['id']]);
    $players = $stmt->fetchAll();
    $slot = null;
    foreach ($players as $player) if ((int)$player['user_id'] === $userId) $slot = (int)$player['slot'];
    $config = json_decode($room['config_json'], true) ?: [];
    return [
        'code' => $room['room_code'], 'status' => $room['status'], 'map' => $config['map'] ?? 'riverwatch',
        'game_id' => $config['game_id'] ?? strtolower($room['room_code']), 'slot' => $slot,
        'active_slot' => (int)$room['active_slot'], 'version' => (int)$room['version'],
        'state' => $room['state_json'] ? json_decode($room['state_json'], true) : null,
        'players' => array_map(fn($p) => ['slot' => (int)$p['slot'], 'username' => $p['username']], $players),
    ];
}

if ($action === 'create') {
    $allowedMaps = ['riverwatch','emberfall','frosthollow','sunscar','verdant','blackwood','goldenplains','shatteredcoast','moonfen','ironridge'];
    $map = in_array($body['map'] ?? '', $allowedMaps, true) ? $body['map'] : 'riverwatch';
    $code = room_code($pdo);
    $config = json_encode(['map' => $map, 'game_id' => strtolower($code) . '-' . time()]);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO multiplayer_matches (room_code, host_user_id, status, config_json) VALUES (:code, :uid, 'waiting', :config)");
        $stmt->execute(['code' => $code, 'uid' => $user['id'], 'config' => $config]);
        $matchId = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare('INSERT INTO multiplayer_players (match_id, user_id, slot) VALUES (:match, :uid, 1)');
        $stmt->execute(['match' => $matchId, 'uid' => $user['id']]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    $room = load_room($pdo, $code);
    json_response(['ok' => true, 'room' => room_payload($pdo, $room, (int)$user['id'])]);
}

$code = strtoupper(trim((string)($body['code'] ?? '')));
if (!preg_match('/^[A-Z0-9]{6}$/', $code)) json_response(['ok' => false, 'errors' => ['Invalid room code.']], 422);
$room = load_room($pdo, $code);
if (!$room) json_response(['ok' => false, 'errors' => ['Room not found.']], 404);

if ($action === 'join') {
    $stmt = $pdo->prepare('SELECT slot FROM multiplayer_players WHERE match_id = :match AND user_id = :uid');
    $stmt->execute(['match' => $room['id'], 'uid' => $user['id']]);
    $slot = $stmt->fetchColumn();
    if (!$slot) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM multiplayer_players WHERE match_id = :match');
        $stmt->execute(['match' => $room['id']]);
        if ((int)$stmt->fetchColumn() >= 2) json_response(['ok' => false, 'errors' => ['This room is full.']], 409);
        $slot = 2;
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO multiplayer_players (match_id, user_id, slot) VALUES (:match, :uid, 2)');
            $stmt->execute(['match' => $room['id'], 'uid' => $user['id']]);
            $stmt = $pdo->prepare("UPDATE multiplayer_matches SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = :id");
            $stmt->execute(['id' => $room['id']]);
            $pdo->commit();
        } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
        $room = load_room($pdo, $code);
    }
    json_response(['ok' => true, 'slot' => (int)$slot, 'room' => room_payload($pdo, $room, (int)$user['id'])]);
}

$payload = room_payload($pdo, $room, (int)$user['id']);
if (!$payload['slot']) json_response(['ok' => false, 'errors' => ['You are not a player in this room.']], 403);

if ($action === 'state') json_response(['ok' => true, 'room' => $payload]);

if ($action === 'save') {
    if ($payload['status'] !== 'active' && (int)$payload['slot'] !== 1) json_response(['ok' => false, 'errors' => ['Waiting for another player.']], 409);
    if ((int)$payload['active_slot'] !== (int)$payload['slot'] && !empty($room['state_json'])) json_response(['ok' => false, 'errors' => ['It is not your turn.']], 409);
    $state = $body['state'] ?? null;
    $encoded = json_encode($state, JSON_UNESCAPED_SLASHES);
    if (!is_array($state) || strlen($encoded) > 1000000) json_response(['ok' => false, 'errors' => ['Invalid match state.']], 422);
    $nextSlot = isset($body['next_slot']) ? max(1, min(2, (int)$body['next_slot'])) : (int)$payload['active_slot'];
    $expected = (int)($body['version'] ?? $payload['version']);
    $stmt = $pdo->prepare('UPDATE multiplayer_matches SET state_json = :state, active_slot = :slot, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = :id AND version = :version');
    $stmt->execute(['state' => $encoded, 'slot' => $nextSlot, 'id' => $room['id'], 'version' => $expected]);
    if (!$stmt->rowCount()) json_response(['ok' => false, 'conflict' => true, 'errors' => ['The match changed. Reloading the latest turn.']], 409);
    $room = load_room($pdo, $code);
    json_response(['ok' => true, 'room' => room_payload($pdo, $room, (int)$user['id'])]);
}

json_response(['ok' => false, 'errors' => ['Unknown multiplayer action.']], 400);
