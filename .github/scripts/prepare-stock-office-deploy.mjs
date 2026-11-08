import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const id=(process.env.SULMOS26_D1_DATABASE_ID||'').trim();
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('Set SULMOS26_D1_DATABASE_ID GitHub secret');
for(const f of ['wrangler.jsonc','src/stock-office.ts','public-stock/index.html','public-stock/app.js','public-stock/styles.css','public-stock/manifest.webmanifest','public-stock/assets/icon-192.png','public-stock/assets/icon-512.png','migrations/0012_stock_office_documents.sql'])if(!existsSync(f))throw Error('Missing file '+f);
const base=JSON.parse(readFileSync('wrangler.jsonc','utf8').replace(/^\s*\/\/.*$/gm,''));
if(base.d1_databases?.[0]?.binding!=='DB'||base.d1_databases?.[0]?.database_name!=='sulmos26-db')throw Error('Unexpected database configuration; refusing deployment');
const config={...base,name:'sulmos26-stock-office',main:'src/stock-office.ts',assets:{directory:'./public-stock',binding:'ASSETS',run_worker_first:['/api/*']},d1_databases:[{...base.d1_databases[0],database_id:id}]};
writeFileSync('wrangler.stock.deploy.jsonc',JSON.stringify(config,null,2)+'\n');
console.log('Prepared Stock Office Worker, connected to existing SULMOS26 D1.');
