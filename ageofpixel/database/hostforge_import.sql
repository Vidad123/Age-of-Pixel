-- Age of Pixel — complete MySQL/MariaDB import
-- In HostForge/phpMyAdmin, select the database assigned to the application,
-- open Import, and choose this file. Do not create or select AOP manually here.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(32)  NOT NULL,
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

-- The reserved username "admin" becomes an administrator if it already exists.
UPDATE `users`
SET `role` = 'admin'
WHERE LOWER(`username`) = 'admin';

-- Maps and custom troop definitions are stored in the browser by this version
-- of the game, so no additional SQL tables are required.
