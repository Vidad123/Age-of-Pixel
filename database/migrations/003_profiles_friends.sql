-- Age of Pixel v2.1: player profiles and friends
-- Select the existing AOP database before importing this migration.

SET @has_display_name = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'display_name');
SET @add_display_name = IF(@has_display_name = 0, 'ALTER TABLE users ADD COLUMN display_name VARCHAR(32) NULL AFTER username', 'SELECT 1');
PREPARE stmt FROM @add_display_name; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_bio = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'bio');
SET @add_bio = IF(@has_bio = 0, 'ALTER TABLE users ADD COLUMN bio VARCHAR(160) NOT NULL DEFAULT '''' AFTER display_name', 'SELECT 1');
PREPARE stmt FROM @add_bio; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_avatar_color = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_color');
SET @add_avatar_color = IF(@has_avatar_color = 0, 'ALTER TABLE users ADD COLUMN avatar_color CHAR(7) NOT NULL DEFAULT ''#9b672e'' AFTER bio', 'SELECT 1');
PREPARE stmt FROM @add_avatar_color; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE users SET display_name = username WHERE display_name IS NULL OR display_name = '';

CREATE TABLE IF NOT EXISTS friendships (
    user_low_id  INT UNSIGNED NOT NULL,
    user_high_id INT UNSIGNED NOT NULL,
    requested_by INT UNSIGNED NOT NULL,
    status       ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_low_id, user_high_id),
    KEY idx_friendships_requested_by (requested_by),
    KEY idx_friendships_status (status),
    CONSTRAINT fk_friendships_low FOREIGN KEY (user_low_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_friendships_high FOREIGN KEY (user_high_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_friendships_requester FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_friendships_distinct CHECK (user_low_id < user_high_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
