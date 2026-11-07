import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');

test('the password code never asks Cloudflare workerd for over 100k iterations in one deriveBits call',()=>{
 assert.doesNotMatch(src,/iterations\s*:\s*210000/);
 assert.match(src,/round\s*<\s*6/);
 assert.match(src,/iterations\s*:\s*100000/);
 assert.match(src,/return 'v2\$'\+hex\(material\)/);
});

test('setup and login succeed against a simulated Cloudflare 100k limit; wrong password is denied',()=>{
 const uri=new URL('../src/index.ts',import.meta.url).href;
 const program=String.raw`
import assert from 'node:assert/strict';
import worker from '${uri}';
const real=globalThis.crypto.subtle;
let derives=0;
Object.defineProperty(globalThis,'crypto',{configurable:true,value:{...globalThis.crypto,randomUUID:()=>cryptoUUID(),getRandomValues:(a)=>realCrypto.getRandomValues(a),subtle:{digest:(...a)=>real.digest(...a),importKey:(...a)=>real.importKey(...a),deriveBits:(...a)=>{if(a[0]?.iterations>100000)throw Error('workerd PBKDF2 iteration limit exceeded');derives++;return real.deriveBits(...a)}}}});
function cryptoUUID(){return realCrypto.randomUUID()}
const realCrypto=(await import('node:crypto')).webcrypto;
const state={owner:null,business:null,session:null,attempts:null};
const db={prepare(sql){const statement={sql,args:[],bind(...args){this.args=args;return this},async first(){
 if(sql.startsWith('SELECT id FROM users'))return state.owner&&{id:'owner'};
 if(sql.startsWith('SELECT attempts,blocked_until'))return null;
 if(sql.startsWith('SELECT * FROM users'))return state.owner&&state.owner.email===this.args[0]?{...state.owner,active:1}:null;
 return null;
 },async run(){if(sql.startsWith('INSERT INTO sessions')){state.session=this.args;return {success:true}};return {success:true}}};return statement;},async batch(stmts){for(const s of stmts){if(s.sql.startsWith('INSERT INTO users')){state.owner={id:s.args[0],name:s.args[1],email:s.args[2],password_salt:s.args[3],password_hash:s.args[4],role:'owner'};}if(s.sql.startsWith('INSERT INTO business'))state.business=s.args;}return stmts.map(()=>({success:true}));}};
const env={DB:db,SULMOS26_SETUP_TOKEN:'m'.repeat(64),ASSETS:{fetch:()=>new Response('assets')}};
const origin='https://test.invalid';const req=(path,payload,headers={})=>new Request(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(payload)});
const payload={business:'My Hardware',name:'Owner',email:'owner@example.test',password:'PasswordOnlyForUnitTest12345'};
const setup=await worker.fetch(req('/api/setup',payload,{'x-sulmos26-setup-token':'m'.repeat(64)}),env);
assert.equal(setup.status,201,JSON.stringify(await setup.clone().json()));assert.equal((await setup.json()).user.role,'owner');
assert.ok(state.owner.password_hash.startsWith('v2$'));assert.equal(state.owner.password_hash.length,67);
assert.equal(derives,6);
const login=await worker.fetch(req('/api/login',{email:payload.email,password:payload.password}),env);
assert.equal(login.status,200,JSON.stringify(await login.clone().json()));assert.equal(derives,12);
const wrong=await worker.fetch(req('/api/login',{email:payload.email,password:'this-is-a-wrong-password'}),env);
assert.equal(wrong.status,401);assert.equal(derives,18);
console.log('Cloudflare cap simulation: setup, login, denial verified');
`;
 const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',program],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,`STDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
 assert.match(result.stdout,/setup, login, denial verified/);
});
