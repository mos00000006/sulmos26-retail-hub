-- Phase 3: customer directory. Quotations remain the canonical cashier lookup source.
-- Every existing quotation is automatically discoverable by its reference; no payments are posted here.
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_store_name ON customers(store_id,name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(store_id,phone);
ALTER TABLE quotations ADD COLUMN customer_id TEXT REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id,created_at);
CREATE INDEX IF NOT EXISTS idx_quotations_reference_lookup ON quotations(reference);
