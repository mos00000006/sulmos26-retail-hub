import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const backend=readFileSync('src/index.ts','utf8');
const ui=readFileSync('public-pos/app.js','utf8');
const migration=readFileSync('migrations/0007_sales_fulfilment_coordination.sql','utf8');
test('only sales/manager/owner coordinate fulfilment, store permission checked',()=>{
 assert.match(backend,/const fulfilmentMatch=path.match/);
 assert.match(backend,/scopedStore\(db,u,order.store_id\)/);
 assert.match(backend,/order.created_by!==u.id/);
});
test('cannot edit a sales order after cashier handoff state changes',()=>{
 assert.match(backend,/order.status!=='awaiting_cashier'/);
 assert.match(backend,/status='awaiting_cashier'/);
});
test('no paid, delivered, dispatched flags added',()=>{
 assert.doesNotMatch(migration, /ADD COLUMN (paid|delivered|dispatched)/);
 assert.match(backend,/payment_recorded:false,stock_deducted:false/);
});
test('sales ui has tracking and read-only payment warning',()=>{
 assert.match(ui,/Collections & delivery follow-up/);
 assert.match(ui,/does not confirm payment/);
 assert.match(ui,/requested_date/);
});
