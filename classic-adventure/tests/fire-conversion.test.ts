import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{Game,type Pea,type Plant}from'../src/game/model';import{soundFiles}from'../src/platform/audio-plan';import{GameAudio}from'../src/platform/audio';import{firePeaShotFrame}from'../src/rendering/projectiles';import metadata from'../docs/firepea-audio.json';
function fixture(ice=false){const g=new Game(29,23);g.phase='playing';g.started=true;g.waveIn=100000;const tree:Plant={id:901,kind:'torchwood',row:0,column:3,health:300,actionIn:0,born:0,shotAt:-100};g.plants=[tree];const pea:Pea={id:902,row:0,x:314,originY:100,age:0,ice,puff:false};g.peas=[pea];return{g,pea,tree};}

test('native point-of-ignition recording is traceable,small and absent from early-stage downloads',()=>{
 const body=readFileSync(new URL('../public/assets/original/'+metadata.file,import.meta.url));assert.equal(body.length,metadata.bytes);assert.ok(body.length<6144);assert.equal(createHash('sha256').update(body).digest('hex'),metadata.sha256);
 assert.equal(soundFiles(new Game(1,1))['pea-ignite'],undefined);const{g}=fixture();assert.equal(soundFiles(g)['pea-ignite'],'firepea.mp3');assert.equal(soundFiles(g).ignite,'ignite.mp3');
 g.plants=[];g.seeds=[];g.peas[0].fire=true;assert.equal(soundFiles(Game.restore(g.snapshot()))['pea-ignite'],'firepea.mp3');
});

test('melting and ignition emit their own one-shot events exactly once per tree column',()=>{
 const{g,pea,tree}=fixture(true);g.step();assert.deepEqual(g.drainEvents().map(e=>e.kind),['pea-melt']);assert.equal(pea.fireAt,undefined);
 pea.x=314;g.step();assert.deepEqual(g.drainEvents(),[]);g.plants.push({...tree,id:903,column:5});pea.x=474;g.step();assert.deepEqual(g.drainEvents().map(e=>e.kind),['pea-ignite']);assert.equal(pea.fireAt,3);assert.ok(pea.fireRate!>=50&&pea.fireRate!<=80);
 pea.x=474;g.step();assert.deepEqual(g.drainEvents(),[]);
});

test('ignition phase and rate survive pause,JSON restore and independent repeated redraws',()=>{
 const{g,pea}=fixture();g.step();g.drainEvents();for(let n=0;n<15;n++)g.step();g.phase='paused';const frozen=g.snapshot(),frame=firePeaShotFrame(pea,g.ticks);
 for(let n=0;n<100;n++){g.step();assert.equal(firePeaShotFrame(pea,g.ticks),frame);}assert.deepEqual(g.snapshot(),frozen);
 const copy=Game.restore(JSON.parse(JSON.stringify(frozen)));assert.equal(firePeaShotFrame(copy.peas[0],copy.ticks),frame);g.phase=copy.phase='playing';
 for(let n=0;n<40;n++){g.step();copy.step();assert.deepEqual(copy.snapshot(),g.snapshot());assert.equal(firePeaShotFrame(copy.peas[0],copy.ticks),firePeaShotFrame(pea,g.ticks));}
 const old={...pea};delete old.fireAt;delete old.fireRate;assert.equal(firePeaShotFrame(old,1000),firePeaShotFrame(old,5000),'legacy phase follows projectile age,not new Scene creation time');
});

test('conversion voices share combat caps and mute controls,and release decoded ignition audio',async t=>{
 const prior=globalThis.AudioContext,nodes:any[]=[];let now=0;class Context{destination={};state='suspended';get currentTime(){return now}async resume(){this.state='running'}async suspend(){this.state='suspended'}async decodeAudioData(data:ArrayBuffer){return{file:new TextDecoder().decode(data)}}createGain(){return{gain:{value:1},connect(){}}}createBufferSource(){const node={buffer:null,connect(target:any){this.target=target},target:null,disconnect(){},start(){},stop(){},onended:null};nodes.push(node);return node}}
 globalThis.AudioContext=Context as unknown as typeof AudioContext;t.after(()=>globalThis.AudioContext=prior);t.mock.method(globalThis,'fetch',async(url:string)=>new Response(new TextEncoder().encode(url)));
 const audio=new GameAudio('/'),{g}=fixture();await audio.unlock(g);audio.play('pea-ignite');audio.play('pea-melt');assert.equal(nodes.length,2);assert.ok(nodes[0].buffer.file.endsWith('/firepea.mp3'));assert.ok(/\/throw2?\.mp3$/.test(nodes[1].buffer.file));assert.equal(nodes[0].target,audio['combatOutput']);
 audio.muted=true;now=1;audio.play('pea-ignite');assert.equal(nodes.length,2);audio.muted=false;
 for(let n=0;n<20;n++){now+=.1;audio.play('pea-ignite');}assert.equal(nodes.length,10);await audio.release();assert.equal(audio['buffers'].size,0);assert.equal(audio['voices'],0);
});
