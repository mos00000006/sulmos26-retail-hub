import {readFileSync,writeFileSync} from 'node:fs';
const id=process.env.SULMOS26_D1_DATABASE_ID?.trim()||'';
const setup=process.env.SULMOS26_SETUP_TOKEN||'';
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
 console.error('SULMOS26_D1_DATABASE_ID is missing or not a Cloudflare D1 UUID. Create a separate D1 database and add its ID under GitHub Actions secrets.');process.exit(1);
}
if(setup.length<32){console.error('SULMOS26_SETUP_TOKEN must be a private random installation key of at least 32 characters (GitHub Actions secret).');process.exit(1);}
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(config.name!=='sulmos26-retail-hub'||config.d1_databases?.[0]?.database_name!=='sulmos26-db'||config.d1_databases?.[0]?.binding!=='DB'){
 console.error('Unexpected Cloudflare worker/database configuration. Refusing deployment.');process.exit(1);
}
if(!config.assets?.directory||config.assets.directory!=='./public'){
 console.error('Static Sulmos26 interface assets missing from deployment configuration.');process.exit(1);
}
config.d1_databases[0].database_id=id;
writeFileSync('wrangler.deploy.jsonc',JSON.stringify(config,null,2)+'\n');
console.log('Cloudflare deployment configuration prepared. Database isolated; no credentials printed.');
