import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant} from '../src/game/model';
import {GameClock} from '../src/game/clock';
function fixture(kind:Plant['kind']='sunflower'){
 const g=new Game(44,23),p:Plant={id:9000,kind,column:2,row:0,health:300,born:0,shotAt:-100,actionIn:100000};for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));g.plants=g.plants.filter(p=>p.kind==='flowerpot');g.plants.push(p);
 const z=g['spawnZombie']('pogo',0,260,0);return {g,p,z};
}
test('pogo pauses for a native 80-tick high bounce before crossing a plant',()=>{
 const {g,z}=fixture();z.pogoState={phase:'bounce',remaining:1,altitude:9,animTime:1};
 g.step();assert.equal(z.pogoState!.phase,'high');assert.equal(z.speed,0);const x=z.x;
 for(let n=0;n<79;n++)g.step();assert.equal(z.x,x);assert.equal(z.pogoState!.remaining,1);
 g.step();assert.equal(z.pogoState!.phase,'forward');assert.equal(z.speed,(230-200+60)/80);
 assert.equal(z.x,x-z.speed);
});
test('pogo altitude uses the slow-middle bounce curve and the counter is not slowed by chill',()=>{
 for(const chilled of [false,true]){
  const {g,z}=fixture();g.plants=[];z.chillIn=chilled?1000:0;z.pogoState={phase:'bounce',remaining:41,altitude:9,animTime:1};
  const x=z.x;g.step();assert.equal(z.pogoState!.remaining,40);assert.equal(z.pogoState!.altitude,49);assert.equal(z.x,x-.45*(chilled?.4:1));
 }
});
test('pogo only breaks on a tallnut during the forward check at counter70; a supporting pot cannot mask it',()=>{
 const {g,p,z}=fixture('tallnut');z.pogoState={phase:'forward',remaining:72,altitude:9,animTime:1};z.speed=0;
 g.step();assert.equal(z.pogo,true);g.step();assert.equal(z.pogo,false);
});

test('pogo counters freeze with pause and immobilization, and resume identically after saving at varied render rates',()=>{
 const run=(hz:number,speed:1|2|4)=>{const {g}=fixture();const c=new GameClock();c.speed=speed;let ms=0;while(ms<2000/speed){const dt=Math.min(1000/hz,2000/speed-ms);c.advance(g,dt,()=>{});ms+=dt;}c.advance(g,1e-6,()=>{});return g.snapshot();};
 const expected=run(60,1);for(const hz of [30,60,144])for(const speed of [1,2,4] as const)assert.deepEqual(run(hz,speed),expected);
 const {g,z}=fixture();z.frozenIn=20;const state=structuredClone(z.pogoState);for(let n=0;n<19;n++)g.step();assert.deepEqual(z.pogoState,state);g.step();assert.equal(z.frozenIn,0);assert.equal(z.pogoState!.remaining,state!.remaining-1,'final frozen tick resumes native actions');const resumed=structuredClone(z.pogoState);
 g.pause();for(let n=0;n<10;n++)g.step();assert.deepEqual(z.pogoState,resumed);g.resume();for(let n=0;n<30;n++)g.step();const restored=Game.restore(g.snapshot());for(let n=0;n<100;n++){g.step();restored.step();}assert.deepEqual(restored.snapshot(),g.snapshot());
});
