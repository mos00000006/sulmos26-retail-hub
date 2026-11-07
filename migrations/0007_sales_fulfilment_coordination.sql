-- Phase 5 coordination only. No payment, dispatch release, inventory posting or delivery confirmation.
ALTER TABLE sales_orders ADD COLUMN requested_date TEXT;
ALTER TABLE sales_orders ADD COLUMN contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sales_orders ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE sales_orders ADD COLUMN fulfilment_updated_at TEXT;
CREATE TABLE IF NOT EXISTS sales_fulfilment_events (
 id TEXT PRIMARY KEY,
 sales_order_id TEXT NOT NULL REFERENCES sales_orders(id),
 actor_id TEXT NOT NULL REFERENCES users(id),
 event_type TEXT NOT NULL CHECK(event_type IN ('instructions_updated')),
 note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_fulfilment_order ON sales_fulfilment_events(sales_order_id,created_at);
