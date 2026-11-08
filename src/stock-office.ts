/* SULMOS26 Stock Office: separate authenticated back-office inventory desk.
   Uses shared D1, existing inventory ledger and independent approval controls. */
interface Env {DB:D1Database;ASSETS:Fetcher}
type User={id:string;name:string;username:string|null;role:string;active:number};
const enc=new TextEncoder();
const json=(v:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const fail=(reason:string,status=400)=>json({error:reason},status);
const now=()=>new Date().toISOString();
const clean=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const hex=(buf:ArrayBuffer)=>[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function hash(s:string){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
async function passwordHash(p:string,salt:string){let x:ArrayBuffer=enc.encode(p).buffer as ArrayBuffer;for(let i=0;i<6;i++){const k=await crypto.subtle.importKey('raw',x,'PBKDF2',false,['deriveBits']);x=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(`sulmos26:v2:${i}:${salt}`),iterations:100000,hash:'SHA-256'},k,256)}return 'v2$'+hex(x)}
const randomToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
const cookie=(token:string)=>`sulmos_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
const expired=cookie('')+'; Max-Age=0';
const originOk=(r:Request)=>!r.headers.get('origin')||r.headers.get('origin')===new URL(r.url).origin;
async function auth(req:Request,db:D1Database){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)sulmos_session=([a-f0-9]{64})/)?.[1];if(!token)return null;return db.prepare('SELECT u.id,u.name,u.username,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(await hash(token),now()).first<User>()}
const allowed=(u:User|null)=>!!u&&['owner','manager','stock'].includes(u.role);
const canReview=(u:User)=>['owner','manager'].includes(u.role);
async function scope(db:D1Database,u:User,store:string){if(!store)return false;const row=await db.prepare('SELECT id FROM stores WHERE id=? AND active=1').bind(store).first();if(!row)return false;if(canReview(u))return true;return !!await db.prepare('SELECT 1 FROM user_stores WHERE user_id=? AND store_id=?').bind(u.id,store).first()}
async function rows(db:D1Database,q:string,...params:unknown[]){const r=await db.prepare(q).bind(...params).all();return r.results||[]}
function explainError(e:unknown){const message=e instanceof Error?e.message:'';if(message.includes('STOCK_COUNT_STALE'))return 'Stock changed since this count was recorded. Start a new count with updated balances.';if(message.includes('STOCK_COUNT_BELOW_RESERVATIONS'))return 'Count is below reserved stock. Review reservations before approval.';if(message.includes('STOCK_INSUFFICIENT'))return 'Not enough stock to post this adjustment.';if(message.includes('STOCK_APPROVAL_REQUIRES'))return 'A different manager or owner must approve the submitted document.';if(message.includes('STOCK_DOCUMENT_LOCKED'))return 'This stock document is locked.';if(message.includes('UNIQUE'))return 'Document was already posted or the reference exists.';return 'Stock operation could not be completed. Check migration 0012 and Worker logs.'}
export default {async fetch(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url),path=url.pathname,db=env.DB;
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(req.method!=='GET'&&(!originOk(req)||!req.headers.get('content-type')?.startsWith('application/json')))return fail('Invalid origin or content type',403);
 try{
  if(path==='/api/session'&&req.method==='GET'){const user=await auth(req,db);return json({user:allowed(user)?user:null,role_restricted:!!user&&!allowed(user)})}
  if(path==='/api/login'&&req.method==='POST'){
   const data=await req.json() as Record<string,unknown>,name=clean(data.username||data.email,180).toLowerCase(),pass=clean(data.password,200);
   if(!name||!pass)return fail('Username and password required');
   const key=await hash('login:'+name),attempt=await db.prepare('SELECT attempts,blocked_until FROM login_attempts WHERE identifier=?').bind(key).first<{attempts:number;blocked_until:string|null}>();
   if(attempt?.blocked_until&&attempt.blocked_until>now())return fail('Too many attempts. Try again later.',429);
   const user=await db.prepare('SELECT * FROM users WHERE (username=? OR email=?) AND active=1').bind(name,name).first<User&{password_salt:string;password_hash:string}>();
   const calculated=await passwordHash(pass,user?.password_salt||'unregistered_salt');
   if(!user||calculated!==user.password_hash){const count=(attempt?.attempts||0)+1;await db.prepare('INSERT INTO login_attempts(identifier,attempts,blocked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(identifier) DO UPDATE SET attempts=excluded.attempts,blocked_until=excluded.blocked_until,updated_at=excluded.updated_at').bind(key,count,count>=6?new Date(Date.now()+900000).toISOString():null,now()).run();return fail('Invalid username or password',401)}
   await db.prepare('DELETE FROM login_attempts WHERE identifier=?').bind(key).run();
   if(!allowed(user))return fail('Stock Office permission required',403);
   const token=randomToken();await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await hash(token),user.id,new Date(Date.now()+43200000).toISOString(),now()).run();
   return json({ok:true,user:{id:user.id,name:user.name,role:user.role}},200,{'set-cookie':cookie(token)});
  }
  if(path==='/api/logout'&&req.method==='POST'){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)sulmos_session=([a-f0-9]{64})/)?.[1];if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();return json({ok:true},200,{'set-cookie':expired})}
  const user=await auth(req,db);if(!user)return fail('Sign in required',401);if(!allowed(user))return fail('Stock Office only',403);
  if(path==='/api/stores'&&req.method==='GET'){
   const items=canReview(user)?await rows(db,'SELECT id,name,code FROM stores WHERE active=1 ORDER BY name'):await rows(db,'SELECT s.id,s.name,s.code FROM stores s JOIN user_stores us ON us.store_id=s.id WHERE us.user_id=? AND s.active=1 ORDER BY s.name',user.id);
   return json({items});
  }
  if(path==='/api/stock/products'&&req.method==='GET'){
   const store=clean(url.searchParams.get('store_id'),60),q=clean(url.searchParams.get('q'),100);
   if(!await scope(db,user,store))return fail('Assigned store required',403);
   const items=await rows(db,`SELECT p.sku,p.name,p.barcode,p.category,b.on_hand,b.updated_at,
    COALESCE((SELECT SUM(sr.qty) FROM stock_requests sr WHERE sr.sku=p.sku AND sr.store_id=? AND sr.kind='reservation' AND sr.status='approved'),0) reserved
    FROM products p LEFT JOIN inventory_balances b ON b.sku=p.sku AND b.store_id=? WHERE p.active=1
    AND (?='' OR UPPER(p.sku) LIKE '%'||UPPER(?)||'%' OR UPPER(p.name) LIKE '%'||UPPER(?)||'%' OR p.barcode LIKE '%'||?||'%') ORDER BY p.name LIMIT 1000`,store,store,q,q,q,q);
   return json({items:items.map((x:any)=>({...x,recorded:x.on_hand!==null,available:x.on_hand===null?null:Math.max(0,Number(x.on_hand)-Number(x.reserved))}))});
  }
  if(path==='/api/stock/movements'&&req.method==='GET'){
   const store=clean(url.searchParams.get('store_id'),60),sku=clean(url.searchParams.get('sku'),100).toUpperCase();
   if(!await scope(db,user,store))return fail('Assigned store required',403);
   return json({items:await rows(db,`SELECT m.id,m.sku,p.name,m.qty_delta,m.reason,m.source_id,m.created_at,u.name actor,
    d.kind document_kind,d.reference document_reference FROM inventory_movements m
    JOIN products p ON p.sku=m.sku LEFT JOIN users u ON u.id=m.actor_id
    LEFT JOIN stock_office_documents d ON d.id=m.source_id
    WHERE m.store_id=? AND (?='' OR m.sku=?) ORDER BY m.created_at DESC LIMIT 300`,store,sku,sku)});
  }
  if(path==='/api/stock/documents'&&req.method==='GET'){
   const store=clean(url.searchParams.get('store_id'),60);
   if(!await scope(db,user,store))return fail('Assigned store required',403);
   return json({items:await rows(db,`SELECT d.*,creator.name creator_name,reviewer.name reviewer_name FROM stock_office_documents d JOIN users creator ON creator.id=d.created_by LEFT JOIN users reviewer ON reviewer.id=d.reviewed_by WHERE d.store_id=? ORDER BY d.created_at DESC LIMIT 150`,store)});
  }
  if(path==='/api/stock/documents'&&req.method==='POST'){
   const data=await req.json() as Record<string,unknown>,kind=clean(data.kind,20),store=clean(data.store_id,60),raw=data.lines;
   if(!await scope(db,user,store))return fail('Assigned store required',403);
   if(!['grv','count'].includes(kind)||!Array.isArray(raw)||raw.length<1||raw.length>100)return fail('GRV or count requires 1–100 products');
   const supplied=raw as Record<string,unknown>[];
   const parsed=supplied.map(x=>({sku:clean(x.sku,100).toUpperCase(),qty:Number(x.qty)}));
   if(parsed.some(x=>!x.sku||!Number.isSafeInteger(x.qty)||x.qty<0||x.qty>1000000||(kind==='grv'&&x.qty===0))||new Set(parsed.map(x=>x.sku)).size!==parsed.length)return fail('Invalid or duplicate SKU/quantity');
   const supplier=clean(data.supplier,180),supplier_document=clean(data.supplier_document,100),note=clean(data.note,1000);
   if(kind==='grv'&&(!supplier||!supplier_document))return fail('Supplier and supplier document number are required for a GRV');
   const lines=[];
   for(const entry of parsed){
    const p=await db.prepare('SELECT sku FROM products WHERE sku=? AND active=1').bind(entry.sku).first();
    if(!p)return fail('Product SKU not found: '+entry.sku,404);
    const balance=await db.prepare('SELECT on_hand FROM inventory_balances WHERE store_id=? AND sku=?').bind(store,entry.sku).first<{on_hand:number}>();
    if(kind==='count'&&!balance)return fail('Stock count requires an existing recorded balance for '+entry.sku+'. Manager must enter opening stock first.',409);
    lines.push(kind==='count'?{...entry,expected:Number(balance!.on_hand)}:entry);
   }
   const id=crypto.randomUUID(),reference='SO-'+kind.toUpperCase()+'-'+Date.now().toString(36).toUpperCase()+'-'+id.slice(0,5).toUpperCase();
   await db.prepare('INSERT INTO stock_office_documents(id,reference,kind,store_id,supplier,supplier_document,note,lines_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,reference,kind,store,supplier,supplier_document,note,JSON.stringify(lines),user.id,now()).run();
   return json({ok:true,id,reference,status:'draft'},201);
  }
  const action=path.match(/^\/api\/stock\/documents\/([^/]+)\/(submit|approve|reject)$/);
  if(action&&req.method==='POST'){
   const [,id,decision]=action;
   const d=await db.prepare('SELECT id,store_id,status,created_by FROM stock_office_documents WHERE id=?').bind(id).first<{id:string;store_id:string;status:string;created_by:string}>();
   if(!d||!await scope(db,user,d.store_id))return fail('Document not found',404);
   if(decision==='submit'){
    if(d.status!=='draft'||d.created_by!==user.id)return fail('Only the creator may submit their draft',403);
    const result=await db.prepare("UPDATE stock_office_documents SET status='submitted',submitted_at=? WHERE id=? AND status='draft' AND created_by=?").bind(now(),id,user.id).run();
    if(Number(result.meta?.changes||0)!==1)return fail('Document changed. Refresh.',409);
   }else{
    if(!canReview(user)||d.created_by===user.id||d.status!=='submitted')return fail('Independent owner/manager review required',403);
    const result=await db.prepare('UPDATE stock_office_documents SET status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status=? AND created_by!=?').bind(decision==='approve'?'approved':'rejected',user.id,now(),id,'submitted',user.id).run();
    if(Number(result.meta?.changes||0)!==1)return fail('Document changed. Refresh.',409);
   }
   return json({ok:true,status:decision==='submit'?'submitted':decision==='approve'?'approved':'rejected',stock_posted:decision==='approve'});
  }
  return fail('Stock Office endpoint unavailable',404);
 }catch(e){console.error('SULMOS26_STOCK_OFFICE_ERROR',e instanceof Error?e.name:'unknown');return fail(explainError(e),409)}
}};
