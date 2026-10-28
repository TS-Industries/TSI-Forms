/* Staging-only adapters; original form source/calculations remain unchanged. */
(()=>{
'use strict';
const original=window.fetch.bind(window),legacy='https://tsi-overhaul-api.jason-184.workers.dev',versions=new Map();
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
window.fetch=async(input,init)=>{
 const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url,url=new URL(raw,location.href);
 if(url.hostname.endsWith('.supabase.co'))throw new Error('Direct legacy connection blocked in secure staging.');
 if(url.origin===legacy){const target=location.origin+url.pathname+url.search;input=input instanceof Request?new Request(target,input):target;url.href=target;}
 const method=(init?.method||input.method||'GET').toUpperCase(),match=url.origin===location.origin&&url.pathname.match(/^\/api\/job\/([^/]+)$/);
 if(match&&method==='POST'){
  const rows=JSON.parse(init.body);if(Array.isArray(rows)){
   const known=versions.get(match[1])||{},base=Object.fromEntries(rows.map(r=>[r.field_id,known[r.field_id]??null]));
   const session=await original('/api/session',{credentials:'same-origin'});if(!session.ok)return session;
   const owner=await session.json(),payload={rows:rows.map(r=>({...r,field_value:String(r.field_value??'')})),base};
   const id=await digest(JSON.stringify({owner:owner.id,job:match[1],...payload}));
   init={...init,body:JSON.stringify({...payload,id})};
  }
 }
 const response=await original(input,{...init,credentials:'same-origin'});
 if(match&&response.ok){
  const data=await response.clone().json();
  if(method==='GET'&&Array.isArray(data))versions.set(match[1],Object.fromEntries([...data].reverse().map(r=>[r.field_id,r.updated_at])));
  if(method==='POST'&&data.updated_at){const known=versions.get(match[1])||{};for(const row of JSON.parse(init.body).rows)known[row.field_id]=data.updated_at;versions.set(match[1],known);}
 }
 return response;
};
// The two legacy Supabase forms use only select/eq/order/limit and upsert.
// This compatibility adapter keeps their existing job suffixes and field IDs.
window.TSI_DATA={from(){return {
 async upsert(input){try{const rows=Array.isArray(input)?input:[input],job=rows[0]?.job_id;if(!job||rows.some(r=>r.job_id!==job))throw Error('Mixed work-order save rejected');const res=await fetch('/api/job/'+encodeURIComponent(job),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rows)});return {error:res.ok?null:await res.json()};}catch(e){return {error:{message:e.message}};}},
 select(){let job;const chain={eq(key,value){if(key!=='job_id')throw Error('Unsupported query');job=value;return chain;},order(){return chain;},limit(){return chain;},async then(resolve,reject){try{if(!job)throw Error('Work order required');const res=await fetch('/api/job/'+encodeURIComponent(job));resolve(res.ok?{data:await res.json(),error:null}:{data:null,error:await res.json()});}catch(e){reject(e);}}};return chain;}
};}};
const rewrite=el=>{if(el.tagName==='IMG'&&el.getAttribute('src')?.startsWith(legacy+'/'))el.src=el.getAttribute('src').slice(legacy.length);};
const watch=()=>{
 document.querySelectorAll('img').forEach(rewrite);
 new MutationObserver(changes=>changes.forEach(c=>{
 if(c.type==='attributes')rewrite(c.target);
 for(const n of c.addedNodes||[])if(n.nodeType===1){rewrite(n);n.querySelectorAll('img').forEach(rewrite);}
 })).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();
})();
