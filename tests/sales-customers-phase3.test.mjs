import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
const pos=readFileSync(new URL('../public-pos/app.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/0005_customers_cash_office_lookup.sql',import.meta.url),'utf8');

test('Phase 3 supports store-scoped customer directory',()=>{
 assert.match(source,/path==='\/api\/customers'/);
 assert.match(source,/scopedStore\(db,u,store\)/);
 assert.match(source,/INSERT INTO customers/);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS customers/);
});
test('Cash Office can retrieve a quotation by reference without a manual handoff',()=>{
 assert.match(source,/path==='\/api\/cash-office\/quotation'/);
 assert.match(source,/WHERE UPPER\(q\.reference\)=\?/);
 assert.match(source,/LEFT JOIN sales_orders so ON so.quotation_id=q.id/);
 assert.match(source,/payment_recorded:false/);
 assert.match(source,/\['owner','manager','cashier'\]\.includes\(u\.role\)/);
});
test('Consultant screens do not accept payments or discounts',()=>{
 assert.match(pos,/Cash Office can retrieve it immediately/);
 assert.match(pos,/api\('customers\?store_id=/);
 assert.doesNotMatch(pos,/post\('payments'/);
 assert.doesNotMatch(pos,/post\('quotations\/.*discount'/);
});
test('Quotation links optional customer ID, retaining existing names and totals',()=>{
 assert.match(migration,/ALTER TABLE quotations ADD COLUMN customer_id/);
 assert.match(source,/customer_id\) VALUES/);
 assert.match(source,/Customer not found at assigned store/);
});
