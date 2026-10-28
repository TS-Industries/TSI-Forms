// Standalone dashboard artifact; inputs restricted to reviewed modules and dist.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
const exports={access:['HttpError','identity','checkMutation','jobRole','canWrite','canVerify'],legacy:['legacy'],photos:['photos'],reports:['customerReport','internalReport']};
let output='';
for(const [name,names] of Object.entries(exports)){
 let source=await readFile(`src/${name}.mjs`,'utf8');
 source=source.replace(/^import \{([^}]+)\} from '\.\/access.mjs';/m,'const {$1}=module_access;').replaceAll('export ','');
 output+=`const module_${name}=(()=>{${source}\nreturn {${names.join(',')}};})();\n`;
}
let source=await readFile('src/worker.mjs','utf8');
source=source.replace(/^import \{([^}]+)\} from '\.\/(\w+).mjs';/gm,'const {$1}=module_$2;').replace('export default ','const appWorker=').replaceAll('export ','');
output+=source;
const types={html:'text/html; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'},assets={};
for(const file of await readdir('dist'))assets['/'+file]={body:await readFile('dist/'+file,'utf8'),type:types[file.split('.').pop()]};
if(process.env.TSI_PROTECTED_ASSETS){for(const file of ['checklist-test.html','checklist-466.html','tsi-runtime.js'])assets['/'+file]={body:await readFile(process.env.TSI_PROTECTED_ASSETS+'/'+file,'utf8'),type:types[file.split('.').pop()]};}
output+=`\nconst assets=${JSON.stringify(assets)};\nexport default {fetch(request,env){return appWorker.fetch(request,{...env,ASSETS:{fetch(request){const path=new URL(request.url).pathname;const asset=assets[path==='/'?'/index.html':path];return asset?new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type}}):new Response('Not found',{status:404});}}});}};\n`;
await mkdir('bundle',{recursive:true});await writeFile('bundle/worker.mjs',output);console.log(process.env.TSI_PROTECTED_ASSETS?'Prepared protected internal bundle. Never publish this generated file.':'Prepared application-only dashboard bundle.');
