const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format((Number(c)||0)/100);
const todayString=()=>new Date().toISOString().slice(0,10);
const state={
  user:null,stores:[],products:[],quotes:[],orders:[],basket:[],currentStore:'',search:'',notice:'',busy:false,
  quoteSearch:'',categoryFilter:'',lastSavedQuoteId:'',lastSavedReference:'',handoffId:'',handoffFulfilment:'collection',handoffAddress:'',handoffNote:'', customers:[],stockLevels:[],stockRequests:[],stockStores:[],stockSku:'',stockMode:'reservation',stockSource:'',stockQty:1,fulfilmentOrderId:'',fulfilmentHistory:[],selectedCustomerId:'',customerName:'',customerPhone:'',showCustomerForm:false,customerSearch:'',customerHistory:[], report:null,reportFrom:new Date().toISOString().slice(0,7)+'-01',reportTo:todayString(),reportStore:'',reportBusy:false
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
  return 'Cash Office lookup ready';
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
        <span class="tag">SALES PHASE 6 · REPORTS & FINAL SALES CONTROLS</span>
        <h1>Sales desk</h1>
        <p class="muted">Every saved quotation is automatically available at Cash Office by its quotation number. Discounts remain owner-only.</p>
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

    <section class="panel report-panel" id="performanceReport">
      <div class="panel-head"><div><h2>Sales performance & follow-up</h2><p class="muted">Quotation and Cash Office handoff activity only — these figures are NOT paid sales or receipts.</p></div><span class="pill">Phase 6</span></div>
      <form id="reportFilters" class="report-filters">
        <div class="field"><label>From</label><input type="date" name="from" value="${esc(state.reportFrom)}" required></div>
        <div class="field"><label>To</label><input type="date" name="to" value="${esc(state.reportTo)}" required></div>
        <div class="field"><label>Store</label><select name="store_id"><option value="">${['owner','manager'].includes(state.user.role)?'All stores':'My assigned stores'}</option>${state.stores.map(s=>`<option value="${esc(s.id)}" ${state.reportStore===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
        <button type="submit" class="btn primary" ${state.reportBusy?'disabled':''}>${state.reportBusy?'Loading…':'Load report'}</button>
        <button type="button" id="reportCsv" class="btn" ${!state.report?'disabled':''}>Export CSV</button>
      </form>
      ${state.report?`<div class="report-kpis"><div><span>Quotations created</span><strong>${state.report.totals.quote_count}</strong></div><div><span>Quotation value</span><strong>${money(state.report.totals.quote_value_cents)}</strong></div><div><span>Orders confirmed</span><strong>${state.report.totals.order_count}</strong></div><div><span>Order value</span><strong>${money(state.report.totals.order_value_cents)}</strong></div><div><span>Approved discount value</span><strong>${money(state.report.totals.approved_discount_cents)}</strong></div><div><span>Old quotes for follow-up</span><strong>${state.report.followups.length}${state.report.followups_limited?'+':''}</strong></div></div>
        <div class="report-tables"><div><h3>Consultant scorecard</h3><div class="report-scroll"><table class="report-table"><thead><tr><th>Consultant</th><th>Store</th><th>Quotes</th><th>Quote value</th><th>Orders</th><th>Orders value</th><th>Count ratio*</th></tr></thead><tbody>${state.report.consultants.length?state.report.consultants.map(r=>`<tr><td>${esc(r.consultant)}</td><td>${esc(r.store_name)}</td><td>${r.quote_count}</td><td>${money(r.quote_value_cents)}</td><td>${r.order_count}</td><td>${money(r.order_value_cents)}</td><td>${r.conversion_percent}%</td></tr>`).join(''):'<tr><td colspan="7" class="empty">No activity in selected period</td></tr>'}</tbody></table></div></div><div><h3>Quotation follow-up (3+ days)</h3><div class="report-scroll"><table class="report-table"><thead><tr><th>Quote</th><th>Customer</th><th>Consultant</th><th>Created</th><th>Value</th></tr></thead><tbody>${state.report.followups.length?state.report.followups.map(q=>`<tr><td>${esc(q.reference)}</td><td>${esc(q.customer_name)}${q.customer_phone?`<div class="muted">${esc(q.customer_phone)}</div>`:''}</td><td>${esc(q.created_by_name)}</td><td>${esc(q.created_at.slice(0,10))}</td><td>${money(q.total_cents)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No older unconfirmed quotes in this period</td></tr>'}</tbody></table></div></div></div>
        <p class="muted mt12">*Count ratio = confirmed orders created during the period ÷ quotations created during the period; this is not a same-cohort conversion rate. Collection and delivery requests are not payment confirmations. Follow-up list is capped at 75.</p>`:'<div class="report-placeholder muted">Choose dates and select <b>Load report</b> for the full Sales Desk performance view.</div>'}
    </section>

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
          <div class="customer-toolbox">
            <div class="panel-head"><div><strong>Customer records</strong><p class="muted">Select a saved customer or use a walk-in name.</p></div><button id="toggleCustomerForm" class="btn mini" type="button">+ Save customer</button></div>
            <div class="field"><label>Saved customer (optional)</label>
              <select id="selectedCustomer"><option value="">Walk-in / enter manually</option>${state.customers.map(c=>`<option value="${esc(c.id)}" ${state.selectedCustomerId===c.id?'selected':''}>${esc(c.name)}${c.phone?' · '+esc(c.phone):''}</option>`).join('')}</select>
            </div>
            ${state.showCustomerForm?`<div class="customer-save-box"><div class="form-grid two"><div class="field"><label>Name</label><input id="newCustomerName" maxlength="180" placeholder="Customer name"></div><div class="field"><label>Cellphone</label><input id="newCustomerPhone" maxlength="50" placeholder="Cellphone (optional)"></div></div><div class="btn-row"><button class="btn mini primary" id="saveCustomer" type="button">Save customer</button><button class="btn mini" type="button" id="cancelCustomer">Cancel</button></div></div>`:''}
            ${state.selectedCustomerId?`<div class="customer-history-row"><button class="btn mini" type="button" id="customerHistory">View customer quotation history</button></div><div class="customer-history-list">${state.customerHistory.length?state.customerHistory.map(q=>`<div class="mini-row"><span>${esc(q.reference)}</span><b>${money(q.total_cents)}</b></div>`).join(''):''}</div>`:''}
          </div>
          <div class="form-grid two">
            <div class="field"><label>Customer name</label><input name="customer_name" maxlength="180" required placeholder="Customer full name" value="${esc(state.customerName)}"></div>
            <div class="field"><label>Customer cellphone (optional)</label><input name="customer_phone" maxlength="50" placeholder="Contact number" value="${esc(state.customerPhone)}"></div>
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

      <section class="panel stock-phase-panel">
        <div class="panel-head"><div><h2>Stock availability & requests</h2><p class="muted">Management-entered stock snapshots, not live stock. Quotes never reserve or deduct stock.</p></div><span class="pill ghost">Phase 4</span></div>
        <div class="field"><label>Product</label><select id="stockSku"><option value="">Select product</option>${state.products.filter(p=>p.active).map(p=>`<option value="${esc(p.sku)}" ${p.sku===state.stockSku?'selected':''}>${esc(p.sku)} · ${esc(p.name)}</option>`).join('')}</select></div>
        <div class="stock-levels">${state.stockSku?(()=>{const levels=state.stockLevels.filter(x=>x.sku===state.stockSku);return levels.length?levels.map(x=>`<div class="mini-row"><span>${esc(x.store_name)}<small class="muted">Updated ${esc(String(x.updated_at||'').slice(0,10))}</small></span><b>${x.available} available <small class="muted">(${x.on_hand} snapshot − ${x.reserved} reserved)</small></b></div>`).join(''):'<div class="muted">No stock snapshot recorded. Ask the manager to verify stock.</div>'})():'<div class="muted">Select a product to view snapshots at all stores.</div>'}</div>
        <form id="stockRequestForm" class="stock-request-form">
          <div class="field"><label>Request type</label><select name="kind" id="stockKind"><option value="reservation" ${state.stockMode==='reservation'?'selected':''}>Reserve stock (approval required)</option><option value="transfer" ${state.stockMode==='transfer'?'selected':''}>Request transfer from another store</option></select></div>
          <div class="field" id="sourceStoreWrap" ${state.stockMode==='transfer'?'':'hidden'}><label>Source store</label><select name="source_store_id"><option value="">Select source</option>${state.stockStores.filter(s=>s.id!==state.currentStore).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><small class="muted">For a store not on your list, ask management to raise the transfer.</small></div>
          <div class="form-grid two"><div class="field"><label>Quantity</label><input name="qty" type="number" min="1" max="1000000" step="1" required value="1"></div><div class="field"><label>Quotation reference (optional)</label><select name="quotation_id"><option value="">Not linked</option>${state.quotes.filter(q=>q.store_id===state.currentStore).slice(0,70).map(q=>`<option value="${esc(q.id)}">${esc(q.reference)}</option>`).join('')}</select></div></div>
          <div class="field"><label>Request notes</label><input name="note" maxlength="500" placeholder="Customer, requirement or transfer reason"></div>
          <button class="btn primary" ${!state.stockSku?'disabled':''}>Submit for manager approval</button>
        </form>
        ${['owner','manager'].includes(state.user.role)?`<details class="stock-manager"><summary><b>Manager: update verified stock snapshot</b></summary><form id="stockSnapshotForm"><div class="field"><label>Verified physical quantity for selected product</label><input name="on_hand" type="number" min="0" max="100000000" step="1" required></div><button class="btn">Save stock snapshot</button></form></details>`:''}
        <div class="panel-head mt14"><h3>Stock requests</h3><button id="stockRefresh" class="btn mini">Refresh</button></div>
        <div class="stock-request-list">${state.stockRequests.length?state.stockRequests.slice(0,12).map(r=>`<div class="stock-request"><div><b>${esc(r.reference)}</b><span class="status ${r.status==='approved'?'status-approved':'status-open'}">${esc(r.status)}</span></div><div class="muted">${esc(r.kind)} · ${esc(r.sku)} × ${r.qty}${r.source_store_name?' · From '+esc(r.source_store_name):''}</div>${r.status==='approved'&&r.kind==='reservation'&&['owner','manager'].includes(state.user.role)&&r.created_by!==state.user.id?`<div class="btn-row mt10"><button class="btn mini" data-stock-action="release" data-stock-id="${esc(r.id)}">Release reservation</button></div>`:''}${r.status==='pending'?`<div class="btn-row mt10">${['owner','manager'].includes(state.user.role)&&r.created_by!==state.user.id?`<button class="btn mini" data-stock-action="approve" data-stock-id="${esc(r.id)}">Approve</button><button class="btn mini" data-stock-action="reject" data-stock-id="${esc(r.id)}">Reject</button>`:''}${r.created_by===state.user.id||['owner','manager'].includes(state.user.role)?`<button class="btn mini" data-stock-action="cancel" data-stock-id="${esc(r.id)}">Cancel</button>`:''}</div>`:''}</div>`).join(''):'<p class="muted">No requests yet.</p>'}</div>
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
          <div class="panel-head"><div><h2>Cash Office handoff</h2><p class="muted">All quotations are already searchable at Cash Office. Use this section only to confirm collection or delivery details.</p><p class="muted">Sales do not receive or record payments.</p></div><span class="status status-cashier">Sales only</span></div>
          ${handoffQuote?`<form id="handoffForm"><p class="handoff-quote"><strong>${esc(handoffQuote.reference)}</strong> · ${money(quoteTotal(handoffQuote))}</p><div class="field"><label>Order type</label><select id="handoffFulfilment" name="fulfilment"><option value="collection" ${state.handoffFulfilment==='collection'?'selected':''}>Customer collection</option><option value="delivery" ${state.handoffFulfilment==='delivery'?'selected':''}>Customer delivery</option></select></div><div class="field" id="handoffAddressWrap" ${state.handoffFulfilment==='delivery'?'':'hidden'}><label>Delivery address</label><input name="delivery_address" maxlength="300" placeholder="Full delivery address" value="${esc(state.handoffAddress)}"></div><div class="field"><label>Instructions (optional)</label><input name="sales_note" maxlength="500" placeholder="Collection or delivery instructions" value="${esc(state.handoffNote)}"></div><div class="btn-row"><button type="submit" class="btn primary" ${state.busy?'disabled':''}>Confirm order details</button><button type="button" class="btn mini" id="cancelHandoff">Cancel</button></div></form>`:'<p class="muted">Choose a saved quotation below, then click <b>Confirm order details</b>. Cash Office will handle all payments later.</p>'}
          <h3 class="section-mini">Recently sent orders</h3>
          ${sentOrders.length?sentOrders.map(o=>`<div class="mini-order"><b>${esc(o.reference)}</b><span>${esc(o.customer_name)} · ${money(o.total_cents)}</span><small>Awaiting Cashier · ${esc(o.fulfilment)}</small></div>`).join(''):'<div class="muted">No orders sent yet.</div>'}
        </section>

        <section class="panel compact-panel fulfilment-panel">
          <div class="panel-head"><div><h2>Collections & delivery follow-up</h2><p class="muted">Sales records instructions only. Cash Office must process payment before dispatch release.</p></div><span class="pill ghost">Phase 5</span></div>
          ${state.orders.filter(o=>o.store_id===state.currentStore).length?state.orders.filter(o=>o.store_id===state.currentStore).slice(0,15).map(o=>`<div class="fulfilment-order"><div class="quote-top"><strong>${esc(o.reference)}</strong><span class="status status-cashier">${esc(o.status==='awaiting_cashier'?'Awaiting Cash Office':o.status)}</span></div><div class="muted">Quote: ${esc(o.quotation_reference)} · ${esc(o.customer_name)} · ${money(o.total_cents)}</div><div class="muted">${esc(o.fulfilment)}${o.requested_date?' · Requested '+esc(o.requested_date):''}</div><div class="btn-row mt10"><button class="btn mini" data-fulfilment="${esc(o.id)}">Instructions & follow-up</button></div></div>`).join(''):'<p class="muted">Confirm customer collection or delivery details from their quotation to start tracking.</p>'}
          ${state.fulfilmentOrderId?(()=>{const o=state.orders.find(x=>x.id===state.fulfilmentOrderId);return o?`<form id="fulfilmentForm" class="fulfilment-form"><h3>Update ${esc(o.reference)}</h3><div class="field"><label>Method</label><select name="fulfilment" id="editFulfilment"><option value="collection" ${o.fulfilment==='collection'?'selected':''}>Customer collection</option><option value="delivery" ${o.fulfilment==='delivery'?'selected':''}>Delivery</option></select></div><div class="field"><label>Delivery address (if applicable)</label><input name="delivery_address" maxlength="300" value="${esc(o.delivery_address||'')}"></div><div class="field"><label>Requested date (not a confirmed booking)</label><input name="requested_date" type="date" value="${esc(o.requested_date||'')}"></div><div class="field"><label>Contact person</label><input name="contact_name" maxlength="120" value="${esc(o.contact_name||o.customer_name||'')}"></div><div class="field"><label>Contact number</label><input name="contact_phone" maxlength="50" value="${esc(o.contact_phone||o.customer_phone||'')}"></div><div class="field"><label>Collection / delivery notes</label><textarea name="sales_note" maxlength="500" rows="3">${esc(o.sales_note||'')}</textarea></div><div class="btn-row"><button type="submit" class="btn primary">Save instructions</button><button type="button" id="cancelFulfilment" class="btn mini">Close</button></div><p class="muted mt12">This does not confirm payment, a delivery slot, stock allocation or dispatch.</p><h3 class="section-mini">Instruction history</h3>${state.fulfilmentHistory.length?state.fulfilmentHistory.map(e=>`<p class="muted">${esc(e.created_at.slice(0,16))} · ${esc(e.actor_name)} · Instructions updated</p>`).join(''):'<p class="muted">No updates yet.</p>'}</form>`:''})():''}
        </section>

        <section class="panel compact-panel">
          <div class="panel-head"><div><h2>My quotations</h2><p class="muted">Search, reprint, and send orders to Cash Office.</p></div></div>
          <div class="search-row slim"><input id="quoteSearch" placeholder="Search quote number or customer" value="${esc(state.quoteSearch)}"></div>
          <div class="quotes-list">
            ${qrows.length?qrows.map(q=>`<div class="quote-card"><div class="quote-top"><strong>${esc(q.reference)}</strong><span class="status ${statusClass(q)}">${esc(quoteStatus(q))}</span></div><div class="muted quote-meta">${esc(q.customer_name||'Walk-in customer')} · ${esc(q.store_name||'')} · ${esc(new Date(q.created_at).toLocaleDateString('en-ZA'))}</div><div class="quote-money"><span>${money(quoteTotal(q))}</span>${quoteOriginal(q)!==quoteTotal(q)?`<small>Orig ${money(quoteOriginal(q))}</small>`:''}</div><div class="btn-row mt10"><button class="btn mini" data-print="${esc(q.id)}">Print</button><button class="btn mini" data-reloadquote="${esc(q.id)}">Refresh & Print</button>${state.orders.some(o=>o.quotation_id===q.id)?'<span class="status status-cashier">Collection/delivery confirmed</span>':`<button class="btn mini handoff-btn" data-handoff="${esc(q.id)}">Confirm order details</button>`}</div></div>`).join(''):'<div class="empty">No quotations found.</div>'}
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
  await loadCustomers();
  await loadStockRequests();
}
async function loadCustomers(){
  if(!state.currentStore){state.customers=[];return}
  const result=await api('customers?store_id='+encodeURIComponent(state.currentStore));
  state.customers=result.items||[];
  if(!state.customers.some(c=>c.id===state.selectedCustomerId))state.selectedCustomerId='';
}
async function loadStockRequests(){
  if(!state.currentStore){state.stockRequests=[];state.stockLevels=[];return}
  const [requests,levels,stores]=await Promise.all([api('sales-stock/requests?store_id='+encodeURIComponent(state.currentStore)),api('sales-stock?store_id='+encodeURIComponent(state.currentStore)+(state.stockSku?'&sku='+encodeURIComponent(state.stockSku):'')),api('sales-stock/stores')]);
  state.stockRequests=requests.items||[];state.stockLevels=levels.items||[];state.stockStores=stores.items||[];
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
        if(!['owner','manager','sales'].includes(data.user.role)) throw Error('Your role does not include POS access');
        state.user=data.user; state.notice='';
        await refresh();
        render();
      }catch(error){message(error)}
    };
    return;
  }
  $('#signout').onclick=async()=>{await post('logout',{}).catch(()=>{}); state.user=null; state.basket=[]; state.notice=''; render()};
  $('#reportFilters').onsubmit=async e=>{e.preventDefault();if(state.reportBusy)return;const data=Object.fromEntries(new FormData(e.target));state.reportFrom=data.from;state.reportTo=data.to;state.reportStore=data.store_id;state.reportBusy=true;try{const params=new URLSearchParams({from:state.reportFrom,to:state.reportTo});if(state.reportStore)params.set('store_id',state.reportStore);state.report=await api('sales-performance?'+params.toString());render()}catch(err){message(err)}finally{state.reportBusy=false}};
  $('#reportCsv').onclick=()=>{
    if(!state.report)return;
    const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const rows=[['Consultant','Store','Quote count','Quote value (ZAR)','Order count','Order value (ZAR)','Count ratio (%)'],...state.report.consultants.map(r=>[r.consultant,r.store_name,r.quote_count,(r.quote_value_cents/100).toFixed(2),r.order_count,(r.order_value_cents/100).toFixed(2),r.conversion_percent])];
    const csv='\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`SULMOS26-Sales-Performance-${state.reportFrom}-to-${state.reportTo}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  };
  $('#store').onchange=async e=>{state.currentStore=e.target.value;state.selectedCustomerId='';state.customerName='';state.customerPhone='';try{await loadCustomers();await loadStockRequests();render()}catch(err){message(err)}};
  $('#search').oninput=e=>{state.search=e.target.value; render(); $('#search').focus(); $('#search').setSelectionRange(state.search.length,state.search.length)};
  $('#selectedCustomer').onchange=e=>{
    state.selectedCustomerId=e.target.value;state.customerHistory=[];
    const customer=state.customers.find(c=>c.id===state.selectedCustomerId);
    if(customer){state.customerName=customer.name;state.customerPhone=customer.phone||''}
    render();
  };
  const customerNameInput=$('#quote input[name="customer_name"]');
  const customerPhoneInput=$('#quote input[name="customer_phone"]');
  customerNameInput.oninput=e=>{state.customerName=e.target.value; if(state.selectedCustomerId && state.customers.find(c=>c.id===state.selectedCustomerId)?.name!==state.customerName)state.selectedCustomerId=''};
  customerPhoneInput.oninput=e=>{state.customerPhone=e.target.value};
  $('#toggleCustomerForm').onclick=()=>{state.showCustomerForm=!state.showCustomerForm;render()};
  if($('#cancelCustomer'))$('#cancelCustomer').onclick=()=>{state.showCustomerForm=false;render()};
  if($('#saveCustomer'))$('#saveCustomer').onclick=async()=>{
    const name=$('#newCustomerName').value.trim(),phone=$('#newCustomerPhone').value.trim();
    if(!name)return message('Enter the customer name');
    try{
      const created=await post('customers',{store_id:state.currentStore,name,phone});
      await loadCustomers();state.selectedCustomerId=created.id;state.customerName=name;state.customerPhone=phone;state.showCustomerForm=false;
      message('Customer saved and selected',true);
    }catch(err){message(err)}
  };
  if($('#customerHistory'))$('#customerHistory').onclick=async()=>{
    try{
      const result=await api('customers/'+encodeURIComponent(state.selectedCustomerId)+'/quotations');
      state.customerHistory=(result.items||[]).slice(0,10);render();
      if(!state.customerHistory.length)message('No saved quotations for this customer yet.');
    }catch(err){message(err)}
  };

  if($('#stockSku'))$('#stockSku').onchange=async e=>{state.stockSku=e.target.value;try{await loadStockRequests();render()}catch(err){message(err)}};
  if($('#stockKind'))$('#stockKind').onchange=e=>{state.stockMode=e.target.value;render()};
  if($('#stockRequestForm'))$('#stockRequestForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));try{const r=await post('sales-stock/requests',{store_id:state.currentStore,sku:state.stockSku,kind:b.kind,source_store_id:b.source_store_id,qty:Number(b.qty),quotation_id:b.quotation_id,note:b.note});await loadStockRequests();message(`Stock request ${r.reference} submitted for approval. No stock moved.`,true)}catch(err){message(err)}};
  if($('#stockSnapshotForm'))$('#stockSnapshotForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));try{await post('sales-stock/snapshot',{store_id:state.currentStore,sku:state.stockSku,on_hand:Number(b.on_hand)});await loadStockRequests();message('Verified stock snapshot updated. This is not a live inventory posting.',true)}catch(err){message(err)}};
  if($('#stockRefresh'))$('#stockRefresh').onclick=async()=>{try{await loadStockRequests();message('Stock requests and snapshots refreshed',true)}catch(err){message(err)}};
  $$('[data-stock-action]').forEach(b=>b.onclick=async()=>{try{await post('sales-stock/requests/'+encodeURIComponent(b.dataset.stockId)+'/'+b.dataset.stockAction,{});await loadStockRequests();message('Stock request updated. No physical stock posted.',true)}catch(err){message(err)}});
  $$('.chip[data-cat]').forEach(b=>b.onclick=()=>{state.categoryFilter=b.dataset.cat||''; render()});
  $$('.quote-card [data-print], [data-print]').forEach(b=>b.onclick=()=>{const q=state.quotes.find(x=>x.id===b.dataset.print); if(q) printQuote(q)});
  $$('[data-reloadquote]').forEach(b=>b.onclick=()=>reloadQuoteAndPrint(b.dataset.reloadquote));
  $$('[data-fulfilment]').forEach(b=>b.onclick=async()=>{
    try{const r=await api('sales-orders/'+encodeURIComponent(b.dataset.fulfilment)+'/fulfilment');state.fulfilmentOrderId=b.dataset.fulfilment;state.fulfilmentHistory=r.history||[];render();document.querySelector('.fulfilment-panel')?.scrollIntoView({block:'center',behavior:'smooth'});}catch(err){message(err)}
  });
  if($('#fulfilmentForm')){
    $('#cancelFulfilment').onclick=()=>{state.fulfilmentOrderId='';state.fulfilmentHistory=[];render()};
    $('#fulfilmentForm').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{
      await post('sales-orders/'+encodeURIComponent(state.fulfilmentOrderId)+'/fulfilment',data);
      await refresh();const r=await api('sales-orders/'+encodeURIComponent(state.fulfilmentOrderId)+'/fulfilment');state.fulfilmentHistory=r.history||[];
      message('Instructions updated. Payment and dispatch are still pending Cash Office.',true);
    }catch(err){message(err)}};
  }
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
        state.handoffId='';await refresh();message(`Order details confirmed (${result.reference}). Cash Office can also find the original quotation number. No payment recorded.`,true);
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
      const payload={store_id:state.currentStore,customer_id:state.selectedCustomerId||undefined,customer_name:values.customer_name,customer_phone:values.customer_phone,lines:state.basket.map(({sku,qty})=>({sku,qty}))};
      const result=await post('quotations',payload);
      state.basket=[];state.selectedCustomerId='';state.customerName='';state.customerPhone='';state.customerHistory=[];
      state.lastSavedQuoteId=result.id||'';
      state.lastSavedReference=result.reference||'';
      await refresh();
      message(`Quotation ${result.reference} saved. Cash Office can retrieve it immediately by this number. No payment recorded.`,true);
    }catch(err){message(err)}finally{state.busy=false}
  };
}
async function start(){
  try{
    const session=await api('session');
    if(session.user){
      if(!['owner','manager','sales'].includes(session.user.role)) throw Error('This account is not permitted to use POS');
      state.user=session.user;
      await refresh();
    }else if(session.setup){
      state.notice={text:'The owner must finish Manager Hub setup first.',ok:false};
    }
    render();
  }catch(e){state.user=null; state.notice={text:e.message,ok:false}; render();}
}
start();
