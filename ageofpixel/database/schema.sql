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
