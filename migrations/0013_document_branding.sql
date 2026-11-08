-- Per-installation company defaults and per-store document branding.
-- '__company__' provides fallback identity; store ids match stores.id.
CREATE TABLE IF NOT EXISTS document_branding (
  store_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  logo_data TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TEXT NOT NULL
);
