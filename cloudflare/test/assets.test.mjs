import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,mkdtempSync,mkdirSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
test('build excludes root procedures, records, and stale dist assets',()=>{
 const temp=mkdtempSync(join(tmpdir(),'tsi-assets-')),base=join(temp,'cloudflare');
 mkdirSync(join(base,'scripts'),{recursive:true});mkdirSync(join(base,'src'));mkdirSync(join(base,'dist'));
 cpSync('scripts/build.mjs',join(base,'scripts/build.mjs'));cpSync('public',join(base,'public'),{recursive:true});cpSync('src/outbox.mjs',join(base,'src/outbox.mjs'));
 writeFileSync(join(temp,'CONFIDENTIAL-test.html'),'PRIVATE SENTINEL');writeFileSync(join(base,'dist/stale.html'),'PRIVATE SENTINEL');
 try{execFileSync(process.execPath,['scripts/build.mjs'],{cwd:base});assert.deepEqual(readdirSync(join(base,'dist')).sort(),['app.mjs','index.html','outbox.mjs','style.css']);for(const file of readdirSync(join(base,'dist')))assert.ok(!readFileSync(join(base,'dist',file),'utf8').includes('PRIVATE SENTINEL'));}finally{rmSync(temp,{recursive:true,force:true});}
});
test('UI renders evidence as text and has mobile viewport',()=>{const app=readFileSync('public/app.mjs','utf8');assert.ok(!app.includes('innerHTML'));assert.ok(readFileSync('public/index.html','utf8').includes('name="viewport"'));});
