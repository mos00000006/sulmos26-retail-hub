import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');

test('setup errors distinguish hashing, D1 writes and session creation without exposing secrets',()=>{
 for(const code of ['SETUP_HASH','SETUP_WRITE','SETUP_SESSION'])assert.match(source,new RegExp(code));
 assert.match(source,/if\(!validSetupToken\(req\.headers\.get\('x-sulmos26-setup-token'\),env\.SULMOS26_SETUP_TOKEN\)\)/);
 assert.doesNotMatch(source,/console\.error\([^\n]*pass\b/);
 assert.doesNotMatch(source,/console\.error\([^\n]*secret\b/);
});

test('the setup runtime succeeds, protects owner setup and reports partial sign-in errors',()=>{
 const workerUrl=new URL('../src/index.ts',import.meta.url).href;
 const program=String.raw`
import assert from 'node:assert/strict';
import worker from '${workerUrl}';
const key='k'.repeat(64);
function makeDB(options={}){
 const state={owner:false,batchCount:0,sessionCount:0};
 const db={
  prepare(sql){return {
   bind(...args){this.args=args;return this},
   async first(){if(sql.startsWith('SELECT id FROM users'))return state.owner?{id:'owner'}:null;return null},
   async run(){if(sql.startsWith('INSERT INTO sessions')){state.sessionCount++;if(options.sessionError)throw Error('D1 session fault')}return {success:true}}
  }},
  async batch(items){state.batchCount++;if(options.writeError)throw Error('D1 write fault');state.owner=true;return items.map(()=>({success:true}))}
 };return {db,state};
}
async function create(options={},secret=key){const {db,state}=makeDB(options);const env={DB:db,SULMOS26_SETUP_TOKEN:secret,ASSETS:{fetch:()=>new Response('assets')}};const payload={business:'Test Shop',name:'Owner',email:'owner@example.invalid',password:'ExampleLongPassword1234'};const url='https://example.test/api/setup';const req=(k=key)=>new Request(url,{method:'POST',headers:{'content-type':'application/json','x-sulmos26-setup-token':k,'origin':'https://example.test'},body:JSON.stringify(payload)});return {env,state,req};}
{
 const {env,req,state}=await create();const r=await worker.fetch(req(),env);const j=await r.json();assert.equal(r.status,201,JSON.stringify(j));assert.ok(r.headers.get('set-cookie')?.includes('HttpOnly'));assert.equal(state.batchCount,1);assert.equal(state.sessionCount,1);
 const r2=await worker.fetch(req(),env);assert.equal(r2.status,409);assert.match((await r2.json()).error,/sign in/i);
}
{
 const {env,req,state}=await create();const r=await worker.fetch(req('wrong'.repeat(12)),env);assert.equal(r.status,403);assert.equal(state.batchCount,0);
}
{
 const {env,req,state}=await create({sessionError:true});const r=await worker.fetch(req(),env);assert.equal(r.status,503);assert.match((await r.json()).error,/SETUP_SESSION/);assert.equal(state.owner,true);
}
{
 const {env,req,state}=await create({writeError:true});const r=await worker.fetch(req(),env);assert.equal(r.status,503);assert.match((await r.json()).error,/SETUP_WRITE/);assert.equal(state.owner,false);
}
console.log('runtime setup assertions passed');
`;
 const child=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',program],{encoding:'utf8',timeout:15000});assert.equal(child.status,0,`${child.stdout}\n${child.stderr}`);assert.match(child.stdout,/runtime setup assertions passed/);
});
