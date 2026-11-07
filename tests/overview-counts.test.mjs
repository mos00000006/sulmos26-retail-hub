import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
test('overview counts use typed batch rows instead of accessing n on an untyped D1 result',()=>{
 assert.match(api,/as \{n\?:number\}\|undefined/);
 assert.match(api,/stores:count\(0\).*products:count\(1\).*quotes:count\(2\).*documents:count\(3\).*tasks:count\(4\)/);
 assert.doesNotMatch(api,/data\[[0-4]\]\.results\[0\]\?\.n/);
});
