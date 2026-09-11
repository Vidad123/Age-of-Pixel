USE AOP;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role ENUM('user','admin') NOT NULL DEFAULT 'user'
    AFTER password_hash;

-- Promote the reserved default administrator username if it already exists.
UPDATE users SET role = 'admin' WHERE LOWER(username) = 'admin';
