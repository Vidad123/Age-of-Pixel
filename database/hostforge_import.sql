-- Age of Pixel — complete MySQL/MariaDB import
-- In HostForge/phpMyAdmin, select the database assigned to the application,
-- open Import, and choose this file. Do not create or select AOP manually here.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(32)  NOT NULL,
    `display_name`  VARCHAR(32)  NULL DEFAULT NULL,
    `bio`           VARCHAR(160) NOT NULL DEFAULT '',
    `avatar_color`  CHAR(7) NOT NULL DEFAULT '#9b672e',
    `email`         VARCHAR(190) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role`          ENUM('user','admin') NOT NULL DEFAULT 'user',
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_login_at` DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username` (`username`),
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Upgrade an older Age of Pixel users table that predates administrator roles.
SET @aop_has_role = (
    SELECT COUNT(*)
    FROM `information_schema`.`COLUMNS`
    WHERE `TABLE_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'users'
      AND `COLUMN_NAME` = 'role'
);
SET @aop_add_role = IF(
    @aop_has_role = 0,
    'ALTER TABLE `users` ADD COLUMN `role` ENUM(''user'',''admin'') NOT NULL DEFAULT ''user'' AFTER `password_hash`',
    'SELECT 1'
);
PREPARE aop_statement FROM @aop_add_role;
EXECUTE aop_statement;
DEALLOCATE PREPARE aop_statement;

SET @aop_has_display_name = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'display_name');
SET @aop_add_display_name = IF(@aop_has_display_name = 0, 'ALTER TABLE `users` ADD COLUMN `display_name` VARCHAR(32) NULL AFTER `username`', 'SELECT 1');
PREPARE aop_statement FROM @aop_add_display_name; EXECUTE aop_statement; DEALLOCATE PREPARE aop_statement;
SET @aop_has_bio = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'bio');
SET @aop_add_bio = IF(@aop_has_bio = 0, 'ALTER TABLE `users` ADD COLUMN `bio` VARCHAR(160) NOT NULL DEFAULT '''' AFTER `display_name`', 'SELECT 1');
PREPARE aop_statement FROM @aop_add_bio; EXECUTE aop_statement; DEALLOCATE PREPARE aop_statement;
SET @aop_has_avatar_color = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_color');
SET @aop_add_avatar_color = IF(@aop_has_avatar_color = 0, 'ALTER TABLE `users` ADD COLUMN `avatar_color` CHAR(7) NOT NULL DEFAULT ''#9b672e'' AFTER `bio`', 'SELECT 1');
PREPARE aop_statement FROM @aop_add_avatar_color; EXECUTE aop_statement; DEALLOCATE PREPARE aop_statement;
UPDATE `users` SET `display_name` = `username` WHERE `display_name` IS NULL OR `display_name` = '';

CREATE TABLE IF NOT EXISTS `friendships` (
    `user_low_id` INT UNSIGNED NOT NULL,
    `user_high_id` INT UNSIGNED NOT NULL,
    `requested_by` INT UNSIGNED NOT NULL,
    `status` ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_low_id`,`user_high_id`),
    KEY `idx_friendships_requested_by` (`requested_by`),
    KEY `idx_friendships_status` (`status`),
    CONSTRAINT `fk_friendships_low` FOREIGN KEY (`user_low_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_friendships_high` FOREIGN KEY (`user_high_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_friendships_requester` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The reserved username "admin" becomes an administrator if it already exists.
UPDATE `users`
SET `role` = 'admin'
WHERE LOWER(`username`) = 'admin';

CREATE TABLE IF NOT EXISTS `multiplayer_matches` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `room_code` CHAR(6) NOT NULL,
    `host_user_id` INT UNSIGNED NOT NULL,
    `status` ENUM('waiting','active','finished') NOT NULL DEFAULT 'waiting',
    `config_json` JSON NOT NULL,
    `state_json` LONGTEXT NULL,
    `active_slot` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `version` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`), UNIQUE KEY `uq_multiplayer_room_code` (`room_code`),
    KEY `idx_multiplayer_host` (`host_user_id`),
    CONSTRAINT `fk_multiplayer_host` FOREIGN KEY (`host_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `multiplayer_players` (
    `match_id` BIGINT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `slot` TINYINT UNSIGNED NOT NULL,
    `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`match_id`,`user_id`), UNIQUE KEY `uq_multiplayer_slot` (`match_id`,`slot`),
    CONSTRAINT `fk_multiplayer_player_match` FOREIGN KEY (`match_id`) REFERENCES `multiplayer_matches` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_multiplayer_player_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `friend_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sender_id` INT UNSIGNED NOT NULL,
    `recipient_id` INT UNSIGNED NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_friend_messages_pair` (`sender_id`,`recipient_id`,`id`),
    KEY `idx_friend_messages_recipient` (`recipient_id`,`id`),
    CONSTRAINT `fk_friend_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_friend_messages_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Maps and custom troop definitions remain stored in the browser. Profiles,
-- friendships, and private friend messages are shared through the database.
