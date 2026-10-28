import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {route} from '../src/worker.mjs';
function setup(role='mechanic') {
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('../development/i466-v2-additive-schema.sql','utf8'));
 sql.exec('CREATE TABLE overhaul_data(job_id TEXT,field_id TEXT,field_value TEXT,updated_at TEXT,PRIMARY KEY(job_id,field_id))');
 sql.prepare('INSERT INTO i466_job_access VALUES(?,?,?)').run('NG466-WO-1','user1',role);
 const wrap=(query,args=[])=>({bind:(...values)=>wrap(query,values),first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>{const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};}});
 return {sql,env:{DB:{prepare:wrap}},user:{id:'user1',email:'user1@example.com'}};
}
function post(path,data){return new Request('https://tsi.example/api/i466/WO-1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
const event={id:'e1',event_type:'measurement',component:'Main 1',payload:{field_id:'main1',value:'3.5',units:'in',phase:'original'}};
test('measurement events are immutable and retries idempotent',async()=>{
 const {sql,env,user}=setup();assert.equal((await route(post('events',event),env,user)).status,201);
 assert.equal((await (await route(post('events',event),env,user)).json()).replayed,true);
 assert.equal(sql.prepare('SELECT count(*) n FROM i466_workflow_events').get().n,1);
 await assert.rejects(route(post('events',{...event,payload:{...event.payload,value:'3.6'}}),env,user),{status:409});
 assert.equal(JSON.parse(sql.prepare('SELECT payload_json FROM i466_workflow_events').get().payload_json).value,'3.5');
});
test('actor is authenticated identity, not typed mechanic',async()=>{const {sql,env,user}=setup();await route(post('events',{...event,actor:'admin'}),env,user);assert.equal(sql.prepare('SELECT actor FROM i466_workflow_events').get().actor,'user1');});
test('viewer cannot create audit events',async()=>{const {env,user}=setup('viewer');await assert.rejects(route(post('events',event),env,user),{status:403});});
test('mechanic cannot approve a nonconformance',async()=>{const {env,user}=setup();await assert.rejects(route(post('events',{id:'nc',event_type:'nonconformance',component:'Main',payload:{action:'approve',event_id:'other',disposition:'accepted',evidence:'report'}}),env,user),{status:403});});
test('verifier cannot approve their own work',async()=>{const {env,user}=setup('verifier');await route(post('events',{id:'nc-original',event_type:'nonconformance',component:'Main',payload:{finding:'Out of limit'}}),env,user);await assert.rejects(route(post('events',{id:'nc-approval',event_type:'nonconformance',component:'Main',payload:{action:'approve',event_id:'nc-original',disposition:'accepted',evidence:'report'}}),env,user),{status:403});});
test('state compare-and-swap rejects stale device revision',async()=>{const {sql,env,user}=setup();const operation={step_id:'P01-01',status:'in_progress',revision:0};await route(post('state',operation),env,user);await assert.rejects(route(post('state',operation),env,user),{status:409});await route(post('state',{...operation,revision:1,status:'blocked'}),env,user);assert.equal(sql.prepare('SELECT revision FROM i466_workflow_state').get().revision,2);});
test('client cannot bypass completion gates',async()=>{const {env,user}=setup();await assert.rejects(route(post('state',{step_id:'P01-01',status:'completed',revision:0}),env,user),{status:422});});
test('existing shared field identifiers and values preserved',async()=>{const {sql,env,user}=setup();sql.prepare('INSERT INTO overhaul_data VALUES(?,?,?,?)').run('NG466-WO-1','meta_serial','SERIAL-1','2026-01-01');const result=await (await route(new Request('https://tsi.example/api/i466/WO-1/shared'),env,user)).json();assert.equal(result[0].field_id,'meta_serial');assert.equal(result[0].field_value,'SERIAL-1');});
test('independent verifier can review original measurement without copying measurements',async()=>{const {sql,env,user}=setup('verifier');sql.prepare('INSERT INTO i466_workflow_events(id,job_id,event_type,component,payload_json,actor) VALUES(?,?,?,?,?,?)').run('original','NG466-WO-1','measurement','Main 1',JSON.stringify(event.payload),'other');const approval={id:'verified',event_type:'measurement',component:'Main 1',payload:{action:'verify',event_id:'original',disposition:'accepted',evidence:'independent inspection'}};assert.equal((await route(post('events',approval),env,user)).status,201);await assert.rejects(route(post('events',{...approval,id:'review-review',payload:{...approval.payload,event_id:'verified'}}),env,user),{status:422});});
test('review cannot change the evidence component',async()=>{const {sql,env,user}=setup('verifier');sql.prepare('INSERT INTO i466_workflow_events(id,job_id,event_type,component,payload_json,actor) VALUES(?,?,?,?,?,?)').run('original','NG466-WO-1','measurement','Main 1','{}','other');await assert.rejects(route(post('events',{id:'verified',event_type:'measurement',component:'Main 2',payload:{action:'verify',event_id:'original',disposition:'accepted',evidence:'inspection'}}),env,user),{status:422});});
test('customer report cannot disclose arbitrary internal content',async()=>{const {sql,env,user}=setup('viewer');sql.prepare('INSERT INTO i466_workflow_events(id,job_id,event_type,component,payload_json,actor) VALUES(?,?,?,?,?,?)').run('secret','NG466-WO-1','measurement','SECRET PROCEDURE','{"notes":"CONFIDENTIAL"}','other');const report=await route(new Request('https://tsi.example/api/i466/WO-1/report?audience=customer'),env,user);const text=await report.text();assert.ok(!text.includes('SECRET'));assert.ok(!text.includes('CONFIDENTIAL'));await assert.rejects(route(new Request('https://tsi.example/api/i466/WO-1/report?audience=internal'),env,user),{status:403});});
