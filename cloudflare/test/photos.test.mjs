import test from 'node:test';
import assert from 'node:assert/strict';
import {photos} from '../src/photos.mjs';
const user={id:'mechanic',email:'mechanic@example.com'};
function env(role='mechanic'){return {DB:{prepare:()=>({bind:()=>({first:async()=>role?{role}:null})})},PHOTOS:{get:async key=>({body:'private-image',httpMetadata:{contentType:'image/jpeg'}}),put:async()=>{}}};}
test('photo download requires membership even with known key',async()=>assert.rejects(photos(new Request('https://tsi.example/photos/WO/field/known.jpg'),env(null),user),{status:403}));
test('photo response uses private headers',async()=>{const r=await photos(new Request('https://tsi.example/photos/WO/field/known.jpg'),env(),user);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');});
test('encoded path separators cannot cross work orders',async()=>assert.rejects(photos(new Request('https://tsi.example/photos/WO%2Fother/field/file.jpg'),env(),user),{status:400}));
test('image content signature validated before storing',async()=>{let touched=false;const e=env();e.PHOTOS.put=async()=>{touched=true;};await assert.rejects(photos(new Request('https://tsi.example/api/photos/WO/field',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:'<html>bad</html>'}),e,user),{status:422});assert.equal(touched,false);});
test('viewer cannot upload',async()=>assert.rejects(photos(new Request('https://tsi.example/api/photos/WO/field',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:new Uint8Array([255,216,255,0])}),env('viewer'),user),{status:403}));
test('valid photo upload returns authenticated relative route',async()=>{const r=await photos(new Request('https://tsi.example/api/photos/WO/field',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:new Uint8Array([255,216,255,0])}),env(),user);assert.equal(r.status,201);assert.match((await r.json()).url,/^\/photos\/WO\/field\//);});
test('photo deletion cannot destroy data',async()=>assert.rejects(photos(new Request('https://tsi.example/api/photos/WO/field',{method:'DELETE'}),env(),user),{status:405}));
test('uploaded photo bytes round-trip through private storage and HEAD has no body',async()=>{
 const e=env(),objects=new Map(),bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
 e.PHOTOS.put=async(key,data,options)=>objects.set(key,{body:data,httpMetadata:options.httpMetadata});
 e.PHOTOS.get=async key=>objects.get(key);
 const response=await photos(new Request('https://tsi.example/api/photos/QA-ONLY/inspection',{method:'POST',headers:{'Content-Type':'image/png'},body:bytes}),e,user);
 const {url}=await response.json();
 const get=await photos(new Request('https://tsi.example'+url),e,user);
 assert.deepEqual(new Uint8Array(await get.arrayBuffer()),bytes);assert.equal(get.headers.get('Content-Type'),'image/png');
 const head=await photos(new Request('https://tsi.example'+url,{method:'HEAD'}),e,user);assert.equal(await head.text(),'');
 await assert.rejects(photos(new Request('https://tsi.example'+url),{...e,DB:env(null).DB},user),{status:403});
});
