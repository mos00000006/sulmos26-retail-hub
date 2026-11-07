@@ -17,7 +17,17 @@ function optionStores(){return state.stores.filter(x=>x.active).map(x=>({id:x.id
function empty(icon,title,subtitle,button='',click=''){return `<div class="empty"><div class="empty-symbol">${icon}</div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p>${button?`<button class="btn primary" data-action="${esc(click)}">+ ${esc(button)}</button>`:''}</div>`}
function badge(status){const map={draft:'grey',submitted:'amber',approved:'',rejected:'red',awaiting_payment:'amber',open:'amber',in_progress:'blue',done:'',active:'',locked:'grey'};return `<span class="tag ${map[status]||'grey'}">${esc(String(status).replaceAll('_',' '))}</span>`}
function date(iso){return iso?new Date(iso).toLocaleString('en-ZA',{dateStyle:'medium',timeStyle:'short'}):'—'}
function rowTable(head,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}
function rowTable

function safeItems(raw) {
  try {
    const items = JSON.parse(raw || '[]');
    return Array.isArray(items) ? items.length : 0;
  } catch {
    return 0;
  }
}
 (head,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}
function section(title,subtitle,button='',action=''){return `<div class="toolbar"><div><h1>${esc(title)}</h1><p class="subhead" style="margin-bottom:0">${esc(subtitle)}</p></div>${button?`<button class="btn primary" data-action="${esc(action)}">+ ${esc(button)}</button>`:''}</div>`}
function formValues(form){return Object.fromEntries(new FormData(form).entries())}
function logo(){return '/assets/sulmos26-logo.png'}
