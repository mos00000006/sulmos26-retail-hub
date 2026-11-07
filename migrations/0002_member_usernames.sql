-- Allows username/password sign-in; existing users retain email fallback.
-- No existing records are deleted or rewritten.
ALTER TABLE users ADD COLUMN username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);
