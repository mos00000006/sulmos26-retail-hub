-- Cash Office Phase 1: full-payment recording. No stock deduction or tax-invoice issuance.
-- The quotation status stays awaiting_payment because 0001 limits its CHECK values;
-- paid status is derived solely from the existence of a cash_receipts row.
CREATE TABLE IF NOT EXISTS cash_receipts (
 id TEXT PRIMARY KEY,
 reference TEXT NOT NULL UNIQUE,
 quotation_id TEXT NOT NULL UNIQUE REFERENCES quotations(id),
 quotation_reference TEXT NOT NULL,
 quotation_revision INTEGER NOT NULL,
 store_id TEXT NOT NULL REFERENCES stores(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 method TEXT NOT NULL CHECK(method IN ('cash','card','eft')),
 tendered_cents INTEGER NOT NULL CHECK(tendered_cents>=amount_cents),
 change_cents INTEGER NOT NULL DEFAULT 0 CHECK(change_cents>=0),
 external_reference TEXT NOT NULL DEFAULT '',
 cashier_id TEXT NOT NULL REFERENCES users(id),
 paid_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_store_date ON cash_receipts(store_id,paid_at);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_cashier_date ON cash_receipts(cashier_id,paid_at);
