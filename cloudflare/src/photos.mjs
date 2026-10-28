import {HttpError,jobRole,canWrite} from './access.mjs';
const segment=s=>{let value;try{value=decodeURIComponent(s);}catch{throw new HttpError(400,'Invalid photo path');}if(!value||value.length>200||/[\\/\x00-\x1f]/.test(value)||value==='.'||value==='..')throw new HttpError(400,'Invalid photo path');return value;};
export async function photos(request,env,user) {
 const path=new URL(request.url).pathname;
 let m=path.match(/^\/photos\/([^/]+)\/([^/]+)\/([^/]+)$/);
 if(m) {
  const [job,field,name]=m.slice(1).map(segment);await jobRole(env,job,user);
  if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'Method not allowed');
  if(!env.PHOTOS)throw new HttpError(503,'Private staging photo storage not configured');
  const object=await env.PHOTOS.get(`${job}/${field}/${name}`);if(!object)throw new HttpError(404,'Photo not found');
  const headers=new Headers({'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  return new Response(request.method==='HEAD'?null:object.body,{headers});
 }
 m=path.match(/^\/api\/photos\/([^/]+)\/([^/]+)$/);
 if(!m)return null;
 const [job,field]=m.slice(1).map(segment),role=await jobRole(env,job,user);
 if(request.method!=='POST')throw new HttpError(405,'Photo objects are retained; destructive deletion disabled');
 if(!canWrite(role))throw new HttpError(403,'Photo upload requires mechanic role');
 if(!env.PHOTOS)throw new HttpError(503,'Private staging photo storage not configured');
 const type=request.headers.get('Content-Type')?.split(';')[0];
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];if(!ext)throw new HttpError(415,'JPEG, PNG or WebP required');
 if(Number(request.headers.get('Content-Length'))>20000000)throw new HttpError(413,'Photo exceeds 20 MB');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Photo is empty');
 let size=0,parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20000000){await reader.cancel();throw new HttpError(413,'Photo exceeds 20 MB');}parts.push(value);}
 const data=new Uint8Array(size);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}
 const valid=ext==='jpg'?data[0]===255&&data[1]===216&&data[2]===255:ext==='png'?[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v):new TextDecoder().decode(data.slice(0,4))==='RIFF'&&new TextDecoder().decode(data.slice(8,12))==='WEBP';
 if(!valid)throw new HttpError(422,'Photo signature does not match its type');
 const key=`${job}/${field}/${crypto.randomUUID()}.${ext}`;
 await env.PHOTOS.put(key,data,{httpMetadata:{contentType:type},customMetadata:{actor:user.id}});
 return Response.json({key,url:'/photos/'+key.split('/').map(encodeURIComponent).join('/')},{status:201});
}
