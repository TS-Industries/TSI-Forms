import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/bundle-dashboard.mjs']);
const {default:worker}=await import('../bundle/worker.mjs');
test('standalone dashboard bundle denies assets and API without configured Access',async()=>{for(const path of ['/','/app.mjs','/outbox.mjs','/api/session','/api/i466/QA/events'])assert.equal((await worker.fetch(new Request('https://staging.example'+path),{})).status,503);});
test('standalone dashboard bundle denies anonymous access with configured Access',async()=>{const env={ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'qa'};for(const path of ['/','/style.css','/api/session','/photos/QA/x/a.jpg'])assert.equal((await worker.fetch(new Request('https://staging.example'+path),env)).status,401);});
