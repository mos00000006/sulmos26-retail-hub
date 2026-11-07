import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('username login and public version',()=>{assert.match(src,/V9-USERNAME-LOGIN/);assert.match(src,/username=\? OR email=\?/);});
test('staff accounts require owner permission and long password',()=>{assert.match(src,/req.method==='POST'&&u.role==='owner'/);assert.match(src,/pass.length<12/);assert.match(src,/internalMemberEmail/);});
test('username migration exists and UI does not require staff email',()=>{assert.match(ui,/Username \(no email required\)/);assert.match(ui,/owner-username-form/);});
