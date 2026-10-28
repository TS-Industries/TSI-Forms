import {customerReport,internalReport} from './reports.mjs';
import {legacy} from './legacy.mjs';
import {photos} from './photos.mjs';
import {identity,checkMutation,jobRole,canWrite,canVerify,HttpError} from './access.mjs';
const json=(v,status=200)=>Response.json(v,{status});
const required=(s,n=200)=>{if(typeof s!=='string'||!s.trim()||s.length>n)throw new HttpError(422,'Required field invalid');return s;};
export function canonicalJob(raw) {
  required(raw,160);
  if(raw!==raw.trim()||/[\\/\x00-\x1f]/.test(raw))throw new HttpError(422,'Invalid work order');
  // Retain case and punctuation: existing database identifiers must not be normalized destructively.
  return raw.startsWith('NG466-')?raw:'NG466-'+raw;
}
async function body(request) {
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'JSON required');
  const text=await request.text();if(text.length>1000000)throw new HttpError(413,'Request too large');
  try{return JSON.parse(text);}catch{throw new HttpError(400,'Invalid JSON');}
}
function secure(response) {
  const r=new Response(response.body,response);r.headers.set('Cache-Control','private, no-store');
  r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('Referrer-Policy','same-origin');
  r.headers.set('X-Frame-Options','SAMEORIGIN');r.headers.set('Permissions-Policy','camera=(self), microphone=(), geolocation=()');
  return r;
}
export async function route(request,env,user) {
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/session'&&request.method==='GET')return json(user);
  let m=path.match(/^\/api\/i466\/([^/]+)\/(events|state|shared|report)$/);
  if(m) {
    const job=canonicalJob(decodeURIComponent(m[1])), kind=m[2], role=await jobRole(env,job,user);
    if(request.method==='GET') {
      if(kind==='report'){
        if(url.searchParams.get('audience')==='customer')return json(customerReport(job));
        if(!canVerify(role))throw new HttpError(403,'Internal report requires verifier role');
        const events=(await env.DB.prepare('SELECT * FROM i466_workflow_events WHERE job_id = ? ORDER BY created_at,id').bind(job).all()).results;
        const state=(await env.DB.prepare('SELECT * FROM i466_workflow_state WHERE job_id = ? ORDER BY step_id').bind(job).all()).results;
        return json(internalReport(job,events,state));
      }
      if(kind==='events')return json((await env.DB.prepare('SELECT * FROM i466_workflow_events WHERE job_id = ? ORDER BY created_at,id').bind(job).all()).results);
      if(kind==='state')return json((await env.DB.prepare('SELECT * FROM i466_workflow_state WHERE job_id = ? ORDER BY step_id').bind(job).all()).results);
      return json((await env.DB.prepare('SELECT field_id,field_value,updated_at FROM overhaul_data WHERE job_id = ? ORDER BY updated_at DESC').bind(job).all()).results);
    }
    if(request.method!=='POST')throw new HttpError(405,'Method not allowed');
    if(!canWrite(role))throw new HttpError(403,'Read-only work order');
    if(kind==='report')throw new HttpError(405,'Read-only report');
    if(kind==='shared')throw new HttpError(503,'Shared writes await legacy compatibility verification');
    const data=await body(request);
    if(kind==='events') {
      required(data.id,80); if(!/^[a-zA-Z0-9_-]+$/.test(data.id))throw new HttpError(422,'Invalid event ID');
      if(!['torque','measurement','nonconformance','signoff','part','step'].includes(data.event_type))throw new HttpError(422,'Invalid event type');
      required(data.component);const p=data.payload; if(!p||typeof p!=='object'||Array.isArray(p))throw new HttpError(422,'Invalid payload');
      const approval=p.action==='approve'||p.action==='verify';
      if(p.action&&!approval)throw new HttpError(422,'Unsupported review action');
      if(!approval&&data.event_type==='torque') {
        required(p.specification);required(p.source);required(p.stage);required(p.units);required(p.tool);
        if(!Number.isFinite(p.actual)||p.actual<0)throw new HttpError(422,'Actual torque must be numeric');
      }
      if(!approval&&data.event_type==='measurement') {required(p.field_id);required(p.value);required(p.units);required(p.phase);}
      if(!approval&&data.event_type==='part') {required(p.part_number);required(p.location);required(p.status);if(!['ordered','received','installed'].includes(p.status)||!Number.isFinite(p.quantity)||p.quantity<=0)throw new HttpError(422,'Invalid part record');}
      if(approval) {
        if(!canVerify(role))throw new HttpError(403,'Verifier role required');
        required(p.event_id,80);
        const prior=await env.DB.prepare('SELECT actor,event_type,component,payload_json FROM i466_workflow_events WHERE id = ? AND job_id = ?').bind(p.event_id,job).first();
        if(!prior||prior.event_type!==data.event_type)throw new HttpError(422,'Referenced event not found');
        if(prior.component!==data.component||JSON.parse(prior.payload_json).action)throw new HttpError(422,'Review must reference original component evidence');
        if(prior.actor===user.id)throw new HttpError(403,'Independent verifier required');
        required(p.disposition);required(p.evidence);
      }
      const payload=JSON.stringify({...p,actor_email:user.email});if(payload.length>50000)throw new HttpError(413,'Event too large');
      // Retry is accepted only for identical content, job and authenticated actor.
      const previous=await env.DB.prepare('SELECT * FROM i466_workflow_events WHERE id = ?').bind(data.id).first();
      if(previous) {
        if(previous.job_id!==job||previous.actor!==user.id||previous.event_type!==data.event_type||previous.component!==data.component||previous.payload_json!==payload)throw new HttpError(409,'Event ID already used with different content');
        return json({id:data.id,replayed:true});
      }
      await env.DB.prepare('INSERT INTO i466_workflow_events(id,job_id,event_type,component,payload_json,actor) VALUES(?,?,?,?,?,?)').bind(data.id,job,data.event_type,data.component,payload,user.id).run();
      return json({id:data.id},201);
    }
    required(data.step_id); if(!/^P\d{2}-\d{2}$/.test(data.step_id))throw new HttpError(422,'Invalid operation');
    if(!['pending','in_progress','blocked'].includes(data.status))throw new HttpError(422,'Server-verified completion not enabled');
    if(!Number.isInteger(data.revision)||data.revision<0)throw new HttpError(422,'Revision required');
    const stmt=data.revision===0
      ?env.DB.prepare('INSERT INTO i466_workflow_state(job_id,step_id,status,revision,updated_by) VALUES(?,?,?,1,?) ON CONFLICT(job_id,step_id) DO NOTHING').bind(job,data.step_id,data.status,user.id)
      :env.DB.prepare("UPDATE i466_workflow_state SET status=?,revision=revision+1,updated_by=?,updated_at=datetime('now') WHERE job_id=? AND step_id=? AND revision=?").bind(data.status,user.id,job,data.step_id,data.revision);
    const result=await stmt.run();if(result.meta.changes!==1)throw new HttpError(409,'Operation changed on another device; review before retrying');
    return json({revision:data.revision+1});
  }
  const legacyResponse=await legacy(request,env,user);if(legacyResponse)return legacyResponse;
  const photoResponse=await photos(request,env,user);if(photoResponse)return photoResponse;
  if(path.startsWith('/api/')||path.startsWith('/photos/'))throw new HttpError(503,'Route not enabled in staging');
  if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'Method not allowed');
  if(!env.ASSETS)throw new HttpError(503,'Assets not configured');
  return env.ASSETS.fetch(request);
}
export default {async fetch(request,env) {
  try {const user=await identity(request,env);checkMutation(request);return secure(await route(request,env,user));}
  catch(e){if(!(e instanceof HttpError))console.error('TSI request failed');return secure(json({error:e instanceof HttpError?e.message:'Request failed'},e.status||500));}
}};
