<<<<<<< HEAD
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const id=(process.env.SULMOS26_D1_DATABASE_ID||'').trim();
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
 console.error('Missing SULMOS26_D1_DATABASE_ID GitHub secret (must equal Manager Hub database ID).');process.exit(1);
}
for(const file of ['public-pos/index.html','public-pos/app.js','public-pos/styles.css','public-pos/manifest.webmanifest','public-pos/assets/icon-192.png','public-pos/assets/icon-512.png','public-pos/assets/icon-maskable-512.png','public-pos/assets/sulmos26-pos-logo.png']){
 if(!existsSync(file)){console.error('POS file missing: '+file);process.exit(1)}
}
const backend=readFileSync('src/index.ts','utf8');
if(!backend.includes("'/api/pos/products'")){
 console.error('POS Phase 1 backend missing: src/index.ts must contain /api/pos/products. Install Phase 1 backend before deploying this POS Worker.');process.exit(1);
}
const base=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(base.main!=='src/index.ts'||base.d1_databases?.[0]?.binding!=='DB'||base.d1_databases?.[0]?.database_name!=='sulmos26-db'){
 console.error('Expected the existing Sulmos26 Manager Hub backend and D1 binding; refusing deploy.');process.exit(1)
}
const pos={...base,
 name:'sulmos26-pos',
 assets:{directory:'./public-pos',binding:'ASSETS',run_worker_first:['/api/*']},
 d1_databases:[{...base.d1_databases[0],database_id:id}]
};
writeFileSync('wrangler.pos.deploy.jsonc',JSON.stringify(pos,null,2)+'\n');
console.log('POS Worker configuration generated (shares the existing Hub D1 database).');
=======

import {readFileSync,writeFileSync,existsSync} from 'node:fs';

const id=(process.env.SULMOS26_D1_DATABASE_ID||'').trim();

if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
  console.error('Missing SULMOS26_D1_DATABASE_ID GitHub secret (must equal Manager Hub database ID).');
  process.exit(1);
}

for(const file of [
  'public-pos/index.html',
  'public-pos/app.js',
  'public-pos/styles.css',
  'public-pos/manifest.webmanifest',
  'public-pos/assets/icon-192.png',
  'public-pos/assets/icon-512.png',
  'public-pos/assets/icon-maskable-512.png',
  'public-pos/assets/sulmos26-pos-logo.png'
]){
  if(!existsSync(file)){
    console.error('POS file missing: '+file);
    process.exit(1);
  }
}

const backend=readFileSync('src/index.ts','utf8');

if(!backend.includes("'/api/pos/products'")){
  console.error('POS Phase 1 backend missing. Install Phase 1 backend before deploying.');
  process.exit(1);
}

const base=JSON.parse(readFileSync('wrangler.jsonc','utf8'));

if(base.main!=='src/index.ts'||
   base.d1_databases?.[0]?.binding!=='DB'||
   base.d1_databases?.[0]?.database_name!=='sulmos26-db'){
  console.error('Expected existing Manager Hub backend and D1 binding.');
  process.exit(1);
}

const pos={
  ...base,
  name:'sulmos26-pos',
  assets:{
    directory:'./public-pos',
    binding:'ASSETS',
    run_worker_first:['/api/*']
  },
  d1_databases:[{
    ...base.d1_databases[0],
    database_id:id
  }]
};

writeFileSync('wrangler.pos.deploy.jsonc',JSON.stringify(pos,null,2)+'\n');

console.log('POS Worker configuration generated.');
>>>>>>> c199c2dd1ae73bdf083d049705279339b65ff87b
