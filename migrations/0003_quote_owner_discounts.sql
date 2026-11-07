-- Additive migration. Existing quotations and totals remain untouched.
ALTER TABLE quotations ADD COLUMN original_total_cents INTEGER;
ALTER TABLE quotations ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0 CHECK(discount_cents>=0);
ALTER TABLE quotations ADD COLUMN discount_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE quotations ADD COLUMN discount_by TEXT REFERENCES users(id);
ALTER TABLE quotations ADD COLUMN discount_at TEXT;
ALTER TABLE quotations ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_quote_creator ON quotations(created_by,created_at);
