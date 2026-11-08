import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant,type Zombie} from '../src/game/model';
let id=9000;
const p=(kind:Plant['kind'],column=4):Plant=>({id:++id,kind,column,row:0,health:300,born:0,shotAt:-100,actionIn:1000});
const car=(g:Game,x=650)=>(g as any).spawnZombie('catapult',0,x,0) as Zombie;
const update=(g:Game,z:Zombie)=>(g as any).updateCatapult(z);
test('catapult target and basketball impact share native coffee, main, pumpkin, base priority',()=>{
 for(const coffee of [false,true]){
  const g=new Game(9,23),pot=p('flowerpot',1),pumpkin=p('pumpkin',1),main=p('puffshroom',1),bean=p('coffeebean',1),spike=p('spikeweed',0);
  g.plants=[pot,pumpkin,main,...coffee?[bean]:[],spike,p('sunflower',2)];const z=car(g);Object.assign(z.catapult!,{phase:'shoot',remaining:231});update(g,z);
  assert.equal(g.peas[0].lob!.target,(coffee?bean:main).id);
  const shot=g.peas[0];Object.assign(shot,{x:130,y:61,age:60});shot.lob!.flight={vx:0,vz:1,z:61,planeY:0};
  (g as any).updateLob(shot);assert.equal((coffee?bean:main).health,225);assert.equal(pumpkin.health,300);assert.equal(pot.health,300);
 }
 for(const support of [false,true]){
  const g=new Game(9,23),spike=p('spikeweed',0);g.plants=[spike,...support?[p('flowerpot',0)]:[]];const z=car(g);z.speed=0;update(g,z);
  assert.equal(z.catapult!.phase,support?'shoot':'walk');
  if(support){for(let tick=0;tick<150&&!g.peas.length;tick++)update(g,z);assert.equal(g.peas[0].lob!.target,spike.id);}
 }
});
test('catapult crushing requires twenty integer attack-rectangle pixels and affects one contacted cell',()=>{
 for(const kind of ['sunflower','tallnut','pumpkin','cobcannon'] as const)for(const x of [250,276,277,430,430.99,431,450]){
  const g=new Game(9,23),plant=p(kind);g.plants=[plant];const z=car(g,x);z.speed=0;z.catapult!.ammo=0;
  const left=Math.trunc(x-30)+10,plantLeft=kind==='pumpkin'||kind==='cobcannon'?360:370,width=kind==='tallnut'?80:kind==='cobcannon'?140:60;
  const hit=Math.min(left+133,plantLeft+width)-Math.max(left,plantLeft)>=20;
  update(g,z);assert.equal(plant.health,hit?0:300,`${kind}/${x}`);
 }
 const g=new Game(9,23),first=p('sunflower'),base=p('flowerpot'),shell=p('pumpkin'),other=p('sunflower',3);g.plants=[first,base,shell,other];
 const z=car(g,320);z.speed=0;z.catapult!.ammo=0;update(g,z);
 assert.deepEqual(g.plants.map(p=>p.health),[0,0,0,300]);
});
test('driving catapults leave instant plants alone and trigger a supported bomb when its base is crushed',()=>{
 for(const kind of ['cherrybomb','jalapeno','blover','squash','iceshroom','doomshroom','tanglekelp','spikeweed','spikerock'] as const){
  const g=new Game(18,23),plant=p(kind);g.plants=[plant];const z=car(g,400);z.speed=0;z.catapult!.ammo=0;update(g,z);assert.equal(plant.health,300,kind);
 }
 const g=new Game(9,23),base=p('flowerpot'),bomb=p('cherrybomb');g.plants=[base,bomb];const z=car(g,400);z.speed=0;z.catapult!.ammo=0;update(g,z);
 assert.equal(base.health,0);assert.equal(bomb.health,0);assert.equal(z.health,-950);assert.ok(g.drainEvents().some(e=>e.kind==='explode'));
 const h=new Game(18,23),support=p('flowerpot'),squash=p('squash');squash.squash={remaining:160,x:400,target:1};h.plants=[support,squash];const c=car(h,400);c.speed=0;c.catapult!.ammo=0;update(h,c);assert.equal(support.health,0);assert.equal(squash.health,300);
 for(const awake of [false,true])for(const kind of ['iceshroom','doomshroom'] as const){
  const day=new Game(9,23),shroom=p(kind);shroom.awake=awake;day.plants=[shroom];const vehicle=car(day,400);vehicle.speed=0;vehicle.catapult!.ammo=0;update(day,vehicle);assert.equal(shroom.health,awake?300:0);
 }
});
test('a stationary shooting catapult still checks native crushing contacts',()=>{
 const g=new Game(9,23),plant=p('sunflower');g.plants=[plant];const z=car(g,430);Object.assign(z.catapult!,{phase:'shoot',remaining:200});update(g,z);assert.equal(z.x,430);assert.equal(plant.health,0);
});
