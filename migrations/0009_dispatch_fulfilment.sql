-- V31 Dispatch: explicit pick/release state, no stock ledger posting.
-- Only receipts from cash_receipts prove paid status.
CREATE TABLE IF NOT EXISTS dispatch_fulfilments (
  receipt_id TEXT PRIMARY KEY REFERENCES cash_receipts(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  state TEXT NOT NULL DEFAULT 'awaiting_picking' CHECK (state IN ('awaiting_picking','picking','ready','released')),
  picked_by TEXT REFERENCES users(id),
  picked_at TEXT,
  ready_by TEXT REFERENCES users(id),
  ready_at TEXT,
  released_by TEXT REFERENCES users(id),
  released_at TEXT,
  collected_by TEXT,
  release_note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dispatch_fulfilments_store_state ON dispatch_fulfilments(store_id,state);
