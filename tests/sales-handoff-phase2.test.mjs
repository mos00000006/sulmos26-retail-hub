import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const backend=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
const pos=readFileSync(new URL('../public-pos/app.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/0004_sales_orders_cash_office_queue.sql',import.meta.url),'utf8');
test('sales orders are separate from money and require authenticated roles',()=>{
 assert.match(backend,/if\(path==='\/api\/sales-orders'\)/);
 assert.match(backend,/\['owner','manager','sales'\]\.includes\(u\.role\)/);
 assert.match(backend,/q\.created_by!==u\.id/);
 assert.match(backend,/await scopedStore\(db,u,q\.store_id\)/);
 assert.match(backend,/status:'awaiting_cashier'/);
});
test('handoff captures approved quote snapshot and prevents duplicates',()=>{
 assert.match(backend,/q\.total_cents=\? AND q\.revision=\?/);
 assert.match(migration,/quotation_id TEXT NOT NULL UNIQUE/);
 assert.match(migration,/status TEXT NOT NULL DEFAULT 'awaiting_cashier'/);
 assert.match(backend,/AND NOT EXISTS \(SELECT 1 FROM sales_orders so WHERE so\.quotation_id=q\.id\)/);
});
test('sales interface presents cashier handoff without any payment form',()=>{
 assert.match(pos,/Cash Office handoff/);
 assert.match(pos,/Send to Cash Office/);
 assert.match(pos,/collection/);
 assert.match(pos,/delivery/);
 assert.doesNotMatch(pos,/data-card-number|name="card_number"|name="cash_received"/);
});
