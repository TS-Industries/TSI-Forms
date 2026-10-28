// Generated protected assets must never be committed to public source.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve(process.argv[2]||'..'),out=resolve('private-assets');
await mkdir(out,{recursive:true});
for(const file of ['checklist-test.html','checklist-466.html']){
 let content=await readFile(resolve(source,file),'utf8');
 content=content.replace(/<head>/i,'<head><script src="/tsi-runtime.js"></script>');
 content=content.replaceAll('https://ts-industries.github.io/TSI-Forms/report.html','/report.html');
 content=content.replaceAll('href="TSI-SRC466-Workflow.html"','href="/"');
 content=content.replaceAll('Work Order #','Iron Track / engine reference');
 await writeFile(resolve(out,file),content);
}
await writeFile(resolve(out,'tsi-runtime.js'),await readFile('src/runtime.js','utf8'));
console.log('Prepared original forms for authenticated internal staging only.');
