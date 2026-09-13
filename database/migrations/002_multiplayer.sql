-- Run this migration only when the users table already exists.
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
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_multiplayer_room_code` (`room_code`),
    KEY `idx_multiplayer_host` (`host_user_id`),
    CONSTRAINT `fk_multiplayer_host` FOREIGN KEY (`host_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `multiplayer_players` (
    `match_id` BIGINT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `slot` TINYINT UNSIGNED NOT NULL,
    `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`match_id`, `user_id`),
    UNIQUE KEY `uq_multiplayer_slot` (`match_id`, `slot`),
    CONSTRAINT `fk_multiplayer_player_match` FOREIGN KEY (`match_id`) REFERENCES `multiplayer_matches` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_multiplayer_player_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
