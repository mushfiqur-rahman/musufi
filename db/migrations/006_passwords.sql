-- Password login (after the first email-code login) and its throttle table.
-- Role permissions live in settings (name 'roles', JSON), no table needed.

ALTER TABLE customers
  ADD COLUMN password_hash   VARCHAR(255) NULL AFTER email,   -- scrypt, see lib/password.ts
  ADD COLUMN password_set_at DATETIME NULL AFTER password_hash;

-- How each session started: 'code' sessions may set a password without the old one
-- for 30 minutes (this is the "forgot password" path).
ALTER TABLE sessions
  ADD COLUMN login_method VARCHAR(10) NOT NULL DEFAULT 'code';

CREATE TABLE login_failures (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(254) NOT NULL,
  ip         VARCHAR(45)  NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_lf_email (email, created_at),
  KEY ix_lf_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
