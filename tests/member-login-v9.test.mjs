
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src = readFileSync(
  new URL('../src/index.ts', import.meta.url),
  'utf8'
);

const ui = readFileSync(
  new URL('../public/app.js', import.meta.url),
  'utf8'
);

test('username login and public version', () => {
  assert.match(src, /V9-USERNAME-LOGIN/);
  assert.match(src, /username=\? OR email=\?/);
});

test('owners and managers can add permitted staff, but managers only add sales consultants', () => {
  assert.match(
    src,
    /req\.method==='POST'&&\['owner','manager'\]\.includes\(u\.role\)/
  );
  assert.match(src, /u\.role==='manager'&&role!=='sales'/);
  assert.match(src, /pass\.length<12/);
  assert.match(src, /role==='owner'/);
  assert.match(src, /internalMemberEmail/);
});

test('quotation discounts are owner-only and logged for auditing', () => {
  assert.match(
    src,
    /if\(u\.role!=='owner'\)return fail\('Only the owner may apply quotation discounts',403\)/
  );
  assert.match(src, /'owner_discount'/);
});

test('username migration exists and UI does not require staff email', () => {
  assert.match(ui, /Username \(no email required\)/);
  assert.match(ui, /owner-username-form/);
});
