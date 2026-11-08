/* SULMOS26 Dispatch Desk Phase 1: READ ONLY payment-verified fulfilment preparation.
   Runs as its own Worker with a shared D1 database; no changes to the Hub backend.
*/
interface Env {DB:D1Database; ASSETS:Fetcher}
type User={id:string;name:string;username:string|null;role:string;active:number};
const enc=new TextEncoder();
const json=(data:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const fail=(msg:string,status=400)=>json({error:msg},status);
const now=()=>new Date().toISOString();
const clean=(value:unknown,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const hex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
async function hash(s:string){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
async function passwordHash(pass:string,salt:string){let material:ArrayBuffer=enc.encode(pass).buffer as ArrayBuffer;for(let round=0;round<6;round++){const k=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);material=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(`sulmos26:v2:${round}:${salt}`),iterations:100000,hash:'SHA-256'},k,256)}return 'v2$'+hex(material)}
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
function cookie(value:string){return `sulmos_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`}
const expired='sulmos_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
function originOk(request:Request){const origin=request.headers.get('origin');return (!origin||origin===new URL(request.url).origin)&&(!request.headers.get('sec-fetch-site')||['same-origin','none'].includes(request.headers.get('sec-fetch-site')!))}
async function auth(req:Request,db:D1Database):Promise<User|null>{const token=req.headers.get('cookie')?.match(/(?:^|;\s*)sulmos_session=([a-f0-9]{64})/)?.[1];if(!token)return null;return await db.prepare('SELECT u.id,u.name,u.username,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(await hash(token),now()).first<User>()}
const dispatchRole=(u:User|null)=>!!u&&['owner','manager','dispatch'].includes(u.role);
async function storeAccess(db:D1Database,u:User,id:string){const store=await db.prepare('SELECT id FROM stores WHERE id=? AND active=1').bind(id).first();if(!store)return false;if(['owner','manager'].includes(u.role))return true;return !!await db.prepare('SELECT 1 FROM user_stores WHERE store_id=? AND user_id=?').bind(id,u.id).first()}
export default {async fetch(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url),path=url.pathname,db=env.DB;
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(req.method!=='GET'&&(!originOk(req)||!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')))return fail('Invalid request origin or content type',403);
 try{
  if(path==='/api/session'&&req.method==='GET'){const u=await auth(req,db);return json({user:dispatchRole(u)?u:null,role_restricted:!!u&&!dispatchRole(u)})}
  if(path==='/api/login'&&req.method==='POST'){
   const b=await req.json() as Record<string,unknown>,identifier=clean(b.username||b.email,180).toLowerCase(),pass=clean(b.password,200);
   if(!identifier||!pass)return fail('Enter username and password');
   const key=await hash('login:'+identifier),attempt=await db.prepare('SELECT attempts,blocked_until FROM login_attempts WHERE identifier=?').bind(key).first<{attempts:number;blocked_until:string|null}>();
   if(attempt?.blocked_until&&attempt.blocked_until>now())return fail('Too many attempts. Try again later.',429);
   const u=await db.prepare('SELECT * FROM users WHERE (username=? OR email=?) AND active=1').bind(identifier,identifier).first<User & {password_salt:string;password_hash:string}>();
   const calculated=await passwordHash(pass,u?.password_salt||'unregistered_salt');
   if(!u||calculated!==u.password_hash){const n=(attempt?.attempts||0)+1;await db.prepare('INSERT INTO login_attempts(identifier,attempts,blocked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(identifier) DO UPDATE SET attempts=excluded.attempts,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at').bind(key,n,n>=6?new Date(Date.now()+900000).toISOString():null,now()).run();return fail('Invalid username or password',401)}
   await db.prepare('DELETE FROM login_attempts WHERE identifier=?').bind(key).run();
   if(!dispatchRole(u))return fail('Dispatch Desk access only. Ask your owner to assign the Dispatch role.',403);
   const token=randomToken();await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await hash(token),u.id,new Date(Date.now()+43200000).toISOString(),now()).run();
   return json({ok:true,user:{id:u.id,name:u.name,username:u.username,role:u.role}},200,{'set-cookie':cookie(token)});
  }
  if(path==='/api/logout'&&req.method==='POST'){
   const token=req.headers.get('cookie')?.match(/(?:^|;\s*)sulmos_session=([a-f0-9]{64})/)?.[1];if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();return json({ok:true},200,{'set-cookie':expired});
  }
  const user=await auth(req,db);
  if(!user)return fail('Sign in required',401);
  if(!dispatchRole(user))return fail('Dispatch Desk access only',403);
  if(path==='/api/stores'&&req.method==='GET'){
   const query=['owner','manager'].includes(user.role)?'SELECT id,name,code FROM stores WHERE active=1 ORDER BY name':'SELECT s.id,s.name,s.code FROM stores s JOIN user_stores us ON us.store_id=s.id WHERE s.active=1 AND us.user_id=? ORDER BY s.name';
   const result=['owner','manager'].includes(user.role)?await db.prepare(query).all():await db.prepare(query).bind(user.id).all();
   return json({items:result.results||[]});
  }
  if(path==='/api/dispatch/queue'&&req.method==='GET'){
   const store=clean(url.searchParams.get('store_id'),64);
   if(!store||!await storeAccess(db,user,store))return fail('Assigned store required',403);
   // A cash receipt is the only permitted proof of payment in this phase.
   // No paid receipt = no item in the verified dispatch queue.
   const result=await db.prepare(`SELECT cr.reference receipt_reference,cr.paid_at,cr.amount_cents,cr.quotation_reference,
     q.customer_name,q.customer_phone,q.lines_json,
     so.reference sales_order_reference,so.fulfilment,so.delivery_address,so.requested_date,so.contact_name,so.contact_phone,so.sales_note,
     consultant.name consultant_name
     FROM cash_receipts cr JOIN quotations q ON q.id=cr.quotation_id
     JOIN users consultant ON consultant.id=q.created_by
     LEFT JOIN sales_orders so ON so.quotation_id=q.id
     WHERE cr.store_id=? ORDER BY cr.paid_at DESC LIMIT 200`).bind(store).all();
   const items=result.results||[];
   return json({items,summary:{paid_orders:items.length,collection:items.filter((x:any)=>x.fulfilment==='collection').length,delivery:items.filter((x:any)=>x.fulfilment==='delivery').length,needs_instructions:items.filter((x:any)=>!x.fulfilment).length},read_only:true,stock_deducted:false,release_enabled:false});
  }
  return fail('Endpoint not available in Dispatch Desk',404);
 }catch(e){console.error('SULMOS26_DISPATCH_ERROR',e instanceof Error?e.name:'unknown');return fail('Request could not be completed. Check the Dispatch deployment and database permissions.',500)}
}};
