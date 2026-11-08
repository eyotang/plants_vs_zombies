import test from 'node:test';import assert from 'node:assert/strict';
import {GameAudio} from '../src/platform/audio';import {soundFiles} from '../src/platform/audio-plan';import {Game} from '../src/game/model';
const lateGame=()=>{const g=new Game(49,23);g.seeds=['sunflower','kernelpult','coffeebean','chomper','iceshroom','jalapeno'];return g;};
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};}
function context(t:any,decode=(data:ArrayBuffer)=>Promise.resolve({file:new TextDecoder().decode(data)}),resume=()=>Promise.resolve()){
 const previous=globalThis.AudioContext,nodes:any[]=[];let instances=0,requests=0,suspensions=0;
 class Context{currentTime=0;destination={};state='suspended';constructor(){instances++;}async resume(){await resume();this.state='running';}async suspend(){suspensions++;this.state='suspended';}decodeAudioData=decode;createGain(){return{gain:{value:1},connect(){}}}createBufferSource(){const s={buffer:null,connect(){},disconnect(){},start(){},stop(){s.onended?.()},onended:null as null|(()=>void)};nodes.push(s);return s;}}
 globalThis.AudioContext=Context as unknown as typeof AudioContext;t.after(()=>{globalThis.AudioContext=previous});t.mock.method(globalThis,'fetch',async(url:string)=>{requests++;return new Response(new TextEncoder().encode(url))});
 return{nodes,instances:()=>instances,requests:()=>requests,suspensions:()=>suspensions};
}
test('switching from a late roof loadout to level one retains only the required decoded sounds',async t=>{
 const c=context(t),audio=new GameAudio('/'),early=new Game(1,1);await audio.unlock(lateGame());const before=audio['buffers'].size;await audio.unlock(early);
 assert.ok(before>Object.keys(soundFiles(early)).length);assert.deepEqual([...audio['buffers'].keys()].sort(),Object.keys(soundFiles(early)).sort());
 const requests=c.requests();await audio.unlock(early);assert.equal(c.requests(),requests);assert.equal(c.instances(),1);
});
test('leaving battle releases decoded buffers and active voices, then reuses the one audio context',async t=>{
 const c=context(t),audio=new GameAudio('/');await audio.unlock(lateGame());audio.play('shoot');audio.play('wave');assert.equal(audio['voices'],2);
 const oldEnded=c.nodes[0].onended;await audio.release();assert.equal(audio['buffers'].size,0);assert.equal(audio['loading'].size,0);assert.equal(audio['voices'],0);assert.equal(audio['context']!.state,'suspended');
 await audio.unlock(new Game(1,1));audio.play('shoot');oldEnded();assert.equal(audio['voices'],1);assert.equal(c.instances(),1);
});
test('a decode finishing after a level switch cannot restore an obsolete buffer',async t=>{
 const started=deferred(),finish=deferred();context(t,async data=>{const file=new TextDecoder().decode(data);if(file.endsWith('/coffee.mp3')){started.resolve();await finish.promise;}return{file};});
 const audio=new GameAudio('/'),first=audio.unlock(lateGame());await started.promise;await audio.unlock(new Game(1,1));finish.resolve();await first;
 assert.equal(audio['buffers'].has('coffee'),false);assert.equal(audio['buffers'].size,12);
});
test('leaving while audio activation is pending does not start obsolete downloads',async t=>{
 const resume=deferred(),c=context(t,undefined,()=>resume.promise),audio=new GameAudio('/');const first=audio.unlock(lateGame());const release=audio.release();resume.resolve();await Promise.all([first,release]);assert.equal(c.requests(),0);assert.equal(audio['buffers'].size,0);assert.equal(c.suspensions(),1);
});
test('obsolete network requests are aborted without discarding common cached audio',async t=>{
 context(t);let pending!:AbortSignal;const started=deferred();t.mock.method(globalThis,'fetch',async(url:string,options:RequestInit)=>{
  if(url.endsWith('/coffee.mp3')){pending=options.signal!;started.resolve();return await new Promise<Response>((_,reject)=>pending.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true}));}
  return new Response(new TextEncoder().encode(url));
 });
 const audio=new GameAudio('/'),first=audio.unlock(lateGame());await started.promise;await audio.unlock(new Game(1,1));await first;assert.equal(pending.aborted,true);assert.equal(audio['buffers'].size,12);assert.equal(audio['loading'].size,12);
});
