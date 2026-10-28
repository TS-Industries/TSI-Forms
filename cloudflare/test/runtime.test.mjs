import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../src/runtime.js',import.meta.url),'utf8');
function runtime(){
 const calls=[];
 const fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url;calls.push({url,init});if(url==='/api/session')return Response.json({id:'test-owner'});if((init?.method||'GET')==='GET')return Response.json([{field_id:'serial',field_value:'old',updated_at:'version-1'}]);return Response.json({updated_at:'version-2'});};
 const window={fetch};
 const document={readyState:'loading',addEventListener(){}};
 vm.runInNewContext(source,{window,document,location:{href:'https://staging.test/checklist.html',origin:'https://staging.test'},URL,Request,Response,crypto,TextEncoder,Map,Uint8Array});
 return {fetch:window.fetch,calls};
}
test('legacy form saves stay same-origin and carry read version and stable retry ID',async()=>{
 const r=runtime(),url='https://tsi-overhaul-api.jason-184.workers.dev/api/job/QA';
 await r.fetch(url);const init={method:'POST',body:JSON.stringify([{field_id:'serial',field_value:'test'}])};
 await r.fetch(url,init);const first=JSON.parse(r.calls.at(-1).init.body);
 assert.equal(r.calls.at(-1).url,'https://staging.test/api/job/QA');assert.equal(first.base.serial,'version-1');assert.equal(first.rows[0].field_value,'test');assert.match(first.id,/^[0-9a-f]{64}$/);
 assert.equal(r.calls.at(-1).init.credentials,'same-origin');
});
test('external notes and AI requests never leave protected staging',async()=>{const r=runtime();await assert.rejects(r.fetch('https://api.anthropic.com/v1/messages',{method:'POST',body:'internal notes'}),/External data/);assert.equal(r.calls.length,0);});
test('old report publication route remains blocked',async()=>{const r=runtime();const response=await r.fetch('/api/job/QA',{method:'POST',body:JSON.stringify([{field_id:'report_html',field_value:'private report'}])});assert.equal(response.status,403);assert.equal(r.calls.length,0);});
test('photo uploads are remapped to staging without changing the image body',async()=>{const r=runtime(),body=new Blob(['test'],{type:'image/png'});await r.fetch('https://tsi-overhaul-api.jason-184.workers.dev/api/photos/QA/field',{method:'POST',body});assert.equal(r.calls[0].url,'https://staging.test/api/photos/QA/field');assert.equal(r.calls[0].init.body,body);});
