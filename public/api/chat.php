<?php
require_once __DIR__ . '/../../src/auth.php';
$user = require_login_api();
$pdo = Database::connection();
$me = (int) $user['id'];

function require_friend(PDO $pdo, int $me, int $friendId): array
{
    if ($friendId < 1 || $friendId === $me) json_response(['ok' => false, 'errors' => ['Invalid friend.']], 422);
    $low = min($me, $friendId); $high = max($me, $friendId);
    $stmt = $pdo->prepare("SELECT u.id,u.username,u.display_name,u.avatar_color FROM friendships f JOIN users u ON u.id=:friend WHERE f.user_low_id=:low AND f.user_high_id=:high AND f.status='accepted'");
    $stmt->execute(['friend' => $friendId, 'low' => $low, 'high' => $high]);
    $friend = $stmt->fetch();
    if (!$friend) json_response(['ok' => false, 'errors' => ['You can only chat with accepted friends.']], 403);
    return $friend;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $friendId = (int) ($_GET['friend'] ?? 0);
    $friend = require_friend($pdo, $me, $friendId);
    $stmt = $pdo->prepare('SELECT id,sender_id,recipient_id,message,created_at FROM friend_messages WHERE (sender_id=:me1 AND recipient_id=:friend1) OR (sender_id=:friend2 AND recipient_id=:me2) ORDER BY id DESC LIMIT 100');
    $stmt->execute(['me1'=>$me,'friend1'=>$friendId,'friend2'=>$friendId,'me2'=>$me]);
    $messages = array_reverse($stmt->fetchAll());
    foreach ($messages as &$message) { $message['id']=(int)$message['id']; $message['sender_id']=(int)$message['sender_id']; $message['recipient_id']=(int)$message['recipient_id']; }
    json_response(['ok'=>true,'me'=>$me,'friend'=>$friend,'messages'=>$messages]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !csrf_verify_header()) json_response(['ok'=>false,'errors'=>['Invalid request token. Refresh and try again.']],403);
$body = json_body(); $friendId = (int) ($body['friend_id'] ?? 0); require_friend($pdo,$me,$friendId);
$message = trim((string) ($body['message'] ?? ''));
if ($message === '' || strlen($message) > 500) json_response(['ok'=>false,'errors'=>['Messages must be 1–500 characters.']],422);
$stmt=$pdo->prepare('INSERT INTO friend_messages (sender_id,recipient_id,message) VALUES (:sender,:recipient,:message)');
$stmt->execute(['sender'=>$me,'recipient'=>$friendId,'message'=>$message]);
json_response(['ok'=>true,'message_id'=>(int)$pdo->lastInsertId()]);
