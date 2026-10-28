import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('build excludes root procedures, records, and stale dist assets',()=>{
 writeFileSync('../CONFIDENTIAL-test.html','PRIVATE SENTINEL');writeFileSync('dist/stale.html','PRIVATE SENTINEL');
 try{execFileSync(process.execPath,['scripts/build.mjs']);assert.deepEqual(readdirSync('dist').sort(),['app.mjs','index.html','outbox.mjs','style.css']);for(const file of readdirSync('dist'))assert.ok(!readFileSync('dist/'+file,'utf8').includes('PRIVATE SENTINEL'));}finally{unlinkSync('../CONFIDENTIAL-test.html');}
});
test('UI renders evidence as text and has mobile viewport',()=>{const app=readFileSync('public/app.mjs','utf8');assert.ok(!app.includes('innerHTML'));assert.ok(readFileSync('public/index.html','utf8').includes('name="viewport"'));});
