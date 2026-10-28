// Events remain on device until the server acknowledges the same immutable ID.
// Store is deliberately injected so reconnect behavior can be tested without a browser.
export class Outbox {
 constructor(store,send){this.store=store;this.send=send;this.running=false;}
 async enqueue(owner,job,event){if(!owner||!job||!event.id)throw Error('Authenticated owner, work order and event ID required');const record={id:event.id,owner,job,event,status:'pending'};const prior=await this.store.get(record.id);if(prior&&(prior.owner!==owner||prior.job!==job||JSON.stringify(prior.event)!==JSON.stringify(event)))throw Error('Cannot replace an existing event');if(!prior)await this.store.put(record);return record.id;}
 async flush(owner){if(this.running)return {busy:true};this.running=true;let sent=0;try{
  for(const record of await this.store.all()){
   if(record.owner!==owner||record.status!=='pending')continue;
   let response;try{response=await this.send(record);}catch{return {sent,offline:true};}
   if(response.status===401||response.status===403)return {sent,blocked:true};
   if(response.status===409||response.status===422){await this.store.put({...record,status:'review',reason:await response.text()});continue;}
   if(!response.ok)return {sent,retry:true};
   const ack=await response.json();if(ack.id!==record.id)return {sent,invalidAcknowledgement:true};
   await this.store.put({...record,status:'acknowledged'});sent++;
  }return {sent};
 }finally{this.running=false;}}
}
export function browserStore(){
 let db;
 const open=()=>db?Promise.resolve(db):new Promise((resolve,reject)=>{const req=indexedDB.open('tsi-secure-outbox-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('events',{keyPath:'id'});req.onsuccess=()=>{db=req.result;resolve(db);};req.onerror=()=>reject(req.error);});
 const run=async(mode,action)=>{const database=await open();return new Promise((resolve,reject)=>{const tx=database.transaction('events',mode),req=action(tx.objectStore('events'));let result;req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Local save aborted'));});};
 return {get:id=>run('readonly',s=>s.get(id)),all:()=>run('readonly',s=>s.getAll()),put:r=>run('readwrite',s=>s.put(r))};
}
