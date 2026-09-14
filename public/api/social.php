<?php
require_once __DIR__ . '/../../src/auth.php';

$user = require_login_api();
$pdo = Database::connection();

function social_person(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'username' => $row['username'],
        'display_name' => $row['display_name'] ?: $row['username'],
        'bio' => $row['bio'] ?? '',
        'avatar_color' => $row['avatar_color'] ?: '#9b672e',
        'online' => !empty($row['online']),
    ];
}

function social_pair(int $a, int $b): array
{
    return $a < $b ? [$a, $b] : [$b, $a];
}

function social_bootstrap(PDO $pdo, int $userId): array
{
    $profileStmt = $pdo->prepare('SELECT id, username, display_name, bio, avatar_color FROM users WHERE id = :id');
    $profileStmt->execute(['id' => $userId]);
    $profile = $profileStmt->fetch();

    $friendsStmt = $pdo->prepare(
        "SELECT u.id, u.username, u.display_name, u.bio, u.avatar_color,
                CASE WHEN u.last_login_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END AS online
         FROM friendships f
         JOIN users u ON u.id = IF(f.user_low_id = :id1, f.user_high_id, f.user_low_id)
         WHERE (f.user_low_id = :id2 OR f.user_high_id = :id3) AND f.status = 'accepted'
         ORDER BY COALESCE(NULLIF(u.display_name, ''), u.username)"
    );
    $friendsStmt->execute(['id1' => $userId, 'id2' => $userId, 'id3' => $userId]);

    $requestsStmt = $pdo->prepare(
        "SELECT u.id, u.username, u.display_name, u.bio, u.avatar_color,
                CASE WHEN u.last_login_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END AS online
         FROM friendships f JOIN users u ON u.id = f.requested_by
         WHERE (f.user_low_id = :id1 OR f.user_high_id = :id2)
           AND f.status = 'pending' AND f.requested_by <> :id3
         ORDER BY f.updated_at DESC"
    );
    $requestsStmt->execute(['id1' => $userId, 'id2' => $userId, 'id3' => $userId]);

    return [
        'ok' => true,
        'profile' => social_person($profile),
        'friends' => array_map('social_person', $friendsStmt->fetchAll()),
        'requests' => array_map('social_person', $requestsStmt->fetchAll()),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'bootstrap';
    if ($action === 'bootstrap') {
        json_response(social_bootstrap($pdo, (int) $user['id']));
    }
    if ($action === 'search') {
        $query = trim((string) ($_GET['q'] ?? ''));
        if (strlen($query) < 2) {
            json_response(['ok' => false, 'errors' => ['Enter at least 2 characters.']], 422);
        }
        $stmt = $pdo->prepare(
            "SELECT u.id, u.username, u.display_name, u.bio, u.avatar_color,
                    CASE WHEN u.last_login_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END AS online,
                    CASE
                      WHEN f.status = 'accepted' THEN 'friends'
                      WHEN f.status = 'pending' THEN 'pending'
                      ELSE 'none'
                    END AS relationship
             FROM users u
             LEFT JOIN friendships f ON f.user_low_id = LEAST(u.id, :me1)
                                        AND f.user_high_id = GREATEST(u.id, :me2)
             WHERE u.id <> :me3 AND (u.username LIKE :q1 OR u.display_name LIKE :q2)
             ORDER BY CASE WHEN u.username = :exact THEN 0 ELSE 1 END, u.username
             LIMIT 20"
        );
        $like = '%' . $query . '%';
        $stmt->execute(['me1' => $user['id'], 'me2' => $user['id'], 'me3' => $user['id'], 'q1' => $like, 'q2' => $like, 'exact' => $query]);
        $results = [];
        foreach ($stmt->fetchAll() as $row) {
            $person = social_person($row);
            $person['relationship'] = $row['relationship'];
            $results[] = $person;
        }
        json_response(['ok' => true, 'results' => $results]);
    }
    json_response(['ok' => false, 'errors' => ['Unknown social action.']], 404);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !csrf_verify_header()) {
    json_response(['ok' => false, 'errors' => ['Invalid request token. Refresh and try again.']], 403);
}

$body = json_body();
$action = $body['action'] ?? '';

if ($action === 'update_profile') {
    $displayName = trim((string) ($body['display_name'] ?? ''));
    $bio = trim((string) ($body['bio'] ?? ''));
    $color = strtolower(trim((string) ($body['avatar_color'] ?? '')));
    $errors = [];
    if (strlen($displayName) < 2 || strlen($displayName) > 32) $errors[] = 'Display name must be 2–32 characters.';
    if (strlen($bio) > 160) $errors[] = 'Battle motto must be 160 characters or fewer.';
    if (!preg_match('/^#[0-9a-f]{6}$/', $color)) $errors[] = 'Choose a valid banner color.';
    if ($errors) json_response(['ok' => false, 'errors' => $errors], 422);
    $stmt = $pdo->prepare('UPDATE users SET display_name = :name, bio = :bio, avatar_color = :color WHERE id = :id');
    $stmt->execute(['name' => $displayName, 'bio' => $bio, 'color' => $color, 'id' => $user['id']]);
    json_response(['ok' => true, 'message' => 'Profile saved.']);
}

$targetId = (int) ($body['target_user_id'] ?? 0);
if ($targetId < 1 || $targetId === (int) $user['id']) {
    json_response(['ok' => false, 'errors' => ['Choose another player.']], 422);
}
$targetStmt = $pdo->prepare('SELECT id FROM users WHERE id = :id');
$targetStmt->execute(['id' => $targetId]);
if (!$targetStmt->fetch()) json_response(['ok' => false, 'errors' => ['Player not found.']], 404);
[$low, $high] = social_pair((int) $user['id'], $targetId);

if ($action === 'send') {
    $stmt = $pdo->prepare(
        "INSERT INTO friendships (user_low_id, user_high_id, requested_by, status)
         VALUES (:low, :high, :me, 'pending')
         ON DUPLICATE KEY UPDATE requested_by = IF(status = 'accepted', requested_by, VALUES(requested_by)),
                                 status = IF(status = 'accepted', status, 'pending'), updated_at = CURRENT_TIMESTAMP"
    );
    $stmt->execute(['low' => $low, 'high' => $high, 'me' => $user['id']]);
    json_response(['ok' => true, 'message' => 'Friend request sent.']);
}

if ($action === 'accept' || $action === 'decline') {
    $check = $pdo->prepare("SELECT requested_by FROM friendships WHERE user_low_id = :low AND user_high_id = :high AND status = 'pending'");
    $check->execute(['low' => $low, 'high' => $high]);
    $request = $check->fetch();
    if (!$request || (int) $request['requested_by'] === (int) $user['id']) {
        json_response(['ok' => false, 'errors' => ['That incoming request is no longer available.']], 409);
    }
    if ($action === 'accept') {
        $stmt = $pdo->prepare("UPDATE friendships SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE user_low_id = :low AND user_high_id = :high");
        $stmt->execute(['low' => $low, 'high' => $high]);
        json_response(['ok' => true, 'message' => 'Friend request accepted.']);
    }
    $stmt = $pdo->prepare('DELETE FROM friendships WHERE user_low_id = :low AND user_high_id = :high');
    $stmt->execute(['low' => $low, 'high' => $high]);
    json_response(['ok' => true, 'message' => 'Friend request declined.']);
}

if ($action === 'remove') {
    $stmt = $pdo->prepare('DELETE FROM friendships WHERE user_low_id = :low AND user_high_id = :high');
    $stmt->execute(['low' => $low, 'high' => $high]);
    json_response(['ok' => true, 'message' => 'Friend removed.']);
}

json_response(['ok' => false, 'errors' => ['Unknown social action.']], 404);
