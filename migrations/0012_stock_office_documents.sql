-- SULMOS26 Stock Office: controlled GRV and physical stock counts.
-- Requires inventory ledger migration 0010. No automatic transfers or purchasing liabilities.
CREATE TABLE IF NOT EXISTS stock_office_documents (
 id TEXT PRIMARY KEY,
 reference TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('grv','count')),
 store_id TEXT NOT NULL REFERENCES stores(id),
 supplier TEXT NOT NULL DEFAULT '',
 supplier_document TEXT NOT NULL DEFAULT '',
 note TEXT NOT NULL DEFAULT '',
 lines_json TEXT NOT NULL CHECK(json_valid(lines_json) AND json_type(lines_json)='array'),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 submitted_at TEXT,
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_stock_office_store ON stock_office_documents(store_id,created_at DESC);
-- Authorisation happens at the API, and these triggers defend against invalid posting even if a SQL statement is accidentally submitted.
CREATE TRIGGER IF NOT EXISTS stock_office_before_approve
BEFORE UPDATE OF status ON stock_office_documents
WHEN NEW.status='approved'
BEGIN
 SELECT CASE WHEN OLD.status!='submitted' OR NEW.reviewed_by IS NULL OR NEW.reviewed_by=OLD.created_by
   THEN RAISE(ABORT,'STOCK_APPROVAL_REQUIRES_INDEPENDENT_REVIEW') END;
 SELECT CASE WHEN json_array_length(NEW.lines_json)=0 THEN RAISE(ABORT,'STOCK_EMPTY_DOCUMENT') END;
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM json_each(NEW.lines_json) j
  WHERE json_type(j.value,'$.sku')!='text' OR json_type(j.value,'$.qty')!='integer'
   OR CAST(json_extract(j.value,'$.qty') AS INTEGER)<0 OR CAST(json_extract(j.value,'$.qty') AS INTEGER)>1000000
   OR (NEW.kind='grv' AND CAST(json_extract(j.value,'$.qty') AS INTEGER)=0)
   OR NOT EXISTS(SELECT 1 FROM products p WHERE p.sku=json_extract(j.value,'$.sku') AND p.active=1)
 ) THEN RAISE(ABORT,'STOCK_INVALID_DOCUMENT_LINES') END;
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM json_each(NEW.lines_json) j
  GROUP BY json_extract(j.value,'$.sku') HAVING COUNT(*)>1
 ) THEN RAISE(ABORT,'STOCK_DUPLICATE_PRODUCT') END;
 -- Counts cannot silently override stock that moved after the physical count was captured.
 SELECT CASE WHEN NEW.kind='count' AND EXISTS (
  SELECT 1 FROM json_each(NEW.lines_json) j
  LEFT JOIN inventory_balances b ON b.store_id=NEW.store_id AND b.sku=json_extract(j.value,'$.sku')
  WHERE b.on_hand IS NULL OR json_type(j.value,'$.expected')!='integer' OR b.on_hand != CAST(json_extract(j.value,'$.expected') AS INTEGER)
 ) THEN RAISE(ABORT,'STOCK_COUNT_STALE_RECOUNT_REQUIRED') END;
 -- Preserve approved reservations; receipt increases are always permitted.
 SELECT CASE WHEN NEW.kind='count' AND EXISTS (
  SELECT 1 FROM json_each(NEW.lines_json) j
  WHERE CAST(json_extract(j.value,'$.qty') AS INTEGER) < COALESCE((
   SELECT SUM(r.qty) FROM stock_requests r WHERE r.store_id=NEW.store_id AND r.sku=json_extract(j.value,'$.sku')
    AND r.kind='reservation' AND r.status='approved'),0)
 ) THEN RAISE(ABORT,'STOCK_COUNT_BELOW_RESERVATIONS') END;
END;
-- Posting is executed inside the same atomic UPDATE transaction. Existing ledger trigger applies balances and snapshot mirror.
-- Ledger reason is currently 'stock_adjustment'; the source_id is this controlled stock document ID.
CREATE TRIGGER IF NOT EXISTS stock_office_post_approved
AFTER UPDATE OF status ON stock_office_documents
WHEN OLD.status='submitted' AND NEW.status='approved'
BEGIN
 INSERT INTO inventory_movements(id,store_id,sku,qty_delta,reason,source_id,actor_id,created_at)
 SELECT lower(hex(randomblob(16))),NEW.store_id,json_extract(j.value,'$.sku'),
 CASE WHEN NEW.kind='grv' THEN CAST(json_extract(j.value,'$.qty') AS INTEGER)
 ELSE CAST(json_extract(j.value,'$.qty') AS INTEGER)-CAST(json_extract(j.value,'$.expected') AS INTEGER) END,
 'stock_adjustment',NEW.id,NEW.reviewed_by,NEW.reviewed_at
 FROM json_each(NEW.lines_json) j
 WHERE CASE WHEN NEW.kind='grv' THEN CAST(json_extract(j.value,'$.qty') AS INTEGER)
 ELSE CAST(json_extract(j.value,'$.qty') AS INTEGER)-CAST(json_extract(j.value,'$.expected') AS INTEGER) END !=0;
END;
-- Protect approved documents and submitted counts against post-submission mutation.
CREATE TRIGGER IF NOT EXISTS stock_office_no_edit_submitted
BEFORE UPDATE OF lines_json,store_id,kind,created_by,created_at ON stock_office_documents
WHEN OLD.status!='draft'
BEGIN SELECT RAISE(ABORT,'STOCK_DOCUMENT_LOCKED'); END;
CREATE TRIGGER IF NOT EXISTS stock_office_no_delete_approved
BEFORE DELETE ON stock_office_documents WHEN OLD.status IN ('submitted','approved')
BEGIN SELECT RAISE(ABORT,'STOCK_DOCUMENT_LOCKED'); END;
