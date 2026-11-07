
import {
  readFileSync,
  writeFileSync,
  existsSync
} from 'node:fs';

const databaseId =
  (process.env.SULMOS26_D1_DATABASE_ID || '').trim();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!uuidPattern.test(databaseId)) {
  console.error(
    'Missing or invalid SULMOS26_D1_DATABASE_ID GitHub secret.'
  );
  process.exit(1);
}

const requiredFiles = [
  'public-pos/index.html',
  'public-pos/app.js',
  'public-pos/styles.css',
  'public-pos/manifest.webmanifest',
  'public-pos/assets/icon-192.png',
  'public-pos/assets/icon-512.png',
  'public-pos/assets/icon-maskable-512.png',
  'public-pos/assets/sulmos26-pos-logo.png'
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`POS file missing: ${file}`);
    process.exit(1);
  }
}

const backend = readFileSync('src/index.ts', 'utf8');

if (!backend.includes("'/api/pos/products'")) {
  console.error(
    'POS Phase 1 backend missing. Install the POS backend first.'
  );
  process.exit(1);
}

const base = JSON.parse(
  readFileSync('wrangler.jsonc', 'utf8')
);

if (
  base.main !== 'src/index.ts' ||
  base.d1_databases?.[0]?.binding !== 'DB' ||
  base.d1_databases?.[0]?.database_name !== 'sulmos26-db'
) {
  console.error(
    'Existing Manager Hub configuration does not match expected settings.'
  );
  process.exit(1);
}

const posConfig = {
  ...base,
  name: 'sulmos26-pos',
  assets: {
    directory: './public-pos',
    binding: 'ASSETS',
    run_worker_first: ['/api/*']
  },
  d1_databases: [
    {
      ...base.d1_databases[0],
      database_id: databaseId
    }
  ]
};

writeFileSync(
  'wrangler.pos.deploy.jsonc',
  JSON.stringify(posConfig, null, 2) + '\n'
);

console.log(
  'SULMOS26 POS Worker configuration generated successfully.'
);
