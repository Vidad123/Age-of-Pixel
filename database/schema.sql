-- Age of Pixel
-- Database schema
-- Import with: mysql -u youruser -p < schema.sql
-- (creates the AOP database itself, so it doesn't need to exist beforehand)

CREATE DATABASE IF NOT EXISTS AOP CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE AOP;

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(32)  NOT NULL UNIQUE,
    email         VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('user','admin') NOT NULL DEFAULT 'user',
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS multiplayer_matches (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_code CHAR(6) NOT NULL UNIQUE,
    host_user_id INT UNSIGNED NOT NULL,
    status ENUM('waiting','active','finished') NOT NULL DEFAULT 'waiting',
    config_json JSON NOT NULL,
    state_json LONGTEXT NULL,
    active_slot TINYINT UNSIGNED NOT NULL DEFAULT 1,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS multiplayer_players (
    match_id BIGINT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    slot TINYINT UNSIGNED NOT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (match_id,user_id), UNIQUE KEY uq_multiplayer_slot (match_id,slot),
    FOREIGN KEY (match_id) REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
