import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const id=(process.env.SULMOS26_D1_DATABASE_ID||'').trim();
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
 console.error('Missing SULMOS26_D1_DATABASE_ID secret (same D1 database as Manager Hub).');process.exit(1);
}
for(const file of ['public-cash/index.html','public-cash/app.js','public-cash/styles.css','src/index.ts','migrations/0008_cash_office_receipts.sql']){
 if(!existsSync(file)){console.error('Missing Cash Office file: '+file);process.exit(1)}
}
const backend=readFileSync('src/index.ts','utf8');
if(!backend.includes("'/api/cash-office/payment'")){
 console.error('Cash Office backend missing. Apply the complete V26 backend file first.');process.exit(1);
}
const base=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(base.main!=='src/index.ts'||base.d1_databases?.[0]?.binding!=='DB'||base.d1_databases?.[0]?.database_name!=='sulmos26-db'){
 console.error('Expected existing SULMOS26 shared D1 database. Refusing deployment.');process.exit(1);
}
const cash={...base,name:'sulmos26-cash-office',assets:{directory:'./public-cash',binding:'ASSETS',run_worker_first:['/api/*']},d1_databases:[{...base.d1_databases[0],database_id:id}]};
writeFileSync('wrangler.cash.deploy.jsonc',JSON.stringify(cash,null,2)+'\n');
console.log('Prepared separate Cash Office Worker with the existing D1 database.');
