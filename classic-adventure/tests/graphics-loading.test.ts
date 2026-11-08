import test from 'node:test';import assert from 'node:assert/strict';import{loadGraphics}from'../src/platform/load-queue';
const turn=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve}}
test('all image families share three occupied slots and queued work starts in FIFO order',async()=>{
 const gates=Array.from({length:9},deferred),started:number[]=[];let active=0,peak=0;
 const jobs=gates.map((g,i)=>loadGraphics(async()=>{started.push(i);peak=Math.max(peak,++active);await g.promise;active--;return i;}));
 await turn();assert.deepEqual(started,[0,1,2]);gates[1].resolve();await turn();assert.deepEqual(started,[0,1,2,3]);gates[0].resolve();await turn();assert.deepEqual(started,[0,1,2,3,4]);
 for(const g of gates)g.resolve();assert.deepEqual(await Promise.all(jobs),[0,1,2,3,4,5,6,7,8]);assert.equal(peak,3);assert.equal(active,0);
});
test('a failed image load preserves its error and hands the occupied slot to the next job',async()=>{
 const gates=[deferred(),deferred(),deferred()],failure=new Error('decode failed'),started:number[]=[];
 const jobs=Array.from({length:6},(_,i)=>loadGraphics(async()=>{started.push(i);if(i<3)await gates[i].promise;if(i===1)throw failure;return i;}).then(value=>({value}),error=>({error})));
 await turn();assert.deepEqual(started,[0,1,2]);gates[1].resolve();await turn();assert.deepEqual(started,[0,1,2,3,4,5]);gates[0].resolve();gates[2].resolve();const result=await Promise.all(jobs);assert.deepEqual(result[1],{error:failure});assert.deepEqual(result[5],{value:5});assert.equal(await loadGraphics(async()=>42),42);
});
