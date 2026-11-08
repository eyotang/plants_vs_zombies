import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant,type Zombie} from '../src/game/model';import {GameClock,type GameSpeed}from'../src/game/clock';
let id=9000;
const p=(kind:Plant['kind'],column=4,row=0):Plant=>({id:++id,kind,column,row,health:300,born:0,shotAt:-100,actionIn:1000});
const car=(g:Game,x=400,row=0)=>g['spawnZombie']('zomboni',row,x,0);
const update=(g:Game,z:Zombie)=>g['updateZomboni'](z);
test('zomboni uses source integer attack rectangles and twenty-pixel contact, including reverse direction',()=>{
 for(const kind of ['sunflower','tallnut','pumpkin','cobcannon'] as const)for(const reverse of[false,true])for(const x of[250,276,277,430,430.99,431,450]){
  const g=new Game(49,23),plant=p(kind);g.plants=[plant];const z=car(g,x);z.backwards=reverse;
  const left=Math.trunc(x-30)+(reverse?-23:10),plantLeft=kind==='pumpkin'||kind==='cobcannon'?360:370,width=kind==='tallnut'?80:kind==='cobcannon'?140:60;
  const hit=Math.min(left+133,plantLeft+width)-Math.max(left,plantLeft)>=20;update(g,z);assert.equal(plant.health,hit?0:300,`${kind}/${reverse}/${x}`);
 }
});
test('zomboni crushes one first-contact cell with all ordinary layers rather than all nearby cells',()=>{
 const g=new Game(49,23),first=p('sunflower'),base=p('flowerpot'),shell=p('pumpkin'),other=p('sunflower',3);g.plants=[first,base,shell,other];update(g,car(g,320));assert.deepEqual(g.plants.map(p=>p.health),[0,0,0,300]);
});
test('catapult pressure also waits for the next integer-position check after crossing a contact boundary',()=>{
 const g=new Game(49,23),plant=p('sunflower');g.plants=[plant];const z=g['spawnZombie']('catapult',0,431.01,0);z.speed=.2;z.catapult!.ammo=0;
 g['updateCatapult'](z);assert.ok(z.x<431);assert.equal(plant.health,300,'prior integer rectangle has only19 overlap pixels');
 g['updateCatapult'](z);assert.equal(plant.health,0,'next prior rectangle has20 overlap pixels');
});
test('zomboni skips standalone instant plants and triggers a supported awake explosive exactly once',()=>{
 for(const kind of ['cherrybomb','jalapeno','blover','squash','iceshroom','doomshroom','tanglekelp']as const){const g=new Game(18,23),plant=p(kind);g.plants=[plant];update(g,car(g));assert.equal(plant.health,300,kind);}
 for(const kind of ['cherrybomb','jalapeno','iceshroom','doomshroom']as const){
  const g=new Game(49,23),base=p('flowerpot'),bomb=p(kind);bomb.awake=true;g.plants=[base,bomb];const z=car(g);update(g,z);
  assert.equal(base.health,0,kind);assert.equal(bomb.health,0,kind);assert.equal(z.health,kind==='iceshroom'?1350:-450,kind);
  const effect=kind==='jalapeno'?'fire':kind==='iceshroom'?'freeze':'explode';assert.equal(g.drainEvents().filter(e=>e.kind===effect).length,1,kind);if(kind==='jalapeno')assert.equal(g.iceTrails[0].remaining,20);
 }
});
test('active grounded squash survives pressure while its pot is crushed; sleeping mushrooms remain crushable',()=>{
 for(const active of[false,true]){const g=new Game(49,23),base=p('flowerpot'),squash=p('squash');if(active)squash.squash={remaining:160,x:400,target:1};g.plants=[base,squash];update(g,car(g));assert.equal(base.health,0);assert.equal(squash.health,active?300:0);}
 for(const kind of ['iceshroom','doomshroom']as const){const h=new Game(49,23),shroom=p(kind);h.plants=[shroom];update(h,car(h));assert.equal(shroom.health,0);assert.equal(h.drainEvents().filter(e=>e.kind==='explode'||e.kind==='freeze').length,0);}
});
test('existing spike tire-pop and low-health departure controls remain active',()=>{
 for(const kind of ['spikeweed','spikerock']as const){const g=new Game(49,23),spike=p(kind);spike.health=kind==='spikerock'?450:300;g.plants=[spike];const z=car(g);update(g,z);assert.equal(z.health,0);assert.equal(spike.health,kind==='spikerock'?400:0);}
 const g=new Game(49,23),z=car(g);z.health=200;update(g,z);assert.equal(z.health,0);assert.equal(g.iceTrails.length,0);
});
test('pressure damage, events and surviving movement match across clocks and saved continuation',()=>{
 const fixture=()=>{const g=new Game(49,23);for(const k of ['sunflower','cherrybomb','flowerpot','kernelpult','wallnut','umbrella']as const)g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));g.plants.push(p('flowerpot'),p('cherrybomb'));car(g);car(g,600,3);return g;};
 // Keep IDs identical between complete snapshots of independent fixtures.
 let expected;for(const hz of[30,60,144])for(const speed of[1,2,4]as GameSpeed[]){id=9000;const g=fixture(),clock=new GameClock();clock.speed=speed;let ms=0;while(ms<1000/speed){const dt=Math.min(1000/hz,1000/speed-ms);clock.advance(g,dt,()=>{});ms+=dt;}clock.advance(g,1e-6,()=>{});assert.equal(g.ticks,100);assert.equal(g.kills,1);assert.equal(g.drainEvents().filter(e=>e.kind==='explode').length,1);expected??=g.snapshot();assert.deepEqual(g.snapshot(),expected);}
 id=9000;const g=fixture();for(let t=0;t<40;t++)g.step();const restored=Game.restore(g.snapshot());for(let t=0;t<60;t++){g.step();restored.step();}assert.deepEqual(restored.snapshot(),g.snapshot());
});
