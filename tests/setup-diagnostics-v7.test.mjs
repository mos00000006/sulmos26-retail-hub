import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.ts';
const source=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
test('V7 version endpoint is read-only and does not require D1 or installation key',async()=>{
  const req=new Request('https://unit.test/api/version');
  const r=await worker.fetch(req,{ASSETS:{fetch:()=>new Response('static')},DB:undefined});
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{application:'Sulmos26 Retail Hub',version:'V8-SETUP-REPAIR'});
});
test('setup precheck errors have a safe, specific code',async()=>{
 const env={DB:{prepare(){throw new Error('Sensitive D1 SQL details should never appear')}},SULMOS26_SETUP_TOKEN:'s'.repeat(64),ASSETS:{fetch:()=>new Response('static')}};
 const r=await worker.fetch(new Request('https://unit.test/api/setup',{method:'POST',headers:{'content-type':'application/json','origin':'https://unit.test','x-sulmos26-setup-token':'s'.repeat(64)},body:JSON.stringify({business:'Test shop',name:'Tester',email:'owner@example.test',password:'SomeLongPassword01234'})}),env);
 assert.equal(r.status,503);
 const result=await r.json();
 assert.match(result.error,/SETUP_DB_READ/);
 assert.doesNotMatch(result.error,/Sensitive D1 SQL/);
});
test('setup exceptions before guarded stages have safe fallback, without leaking passwords',async()=>{
 const r=await worker.fetch(new Request('https://unit.test/api/setup',{method:'POST',headers:{'content-type':'application/json','origin':'https://unit.test','x-sulmos26-setup-token':'s'.repeat(64)},body:'not valid json'}),{DB:{},SULMOS26_SETUP_TOKEN:'s'.repeat(64),ASSETS:{fetch:()=>new Response('static')}});
 assert.equal(r.status,503);
 assert.match((await r.json()).error,/SETUP_UNHANDLED/);
 assert.match(source,/SULMOS26_SETUP_UNHANDLED/);
});

test('V8 preflight identifies missing database binding without exposing secrets',async()=>{
 const r=await worker.fetch(new Request('https://unit.test/api/setup-check'),{ASSETS:{fetch:()=>new Response('static')}});
 assert.equal(r.status,503);
 const result=await r.json();assert.equal(result.code,'DB_BINDING_MISSING');
 assert.equal(Object.hasOwn(result,'token'),false);
});
