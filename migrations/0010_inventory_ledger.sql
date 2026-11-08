-- SULMOS26 V32: Authoritative on-hand balances and append-only stock movement register.
-- Quantities are INTEGER units (not fractions). Invoicing/payment does not consume stock.
-- First release of an already-paid receipt decrements stock once, atomically.
CREATE TABLE IF NOT EXISTS inventory_balances (
 store_id TEXT NOT NULL REFERENCES stores(id),
 sku TEXT NOT NULL REFERENCES products(sku),
 on_hand INTEGER NOT NULL DEFAULT 0 CHECK(on_hand>=0 AND on_hand<=100000000),
 updated_at TEXT NOT NULL,
 PRIMARY KEY(store_id,sku)
);
CREATE TABLE IF NOT EXISTS inventory_movements (
 id TEXT PRIMARY KEY,
 store_id TEXT NOT NULL REFERENCES stores(id),
 sku TEXT NOT NULL REFERENCES products(sku),
 qty_delta INTEGER NOT NULL CHECK(qty_delta!=0 AND qty_delta BETWEEN -100000000 AND 100000000),
 reason TEXT NOT NULL CHECK(reason IN ('opening_snapshot','stock_adjustment','dispatch_release')),
 source_id TEXT NOT NULL,
 actor_id TEXT REFERENCES users(id),
 created_at TEXT NOT NULL,
 UNIQUE(reason,source_id,store_id,sku)
);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_store_sku_date ON inventory_movements(store_id,sku,created_at);

-- Every movement is checked and posted in the same SQLite statement/transaction.
CREATE TRIGGER IF NOT EXISTS inventory_movement_before_insert
BEFORE INSERT ON inventory_movements
BEGIN
 SELECT CASE WHEN NEW.qty_delta<0 AND COALESCE((SELECT on_hand FROM inventory_balances WHERE store_id=NEW.store_id AND sku=NEW.sku),-1)<-NEW.qty_delta
  THEN RAISE(ABORT,'STOCK_INSUFFICIENT_OR_NOT_RECORDED') END;
 SELECT CASE WHEN NEW.qty_delta>0 AND COALESCE((SELECT on_hand FROM inventory_balances WHERE store_id=NEW.store_id AND sku=NEW.sku),0)+NEW.qty_delta>100000000
  THEN RAISE(ABORT,'STOCK_MAX_EXCEEDED') END;
END;
CREATE TRIGGER IF NOT EXISTS inventory_movement_after_insert
AFTER INSERT ON inventory_movements
BEGIN
 INSERT INTO inventory_balances(store_id,sku,on_hand,updated_at) VALUES(NEW.store_id,NEW.sku,MAX(NEW.qty_delta,0),NEW.created_at)
 ON CONFLICT(store_id,sku) DO UPDATE SET on_hand=on_hand+NEW.qty_delta,updated_at=NEW.created_at;
 -- Legacy stock screen still reads stock_snapshots. Mirror the authoritative quantity.
 INSERT INTO stock_snapshots(store_id,sku,on_hand,updated_by,updated_at)
 SELECT NEW.store_id,NEW.sku,b.on_hand,COALESCE(NEW.actor_id,(SELECT id FROM users WHERE role='owner' LIMIT 1)),NEW.created_at
 FROM inventory_balances b WHERE b.store_id=NEW.store_id AND b.sku=NEW.sku
 ON CONFLICT(store_id,sku) DO UPDATE SET on_hand=excluded.on_hand,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
END;

-- Import the existing manager-confirmed snapshots as initial balances, once.
INSERT OR IGNORE INTO inventory_movements(id,store_id,sku,qty_delta,reason,source_id,actor_id,created_at)
 SELECT 'v32-opening:'||store_id||':'||sku,store_id,sku,on_hand,'opening_snapshot','v32-opening',updated_by,updated_at
 FROM stock_snapshots WHERE on_hand>0;
-- Keep verified zero distinct from 'not counted'.
INSERT OR IGNORE INTO inventory_balances(store_id,sku,on_hand,updated_at)
 SELECT store_id,sku,0,updated_at FROM stock_snapshots WHERE on_hand=0;

-- Existing Hub stock adjustment API writes stock_snapshots. Capture these writes
-- automatically as new ledger movements. Mirrored writes won't re-post because
-- inventory_balances has already been changed to the same amount.
CREATE TRIGGER IF NOT EXISTS stock_snapshot_to_ledger_insert
AFTER INSERT ON stock_snapshots
WHEN NEW.on_hand!=COALESCE((SELECT on_hand FROM inventory_balances WHERE store_id=NEW.store_id AND sku=NEW.sku),0)
BEGIN
 INSERT INTO inventory_movements(id,store_id,sku,qty_delta,reason,source_id,actor_id,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.store_id,NEW.sku,NEW.on_hand-COALESCE((SELECT on_hand FROM inventory_balances WHERE store_id=NEW.store_id AND sku=NEW.sku),0),'stock_adjustment',lower(hex(randomblob(16))),NEW.updated_by,NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS stock_snapshot_to_ledger_update
AFTER UPDATE OF on_hand ON stock_snapshots
WHEN NEW.on_hand!=(SELECT on_hand FROM inventory_balances WHERE store_id=NEW.store_id AND sku=NEW.sku)
BEGIN
 INSERT INTO inventory_movements(id,store_id,sku,qty_delta,reason,source_id,actor_id,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.store_id,NEW.sku,NEW.on_hand-COALESCE((SELECT on_hand FROM inventory_balances WHERE store_id=NEW.store_id AND sku=NEW.sku),0),'stock_adjustment',lower(hex(randomblob(16))),NEW.updated_by,NEW.updated_at);
END;

-- A Dispatch release must not succeed without stock. Multiple lines for the
-- same SKU are aggregated. json_each requires valid quote JSON.
CREATE TRIGGER IF NOT EXISTS dispatch_check_inventory_before_release
BEFORE UPDATE OF state ON dispatch_fulfilments
WHEN NEW.state='released' AND OLD.state='ready'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cash_receipts WHERE id=NEW.receipt_id AND store_id=NEW.store_id)
  THEN RAISE(ABORT,'PAYMENT_NOT_VERIFIED') END;
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM cash_receipts r JOIN quotations q ON q.id=r.quotation_id
  WHERE r.id=NEW.receipt_id AND (NOT json_valid(q.lines_json) OR json_type(q.lines_json)!='array')
 ) THEN RAISE(ABORT,'STOCK_INVALID_QUOTE_LINES') END;
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM cash_receipts r JOIN quotations q ON q.id=r.quotation_id,json_each(q.lines_json) l
  WHERE r.id=NEW.receipt_id
 ) THEN RAISE(ABORT,'STOCK_EMPTY_QUOTATION') END;
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM cash_receipts r JOIN quotations q ON q.id=r.quotation_id,json_each(q.lines_json) l
  WHERE r.id=NEW.receipt_id AND (json_type(l.value,'$.qty')!='integer' OR CAST(json_extract(l.value,'$.qty') AS INTEGER)<1 OR json_extract(l.value,'$.sku') IS NULL)
 ) THEN RAISE(ABORT,'STOCK_INVALID_LINE_QTY') END;
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM (
    SELECT json_extract(l.value,'$.sku') sku,SUM(CAST(json_extract(l.value,'$.qty') AS INTEGER)) qty
    FROM cash_receipts r JOIN quotations q ON q.id=r.quotation_id,json_each(q.lines_json) l
    WHERE r.id=NEW.receipt_id GROUP BY json_extract(l.value,'$.sku')
  ) req LEFT JOIN inventory_balances b ON b.store_id=NEW.store_id AND b.sku=req.sku
  WHERE b.store_id IS NULL OR b.on_hand<req.qty + COALESCE((
    SELECT SUM(sr.qty) FROM stock_requests sr JOIN cash_receipts cr ON cr.id=NEW.receipt_id
    WHERE sr.store_id=NEW.store_id AND sr.sku=req.sku AND sr.kind='reservation' AND sr.status='approved'
      AND (sr.quotation_id IS NULL OR sr.quotation_id!=cr.quotation_id)
  ),0)
 ) THEN RAISE(ABORT,'STOCK_INSUFFICIENT_OR_NOT_RECORDED') END;
END;
CREATE TRIGGER IF NOT EXISTS dispatch_post_stock_after_release
AFTER UPDATE OF state ON dispatch_fulfilments
WHEN NEW.state='released' AND OLD.state='ready'
BEGIN
 INSERT INTO inventory_movements(id,store_id,sku,qty_delta,reason,source_id,actor_id,created_at)
 SELECT lower(hex(randomblob(16))),NEW.store_id,req.sku,-req.qty,'dispatch_release',NEW.receipt_id,NEW.released_by,NEW.released_at
 FROM (
  SELECT json_extract(l.value,'$.sku') sku,SUM(CAST(json_extract(l.value,'$.qty') AS INTEGER)) qty
  FROM cash_receipts r JOIN quotations q ON q.id=r.quotation_id,json_each(q.lines_json) l
  WHERE r.id=NEW.receipt_id GROUP BY json_extract(l.value,'$.sku')
 ) req;
END;

-- Prevent stock history from being rewritten through application SQL.
CREATE TRIGGER IF NOT EXISTS inventory_movement_no_update BEFORE UPDATE ON inventory_movements BEGIN SELECT RAISE(ABORT,'STOCK_MOVEMENT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS inventory_movement_no_delete BEFORE DELETE ON inventory_movements BEGIN SELECT RAISE(ABORT,'STOCK_MOVEMENT_IMMUTABLE'); END;
