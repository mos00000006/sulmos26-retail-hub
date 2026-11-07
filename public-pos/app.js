const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format((Number(c)||0)/100);
const todayString=()=>new Date().toISOString().slice(0,10);
const state={
  user:null,stores:[],products:[],quotes:[],orders:[],basket:[],currentStore:'',search:'',notice:'',busy:false,
  quoteSearch:'',categoryFilter:'',lastSavedQuoteId:'',lastSavedReference:'',handoffId:'',handoffFulfilment:'collection',handoffAddress:'',handoffNote:''
};
async function api(path,options={}){
  const response=await fetch('/api/'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);
  return data;
}
const post=(p,b)=>api(p,{method:'POST',body:JSON.stringify(b)});
function message(e,ok=false){state.notice={text:e instanceof Error?e.message:String(e),ok};render();}
function login(){return `<div class="login panel"><div class="hero"><img src="/assets/sulmos26-pos-logo.png" alt="SULMOS26 POS"><div><h1>SULMOS26 POS</h1><p class="muted">Sales consultant & quotation desk</p></div></div><form id="signin"><div class="field"><label>Username</label><input name="username" autocomplete="username" required></div><div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn primary full" type="submit">Sign in</button></form>${state.notice?`<div class="notice ${state.notice.ok?'ok':''}" role="alert">${esc(state.notice.text)}</div>`:''}<p class="muted mt16">Your manager creates your account in SULMOS26 HUB → Staff & Access.</p></div>`}
function shell(inner){
  return `<header><div class="brand"><img src="/assets/sulmos26-pos-logo.png" alt="SULMOS26 POS"><div>SULMOS26 <span class="brand-red">POS</span><div class="sub">Sales desk · Quotations · Red + charcoal</div></div></div><div class="btn-row"><span class="user-pill">${esc(state.user.name)} · ${esc(state.user.role)}</span><button class="btn mini" id="signout">Sign out</button></div></header>${inner}`;
}
function quoteTotal(q){
  return Number(q.final_total_cents ?? q.total_cents ?? 0);
}
function quoteOriginal(q){
  return Number(q.original_total_cents ?? q.total_cents ?? 0);
}
function quoteStatus(q){
  if(state.orders.some(o=>o.quotation_id===q.id)) return 'Awaiting Cashier';
  if(Number(q.discount_cents||0)>0 || Number(q.discount_percent_basis_points||0)>0) return 'Discount approved';
  return 'Quotation saved';
}
function statusClass(q){
  if(state.orders.some(o=>o.quotation_id===q.id))return 'status-cashier';
  if(Number(q.discount_cents||0)>0 || Number(q.discount_percent_basis_points||0)>0) return 'status-approved';
  return 'status-open';
}
function todayQuotes(){
  return state.quotes.filter(q=>String(q.created_at||'').slice(0,10)===todayString());
}
function categories(){
  const counts = new Map();
  state.products.filter(p=>p.active).forEach(p=>{
    const c=(p.category||'General').trim()||'General';
    counts.set(c,(counts.get(c)||0)+1);
  });
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
}
function filteredProducts(){
  let rows=state.products.filter(x=>x.active);
  if(state.categoryFilter) rows=rows.filter(x=>(x.category||'General')===state.categoryFilter);
  if(state.search){
    const q=state.search.toLowerCase();
    rows=rows.filter(x=>[x.sku,x.name,x.barcode,x.category].some(v=>String(v||'').toLowerCase().includes(q)));
  }
  return rows.slice(0,80);
}
function filteredQuotes(){
  let rows=[...state.quotes];
  if(state.quoteSearch){
    const q=state.quoteSearch.toLowerCase();
    rows=rows.filter(x=>[x.reference,x.customer_name,x.customer_phone,x.store_name,x.created_by_name].some(v=>String(v||'').toLowerCase().includes(q)));
  }
  return rows;
}
function currentBasketTotal(){return state.basket.reduce((s,x)=>s+x.price_cents*x.qty,0)}
function stats(){
  const quotesToday=todayQuotes();
  const totalValue=quotesToday.reduce((s,q)=>s+quoteTotal(q),0);
  const approved=state.quotes.filter(q=>Number(q.discount_cents||0)>0).length;
  return {quotesToday:quotesToday.length,totalValue,approved,lines:state.basket.reduce((s,x)=>s+x.qty,0)};
}
function workspace(){
  const rows=filteredProducts();
  const qrows=filteredQuotes().slice(0,12);
  const handoffQuote=state.quotes.find(q=>q.id===state.handoffId);
  const sentOrders=state.orders.slice(0,8);
  const total=currentBasketTotal();
  const s=stats();
  const cats=categories();
  return shell(`
  <main>
    <div class="topline">
      <div>
        <span class="tag">PHASE 1 · QUOTATIONS</span>
        <h1>Sales desk</h1>
        <p class="muted">Create customer quotations, track your recent work, and send discount requests to the owner through quotation numbers.</p>
      </div>
      <div class="store-box">
        <label for="store">Assigned store</label>
        <select id="store">${state.stores.map(s=>`<option value="${esc(s.id)}" ${s.id===state.currentStore?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
      </div>
    </div>

    <section class="stats-grid">
      <div class="stat-card"><div class="stat-label">Today's quotations</div><div class="stat-value">${s.quotesToday}</div><div class="stat-note">Saved from this POS today</div></div>
      <div class="stat-card"><div class="stat-label">Today's quote value</div><div class="stat-value small">${money(s.totalValue)}</div><div class="stat-note">Combined quotation total</div></div>
      <div class="stat-card"><div class="stat-label">Approved discounts</div><div class="stat-value">${s.approved}</div><div class="stat-note">Quotes updated by owner</div></div>
      <div class="stat-card"><div class="stat-label">Current items</div><div class="stat-value">${s.lines}</div><div class="stat-note">Units in current quotation</div></div>
    </section>

    ${state.notice?`<div class="notice ${state.notice.ok?'ok':''}" role="alert">${esc(state.notice.text)}</div>`:''}

    <div class="workspace-grid">
      <section class="panel products-panel">
        <div class="panel-head">
          <div>
            <h2>Products</h2>
            <p class="muted">Search by product, SKU, barcode or category.</p>
          </div>
          <div class="pill ghost">${rows.length} shown</div>
        </div>
        <div class="search-row">
          <input id="search" placeholder="Search by product, SKU, barcode or category" value="${esc(state.search)}" aria-label="Search products">
        </div>
        <div class="category-row">
          <button class="chip ${!state.categoryFilter?'active':''}" data-cat="">All</button>
          ${cats.map(([name,count])=>`<button class="chip ${state.categoryFilter===name?'active':''}" data-cat="${esc(name)}">${esc(name)} <span>${count}</span></button>`).join('')}
        </div>
        <div class="items">
          ${rows.length?rows.map(p=>`<div class="item"><div><b>${esc(p.name)}</b><small>${esc(p.sku)}${p.barcode?' · '+esc(p.barcode):''}${p.category?' · '+esc(p.category):''}</small></div><div class="btn-row right-align"><span class="price">${money(p.price_cents)}</span><button class="btn mini" data-add="${esc(p.sku)}">Add +</button></div></div>`).join(''):'<div class="empty">No matching products found</div>'}
        </div>
        <div class="helper-card muted-box">
          <strong>Sales tip</strong>
          <p>Use the quotation number to request owner-approved discounts. Price editing is not available on the till screen.</p>
        </div>
      </section>

      <section class="panel quote-panel">
        <div class="panel-head">
          <div>
            <h2>Customer quotation</h2>
            <p class="muted">Build the quotation, then save it to the Hub.</p>
          </div>
          <div class="pill">${state.basket.length} line${state.basket.length===1?'':'s'}</div>
        </div>
        <form id="quote">
          <div class="form-grid two">
            <div class="field"><label>Customer name</label><input name="customer_name" maxlength="180" required placeholder="Customer full name"></div>
            <div class="field"><label>Customer cellphone (optional)</label><input name="customer_phone" maxlength="50" placeholder="Contact number"></div>
          </div>
          <table class="basket"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th><th></th></tr></thead><tbody>${state.basket.length?state.basket.map((line,i)=>`<tr><td><b>${esc(line.name)}</b><div class="muted">${esc(line.sku)}</div></td><td><input type="number" min="1" max="1000000" step="1" data-qty="${i}" value="${line.qty}"></td><td>${money(line.qty*line.price_cents)}</td><td><button class="btn mini" type="button" data-remove="${i}" aria-label="Remove item">×</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">Add products to start</td></tr>'}</tbody></table>
          <div class="quote-summary">
            <div class="summary-line"><span>Store</span><b>${esc(state.stores.find(s=>s.id===state.currentStore)?.name||'Not selected')}</b></div>
            <div class="summary-line"><span>Lines</span><b>${state.basket.length}</b></div>
            <div class="summary-line total"><span>Total</span><b>${money(total)}</b></div>
          </div>
          <p class="muted mt12">Quotation only. Not a payment receipt or tax invoice. VAT treatment follows saved product prices.</p>
          <div class="btn-row mt14"><button type="button" class="btn" id="clear">Clear</button><button type="submit" class="btn primary" ${!state.basket.length||!state.currentStore||state.busy?'disabled':''}>Save quotation</button></div>
        </form>
      </section>

      <aside class="sidebar-stack">
        <section class="panel compact-panel">
          <div class="panel-head"><h2>Quick actions</h2></div>
          <div class="quick-actions">
            <button class="btn" id="refreshProducts">Refresh products</button>
            <button class="btn" id="refreshQuotes">Refresh quotations</button>
            <button class="btn" id="printLast" ${!state.lastSavedQuoteId?'disabled':''}>Print last saved</button>
            <button class="btn" id="newQuote">New quotation</button>
          </div>
        </section>

        <section class="panel compact-panel">
          <div class="panel-head"><h2>Consultant session</h2></div>
          <div class="mini-list">
            <div class="mini-row"><span>Consultant</span><b>${esc(state.user.name)}</b></div>
            <div class="mini-row"><span>Role</span><b>${esc(state.user.role)}</b></div>
            <div class="mini-row"><span>Assigned store</span><b>${esc(state.stores.find(s=>s.id===state.currentStore)?.name||'—')}</b></div>
            <div class="mini-row"><span>Last saved quote</span><b>${esc(state.lastSavedReference||'—')}</b></div>
          </div>
        </section>

        <section class="panel compact-panel cashier-panel">
          <div class="panel-head"><div><h2>Cash Office handoff</h2><p class="muted">Sales do not receive or record payments.</p></div><span class="status status-cashier">Sales only</span></div>
          ${handoffQuote?`<form id="handoffForm"><p class="handoff-quote"><strong>${esc(handoffQuote.reference)}</strong> · ${money(quoteTotal(handoffQuote))}</p><div class="field"><label>Order type</label><select id="handoffFulfilment" name="fulfilment"><option value="collection" ${state.handoffFulfilment==='collection'?'selected':''}>Customer collection</option><option value="delivery" ${state.handoffFulfilment==='delivery'?'selected':''}>Customer delivery</option></select></div><div class="field" id="handoffAddressWrap" ${state.handoffFulfilment==='delivery'?'':'hidden'}><label>Delivery address</label><input name="delivery_address" maxlength="300" placeholder="Full delivery address" value="${esc(state.handoffAddress)}"></div><div class="field"><label>Instructions (optional)</label><input name="sales_note" maxlength="500" placeholder="Collection or delivery instructions" value="${esc(state.handoffNote)}"></div><div class="btn-row"><button type="submit" class="btn primary" ${state.busy?'disabled':''}>Send to Cash Office</button><button type="button" class="btn mini" id="cancelHandoff">Cancel</button></div></form>`:'<p class="muted">Choose a saved quotation below, then click <b>Send to Cash Office</b>. Cash Office will handle all payments later.</p>'}
          <h3 class="section-mini">Recently sent orders</h3>
          ${sentOrders.length?sentOrders.map(o=>`<div class="mini-order"><b>${esc(o.reference)}</b><span>${esc(o.customer_name)} · ${money(o.total_cents)}</span><small>Awaiting Cashier · ${esc(o.fulfilment)}</small></div>`).join(''):'<div class="muted">No orders sent yet.</div>'}
        </section>

        <section class="panel compact-panel">
          <div class="panel-head"><div><h2>My quotations</h2><p class="muted">Search, reprint, and send orders to Cash Office.</p></div></div>
          <div class="search-row slim"><input id="quoteSearch" placeholder="Search quote number or customer" value="${esc(state.quoteSearch)}"></div>
          <div class="quotes-list">
            ${qrows.length?qrows.map(q=>`<div class="quote-card"><div class="quote-top"><strong>${esc(q.reference)}</strong><span class="status ${statusClass(q)}">${esc(quoteStatus(q))}</span></div><div class="muted quote-meta">${esc(q.customer_name||'Walk-in customer')} · ${esc(q.store_name||'')} · ${esc(new Date(q.created_at).toLocaleDateString('en-ZA'))}</div><div class="quote-money"><span>${money(quoteTotal(q))}</span>${quoteOriginal(q)!==quoteTotal(q)?`<small>Orig ${money(quoteOriginal(q))}</small>`:''}</div><div class="btn-row mt10"><button class="btn mini" data-print="${esc(q.id)}">Print</button><button class="btn mini" data-reloadquote="${esc(q.id)}">Refresh & Print</button>${state.orders.some(o=>o.quotation_id===q.id)?'<span class="status status-cashier">Sent to Cash Office</span>':`<button class="btn mini handoff-btn" data-handoff="${esc(q.id)}">Send to Cash Office</button>`}</div></div>`).join(''):'<div class="empty">No quotations found.</div>'}
          </div>
        </section>
      </aside>
    </div>
  </main>`);
}
function render(){document.title='SULMOS26 POS';$('#app').innerHTML=state.user?workspace():login();wire()}
async function refresh(){
  const [stores,products,quotes,orders]=await Promise.all([api('stores'),api('pos/products'),api('quotations'),api('sales-orders')]);
  state.stores=(stores.items||[]).filter(s=>s.active);
  state.products=products.items||[];
  state.quotes=quotes.items||[];
  state.orders=orders.items||[];
  if(!state.stores.some(s=>s.id===state.currentStore)) state.currentStore=state.stores[0]?.id||'';
}
function printQuote(q){
  let lines=[];
  try{lines=JSON.parse(q.lines_json)}catch{}
  const approved = statusClass(q)==='status-approved';
  const discountText = approved ? `<p><b>Discount approved:</b> ${money(Number(q.discount_cents||0))}${q.discount_reason?` · ${esc(q.discount_reason)}`:''}</p>` : '';
  let w=window.open('','_blank');
  if(!w){message('Allow pop-ups to print quotations.');return}
  w.document.write(`<!doctype html><html><head><title>${esc(q.reference)}</title><link rel="stylesheet" href="${location.origin}/styles.css"></head><body><div class="sheet"><div class="head"><div><h1>SULMOS26 POS</h1><p class="small">CUSTOMER QUOTATION</p></div><div><img src="${location.origin}/assets/sulmos26-pos-logo.png" alt=""><p>${esc(q.reference)}</p></div></div><p style="margin-top:18px"><b>Customer:</b> ${esc(q.customer_name)}<br><b>Store:</b> ${esc(q.store_name||'')}<br><b>Date:</b> ${esc(new Date(q.created_at).toLocaleString('en-ZA'))}</p>${discountText}<table><thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${esc(l.sku)}</td><td>${esc(l.name)}</td><td>${esc(l.qty)}</td><td>${money(l.unit_price_cents)}</td><td>${money(l.line_total_cents)}</td></tr>`).join('')}</tbody></table><div class="amount">TOTAL: ${money(quoteTotal(q))}</div><p class="small" style="margin-top:20px">UNPAID QUOTATION. NOT A TAX INVOICE. No payment accepted by this screen.</p></div></body></html>`);
  w.document.close();
  w.addEventListener('load',()=>w.print(),{once:true});
}
async function reloadQuoteAndPrint(id){
  try{
    await refresh();
    const q=state.quotes.find(x=>x.id===id);
    if(!q) throw Error('Quotation no longer available');
    state.notice='Quotation refreshed from Hub';
    render();
    printQuote(q);
  }catch(e){message(e)}
}
function wire(){
  if(!state.user){
    const f=$('#signin');
    f.onsubmit=async e=>{
      e.preventDefault();
      const b=Object.fromEntries(new FormData(f));
      try{
        const data=await post('login',b);
        if(!['owner','manager','sales','cashier'].includes(data.user.role)) throw Error('Your role does not include POS access');
        state.user=data.user; state.notice='';
        await refresh();
        render();
      }catch(error){message(error)}
    };
    return;
  }
  $('#signout').onclick=async()=>{await post('logout',{}).catch(()=>{}); state.user=null; state.basket=[]; state.notice=''; render()};
  $('#store').onchange=e=>{state.currentStore=e.target.value; render()};
  $('#search').oninput=e=>{state.search=e.target.value; render(); $('#search').focus(); $('#search').setSelectionRange(state.search.length,state.search.length)};
  $$('.chip[data-cat]').forEach(b=>b.onclick=()=>{state.categoryFilter=b.dataset.cat||''; render()});
  $$('.quote-card [data-print], [data-print]').forEach(b=>b.onclick=()=>{const q=state.quotes.find(x=>x.id===b.dataset.print); if(q) printQuote(q)});
  $$('[data-reloadquote]').forEach(b=>b.onclick=()=>reloadQuoteAndPrint(b.dataset.reloadquote));
  $$('[data-handoff]').forEach(b=>b.onclick=()=>{state.handoffId=b.dataset.handoff;state.handoffFulfilment='collection';state.handoffAddress='';state.handoffNote='';render();document.querySelector('.cashier-panel')?.scrollIntoView({behavior:'smooth',block:'center'})});
  if($('#handoffForm')){
    $('#cancelHandoff').onclick=()=>{state.handoffId='';render()};
    $('#handoffFulfilment').onchange=e=>{state.handoffFulfilment=e.target.value;$('#handoffAddressWrap').hidden=state.handoffFulfilment!=='delivery'};
    $('#handoffForm').onsubmit=async e=>{
      e.preventDefault();if(state.busy)return;
      const data=Object.fromEntries(new FormData(e.target));
      state.busy=true;
      try{
        // Always refresh the quotation before creating its immutable cashier handoff.
        const latest=await api('quotations/'+encodeURIComponent(state.handoffId));
        if(!latest.quotation)throw Error('Quotation not found');
        const result=await post('sales-orders',{quotation_id:state.handoffId,fulfilment:data.fulfilment,delivery_address:data.delivery_address||'',sales_note:data.sales_note||''});
        state.handoffId='';await refresh();message(`Sales order ${result.reference} sent to Cash Office. No payment recorded.`,true);
      }catch(err){message(err)}finally{state.busy=false}
    };
  }
  $$('[data-add]').forEach(b=>b.onclick=()=>{const p=state.products.find(x=>x.sku===b.dataset.add); if(!p) return; const existing=state.basket.find(x=>x.sku===p.sku); if(existing) existing.qty++; else state.basket.push({sku:p.sku,name:p.name,price_cents:p.price_cents,qty:1}); render()});
  $$('[data-remove]').forEach(b=>b.onclick=()=>{state.basket.splice(Number(b.dataset.remove),1); render()});
  $$('[data-qty]').forEach(inp=>inp.onchange=()=>{const qty=Number(inp.value); if(!Number.isInteger(qty)||qty<1||qty>1000000){message('Quantity must be a positive whole number'); return;} state.basket[Number(inp.dataset.qty)].qty=qty; render()});
  $('#clear').onclick=()=>{state.basket=[]; state.notice=''; render()};
  $('#newQuote').onclick=()=>{$('#clear').click()};
  $('#refreshProducts').onclick=async()=>{try{const products=await api('pos/products'); state.products=products.items||[]; message('Product list refreshed',true)}catch(e){message(e)}};
  $('#refreshQuotes').onclick=async()=>{try{const quotes=await api('quotations'); state.quotes=quotes.items||[]; message('Quotation list refreshed',true)}catch(e){message(e)}};
  $('#printLast').onclick=()=>{const q=state.quotes.find(x=>x.id===state.lastSavedQuoteId); if(q) printQuote(q)};
  $('#quoteSearch').oninput=e=>{state.quoteSearch=e.target.value; render(); $('#quoteSearch').focus(); $('#quoteSearch').setSelectionRange(state.quoteSearch.length,state.quoteSearch.length)};
  $('#quote').onsubmit=async e=>{
    e.preventDefault();
    if(state.busy) return;
    state.busy=true;
    const values=Object.fromEntries(new FormData(e.target));
    try{
      const payload={store_id:state.currentStore,customer_name:values.customer_name,customer_phone:values.customer_phone,lines:state.basket.map(({sku,qty})=>({sku,qty}))};
      const result=await post('quotations',payload);
      state.basket=[];
      state.lastSavedQuoteId=result.id||'';
      state.lastSavedReference=result.reference||'';
      await refresh();
      message(`Quotation ${result.reference} saved successfully`,true);
    }catch(err){message(err)}finally{state.busy=false}
  };
}
async function start(){
  try{
    const session=await api('session');
    if(session.user){
      if(!['owner','manager','sales','cashier'].includes(session.user.role)) throw Error('This account is not permitted to use POS');
      state.user=session.user;
      await refresh();
    }else if(session.setup){
      state.notice={text:'The owner must finish Manager Hub setup first.',ok:false};
    }
    render();
  }catch(e){state.user=null; state.notice={text:e.message,ok:false}; render();}
}
start();
