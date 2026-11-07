import { readFileSync, existsSync } from 'node:fs';
const root='public';
const manifestPath=`${root}/manifest.webmanifest`;
if(!existsSync(manifestPath)) throw new Error('Missing PWA manifest');
const html=readFileSync(`${root}/index.html`,'utf8');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
if(!html.includes('rel="manifest"') || !html.includes('SULMOS26 HUB')) throw new Error('SULMOS26 install metadata missing from public/index.html');
if(manifest.name!=='SULMOS26 HUB'||manifest.display!=='standalone') throw new Error('Incorrect PWA name/display');
for(const icon of manifest.icons){const path=`${root}${icon.src}`;if(!existsSync(path))throw new Error(`Missing icon: ${path}`);const bytes=readFileSync(path);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`Not a valid PNG: ${path}`);}
for(const path of ['public/favicon.ico','public/assets/favicon-48.png','public/assets/apple-touch-icon.png'])if(!existsSync(path))throw new Error(`Missing ${path}`);
console.log('PWA icon files and manifest verified in deployment checkout');
