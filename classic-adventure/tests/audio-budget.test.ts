import test from 'node:test';import assert from 'node:assert/strict';import {GameAudio} from '../src/platform/audio';import {Game} from '../src/game/model';
test('combat leaves two of twelve voices for cues, releases nodes, and obeys mute',async t=>{
 const previous=globalThis.AudioContext;let context:any;const nodes:any[]=[];
 class Context{
  currentTime=0;destination={};constructor(){context=this}async resume(){}async decodeAudioData(){return {duration:.1}}
  createGain(){return {gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}
  createBufferSource(){const node={buffer:null,connect(){},disconnect(){},start(){},onended:null};nodes.push(node);return node}
 }
 globalThis.AudioContext=Context as unknown as typeof AudioContext;t.after(()=>{globalThis.AudioContext=previous});t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([1])));
 const audio=new GameAudio('/');await audio.unlock(new Game(1,1));for(let i=0;i<30;i++){context.currentTime+=.06;audio.play('shoot')}assert.equal(nodes.length,10);
 audio.play('wave');context.currentTime+=.06;audio.play('flag');assert.equal(nodes.length,12);audio.play('win');assert.equal(nodes.length,12);
 for(const node of nodes)node.onended();context.currentTime+=.06;audio.play('win');assert.equal(nodes.length,13);audio.muted=true;context.currentTime+=.06;audio.play('shoot');assert.equal(nodes.length,13);
});
test('a failed sound response retries later instead of caching a permanent rejection',async t=>{
 const previous=globalThis.AudioContext;let plantRequests=0;
 class Context{
  destination={};async resume(){}async decodeAudioData(){return {duration:.1}}
  createGain(){return {gain:{value:1},connect(){}}}
 }
 globalThis.AudioContext=Context as unknown as typeof AudioContext;t.after(()=>{globalThis.AudioContext=previous});
 t.mock.method(globalThis,'fetch',async(url:string)=>{
  if(url.endsWith('plant_water.mp3')&&++plantRequests===1)return new Response('',{status:503});
  return new Response(new Uint8Array([1]));
 });
 const audio=new GameAudio('/');await assert.rejects(audio.unlock(new Game(1,1)),/HTTP 503/);
 await assert.doesNotReject(audio.unlock(new Game(1,1)));assert.equal(plantRequests,2);
});
test('classic variants use cached samples and one quiet combat bus, including partial loading',async t=>{
 const previous=globalThis.AudioContext;let context:any;const sources:any[]=[];const gains:any[]=[];let requests=0;
 class Context{
  currentTime=0;destination={};constructor(){context=this}async resume(){}
  async decodeAudioData(data:ArrayBuffer){return {file:new TextDecoder().decode(data)}}
  createGain(){const node={gain:{value:1},connect(){}};gains.push(node);return node}
  createBufferSource(){const node={buffer:null as any,destination:null as any,connect(output:any){this.destination=output},disconnect(){},start(){},onended:null};sources.push(node);return node}
 }
 globalThis.AudioContext=Context as unknown as typeof AudioContext;t.after(()=>{globalThis.AudioContext=previous});
 t.mock.method(globalThis,'fetch',async(url:string)=>{requests++;return new Response(new TextEncoder().encode(url))});
 const random=t.mock.method(Math,'random',()=>.999);const audio=new GameAudio('/');await audio.unlock(new Game(9,1));const loaded=requests;
 audio.play('shoot');context.currentTime+=.06;audio.play('hit');
 assert.ok(sources[0].buffer.file.endsWith('/throw2.mp3'));assert.ok(sources[1].buffer.file.endsWith('/splat3.mp3'));
 random.mock.mockImplementation(()=>0);context.currentTime+=.06;audio.play('shoot');context.currentTime+=.06;audio.play('hit');
 assert.ok(sources[2].buffer.file.endsWith('/throw.mp3'));assert.ok(sources[3].buffer.file.endsWith('/splat.mp3'));
 assert.equal(sources[0].destination,gains[1]);assert.equal(gains[1].gain.value,.3);assert.equal(gains.length,2);assert.equal(requests,loaded);
 context.currentTime+=.06;random.mock.mockImplementation(()=>.999);const count=sources.length;audio.play('hit',['plastic','hit']);assert.equal(sources.length,count+2);assert.ok(sources[count].buffer.file.endsWith('/plastichit2.mp3'));assert.ok(sources[count+1].buffer.file.endsWith('/splat3.mp3'));
 // One delayed variant must not silence an already loaded shooting sample.
 const partial=new GameAudio('/');t.mock.method(globalThis,'fetch',async(url:string)=>{if(url.endsWith('/throw2.mp3'))throw new Error('unavailable variant');return new Response(new TextEncoder().encode(url))});
 await assert.rejects(partial.unlock(new Game(1,1)));await new Promise(r=>setImmediate(r));random.mock.mockImplementation(()=>.999);partial.play('shoot');assert.ok(sources.at(-1).buffer.file.endsWith('/throw.mp3'));
});
