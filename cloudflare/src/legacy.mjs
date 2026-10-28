import {HttpError,jobRole,canWrite} from './access.mjs';
const parseJob=raw=>{let job;try{job=decodeURIComponent(raw);}catch{throw new HttpError(400,'Invalid job');}if(!job||job.length>160||/[\\/\x00-\x1f]/.test(job))throw new HttpError(422,'Invalid job');return job;};
export async function legacy(request,env,user) {
 const m=new URL(request.url).pathname.match(/^\/api\/job\/([^/]+)$/);if(!m)return null;
 const job=parseJob(m[1]),role=await jobRole(env,job,user);
 if(request.method==='GET')return Response.json((await env.DB.prepare('SELECT field_id,field_value,updated_at FROM overhaul_data WHERE job_id=? ORDER BY updated_at DESC').bind(job).all()).results.map(r=>({...r,job_id:job})));
 if(request.method!=='POST')throw new HttpError(405,'Destructive field deletion is disabled');
 if(!canWrite(role))throw new HttpError(403,'Work order is read only');
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'JSON required');
 const raw=await request.text();if(raw.length>1000000)throw new HttpError(413,'Save too large');
 let data;try{data=JSON.parse(raw);}catch{throw new HttpError(400,'Invalid JSON');}
 // Existing forms submit arrays. The staging runtime wraps them with read versions.
 if(!data||Array.isArray(data)||!Array.isArray(data.rows)||!data.base||typeof data.base!=='object'||!/^[-a-zA-Z0-9_]{1,80}$/.test(data.id||''))throw new HttpError(428,'Read versions and an idempotency ID are required');
 if(!data.rows.length||data.rows.length>100)throw new HttpError(422,'Save between 1 and 100 fields');
 const seen=new Set();
 const nonce=BigInt('0x'+crypto.randomUUID().replaceAll('-','')).toString().padStart(39,'0');
 const now=new Date().toISOString().slice(0,-1)+nonce+'Z';
 const rows=data.rows.map(r=>{
  if(typeof r.field_id!=='string'||!r.field_id||r.field_id.length>200||seen.has(r.field_id)||typeof r.field_value!=='string'||r.field_value.length>700000)throw new HttpError(422,'Invalid or duplicate field');seen.add(r.field_id);
  if(!Object.hasOwn(data.base,r.field_id)||!(data.base[r.field_id]===null||typeof data.base[r.field_id]==='string'))throw new HttpError(428,'Missing read version');
  return {field_id:r.field_id,field_value:r.field_value};
 });
 const content=JSON.stringify({rows,base:data.base,actor_email:user.email}),id='save_'+data.id;
 const existing=await env.DB.prepare('SELECT job_id,actor,payload_json FROM i466_workflow_events WHERE id=?').bind(id).first();
 if(existing){if(existing.job_id!==job||existing.actor!==user.id||existing.payload_json!==content)throw new HttpError(409,'Save ID conflict');return Response.json({saved:rows.length,replayed:true});}
 // All expected field versions are checked inside the same D1 transaction as the
 // history and updates. The installed event_type CHECK aborts the batch on conflict.
 const condition="NOT EXISTS(SELECT 1 FROM json_each(?) expected LEFT JOIN overhaul_data d ON d.job_id=? AND d.field_id=expected.key WHERE (expected.value IS NULL AND d.field_id IS NOT NULL) OR (expected.value IS NOT NULL AND (d.field_id IS NULL OR d.updated_at IS NOT expected.value)))";
 const statements=[env.DB.prepare(`INSERT INTO i466_workflow_events(id,job_id,event_type,component,payload_json,actor) SELECT ?,?,CASE WHEN ${condition} THEN 'step' ELSE 'conflict' END,'legacy:save',?,?`).bind(id,job,JSON.stringify(data.base),job,content,user.id)];
 for(const r of rows){
  statements.push(env.DB.prepare('INSERT INTO overhaul_data_history(job_id,field_id,field_value,source,created_at) VALUES(?,?,?,?,?)').bind(job,r.field_id,r.field_value,'access:'+user.id,now));
  statements.push(env.DB.prepare('INSERT INTO overhaul_data(job_id,field_id,field_value,updated_at) VALUES(?,?,?,?) ON CONFLICT(job_id,field_id) DO UPDATE SET field_value=excluded.field_value,updated_at=excluded.updated_at').bind(job,r.field_id,r.field_value,now));
 }
 try{await env.DB.batch(statements);}catch(e){if(/CHECK constraint|UNIQUE constraint/i.test(e.message||''))throw new HttpError(409,'Saved values changed on another device; local entries are retained for review');throw e;}
 return Response.json({saved:rows.length,updated_at:now});
}
