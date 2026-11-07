import {ROLES, DOC_TYPES, permission, validLines, validMoney, canApprove} from './logic.mjs';
interface Env { DB: D1Database; ASSETS: Fetcher; SULMOS26_SETUP_TOKEN?: string }
type User = {id:string;name:string;email:string;role:string;active:number};
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
async function auth(req:Request,db:D1Database):Promise<User|null>{const token=req.headers.get('cookie')?.match(/(?:^|;\s*)sulmos_session=([a-f0-9]{64})/)?.[1];if(!token)return null;const digest=await hash(token);return await db.prepare("SELECT u.id,u.name,u.email,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1").bind(digest,now()).first<User>()}
async function body(req:Request){if(!req.headers.get('content-type')?.toLowerCase().includes('application/json'))throw Error('JSON content type required');const raw=await req.text();if(raw.length>500000)throw Error('Payload too large');return JSON.parse(raw) as Record<string,unknown>}
async function log(db:D1Database,who:string|null,action:string,entity:string,id:string,details=''){await db.prepare('INSERT INTO audit_log(id,actor_id,action,entity,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid(),who,action,entity,id,details.slice(0,1000),now()).run()}
async function scopedStore(db:D1Database,u:User,storeId:string){const store=await db.prepare('SELECT id FROM stores WHERE id=? AND active=1').bind(storeId).first();if(!store)return false;if(['owner','manager'].includes(u.role))return true;return !!await db.prepare('SELECT 1 FROM user_stores WHERE user_id=? AND store_id=?').bind(u.id,storeId).first()}
async function rows<T>(db:D1Database,query:string,...params:unknown[]){return (await db.prepare(query).bind(...params).all<T>()).results}
async function createSession(db:D1Database,userId:string,req:Request){const token=rand();await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await hash(token),userId,new Date(Date.now()+43200000).toISOString(),now()).run();return {'set-cookie':cookie(token,new URL(req.url).protocol==='https:')}}
const summary=(r:Record<string,unknown>)=>r;
export default {async fetch(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url);const path=url.pathname;
 // Read-only version marker, independent of D1 and any owner credentials.
 // If this URL returns 404, the diagnostic build was not deployed to this Worker.
 if(path==='/api/version' && req.method==='GET')return json({application:'Sulmos26 Retail Hub',version:'V7-SETUP-DIAGNOSTICS'});
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(req.method!=='GET' && (!guardOrigin(req)||req.headers.get('content-type')?.split(';')[0]!=='application/json'))return fail('Request blocked: invalid origin or content type',403);
 try{
 const db=env.DB;
 if(path==='/api/session' && req.method==='GET'){const owner=await db.prepare('SELECT id FROM users LIMIT 1').first();if(!owner)return json({setup:true,user:null});const u=await auth(req,db);return json({setup:false,user:u||null});}
 if(path==='/api/setup' && req.method==='POST'){
  if(!validSetupToken(req.headers.get('x-sulmos26-setup-token'),env.SULMOS26_SETUP_TOKEN))
   return fail('Owner setup is locked. Check the private installation key supplied by your Sulmos26 administrator.',403);
  const b=await body(req);const business=clean(b.business,120),name=clean(b.name,100),email=clean(b.email,180).toLowerCase(),pass=clean(b.password,200);
  if(!business||!name||!/^\S+@\S+\.\S+$/.test(email)||pass.length<12)return fail('Business name, owner name, valid email, and password of at least 12 characters are required');
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
   db.prepare('INSERT INTO users(id,name,email,password_salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)').bind('owner',name,email,salt,hashPass,'owner',timestamp),
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
   return json({ok:true,user:{id:'owner',name,email,role:'owner'}},201,headers);
  }catch(e){
   console.error('SULMOS26_SETUP_SESSION',e instanceof Error?e.name:'unknown');
   return fail('The owner was saved, but automatic sign-in failed (SETUP_SESSION). Refresh the page and try signing in.',503);
  }
 }
 if(path==='/api/login' && req.method==='POST'){
  const b=await body(req),email=clean(b.email,180).toLowerCase(),pass=clean(b.password,200);
  const key=await hash('login:'+email);const attempt=await db.prepare('SELECT attempts,blocked_until FROM login_attempts WHERE identifier=?').bind(key).first<{attempts:number;blocked_until:string|null}>();
  if(attempt?.blocked_until && attempt.blocked_until>now())return fail('Too many attempts. Try again later.',429);
  const user=await db.prepare('SELECT * FROM users WHERE email=? AND active=1').bind(email).first<User & {password_hash:string;password_salt:string}>();
  const actual=await passwordHash(pass,user?.password_salt||'unregistered_salt'),good=!!user&&actual===user.password_hash;
  if(!good){const count=(attempt?.attempts||0)+1;const block=count>=6?new Date(Date.now()+15*60000).toISOString():null;await db.prepare('INSERT INTO login_attempts(identifier,attempts,blocked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(identifier) DO UPDATE SET attempts=excluded.attempts,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at').bind(key,count,block,now()).run();return fail('Invalid email or password',401)}
  await db.prepare('DELETE FROM login_attempts WHERE identifier=?').bind(key).run();
  return json({ok:true,user:{id:user.id,name:user.name,email:user.email,role:user.role}},200,await createSession(db,user.id,req));
 }
 if(path==='/api/logout' && req.method==='POST'){
  const token=req.headers.get('cookie')?.match(/(?:^|;\s*)sulmos_session=([a-f0-9]{64})/)?.[1];if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();return json({ok:true},200,{'set-cookie':expiredCookie(url.protocol==='https:')});
 }
 const u=await auth(req,db);if(!u)return fail('Sign in required',401);
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
 if(path==='/api/products'){
  if(req.method==='GET'){const q=clean(url.searchParams.get('q')||'',80);const items=q?await rows(db,'SELECT * FROM products WHERE sku LIKE ? OR name LIKE ? ORDER BY name LIMIT 200',`%${q}%`,`%${q}%`):await rows(db,'SELECT * FROM products ORDER BY name LIMIT 200');return json({items})}
  if(req.method==='POST'&&permission(u.role,'products','write')){const b=await body(req),name=clean(b.name,180),sku=clean(b.sku,100).toUpperCase(),price=Number(b.price_cents),cost=Number(b.cost_cents||0);if(!name||!sku||!validMoney(price)||!validMoney(cost))return fail('Valid SKU, name, and non-negative prices are required');const id=uid();await db.prepare('INSERT INTO products(id,sku,name,category,description,price_cents,cost_cents,barcode,image_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,sku,name,clean(b.category,80),clean(b.description,1000),price,cost,clean(b.barcode,80),clean(b.image_url,500),now()).run();await log(db,u.id,'create','product',id,sku);return json({ok:true,id},201)}
 }
 if(path==='/api/users'){
  if(req.method==='GET'&&['owner','manager'].includes(u.role))return json({items:await rows(db,'SELECT id,name,email,role,active,created_at FROM users ORDER BY created_at'),assignments:await rows(db,'SELECT user_id,store_id FROM user_stores')});
  if(req.method==='POST'&&u.role==='owner'){const b=await body(req),name=clean(b.name,100),email=clean(b.email,180).toLowerCase(),pass=clean(b.password,200),role=clean(b.role,30),stores=Array.isArray(b.store_ids)?b.store_ids.filter(x=>typeof x==='string').slice(0,50) as string[]:[];if(!name||!/^\S+@\S+\.\S+$/.test(email)||pass.length<12||!ROLES.includes(role)||role==='owner')return fail('Employee name, email, 12-character password, and staff role required');const id=uid(),salt=rand(16);const stmts=[db.prepare('INSERT INTO users(id,name,email,password_salt,password_hash,role,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,name,email,salt,await passwordHash(pass,salt),role,now())];for(const sid of stores)stmts.push(db.prepare('INSERT INTO user_stores(user_id,store_id) SELECT ?,id FROM stores WHERE id=?').bind(id,sid));await db.batch(stmts);await log(db,u.id,'create','user',id,role);return json({ok:true,id},201)}
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
 if(path==='/api/quotations'){
  if(req.method==='GET'){const items=['owner','manager'].includes(u.role)?await rows(db,'SELECT q.*,s.name store_name FROM quotations q JOIN stores s ON s.id=q.store_id ORDER BY q.created_at DESC LIMIT 200'):await rows(db,'SELECT q.*,s.name store_name FROM quotations q JOIN stores s ON s.id=q.store_id JOIN user_stores us ON us.store_id=q.store_id WHERE us.user_id=? ORDER BY q.created_at DESC LIMIT 200',u.id);return json({items})}
  if(req.method==='POST'&&permission(u.role,'quotations','write')){const b=await body(req),store=clean(b.store_id,60),name=clean(b.customer_name,180),lines=b.lines;if(!name||!await scopedStore(db,u,store)||!validLines(lines))return fail('Store, customer and at least one item required');const arr=lines as {sku:string;qty:number}[],snap=[] as {sku:string;name:string;qty:number;unit_price_cents:number;line_total_cents:number}[];let total=0;for(const l of arr){const p=await db.prepare('SELECT sku,name,price_cents FROM products WHERE sku=? AND active=1').bind(l.sku.trim()).first<{sku:string;name:string;price_cents:number}>();if(!p) return fail(`SKU not found: ${l.sku}`);const lineTotal=p.price_cents*l.qty;if(!Number.isSafeInteger(lineTotal))return fail('Amount too large');total+=lineTotal;snap.push({sku:p.sku,name:p.name,qty:l.qty,unit_price_cents:p.price_cents,line_total_cents:lineTotal})}if(!validMoney(total))return fail('Amount too large');const id=uid(),ref=`Q-${Date.now().toString(36).toUpperCase()}-${id.slice(0,5).toUpperCase()}`;await db.prepare('INSERT INTO quotations(id,reference,store_id,customer_name,customer_phone,lines_json,total_cents,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,ref,store,name,clean(b.customer_phone,50),JSON.stringify(snap),total,u.id,now()).run();await log(db,u.id,'create','quotation',id,ref);return json({ok:true,id,reference:ref,total_cents:total},201)}
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
