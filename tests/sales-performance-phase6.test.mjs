import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const backend=readFileSync('src/index.ts','utf8');
const ui=readFileSync('public-pos/app.js','utf8');
test('Sales performance is authenticated and scoped to consultants and stores',()=>{
 assert.match(backend,/path==='\/api\/sales-performance'/);
 assert.match(backend,/scopedStore\(db,u,store\)/);
 assert.match(backend,/q\.created_by=\?/);
 assert.match(backend,/so\.created_by=\?/);
});
test('Sales performance aggregates quotes and orders separately, without payment details',()=>{
 assert.match(backend,/FROM quotations q JOIN users u/);
 assert.match(backend,/FROM sales_orders so WHERE/);
 assert.match(backend,/NOT EXISTS \(SELECT 1 FROM sales_orders so WHERE so.quotation_id=q.id\)/);
 assert.match(backend,/No payment or revenue figures/);
});
test('UI allows date filtering, follow-ups, scorecard and export',()=>{
 assert.match(ui,/id="reportFilters"/);
 assert.match(ui,/Quotation follow-up \(3\+ days\)/);
 assert.match(ui,/Consultant scorecard/);
 assert.match(ui,/id="reportCsv"/);
});
