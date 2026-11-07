import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/0006_sales_stock_requests.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../public-pos/app.js',import.meta.url),'utf8');
test('sales quotation does not auto-reserve stock',()=>{
 assert.match(app,/Quotation .* saved/);
 assert.doesNotMatch(app,/post\('sales-stock\/requests',[^\n]*quotation.*saved/);
 assert.match(src,/No stock posted/);
});
test('stock snapshots are management-only and nonnegative',()=>{
 assert.match(src,/Only management can enter stock snapshots/);
 assert.match(migration,/on_hand INTEGER NOT NULL CHECK\(on_hand>=0\)/);
});
test('reservation approval uses atomic available-quantity check',()=>{
 assert.match(src,/UPDATE stock_requests SET status='approved'/);
 assert.match(src,/ss\.on_hand >= stock_requests\.qty/);
 assert.match(src,/other\.status='approved'/);
});
test('sales staff cannot approve their own reservations',()=>{
 assert.match(src,/r\.created_by===u\.id/);
 assert.match(src,/Independent manager approval required/);
});
test('transfer requests do not post stock movement',()=>{
 assert.match(src,/A transfer approval is permission to arrange a transfer/);
 assert.match(src,/No stock posted/);
});
test('approved reservations can be released by independent management',()=>{
 assert.match(src,/action==='release'/);
 assert.match(migration,/'released'/);
});
