import {cp,mkdir,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(base,'dist');
// Only reviewed application assets; never enumerate legacy forms or records.
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(resolve(base,'public'),out,{recursive:true});
await cp(resolve(base,'src/outbox.mjs'),resolve(out,'outbox.mjs'));
console.log('Prepared application shell without manuals, legacy forms or job records.');
