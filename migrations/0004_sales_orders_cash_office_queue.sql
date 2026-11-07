-- Sales consultant handoff only. No payments, invoices, cash movements or stock posting.
CREATE TABLE IF NOT EXISTS sales_orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  quotation_id TEXT NOT NULL UNIQUE REFERENCES quotations(id),
  quotation_reference TEXT NOT NULL,
  quotation_revision INTEGER NOT NULL DEFAULT 0,
  store_id TEXT NOT NULL REFERENCES stores(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  lines_json TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  fulfilment TEXT NOT NULL CHECK(fulfilment IN ('collection','delivery')),
  delivery_address TEXT NOT NULL DEFAULT '',
  sales_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'awaiting_cashier' CHECK(status IN ('awaiting_cashier','cancelled')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_orders_store_created ON sales_orders(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_orders_creator ON sales_orders(created_by, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_orders_cashier_status ON sales_orders(status, created_at);
