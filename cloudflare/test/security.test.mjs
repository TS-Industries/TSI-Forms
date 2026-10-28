import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{canonicalJob,route} from '../src/worker.mjs';
import {identity,checkMutation} from '../src/access.mjs';
const env={ACCESS_TEAM_DOMAIN:'tsi-test.cloudflareaccess.com',ACCESS_AUD:'test-audience'};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicKey={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key'},now=Math.floor(Date.now()/1000);
async function token(overrides={},header={}){
 const prefix=encode({alg:'RS256',kid:'test-key',...header})+'.'+encode({iss:'https://'+env.ACCESS_TEAM_DOMAIN,aud:[env.ACCESS_AUD],sub:'mechanic-1',email:'MECHANIC@example.com',type:'app',iat:now,exp:now+300,...overrides});
 return prefix+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(prefix))).toString('base64url');
}
const req=t=>new Request('https://tsi.example/api/session',{headers:{'Cf-Access-Jwt-Assertion':t}}),certs=async()=>Response.json({keys:[publicKey]});
test('valid signed identity; normalized email',async()=>assert.deepEqual(await identity(req(await token()),env,certs),{id:'mechanic-1',email:'mechanic@example.com'}));
for(const [name,claim] of Object.entries({expired:{exp:now-1},issuer:{iss:'https://attacker.example'},audience:{aud:['other']},future:{iat:now+100},notBefore:{nbf:now+100},missingSubject:{sub:''},serviceIdentity:{email:undefined},missingExpiration:{exp:undefined},wrongType:{type:'service'}}))test('reject '+name,async()=>assert.rejects(identity(req(await token(claim)),env,certs),{status:401}));
test('reject unsigned algorithm',async()=>assert.rejects(identity(req(await token({}, {alg:'none'})),env,certs),{status:401}));
test('reject forged signature',async()=>{const t=await token();await assert.rejects(identity(req(t.slice(0,-8)+'AAAAAAAA'),env,certs),{status:401});});
for(const path of ['/', '/index.html','/checklist-466.html','/api/job/WO-test','/photos/WO/x/y.jpg','/api/photos/WO/x','/api/i466/WO/events'])test('anonymous access denied '+path,async()=>{const res=await worker.fetch(new Request('https://tsi.example'+path),env);assert.equal(res.status,401);assert.equal(res.headers.get('cache-control'),'private, no-store');});
test('unconfigured authentication fails closed',async()=>assert.equal((await worker.fetch(new Request('https://tsi.example/'),{})).status,503));
test('cross-origin writes rejected',()=>assert.throws(()=>checkMutation(new Request('https://tsi.example/api/x',{method:'POST',headers:{Origin:'https://evil.example'}})),{status:403}));
test('same-origin writes permitted',()=>checkMutation(new Request('https://tsi.example/api/x',{method:'POST',headers:{Origin:'https://tsi.example'}})));
test('no-origin writes rejected',()=>assert.throws(()=>checkMutation(new Request('https://tsi.example/api/x',{method:'POST'})),{status:403}));
test('I466 namespace compatibility',()=>{assert.equal(canonicalJob('WO-2026-0086'),'NG466-WO-2026-0086');assert.equal(canonicalJob('NG466-WO-2026-0086'),'NG466-WO-2026-0086');});
test('invalid job identifiers rejected',()=>{for(const key of ['',' WO','WO/1','WO\\1','WO\u0000'])assert.throws(()=>canonicalJob(key),{status:422});});
test('missing DB is not interpreted as empty work order',async()=>assert.rejects(route(new Request('https://tsi.example/api/i466/WO/events'),{}, {id:'x'}),{status:503}));
test('missing membership denies access',async()=>{const DB={prepare:()=>({bind:()=>({first:async()=>null})})};await assert.rejects(route(new Request('https://tsi.example/api/i466/WO/events'),{DB},{id:'x'}),{status:403});});
test('assets not reached without authentication',async()=>{let touched=false;const res=await worker.fetch(new Request('https://tsi.example/'),{...env,ASSETS:{fetch:()=>{touched=true;return new Response('secret');}}});assert.equal(res.status,401);assert.equal(touched,false);});
