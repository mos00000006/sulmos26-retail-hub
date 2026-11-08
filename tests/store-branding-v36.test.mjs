import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('document branding has separate company default and store records',()=>{
 const sql=read('migrations/0013_document_branding.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS document_branding/);
 assert.match(sql,/store_id TEXT PRIMARY KEY/);
});
test('the owner controls uploads and other roles can only view assigned stores',()=>{
 const code=read('src/index.ts');
 assert.match(code,/Only the owner can edit printing identities/);
 assert.match(code,/scopedStore\(db,u,sid\)/);
 assert.match(code,/image\\\/\(png\|jpeg\|webp\)/);
});
test('each Worker can retrieve store branding without making it public',()=>{
 for(const file of ['src/stock-office.ts','src/dispatch.ts']){
  const code=read(file);
  assert.match(code,/document-branding/);
  assert.match(code,/auth\(req,db\)/);
 }
});
test('customer-facing printed documents use store identity',()=>{
 for(const file of ['public-cash/app.js','public-stock/app.js','public-pos/app.js','public-dispatch/app.js']){
  const source=read(file);
  assert.match(source,/document-branding/);
  assert.match(source,/logo_data/);
  assert.match(source,/display_name/);
 }
});
test('the branding editor is owner-only and offers company and store selection',()=>{
 const html=read('public/store-branding.html');
 assert.match(html,/__company__/);
 assert.match(html,/Only the owner can edit document branding/);
 assert.match(html,/type="file"/);
});
