import {ROLES, DOC_TYPES, permission, validLines, validMoney, canApprove} from './logic.mjs';
interface Env { DB: D1Database; ASSETS: Fetcher; SULMOS26_SETUP_TOKEN?: string }
type User = {id:string;name:string;email:string;username:string|null;role:string;active:number};
const encoder=new TextEncoder();
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const fail=(message:string,status=400)=>json({error:message},status);
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
const clean=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const hex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
const rand=(n=32)=>{const a=crypto.getRandomValues(new Uint8Array(n));return Array.from(a).map(x=>x.toString(16).padStart(2,'0')).join('')};
async function hash(text:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)))}
// Cloudflare workerd currently rejects a single PBKDF2 call above 100,000 iterations.
// To preserve a meaningful work factor without exceeding that runtime cap, chain
// six independently domain-separated 100k PBKDF2-SHA-256 calls. Every new
// credential uses the v2 prefix so the algorithm can be upgraded explicitly.
// A dedicated, vetted password-hashing service (Argon2id) is recommended prior
// to offering Sulmos26 commercially to unrelated customer organisations.
async function passwordHash(pass:string,salt:string){
 let material: ArrayBuffer=encoder.encode(pass).buffer as ArrayBuffer;
 for(let round=0;round<6;round++){
  const key=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);
  material=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(`sulmos26:v2:${round}:${salt}`),iterations:100000,hash:'SHA-256'},key,256);
 }
 return 'v2$'+hex(material);
}
// A fresh customer installation is locked until the private bootstrap key is configured.
// Keep the key out of source code, URLs and browser storage; this header is sent only on first setup.
function validSetupToken(provided:string|null, secret:string|undefined){
 if(!provided || !secret || secret.length<32 || provided.length>256)return false;
 const left=encoder.encode(provided),right=encoder.encode(secret);
 let different=left.length ^ right.length;
 for(let i=0;i<Math.max(left.length,right.length);i++)different|=(left[i]||0)^(right[i]||0);
 return different===0;
}
const cookie=(token:string,secure:boolean)=>`sulmos_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure?'; Secure':''}`;
const expiredCookie=(secure:boolean)=>`sulmos_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`;
function guardOrigin(req:Request){const origin=req.headers.get('Origin'); if(origin && origin !== new URL(req.url).origin) return false;const site=req.headers.get('Sec-Fetch-Site');return !site || ['same-origin','none'].includes(site)}
async function auth(req:Request,db:D1Database):Promise<User|null>{const token=req.headers.get('cookie')?.match(/(?:^|;\s*)sulmos_session=([a-f0-9]{64})/)?.[1];if(!token)return null;const digest=await hash(token);return await db.prepare("SELECT u.id,u.name,u.email,u.username,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1").bind(digest,now()).first<User>()}
async function body(req:Request){if(!req.headers.get('content-type')?.toLowerCase().includes('application/json'))throw Error('JSON content type required');const raw=await req.text();if(raw.length>500000)throw Error('Payload too large');return JSON.parse(raw) as Record<string,unknown>}
async function log(db:D1Database,who:string|null,action:string,entity:string,id:string,details=''){await db.prepare('INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid(),who,action,entity,id,details.slice(0,1000),now()).run()}
async function scopedStore(db:D1Database,u:User,storeId:string){const store=await db.prepare('SELECT id FROM stores WHERE id=? AND active=1').bind(storeId).first();if(!store)return false;if(['owner','manager'].includes(u.role))return true;return !!await db.prepare('SELECT 1 FROM user_stores WHERE user_id=? AND store_id=?').bind(u.id,storeId).first()}
async function rows<T>(db:D1Database,query:string,...params:unknown[]){return (await db.prepare(query).bind(...params).all<T>()).results}
async function createSession(db:D1Database,userId:string,req:Request){const token=rand();await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await hash(token),userId,new Date(Date.now()+43200000).toISOString(),now()).run();return {'set-cookie':cookie(token,new URL(req.url).protocol==='https:')}}
const summary=(r:Record<string,unknown>)=>r;
const validUsername=(x:string)=>/^[a-z][a-z0-9._-]{2,39}$/.test(x);
const internalMemberEmail=(username:string)=>`${username}@members.sulmos26.invalid`; // internal database value, not a mailbox

export default {async fetch(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url);const path=url.pathname;
 // Read-only version marker, independent of D1 and any owner credentials.
 // If this URL returns 404, the diagnostic build was not deployed to this Worker.
 if(path==='/api/version' && req.method==='GET')return json({application:'Sulmos26 Retail Hub',version:'V9-USERNAME-LOGIN'});
 // Safe public preflight: never returns installation tokens, account details or raw database errors.
 if(path==='/api/setup-check' && req.method==='GET'){
  if(!env.DB || typeof env.DB.prepare!=='function')return json({version:'V9-USERNAME-LOGIN',ready:false,code:'DB_BINDING_MISSING',message:'Cloudflare Worker is missing its DB binding.'},503);
  try{
   const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','business','sessions','audit_log')").all<{name:string}>();
   const present=new Set((tables.results||[]).map(x=>x.name));
   if(['users','business','sessions','audit_log'].some(name=>!present.has(name)))return json({version:'V9-USERNAME-LOGIN',ready:false,code:'DB_MIGRATION_REQUIRED',message:'Database schema is incomplete. Apply the D1 migrations.'},503);
   const owner=await env.DB.prepare('SELECT id FROM users LIMIT 1').first();
   return json({version:'V9-USERNAME-LOGIN',ready:true,setupRequired:!owner,code:owner?'OWNER_EXISTS':'READY_TO_CREATE_OWNER'});
  }catch(e){console.error('SULMOS26_PREFLIGHT_DB',e instanceof Error?e.name:'unknown');return json({version:'V9-USERNAME-LOGIN',ready:false,code:'DB_CHECK_FAILED',message:'Database could not be queried. Verify D1 binding and schema.'},503)}
 }
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(req.method!=='GET' && (!guardOrigin(req)||req.headers.get('content-type')?.split(';')[0]!=='application/json'))return fail('Request blocked: invalid origin or content type',403);
 try{
 const db=env.DB;
 if(path==='/api/session' && req.method==='GET'){const owner=await db.prepare('SELECT id FROM users LIMIT 1').first();if(!owner)return json({setup:true,user:null});const u=await auth(req,db);return json({setup:false,user:u||null});}
 if(path==='/api/setup' && req.method==='POST'){
  if(!validSetupToken(req.headers.get('x-sulmos26-setup-token'),env.SULMOS26_SETUP_TOKEN))
   return fail('Owner setup is locked. Check the private installation key supplied by your Sulmos26 administrator.',403);
  const b=await body(req);const business=clean(b.business,120),name=clean(b.name,100),email=clean(b.email,180).toLowerCase(),username=clean(b.username,40).toLowerCase(),pass=clean(b.password,200);
  if(!business||!name||!validUsername(username)||!/^\S+@\S+\.\S+$/.test(email)||pass.length<12)return fail('Business name, owner name, username (3–40 letters, digits, dots, underscores, hyphens), email, and password (12+ characters) are required');
  // A previous setup may have committed the owner before the session cookie failed.
  // Never overwrite an existing owner or repeat initialisation on this endpoint.
  // The session endpoint uses this table too, but classify a bootstrap read failure.
  let existingOwner: {id:string}|null;
  try{existingOwner=await db.prepare('SELECT id FROM users LIMIT 1').first<{id:string}>();}
  catch(e){
   console.error('SULMOS26_SETUP_DB_READ',e instanceof Error?e.name:'unknown');
   return fail('Owner setup cannot read the database (SETUP_DB_READ). Check the D1 binding and migration.',503);
  }
  if(existingOwner)return fail('The first owner already exists. Refresh the page and sign in instead.',409);
  const salt=rand(16),timestamp=now();let hashPass:string;
  try{hashPass=await passwordHash(pass,salt)}catch(e){
   console.error('SULMOS26_SETUP_HASH',e instanceof Error?e.name:'unknown');
   return fail('Secure password setup failed (SETUP_HASH). Ask the administrator to check Cloudflare Worker logs.',503);
  }
  try{await db.batch([
   db.prepare('INSERT INTO users(id,name,email,username,password_salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?,?)').bind('owner',name,email,username,salt,hashPass,'owner',timestamp),
   db.prepare('INSERT INTO business(id,name,trading_name,created_at) VALUES(?,?,?,?)').bind('primary',business,business,timestamp),
   db.prepare('INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid(),'owner','setup','business','primary','Fresh customer installation',timestamp)
  ]);}catch(e){
   console.error('SULMOS26_SETUP_WRITE',e instanceof Error?e.name:'unknown');
   // A simultaneous setup may have won the owner race. Do not leak DB internals.
   const owner=await db.prepare('SELECT id FROM users LIMIT 1').first<{id:string}>().catch(()=>null);
   if(owner)return fail('An owner account already exists. Refresh the page and sign in.',409);
   return fail('Could not save the first owner (SETUP_WRITE). Check the D1 migration and Cloudflare Worker logs.',503);
  }
  try{
   const headers=await createSession(db,'owner',req);
   return json({ok:true,user:{id:'owner',name,email,username,role:'owner'}},201,headers);
  }catch(e){
   console.error('SULMOS26_SETUP_SESSION',e instanceof Error?e.name:'unknown');
   return fail('The owner was saved, but automatic sign-in failed (SETUP_SESSION). Refresh the page and try signing in.',503);
  }
 }
 if(path==='/api/login' && req.method==='POST'){
  const b=await body(req),identifier=clean(b.username||b.email,180).toLowerCase(),pass=clean(b.password,200);
  if(!identifier||!pass)return fail('Enter your username and password',400);
  const key=await hash('login:'+identifier);const attempt=await db.prepare('SELECT attempts,blocked_until FROM login_attempts WHERE identifier=?').bind(key).first<{attempts:number;blocked_until:string|null}>();
  if(attempt?.blocked_until && attempt.blocked_until>now())return fail('Too many attempts. Try again later.',429);
  const user=await db.prepare('SELECT * FROM users WHERE (username=? OR email=?) AND active=1').bind(identifier,identifier).first<User & {password_hash:string;password_salt:string}>();
  const actual=await passwordHash(pass,user?.password_salt||'unregistered_salt'),good=!!user&&actual===user.password_hash;
  if(!good){const count=(attempt?.attempts||0)+1;const block=count>=6?new Date(Date.now()+15*60000).toISOString():null;await db.prepare('INSERT INTO login_attempts(identifier,attempts,blocked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(identifier) DO UPDATE SET attempts=excluded.attempts,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at').bind(key,count,block,now()).run();return fail('Invalid username or password',401)}
  await db.prepare('DELETE FROM login_attempts WHERE identifier=?').bind(key).run();
  return json({ok:true,user:{id:user.id,name:user.name,email:user.email,username:user.username,role:user.role}},200,await createSession(db,user.id,req));
 }
 if(path==='/api/logout' && req.method==='POST'){
  const token=req.headers.get('cookie')?.match(/(?:^|;\s*)sulmos_session=([a-f0-9]{64})/)?.[1];if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();return json({ok:true},200,{'set-cookie':expiredCookie(url.protocol==='https:')});
 }
 const u=await auth(req,db);if(!u)return fail('Sign in required',401);
 // Cashier accounts cannot access management, sales, stock or dispatch API endpoints.
 if(u.role==='cashier' && !(path==='/api/stores'&&req.method==='GET') && !(path==='/api/logout'&&req.method==='POST') && !(path.startsWith('/api/cash-office/')&&req.method==='GET'||path==='/api/cash-office/payment'&&req.method==='POST'))return fail('Cash Office access only',403);
 if(path==='/api/my-username'&&req.method==='POST'){
  if(u.role!=='owner')return fail('Only the owner can set the owner username',403);
  const b=await body(req),username=clean(b.username,40).toLowerCase();if(!validUsername(username))return fail('Username must be 3–40 letters, numbers, dots, underscores or hyphens');
  await db.prepare('UPDATE users SET username=? WHERE id=?').bind(username,u.id).run();await log(db,u.id,'update','user',u.id,'Owner username configured');return json({ok:true,username});
 }
 if(path==='/api/overview'&&req.method==='GET'){
  const data=await db.batch([db.prepare('SELECT COUNT(*) n FROM stores WHERE active=1'),db.prepare('SELECT COUNT(*) n FROM products WHERE active=1'),db.prepare('SELECT COUNT(*) n FROM quotations'),db.prepare('SELECT COUNT(*) n FROM stock_documents'),db.prepare('SELECT COUNT(*) n FROM tasks WHERE status != ?').bind('done')]);
  // D1 batch results are typed as generic rows. This query always returns COUNT(*) AS n.
  const count=(index:number)=>Number((data[index]?.results?.[0] as {n?:number}|undefined)?.n ?? 0);
  return json({stores:count(0),products:count(1),quotes:count(2),documents:count(3),tasks:count(4)});
 }
 if(path==='/api/business'){
  if(req.method==='GET')return json({business:await db.prepare('SELECT * FROM business WHERE id=?').bind('primary').first()});
  if(req.method==='POST'&&permission(u.role,'business','write')){const b=await body(req);const name=clean(b.name,120),trading=clean(b.trading_name,120);if(!name)return fail('Business name is required');await db.prepare('UPDATE business SET name=?,trading_name=?,email=?,phone=?,address=? WHERE id=?').bind(name,trading,clean(b.email,180),clean(b.phone,50),clean(b.address,300),'primary').run();await log(db,u.id,'update','business','primary');return json({ok:true})}
 }
 if(path==='/api/stores'){
  if(req.method==='GET'){let data;if(['owner','manager'].includes(u.role))data=await rows(db,'SELECT * FROM stores ORDER BY name');else data=await rows(db,'SELECT s.* FROM stores s JOIN user_stores us ON us.store_id=s.id WHERE us.user_id=? ORDER BY s.name',u.id);return json({items:data})}
  if(req.method==='POST'&&permission(u.role,'stores','write')){const b=await body(req),name=clean(b.name,120),code=clean(b.code,30).toUpperCase();if(!name||!/^[A-Z0-9_-]{2,30}$/.test(code))return fail('Store name and 2–30 character code required');const id=uid();await db.prepare('INSERT INTO stores(id,name,code,address,phone,created_at) VALUES(?,?,?,?,?,?)').bind(id,name,code,clean(b.address,300),clean(b.phone,50),now()).run();await log(db,u.id,'create','store',id);return json({ok:true,id},201)}
 }
 // POS product lookup excludes cost price and is available only to POS-authorized roles.
 if(path==='/api/pos/products' && req.method==='GET'){
  if(!['owner','manager','sales','cashier'].includes(u.role))return fail('POS access required',403);
  const q=clean(url.searchParams.get('q')||'',80);
  const items=q?await rows(db,'SELECT sku,name,category,barcode,price_cents,active FROM products WHERE active=1 AND (sku LIKE ? OR name LIKE ? OR barcode LIKE ?) ORDER BY name LIMIT 200',`%${q}%`,`%${q}%`,`%${q}%`):await rows(db,'SELECT sku,name,category,barcode,price_cents,active FROM products WHERE active=1 ORDER BY name LIMIT 500');
  return json({items});
 }
 if(path==='/api/products'){
  if(req.method==='GET'){const q=clean(url.searchParams.get('q')||'',80);const items=q?await rows(db,'SELECT * FROM products WHERE sku LIKE ? OR name LIKE ? ORDER BY name LIMIT 200',`%${q}%`,`%${q}%`):await rows(db,'SELECT * FROM products ORDER BY name LIMIT 200');return json({items})}
  if(req.method==='POST'&&permission(u.role,'products','write')){const b=await body(req),name=clean(b.name,180),sku=clean(b.sku,100).toUpperCase(),price=Number(b.price_cents),cost=Number(b.cost_cents||0);if(!name||!sku||!validMoney(price)||!validMoney(cost))return fail('Valid SKU, name, and non-negative prices are required');const id=uid();await db.prepare('INSERT INTO products(id,sku,name,category,description,price_cents,cost_cents,barcode,image_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,sku,name,clean(b.category,80),clean(b.description,1000),price,cost,clean(b.barcode,80),clean(b.image_url,500),now()).run();await log(db,u.id,'create','product',id,sku);return json({ok:true,id},201)}
 }
 if(path==='/api/users'){
  if(req.method==='GET'&&['owner','manager'].includes(u.role))return json({items:await rows(db,u.role==='owner'?'SELECT id,name,username,role,active,created_at FROM users ORDER BY created_at':"SELECT id,name,username,role,active,created_at FROM users WHERE role='sales' ORDER BY created_at"),assignments:await rows(db,'SELECT user_id,store_id FROM user_stores')});
  if(req.method==='POST'&&['owner','manager'].includes(u.role)){
   const b=await body(req),name=clean(b.name,100),username=clean(b.username,40).toLowerCase(),pass=clean(b.password,200),role=clean(b.role,30);
   if(u.role==='manager'&&role!=='sales')return fail('Managers may create sales consultants only',403);
   const stores=Array.isArray(b.store_ids)?[...new Set(b.store_ids.filter(x=>typeof x==='string').slice(0,50))] as string[]:[];
   if(!stores.length)return fail('Assign at least one store to the employee');
   for(const sid of stores)if(!await scopedStore(db,u,sid))return fail('Invalid store assignment',403);
   if(!name||!validUsername(username)||pass.length<12||!ROLES.includes(role)||role==='owner')return fail('Name, valid username, password of at least 12 characters, and permitted member role are required');
   const id=uid(),salt=rand(16),email=internalMemberEmail(username);
   const stmts=[db.prepare('INSERT INTO users(id,name,email,username,password_salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,name,email,username,salt,await passwordHash(pass,salt),role,now())];
   for(const sid of stores)stmts.push(db.prepare('INSERT INTO user_stores(user_id,store_id) SELECT ?,id FROM stores WHERE id=?').bind(id,sid));
   await db.batch(stmts);await log(db,u.id,'create','user',id,role);return json({ok:true,id},201);
  }
  if(req.method==='PATCH'&&u.role==='owner'){
   const b=await body(req),id=clean(b.id,64),active=b.active,role=clean(b.role,30),pass=typeof b.password==='string'?b.password:'';
   if(!id||id===u.id||active!==undefined&&active!==true&&active!==false||role&&(!ROLES.includes(role)||role==='owner')||pass&&pass.length<12)return fail('Invalid member update');
   const target=await db.prepare("SELECT id FROM users WHERE id=? AND role!='owner'").bind(id).first();if(!target)return fail('Member not found',404);
   const edits=[] as D1PreparedStatement[];
   if(active!==undefined){edits.push(db.prepare('UPDATE users SET active=? WHERE id=?').bind(active?1:0,id));if(!active)edits.push(db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));}
   if(role)edits.push(db.prepare('UPDATE users SET role=? WHERE id=?').bind(role,id));
   if(pass){const salt=rand(16);edits.push(db.prepare('UPDATE users SET password_salt=?,password_hash=? WHERE id=?').bind(salt,await passwordHash(pass,salt),id));edits.push(db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));}
   if(!edits.length)return fail('No changes provided');
   await db.batch(edits);await log(db,u.id,'update','user',id,'Member access updated');return json({ok:true});
  }
 }
 if(path==='/api/stock-documents'){
  if(req.method==='GET'){const items=['owner','manager'].includes(u.role)?await rows(db,'SELECT d.*,s.name store_name FROM stock_documents d JOIN stores s ON s.id=d.store_id ORDER BY d.created_at DESC LIMIT 200'):await rows(db,'SELECT d.*,s.name store_name FROM stock_documents d JOIN stores s ON s.id=d.store_id JOIN user_stores us ON us.store_id=d.store_id WHERE us.user_id=? ORDER BY d.created_at DESC LIMIT 200',u.id);return json({items})}
  if(req.method==='POST'&&permission(u.role,'stock_documents','write')){const b=await body(req),type=clean(b.type,30),store=clean(b.store_id,60),destination=clean(b.destination_store_id,60),lines=b.lines; if(!DOC_TYPES.includes(type)||!await scopedStore(db,u,store)||!validLines(lines))return fail('Choose a valid document, assigned store, and product lines');if(type==='transfer'&&(!destination||destination===store||!await db.prepare('SELECT id FROM stores WHERE id=?').bind(destination).first()))return fail('Choose a different receiving store');const arr=lines as {sku:string;qty:number}[];for(const l of arr){if(!await db.prepare('SELECT id FROM products WHERE sku=? AND active=1').bind(l.sku.trim()).first())return fail(`Unknown product SKU: ${l.sku}`)}const id=uid(),ref=`ST-${type.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${id.slice(0,5).toUpperCase()}`;await db.prepare('INSERT INTO stock_documents(id,reference,type,store_id,destination_store_id,counterparty,note,lines_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,ref,type,store,destination||null,clean(b.counterparty,180),clean(b.note,1000),JSON.stringify(arr.map(l=>({sku:l.sku.trim(),qty:l.qty}))),u.id,now()).run();await log(db,u.id,'create','stock_document',id,ref);return json({ok:true,id,reference:ref},201)}
 }
 const action=path.match(/^\/api\/stock-documents\/([^/]+)\/(submit|approve|reject)$/);
 if(action&&req.method==='POST'){
  const id=action[1],kind=action[2];const d=await db.prepare('SELECT id,store_id,created_by,status FROM stock_documents WHERE id=?').bind(id).first<{id:string;store_id:string;created_by:string;status:string}>();if(!d||!await scopedStore(db,u,d.store_id))return fail('Document not found',404);
  if(kind==='submit'){if(!permission(u.role,'stock_documents','write')||d.created_by!==u.id||d.status!=='draft')return fail('Only the creator can submit their draft',403);await db.prepare('UPDATE stock_documents SET status=? WHERE id=? AND status=?').bind('submitted',id,'draft').run()}
  else{if(!canApprove(u.role,d.created_by,u.id,d.status))return fail('Requires independent manager approval',403);await db.prepare('UPDATE stock_documents SET status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status=?').bind(kind==='approve'?'approved':'rejected',u.id,now(),id,'submitted').run()}
  await log(db,u.id,kind,'stock_document',id,'Document-control status only; no physical stock movement');return json({ok:true})
 }
 // Phase 4: stock snapshots are entered by management. These are NOT a live stock ledger.
 // Quotations, reservations and transfer requests never post physical stock movements.
 if(path==='/api/sales-stock/stores' && req.method==='GET'){
  if(!['owner','manager','sales'].includes(u.role))return fail('Sales access required',403);
  return json({items:await rows(db,'SELECT id,name FROM stores WHERE active=1 ORDER BY name')});
 }
 if(path==='/api/sales-stock' && req.method==='GET'){
  if(!['owner','manager','sales'].includes(u.role))return fail('Sales access required',403);
  const store=clean(url.searchParams.get('store_id'),60),sku=clean(url.searchParams.get('sku'),100).toUpperCase();
  if(!store||!await scopedStore(db,u,store))return fail('Assigned store required',403);
  const sql=`SELECT b.store_id,s.name store_name,b.sku,p.name product_name,b.on_hand,b.updated_at,
   COALESCE((SELECT SUM(r.qty) FROM stock_requests r WHERE r.store_id=b.store_id AND r.sku=b.sku AND r.kind='reservation' AND r.status='approved'),0) reserved
   FROM inventory_balances b JOIN stores s ON s.id=b.store_id JOIN products p ON p.sku=b.sku`;
  const items=sku?await rows(db,sql+' WHERE b.sku=? ORDER BY s.name',sku):await rows(db,sql+' WHERE b.store_id=? ORDER BY p.name LIMIT 1000',store);
  return json({items:items.map(x=>{const a=x as Record<string,unknown> & {on_hand:number;reserved:number};return {...a,available:Math.max(0,a.on_hand-a.reserved)}}),basis:'inventory_ledger',live:true,stock_posted_at:'dispatch_release'});
 }
 // Read-only per-store availability endpoint. No missing product becomes an invented zero.
 if(path==='/api/inventory/availability'&&req.method==='GET'){
  if(!['owner','manager','sales'].includes(u.role))return fail('Sales access required',403);
  const store=clean(url.searchParams.get('store_id'),60);
  if(!store||!await scopedStore(db,u,store))return fail('Assigned store required',403);
  const items=await rows(db,`SELECT p.sku,p.name,b.on_hand,b.updated_at,
   COALESCE((SELECT SUM(r.qty) FROM stock_requests r WHERE r.store_id=? AND r.sku=p.sku AND r.kind='reservation' AND r.status='approved'),0) reserved
   FROM products p LEFT JOIN inventory_balances b ON b.sku=p.sku AND b.store_id=? WHERE p.active=1 ORDER BY p.name LIMIT 2000`,store,store);
  return json({store_id:store,items:items.map((x:any)=>({...x,recorded:x.on_hand!==null,available:x.on_hand===null?null:Math.max(0,Number(x.on_hand)-Number(x.reserved))})),basis:'inventory_ledger'});
 }
 if(path==='/api/inventory/movements'&&req.method==='GET'){
  if(!['owner','manager'].includes(u.role))return fail('Management access required',403);
  const store=clean(url.searchParams.get('store_id'),60),sku=clean(url.searchParams.get('sku'),100).toUpperCase();
  if(!store||!await scopedStore(db,u,store))return fail('Assigned store required',403);
  const items=await rows(db,`SELECT m.id,m.sku,p.name product_name,m.qty_delta,m.reason,m.source_id,m.created_at,u.name actor_name
    FROM inventory_movements m JOIN products p ON p.sku=m.sku LEFT JOIN users u ON u.id=m.actor_id
    WHERE m.store_id=? AND (?='' OR m.sku=?) ORDER BY m.created_at DESC LIMIT 300`,store,sku,sku);
  return json({items,immutable:true});
 }
 if(path==='/api/sales-stock/snapshot'&&req.method==='POST'){
  if(!['owner','manager'].includes(u.role))return fail('Only management can enter stock snapshots',403);
  const b=await body(req),store=clean(b.store_id,60),sku=clean(b.sku,100).toUpperCase(),qty=Number(b.on_hand);
  if(!store||!await scopedStore(db,u,store)||!sku||!Number.isSafeInteger(qty)||qty<0||qty>100000000)return fail('Valid store, product SKU and non-negative quantity required');
  if(!await db.prepare('SELECT 1 FROM products WHERE sku=? AND active=1').bind(sku).first())return fail('Product not found',404);
  // Do not permit a snapshot below outstanding confirmed reservations.
  const reserved=await db.prepare("SELECT COALESCE(SUM(qty),0) AS n FROM stock_requests WHERE store_id=? AND sku=? AND kind='reservation' AND status='approved'").bind(store,sku).first<{n:number}>();
  if(qty<Number(reserved?.n||0))return fail('Cannot set stock below approved reservation quantity',409);
  await db.prepare('INSERT INTO stock_snapshots(store_id,sku,on_hand,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(store_id,sku) DO UPDATE SET on_hand=excluded.on_hand,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(store,sku,qty,u.id,now()).run();
  await log(db,u.id,'stock_snapshot','product',sku,JSON.stringify({store_id:store,on_hand:qty}));return json({ok:true});
 }
 if(path==='/api/sales-stock/requests'){
  if(!['owner','manager','sales'].includes(u.role))return fail('Sales access required',403);
  if(req.method==='GET'){
   const store=clean(url.searchParams.get('store_id'),60);
   if(!store||!await scopedStore(db,u,store))return fail('Assigned store required',403);
   const items=await rows(db,`SELECT r.*,p.name product_name,s.name store_name,src.name source_store_name,creator.name created_by_name
    FROM stock_requests r JOIN products p ON p.sku=r.sku JOIN stores s ON s.id=r.store_id
    LEFT JOIN stores src ON src.id=r.source_store_id JOIN users creator ON creator.id=r.created_by
    WHERE r.store_id=? ORDER BY r.created_at DESC LIMIT 100`,store);
   return json({items});
  }
  if(req.method==='POST'){
   const b=await body(req),store=clean(b.store_id,60),source=clean(b.source_store_id,60),sku=clean(b.sku,100).toUpperCase(),kind=clean(b.kind,20),qty=Number(b.qty),qid=clean(b.quotation_id,64),note=clean(b.note,500);
   if(!store||!await scopedStore(db,u,store)||!['reservation','transfer'].includes(kind)||!Number.isSafeInteger(qty)||qty<1||qty>1000000)return fail('Invalid stock request');
   if(!await db.prepare('SELECT 1 FROM products WHERE sku=? AND active=1').bind(sku).first())return fail('Product not found',404);
   if(kind==='transfer'&&(!source||source===store||!await db.prepare('SELECT 1 FROM stores WHERE id=? AND active=1').bind(source).first()))return fail('Choose a different source store');
   if(qid){const q=await db.prepare('SELECT store_id,status FROM quotations WHERE id=?').bind(qid).first<{store_id:string;status:string}>();if(!q||q.store_id!==store||q.status!=='awaiting_payment')return fail('Quotation not available for this store',404);}
   const id=uid(),ref=`SR-${Date.now().toString(36).toUpperCase()}-${id.slice(0,6).toUpperCase()}`;
   await db.prepare('INSERT INTO stock_requests(id,reference,kind,store_id,source_store_id,sku,qty,quotation_id,note,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,ref,kind,store,kind==='transfer'?source:null,sku,qty,qid||null,note,u.id,now()).run();
   await log(db,u.id,'stock_request','stock_request',id,ref);return json({ok:true,id,reference:ref,status:'pending'},201);
  }
 }
 const stockReview=path.match(/^\/api\/sales-stock\/requests\/([^/]+)\/(approve|reject|cancel|release)$/);
 if(stockReview&&req.method==='POST'){
  const id=stockReview[1],action=stockReview[2];
  const r=await db.prepare('SELECT id,store_id,source_store_id,sku,qty,kind,status,created_by FROM stock_requests WHERE id=?').bind(id).first<{id:string;store_id:string;source_store_id:string|null;sku:string;qty:number;kind:string;status:string;created_by:string}>();
  if(!r||!await scopedStore(db,u,r.store_id))return fail('Request not found',404);
  if(action==='release'){
   if(!['owner','manager'].includes(u.role)||r.created_by===u.id||r.kind!=='reservation')return fail('An independent manager is required to release a reservation',403);
   const result=await db.prepare("UPDATE stock_requests SET status='released',reviewed_by=?,reviewed_at=? WHERE id=? AND status='approved' AND kind='reservation'").bind(u.id,now(),id).run();
   if(!result.meta.changes)return fail('Only approved reservations may be released',409);
  }else if(action==='cancel'){
   if(r.created_by!==u.id && !['owner','manager'].includes(u.role))return fail('Only requester or management can cancel',403);
   const result=await db.prepare("UPDATE stock_requests SET status='cancelled' WHERE id=? AND status='pending'").bind(id).run();
   if(!result.meta.changes)return fail('Only pending requests can be cancelled',409);
  }else{
   if(!['owner','manager'].includes(u.role)||r.created_by===u.id)return fail('Independent manager approval required',403);
   if(action==='approve'&&r.kind==='reservation'){
    // Atomic conditional update: a second approver cannot approve more units than the latest snapshot.
    const result=await db.prepare(`UPDATE stock_requests SET status='approved',reviewed_by=?,reviewed_at=?
      WHERE id=? AND status='pending' AND kind='reservation' AND EXISTS(
       SELECT 1 FROM stock_snapshots ss WHERE ss.store_id=stock_requests.store_id AND ss.sku=stock_requests.sku
       AND ss.on_hand >= stock_requests.qty + (SELECT COALESCE(SUM(other.qty),0) FROM stock_requests other
       WHERE other.store_id=stock_requests.store_id AND other.sku=stock_requests.sku AND other.kind='reservation' AND other.status='approved'))`)
     .bind(u.id,now(),id).run();
    if(!result.meta.changes)return fail('Cannot approve: missing snapshot, insufficient unreserved quantity, or request already processed',409);
   }else{
    // A transfer approval is permission to arrange a transfer, not a receipt or stock movement.
    const result=await db.prepare('UPDATE stock_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status=?').bind(action==='approve'?'approved':'rejected',u.id,now(),id,'pending').run();
    if(!result.meta.changes)return fail('Request was already processed',409);
   }
  }
  await log(db,u.id,'stock_request_'+action,'stock_request',id,'No stock posted');
  return json({ok:true,status:action==='approve'?'approved':action==='reject'?'rejected':action==='release'?'released':'cancelled'});
 }
 // Owner-only discount on an existing quote; audit and optimistic single-write guard.
 const discountMatch=path.match(/^\/api\/quotations\/([^/]+)\/discount$/);
 if(discountMatch && req.method==='POST'){
  if(u.role!=='owner')return fail('Only the owner may apply quotation discounts',403);
  const b=await body(req),quoteId=discountMatch[1],reason=clean(b.reason,300);
  const discount=Number(b.discount_cents);
  if(!reason||reason.length<5||!Number.isSafeInteger(discount)||discount<1)return fail('Enter a valid discount and reason (at least 5 characters)');
  const record=await db.prepare('SELECT id,reference,total_cents,original_total_cents,discount_cents,status FROM quotations WHERE id=?').bind(quoteId).first<{id:string;reference:string;total_cents:number;original_total_cents:number|null;discount_cents:number;status:string}>();
  if(!record)return fail('Quotation not found',404);
  if(await db.prepare('SELECT id FROM sales_orders WHERE quotation_id=?').bind(quoteId).first())return fail('Quotation already sent to Cash Office. Revisions require a separate authorised workflow.',409);
  if(await db.prepare('SELECT id FROM cash_receipts WHERE quotation_id=?').bind(quoteId).first())return fail('Paid quotations cannot be discounted',409);
  if(record.status!=='awaiting_payment')return fail('Only active unpaid quotations may be discounted',409);
  if(record.discount_cents!==0)return fail('Quotation already discounted. Further changes require a separate adjustment workflow.',409);
  const original=record.original_total_cents??record.total_cents;
  if(discount>original)return fail('Discount cannot exceed the quotation total');
  const timestamp=now();
  const result=await db.prepare('UPDATE quotations SET original_total_cents=?,discount_cents=?,total_cents=?,discount_reason=?,discount_by=?,discount_at=?,revision=revision+1 WHERE id=? AND discount_cents=0 AND status=? AND total_cents=? AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.quotation_id=quotations.id) AND NOT EXISTS (SELECT 1 FROM cash_receipts cr WHERE cr.quotation_id=quotations.id)')
   .bind(original,discount,original-discount,reason,u.id,timestamp,quoteId,'awaiting_payment',record.total_cents).run();
  if(result.meta.changes!==1)return fail('Quotation changed; refresh and try again',409);
  await log(db,u.id,'owner_discount','quotation',quoteId,JSON.stringify({reference:record.reference,original_total_cents:original,discount_cents:discount,final_total_cents:original-discount,reason}));
  return json({ok:true,reference:record.reference,revision:1,total_cents:original-discount});
 }
 // Retrieve a fresh quotation before reprinting. Staff may access only their own records.
 const quoteMatch=path.match(/^\/api\/quotations\/([^/]+)$/);
 if(quoteMatch && req.method==='GET'){
  const q=await db.prepare('SELECT q.*,s.name store_name,creator.name created_by_name,approver.name discount_by_name FROM quotations q JOIN stores s ON s.id=q.store_id JOIN users creator ON creator.id=q.created_by LEFT JOIN users approver ON approver.id=q.discount_by WHERE q.id=?').bind(quoteMatch[1]).first<{created_by:string;store_id:string}>();
  if(!q)return fail('Quotation not found',404);
  if(!['owner','manager'].includes(u.role) && (q.created_by!==u.id || !await scopedStore(db,u,q.store_id)))return fail('Quotation not found',404);
  return json({quotation:q});
 }
 // Phase 6: reporting contains QUOTES and CASH-OFFICE HANDOFFS, never paid revenue.
 // Aggregate from complete date-scoped records, not the limited recent-list endpoints.
 if(path==='/api/sales-performance' && req.method==='GET'){
  if(!['owner','manager','sales'].includes(u.role))return fail('Sales reporting access required',403);
  const from=clean(url.searchParams.get('from'),10),to=clean(url.searchParams.get('to'),10),store=clean(url.searchParams.get('store_id'),60);
  const dateValid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));
  if(!dateValid(from)||!dateValid(to)||from>to)return fail('Choose a valid reporting date range');
  const days=Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
  if(days>366)return fail('Reporting range cannot exceed 367 days');
  if(store&&!await scopedStore(db,u,store))return fail('Store not available to this account',403);
  // Both subqueries enforce creator and store restrictions independently.
  const scope=['owner','manager'].includes(u.role)?'':' AND q.created_by=? AND EXISTS(SELECT 1 FROM user_stores us WHERE us.user_id=? AND us.store_id=q.store_id)';
  const orderScope=['owner','manager'].includes(u.role)?'':' AND so.created_by=? AND EXISTS(SELECT 1 FROM user_stores us WHERE us.user_id=? AND us.store_id=so.store_id)';
  const qb:unknown[]=[from,to],ob:unknown[]=[from,to];
  const qs=store?' AND q.store_id=?':'',os=store?' AND so.store_id=?':'';
  if(store){qb.push(store);ob.push(store)}
  if(scope){qb.push(u.id,u.id);ob.push(u.id,u.id)}
  const quotes=await rows<{created_by:string;consultant:string;store_id:string;store_name:string;quote_count:number;quote_value_cents:number;approved_discount_cents:number}>(db,`
    SELECT q.created_by,u.name consultant,q.store_id,s.name store_name,COUNT(*) quote_count,
    COALESCE(SUM(q.total_cents),0) quote_value_cents,COALESCE(SUM(q.discount_cents),0) approved_discount_cents
    FROM quotations q JOIN users u ON u.id=q.created_by JOIN stores s ON s.id=q.store_id
    WHERE substr(q.created_at,1,10)>=? AND substr(q.created_at,1,10)<=?${qs}${scope}
    GROUP BY q.created_by,q.store_id ORDER BY quote_value_cents DESC`,...qb);
  const orders=await rows<{created_by:string;store_id:string;order_count:number;order_value_cents:number;collection_count:number;delivery_count:number}>(db,`
    SELECT so.created_by,so.store_id,COUNT(*) order_count,COALESCE(SUM(so.total_cents),0) order_value_cents,
    SUM(CASE WHEN so.fulfilment='collection' THEN 1 ELSE 0 END) collection_count,
    SUM(CASE WHEN so.fulfilment='delivery' THEN 1 ELSE 0 END) delivery_count
    FROM sales_orders so WHERE substr(so.created_at,1,10)>=? AND substr(so.created_at,1,10)<=?${os}${orderScope}
    GROUP BY so.created_by,so.store_id`,...ob);
  // Outstanding follow-ups: saved quotes >=3 days old, without a confirmed sales order.
  // This is a suggested SALES follow-up only, not proof of customer purchase intent.
  const cutoff=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
  const followupArgs:unknown[]=[from,to,cutoff];
  if(store)followupArgs.push(store);
  if(scope)followupArgs.push(u.id,u.id);
  const followups=await rows<{id:string;reference:string;customer_name:string;customer_phone:string;total_cents:number;created_at:string;store_name:string;created_by_name:string}>(db,`
    SELECT q.id,q.reference,q.customer_name,q.customer_phone,q.total_cents,q.created_at,s.name store_name,u.name created_by_name
    FROM quotations q JOIN stores s ON s.id=q.store_id JOIN users u ON u.id=q.created_by
    WHERE substr(q.created_at,1,10)>=? AND substr(q.created_at,1,10)<=?
      AND substr(q.created_at,1,10)<=? AND q.status='awaiting_payment'
      AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.quotation_id=q.id)${qs}${scope}
    ORDER BY q.created_at ASC LIMIT 75`,...followupArgs);
  const byKey=new Map<string,{created_by:string;consultant:string;store_id:string;store_name:string;quote_count:number;quote_value_cents:number;approved_discount_cents:number;order_count:number;order_value_cents:number;collection_count:number;delivery_count:number;conversion_percent:number}>();
  for(const q of quotes)byKey.set(q.created_by+'|'+q.store_id,{...q,order_count:0,order_value_cents:0,collection_count:0,delivery_count:0,conversion_percent:0});
  for(const o of orders){const key=o.created_by+'|'+o.store_id;let item=byKey.get(key);if(!item){const consultant=await db.prepare('SELECT name FROM users WHERE id=?').bind(o.created_by).first<{name:string}>();const storeRow=await db.prepare('SELECT name FROM stores WHERE id=?').bind(o.store_id).first<{name:string}>();item={created_by:o.created_by,consultant:consultant?.name||'Consultant',store_id:o.store_id,store_name:storeRow?.name||'Store',quote_count:0,quote_value_cents:0,approved_discount_cents:0,order_count:0,order_value_cents:0,collection_count:0,delivery_count:0,conversion_percent:0};byKey.set(key,item)}
    item.order_count=Number(o.order_count);item.order_value_cents=Number(o.order_value_cents);item.collection_count=Number(o.collection_count);item.delivery_count=Number(o.delivery_count)}
  const consultants=[...byKey.values()].map(x=>({...x,conversion_percent:x.quote_count?Math.round(x.order_count/x.quote_count*1000)/10:0}));
  const totals=consultants.reduce((a,x)=>({quote_count:a.quote_count+x.quote_count,quote_value_cents:a.quote_value_cents+x.quote_value_cents,order_count:a.order_count+x.order_count,order_value_cents:a.order_value_cents+x.order_value_cents,approved_discount_cents:a.approved_discount_cents+x.approved_discount_cents,collection_count:a.collection_count+x.collection_count,delivery_count:a.delivery_count+x.delivery_count}),{quote_count:0,quote_value_cents:0,order_count:0,order_value_cents:0,approved_discount_cents:0,collection_count:0,delivery_count:0});
  // Different metrics use the date of the corresponding event. Rates compare event counts
  // within the selected period; they are NOT a same-cohort conversion measurement.
  return json({from,to,store_id:store,totals,consultants,followups,followups_limited:followups.length===75,reporting_basis:'Quotes and orders by their own creation dates. No payment or revenue figures.'});
 }
 // Phase 2 Sales Desk handoff: immutable-priced order queued for Cash Office.
 // Sales staff do not accept payments, issue receipts or post stock movements.
 if(path==='/api/sales-orders'){
  if(req.method==='GET'){
   if(!['owner','manager','sales'].includes(u.role))return fail('Sales order access required',403);
   const sql='SELECT so.id,so.reference,so.quotation_id,so.quotation_reference,so.store_id,so.customer_name,so.customer_phone,so.total_cents,so.fulfilment,so.delivery_address,so.sales_note,so.requested_date,so.contact_name,so.contact_phone,so.fulfilment_updated_at,so.status,so.created_by,so.created_at,s.name store_name,creator.name created_by_name FROM sales_orders so JOIN stores s ON s.id=so.store_id JOIN users creator ON creator.id=so.created_by';
   const items=['owner','manager'].includes(u.role)
    ?await rows(db,sql+' ORDER BY so.created_at DESC LIMIT 200')
    :await rows(db,sql+' WHERE so.created_by=? AND EXISTS(SELECT 1 FROM user_stores us WHERE us.user_id=? AND us.store_id=so.store_id) ORDER BY so.created_at DESC LIMIT 200',u.id,u.id);
   return json({items});
  }
  if(req.method==='POST'){
   if(!['owner','manager','sales'].includes(u.role))return fail('Sales order access required',403);
   const b=await body(req),quotationId=clean(b.quotation_id,64),fulfilment=clean(b.fulfilment,24),deliveryAddress=clean(b.delivery_address,300),note=clean(b.sales_note,500);
   if(!quotationId||!['collection','delivery'].includes(fulfilment))return fail('Quotation and collection/delivery choice are required');
   if(fulfilment==='delivery' && deliveryAddress.length<5)return fail('Enter the delivery address');
   const q=await db.prepare('SELECT id,reference,store_id,customer_name,customer_phone,lines_json,total_cents,status,created_by,revision FROM quotations WHERE id=?').bind(quotationId).first<{id:string;reference:string;store_id:string;customer_name:string;customer_phone:string;lines_json:string;total_cents:number;status:string;created_by:string;revision:number}>();
   if(!q||!await scopedStore(db,u,q.store_id))return fail('Quotation not found',404);
   if(u.role==='sales' && q.created_by!==u.id)return fail('Only your own quotations can be sent to Cash Office',403);
   if(q.status!=='awaiting_payment')return fail('Only active quotations can be sent to Cash Office',409);
   if(await db.prepare('SELECT id FROM sales_orders WHERE quotation_id=?').bind(q.id).first())return fail('This quotation has already been sent to Cash Office',409);
   if(await db.prepare('SELECT id FROM cash_receipts WHERE quotation_id=?').bind(q.id).first())return fail('This quotation has already been paid',409);
   const id=uid(),ref=`SO-${Date.now().toString(36).toUpperCase()}-${id.slice(0,5).toUpperCase()}`;
   try{
    // Atomic snapshot: reject if a discount/revision changed since quote preview.
    const inserted=await db.prepare(`INSERT INTO sales_orders
      (id,reference,quotation_id,quotation_reference,quotation_revision,store_id,customer_name,customer_phone,lines_json,total_cents,fulfilment,delivery_address,sales_note,created_by,created_at)
      SELECT ?,?,q.id,q.reference,q.revision,q.store_id,q.customer_name,q.customer_phone,q.lines_json,q.total_cents,?,?,?,?,?
      FROM quotations q WHERE q.id=? AND q.status='awaiting_payment' AND q.total_cents=? AND q.revision=?
      AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.quotation_id=q.id)`)
      .bind(id,ref,fulfilment,fulfilment==='delivery'?deliveryAddress:'',note,u.id,now(),q.id,q.total_cents,q.revision||0).run();
    if(inserted.meta.changes!==1)return fail('Quotation changed; refresh before sending to Cash Office',409);
   }catch(e){
    if(await db.prepare('SELECT id FROM sales_orders WHERE quotation_id=?').bind(q.id).first())return fail('This quotation has already been sent to Cash Office',409);
    throw e;
   }
   await log(db,u.id,'send_to_cash_office','sales_order',id,JSON.stringify({reference:ref,quotation:q.reference,total_cents:q.total_cents,fulfilment}));
   return json({ok:true,id,reference:ref,status:'awaiting_cashier'},201);
  }
 }

 // Phase 5: sales-side collection/delivery coordination only; NEVER payment or dispatch release.
 const fulfilmentMatch=path.match(/^\/api\/sales-orders\/([^/]+)\/fulfilment$/);
 if(fulfilmentMatch){
  if(!['owner','manager','sales'].includes(u.role))return fail('Sales coordination access required',403);
  const orderId=fulfilmentMatch[1];
  const order=await db.prepare('SELECT id,store_id,created_by,fulfilment,status FROM sales_orders WHERE id=?').bind(orderId).first<{id:string;store_id:string;created_by:string;fulfilment:string;status:string}>();
  if(!order||!await scopedStore(db,u,order.store_id)||(u.role==='sales'&&order.created_by!==u.id))return fail('Sales order not found',404);
  if(req.method==='GET'){
   const details=await db.prepare('SELECT id,reference,quotation_reference,fulfilment,delivery_address,sales_note,requested_date,contact_name,contact_phone,status,fulfilment_updated_at FROM sales_orders WHERE id=?').bind(orderId).first();
   const history=await rows(db,'SELECT e.event_type,e.note,e.created_at,actor.name actor_name FROM sales_fulfilment_events e JOIN users actor ON actor.id=e.actor_id WHERE e.sales_order_id=? ORDER BY e.created_at DESC LIMIT 40',orderId);
   return json({order:details,history});
  }
  if(req.method==='POST'){
   if(order.status!=='awaiting_cashier')return fail('Order is no longer awaiting Cash Office. Contact management to amend fulfilment.',409);
   const b=await body(req),fulfilment=clean(b.fulfilment,24),deliveryAddress=clean(b.delivery_address,300),note=clean(b.sales_note,500),requestedDate=clean(b.requested_date,10),contactName=clean(b.contact_name,120),contactPhone=clean(b.contact_phone,50);
   if(!['collection','delivery'].includes(fulfilment))return fail('Select collection or delivery');
   if(fulfilment==='delivery'&&deliveryAddress.length<5)return fail('A delivery address is required');
   if(requestedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))return fail('Use a valid YYYY-MM-DD requested date');
   if(requestedDate){const date=new Date(requestedDate+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==requestedDate)return fail('Invalid requested date');}
   const stamp=now();
   const updated=await db.prepare("UPDATE sales_orders SET fulfilment=?,delivery_address=?,sales_note=?,requested_date=?,contact_name=?,contact_phone=?,fulfilment_updated_at=? WHERE id=? AND status='awaiting_cashier'")
    .bind(fulfilment,fulfilment==='delivery'?deliveryAddress:'',note,requestedDate||null,contactName,contactPhone,stamp,orderId).run();
   if(updated.meta.changes!==1)return fail('Order changed. Refresh and try again.',409);
   await db.prepare('INSERT INTO sales_fulfilment_events(id,sales_order_id,actor_id,event_type,note,created_at) VALUES(?,?,?,?,?,?)').bind(uid(),orderId,u.id,'instructions_updated',JSON.stringify({fulfilment,requested_date:requestedDate,note}),stamp).run();
   await log(db,u.id,'update_fulfilment','sales_order',orderId,`${fulfilment} ${requestedDate}`);
   return json({ok:true,status:'awaiting_cashier',payment_recorded:false,stock_deducted:false});
  }
 }
 // Phase 3: store-scoped customer directory; no payment or credit access.
 if(path==='/api/customers'){
  if(!['owner','manager','sales'].includes(u.role))return fail('Customer access required',403);
  if(req.method==='GET'){
   const store=clean(url.searchParams.get('store_id'),64),term=clean(url.searchParams.get('q'),80);
   if(!store||!await scopedStore(db,u,store))return fail('Store access required',403);
   const items=term
    ?await rows(db,'SELECT id,store_id,name,phone,email,notes FROM customers WHERE store_id=? AND active=1 AND (name LIKE ? OR phone LIKE ?) ORDER BY name LIMIT 50',store,`%${term}%`,`%${term}%`)
    :await rows(db,'SELECT id,store_id,name,phone,email,notes FROM customers WHERE store_id=? AND active=1 ORDER BY name LIMIT 100',store);
   return json({items});
  }
  if(req.method==='POST'){
   const b=await body(req),store=clean(b.store_id,64),name=clean(b.name,180),phone=clean(b.phone,50),email=clean(b.email,180),notes=clean(b.notes,300);
   if(!name||!store||!await scopedStore(db,u,store))return fail('Customer name and assigned store are required',403);
   if(email&&!/^\S+@\S+\.\S+$/.test(email))return fail('Invalid customer email');
   const id=uid();
   await db.prepare('INSERT INTO customers(id,store_id,name,phone,email,notes,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,store,name,phone,email,notes,u.id,now()).run();
   await log(db,u.id,'create','customer',id);
   return json({ok:true,id,name,phone},201);
  }
 }
 const customerHistory=path.match(/^\/api\/customers\/([^/]+)\/quotations$/);
 if(customerHistory&&req.method==='GET'){
  if(!['owner','manager','sales'].includes(u.role))return fail('Customer access required',403);
  const customer=await db.prepare('SELECT id,store_id,name FROM customers WHERE id=? AND active=1').bind(customerHistory[1]).first<{id:string;store_id:string;name:string}>();
  if(!customer||!await scopedStore(db,u,customer.store_id))return fail('Customer not found',404);
  const items=await rows(db,'SELECT q.id,q.reference,q.customer_name,q.total_cents,q.discount_cents,q.status,q.created_at FROM quotations q WHERE q.customer_id=? AND q.store_id=? ORDER BY q.created_at DESC LIMIT 50',customer.id,customer.store_id);
  return json({customer,items});
 }
 // Cash Office is the only module permitted to record payment. No stock movement occurs here.
 if(path==='/api/cash-office/payment'&&req.method==='POST'){
  if(!['owner','cashier'].includes(u.role))return fail('Cashier access required',403);
  const b=await body(req);
  const reference=clean(b.reference,100).toUpperCase(),store=clean(b.store_id,64),method=clean(b.method,20);
  const external=clean(b.external_reference,100),expected=Number(b.expected_total_cents),revision=Number(b.expected_revision),tendered=Number(b.tendered_cents);
  if(!/^Q-[A-Z0-9-]{5,90}$/.test(reference)||!store||!await scopedStore(db,u,store))return fail('Valid quotation and assigned store required',403);
  if(!['cash','card','eft'].includes(method))return fail('Choose cash, card or EFT');
  if(!Number.isSafeInteger(expected)||expected<=0||!Number.isSafeInteger(revision)||revision<0)return fail('Invalid quotation amount or revision');
  if(!Number.isSafeInteger(tendered)||tendered<expected||tendered>100000000000)return fail('Tendered amount cannot be below total');
  if(method!=='cash'&&(!external||external.length<4))return fail('Card or EFT confirmation reference is required');
  if(method!=='cash'&&tendered!==expected)return fail('Card or EFT amount must equal quotation total');
  const quote=await db.prepare('SELECT id,store_id,total_cents,revision,status FROM quotations WHERE UPPER(reference)=?').bind(reference).first<{id:string;store_id:string;total_cents:number;revision:number;status:string}>();
  if(!quote||quote.store_id!==store)return fail('Quotation not found at this store',404);
  if(quote.status!=='awaiting_payment')return fail('Only active quotations can be paid',409);
  if(quote.total_cents!==expected||quote.revision!==revision)return fail('Quotation total has changed. Refresh before payment',409);
  const existing=await db.prepare('SELECT id FROM cash_receipts WHERE quotation_id=?').bind(quote.id).first();
  if(existing)return fail('Quotation already paid. Reprint the existing receipt instead.',409);
  const id=uid(),receipt=`RC-${Date.now().toString(36).toUpperCase()}-${id.slice(0,6).toUpperCase()}`,paidAt=now();
  // SQL conditions and UNIQUE(quotation_id) prevent a second payment even with concurrent cashiers.
  try{
   const result=await db.prepare(`INSERT INTO cash_receipts(id,reference,quotation_id,quotation_reference,quotation_revision,store_id,amount_cents,method,tendered_cents,change_cents,external_reference,cashier_id,paid_at)
     SELECT ?,?,q.id,q.reference,q.revision,q.store_id,q.total_cents,?,?,?,?,?,?
     FROM quotations q WHERE q.id=? AND q.store_id=? AND q.status='awaiting_payment' AND q.total_cents=? AND q.revision=?
      AND NOT EXISTS(SELECT 1 FROM cash_receipts r WHERE r.quotation_id=q.id)`)
    .bind(id,receipt,method,tendered,tendered-expected,external,u.id,paidAt,quote.id,store,expected,revision).run();
   if(Number(result.meta?.changes||0)!==1)return fail('Quotation was changed or already paid. Refresh before retrying.',409);
  }catch(e){
   if(e instanceof Error&&/UNIQUE constraint failed/i.test(e.message))return fail('Quotation already paid. Reprint the existing receipt.',409);
   throw e;
  }
  await log(db,u.id,'cash_payment','cash_receipt',id,JSON.stringify({quotation:reference,store_id:store,method,amount_cents:expected}));
  return json({ok:true,receipt:{id,reference:receipt,quotation_reference:reference,amount_cents:expected,method,tendered_cents:tendered,change_cents:tendered-expected,paid_at:paidAt},stock_deducted:false},201);
 }
 if(path==='/api/cash-office/receipts'&&req.method==='GET'){
  if(!['owner','manager','cashier'].includes(u.role))return fail('Cash Office access required',403);
  const store=clean(url.searchParams.get('store_id'),64),date=clean(url.searchParams.get('date'),10);
  if(!store||!await scopedStore(db,u,store))return fail('Assigned store required',403);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail('Choose a valid date');
  const start=new Date(date+'T00:00:00+02:00');
  if(Number.isNaN(start.getTime()))return fail('Invalid date');
  const from=start.toISOString(),to=new Date(start.getTime()+86400000).toISOString();
  const items=await rows(db,`SELECT r.id,r.reference,r.quotation_reference,r.amount_cents,r.method,r.tendered_cents,r.change_cents,r.external_reference,r.paid_at,u.name cashier_name
    FROM cash_receipts r JOIN users u ON u.id=r.cashier_id WHERE r.store_id=? AND r.paid_at>=? AND r.paid_at<? AND (?='owner' OR r.cashier_id=?) ORDER BY r.paid_at DESC LIMIT 150`,store,from,to,u.role,u.id);
  const summary=await db.prepare(`SELECT COUNT(*) n,COALESCE(SUM(amount_cents),0) total_cents,
    COALESCE(SUM(CASE WHEN method='cash' THEN amount_cents ELSE 0 END),0) cash_cents,
    COALESCE(SUM(CASE WHEN method='card' THEN amount_cents ELSE 0 END),0) card_cents,
    COALESCE(SUM(CASE WHEN method='eft' THEN amount_cents ELSE 0 END),0) eft_cents
    FROM cash_receipts WHERE store_id=? AND paid_at>=? AND paid_at<? AND (?='owner' OR cashier_id=?)`).bind(store,from,to,u.role,u.id).first();
  return json({items,summary,basis:u.role==='owner'?'store':'own_cashier'});
 }
 if(path==='/api/cash-office/receipt'&&req.method==='GET'){
  if(!['owner','manager','cashier'].includes(u.role))return fail('Cash Office access required',403);
  const reference=clean(url.searchParams.get('reference'),100).toUpperCase();
  const item=await db.prepare(`SELECT r.*,q.customer_name,q.customer_phone,q.lines_json,s.name store_name,u.name cashier_name,
      creator.name consultant_name FROM cash_receipts r JOIN quotations q ON q.id=r.quotation_id
      JOIN stores s ON s.id=r.store_id JOIN users u ON u.id=r.cashier_id JOIN users creator ON creator.id=q.created_by WHERE r.reference=?`).bind(reference).first<{store_id:string;cashier_id:string}>();
  if(!item||!await scopedStore(db,u,item.store_id)||u.role==='cashier'&&item.cashier_id!==u.id)return fail('Receipt not found',404);
  return json({receipt:item});
 }
 // A cashier can retrieve ANY saved quote for their assigned store by the exact quotation number.
 // No manual handoff is required for visibility. This endpoint is deliberately READ-ONLY.
 if(path==='/api/cash-office/quotation'&&req.method==='GET'){
  if(!['owner','manager','cashier'].includes(u.role))return fail('Cash Office access required',403);
  const reference=clean(url.searchParams.get('reference'),100).toUpperCase();
  if(!/^Q-[A-Z0-9-]{5,90}$/.test(reference))return fail('Enter a complete quotation number');
  const q=await db.prepare(`SELECT q.id,q.reference,q.store_id,q.customer_name,q.customer_phone,q.lines_json,q.total_cents,q.original_total_cents,q.discount_cents,q.status,q.revision,q.created_at,
   s.name store_name, creator.name created_by_name, approver.name discount_by_name,
   so.reference sales_order_reference,so.status sales_order_status,so.fulfilment,so.delivery_address, cr.reference receipt_reference,cr.paid_at,cr.method paid_method
   FROM quotations q JOIN stores s ON s.id=q.store_id JOIN users creator ON creator.id=q.created_by
   LEFT JOIN users approver ON approver.id=q.discount_by LEFT JOIN sales_orders so ON so.quotation_id=q.id LEFT JOIN cash_receipts cr ON cr.quotation_id=q.id
   WHERE UPPER(q.reference)=?`).bind(reference).first<{store_id:string;status:string;sales_order_reference:string|null;receipt_reference:string|null}>();
  if(!q||!await scopedStore(db,u,q.store_id))return fail('Quotation not found at your assigned store',404);
  return json({quotation:q,payment_recorded:!!q.receipt_reference,cash_office_status:q.receipt_reference?'paid':q.status==='cancelled'?'cancelled':q.sales_order_reference?'awaiting_cashier':'awaiting_customer'});
 }
 // Searchable lookup list for cashier queue. Includes ALL quotes (even without a sales order).
 if(path==='/api/cash-office/quotations'&&req.method==='GET'){
  if(!['owner','manager','cashier'].includes(u.role))return fail('Cash Office access required',403);
  const store=clean(url.searchParams.get('store_id'),64),query=clean(url.searchParams.get('q'),80);
  if(!store||!await scopedStore(db,u,store))return fail('Store access required',403);
  const pattern=`%${query}%`;
  const items=await rows(db,`SELECT q.id,q.reference,q.customer_name,q.total_cents,q.discount_cents,q.status,q.created_at, creator.name created_by_name
   FROM quotations q JOIN users creator ON creator.id=q.created_by
   WHERE q.store_id=? AND (q.reference LIKE ? OR q.customer_name LIKE ?) ORDER BY q.created_at DESC LIMIT 100`,store,pattern,pattern);
  return json({items});
 }
 if(path==='/api/quotations'){
  if(req.method==='GET'){
   const columns='q.*,s.name store_name,creator.name created_by_name,approver.name discount_by_name';
   const joins=' FROM quotations q JOIN stores s ON s.id=q.store_id JOIN users creator ON creator.id=q.created_by LEFT JOIN users approver ON approver.id=q.discount_by';
   const items=['owner','manager'].includes(u.role)
    ?await rows(db,'SELECT '+columns+joins+' ORDER BY q.created_at DESC LIMIT 200')
    :await rows(db,'SELECT '+columns+joins+' WHERE q.created_by=? AND EXISTS(SELECT 1 FROM user_stores us WHERE us.user_id=? AND us.store_id=q.store_id) ORDER BY q.created_at DESC LIMIT 200',u.id,u.id);
   return json({items});
  }
  if(req.method==='POST'&&permission(u.role,'quotations','write')){const b=await body(req),store=clean(b.store_id,60),name=clean(b.customer_name,180),customerId=clean(b.customer_id,64),lines=b.lines;if(!name||!await scopedStore(db,u,store)||!validLines(lines))return fail('Store, customer and at least one item required');if(customerId){const c=await db.prepare('SELECT id FROM customers WHERE id=? AND store_id=? AND active=1').bind(customerId,store).first();if(!c)return fail('Customer not found at assigned store',404)}const arr=lines as {sku:string;qty:number}[],snap=[] as {sku:string;name:string;qty:number;unit_price_cents:number;line_total_cents:number}[];let total=0;for(const l of arr){const p=await db.prepare('SELECT sku,name,price_cents FROM products WHERE sku=? AND active=1').bind(l.sku.trim()).first<{sku:string;name:string;price_cents:number}>();if(!p) return fail(`SKU not found: ${l.sku}`);const lineTotal=p.price_cents*l.qty;if(!Number.isSafeInteger(lineTotal))return fail('Amount too large');total+=lineTotal;snap.push({sku:p.sku,name:p.name,qty:l.qty,unit_price_cents:p.price_cents,line_total_cents:lineTotal})}if(!validMoney(total))return fail('Amount too large');const id=uid(),ref=`Q-${Date.now().toString(36).toUpperCase()}-${id.slice(0,5).toUpperCase()}`;await db.prepare('INSERT INTO quotations(id,reference,store_id,customer_name,customer_phone,lines_json,total_cents,created_by,created_at,customer_id) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,ref,store,name,clean(b.customer_phone,50),JSON.stringify(snap),total,u.id,now(),customerId||null).run();await log(db,u.id,'create','quotation',id,ref);return json({ok:true,id,reference:ref,total_cents:total},201)}
 }
 if(path==='/api/tasks'){
  if(req.method==='GET'){return json({items:['owner','manager'].includes(u.role)?await rows(db,'SELECT * FROM tasks ORDER BY created_at DESC LIMIT 200'):await rows(db,'SELECT t.* FROM tasks t WHERE t.store_id IS NULL OR EXISTS(SELECT 1 FROM user_stores us WHERE us.user_id=? AND us.store_id=t.store_id) ORDER BY created_at DESC LIMIT 200',u.id)})}
  if(req.method==='POST'&&permission(u.role,'tasks','write')){const b=await body(req),title=clean(b.title,160),store=clean(b.store_id,60);if(!title||(store&&!await scopedStore(db,u,store)))return fail('Title and assigned store required');const id=uid();await db.prepare('INSERT INTO tasks(id,store_id,title,details,priority,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,store||null,title,clean(b.details,1000),['low','normal','high'].includes(String(b.priority))?b.priority:'normal',u.id,now()).run();await log(db,u.id,'create','task',id);return json({ok:true,id},201)}
 }
 const taskUpdate=path.match(/^\/api\/tasks\/([^/]+)\/status$/);if(taskUpdate&&req.method==='POST'&&permission(u.role,'tasks','write')){const b=await body(req),status=clean(b.status,20);if(!['open','in_progress','done'].includes(status))return fail('Invalid status');const t=await db.prepare('SELECT store_id FROM tasks WHERE id=?').bind(taskUpdate[1]).first<{store_id:string|null}>();if(!t||(t.store_id&&!await scopedStore(db,u,t.store_id)))return fail('Task not found',404);await db.prepare('UPDATE tasks SET status=? WHERE id=?').bind(status,taskUpdate[1]).run();await log(db,u.id,'update','task',taskUpdate[1],status);return json({ok:true})}
 if(path==='/api/audit'&&req.method==='GET'&&['owner','manager'].includes(u.role))return json({items:await rows(db,'SELECT a.*,u.name actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 150')});
 return fail('Not found or not permitted',404);
 }catch(e){
  const m=e instanceof Error?e.message:String(e);
  const type=e instanceof Error?e.name:'UnknownError';
  if(path==='/api/setup'){
   // Do not log submitted fields, credentials, raw SQL or setup tokens.
   console.error('SULMOS26_SETUP_UNHANDLED',type);
   return fail('Owner setup failed unexpectedly (SETUP_UNHANDLED). Check Cloudflare Worker live logs.',503);
  }
  if(/UNIQUE constraint failed/i.test(m))return fail('That code or email already exists',409);
  if(m.includes('JSON'))return fail('Invalid request format');
  return fail('Request could not be completed',500);
 }
}} satisfies ExportedHandler<Env>;
