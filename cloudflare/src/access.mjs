// Validate Access signatures independently of hostname, CORS and claimed email headers.
const decoder = new TextDecoder();
const bytes = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const parse = s => JSON.parse(decoder.decode(bytes(s)));
const cache = new Map();
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export async function identity(request, env, fetcher=fetch) {
  const team=env.ACCESS_TEAM_DOMAIN, audience=env.ACCESS_AUD;
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team||'') || !audience || audience==='UNCONFIGURED') throw new HttpError(503,'Access configuration required');
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length>16384) throw new HttpError(401,'Sign in with Cloudflare Access');
  try {
    const parts=token.split('.'); if(parts.length!==3) throw Error();
    const [h,p]=parts.slice(0,2).map(parse), now=Date.now()/1000;
    if(h.alg!=='RS256'||typeof h.kid!=='string'||p.iss!==`https://${team}`||!Array.isArray(p.aud)||!p.aud.includes(audience)||!Number.isFinite(p.exp)||p.exp<=now||!Number.isFinite(p.iat)||p.iat>now+30||(p.nbf!==undefined&&(!Number.isFinite(p.nbf)||p.nbf>now+30))||typeof p.sub!=='string'||!p.sub||typeof p.email!=='string'||!p.email.includes('@')||p.type!=='app') throw Error();
    let entry=cache.get(team);
    if(!entry||entry.until<Date.now()) {
      const res=await fetcher(`https://${team}/cdn-cgi/access/certs`,{redirect:'error'});
      if(!res.ok) throw Error();
      const body=await res.json(); if(!Array.isArray(body.keys))throw Error();
      entry={keys:body.keys,until:Date.now()+300000}; cache.set(team,entry);
    }
    const jwk=entry.keys.find(k=>k.kid===h.kid&&k.kty==='RSA'); if(!jwk)throw Error();
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]))) throw Error();
    return {id:p.sub,email:p.email.toLowerCase()};
  } catch {throw new HttpError(401,'Invalid or expired Access identity');}
}
export function checkMutation(request) {
  if(['GET','HEAD'].includes(request.method))return;
  const origin=request.headers.get('Origin');
  if(origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new HttpError(403,'Same-origin request required');
}
export async function jobRole(env, job, user) {
  if(!env.DB)throw new HttpError(503,'Staging database not configured');
  const row=await env.DB.prepare('SELECT role FROM i466_job_access WHERE job_id = ? AND principal_id = ?').bind(job,user.id).first();
  if(!row)throw new HttpError(403,'Work-order access required');
  return row.role;
}
export const canWrite=role=>['mechanic','verifier','admin'].includes(role);
export const canVerify=role=>['verifier','admin'].includes(role);
