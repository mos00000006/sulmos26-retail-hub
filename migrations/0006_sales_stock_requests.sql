-- Phase 4: deliberately manager-entered stock snapshots (NOT a perpetual stock ledger).
-- Posting a quotation or request never changes quantity.
CREATE TABLE IF NOT EXISTS stock_snapshots (
 store_id TEXT NOT NULL REFERENCES stores(id),
 sku TEXT NOT NULL REFERENCES products(sku),
 on_hand INTEGER NOT NULL CHECK(on_hand>=0),
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at TEXT NOT NULL,
 PRIMARY KEY(store_id,sku)
);
CREATE TABLE IF NOT EXISTS stock_requests (
 id TEXT PRIMARY KEY,
 reference TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('reservation','transfer')),
 store_id TEXT NOT NULL REFERENCES stores(id),
 source_store_id TEXT REFERENCES stores(id),
 sku TEXT NOT NULL REFERENCES products(sku),
 qty INTEGER NOT NULL CHECK(qty>0 AND qty<=1000000),
 quotation_id TEXT REFERENCES quotations(id),
 note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled','released')),
 created_by TEXT NOT NULL REFERENCES users(id),
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_requests_store ON stock_requests(store_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_stock_requests_availability ON stock_requests(store_id,sku,status,kind);
CREATE INDEX IF NOT EXISTS idx_stock_requests_source ON stock_requests(source_store_id,sku,status,kind);
