import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant,type Zombie} from '../src/game/model';
import {GameClock} from '../src/game/clock';
const ice:Plant={id:9000,kind:'iceshroom',column:0,row:0,health:300,born:0,shotAt:-100,actionIn:0,awake:true};
const freeze=(g:Game)=>g['doSpecial']({...ice});
test('ice trap uses native chill and freeze eligibility across supported zombie phases',()=>{
 const cases:{kind:Zombie['kind'];patch?:Partial<Zombie>;chill:boolean;freeze:boolean}[]=[
  {kind:'normal',chill:true,freeze:true},{kind:'catapult',chill:true,freeze:true},{kind:'zomboni',chill:false,freeze:false},
  {kind:'pogo',chill:true,freeze:false},{kind:'balloon',chill:true,freeze:false},
  {kind:'imp',patch:{flight:{remaining:10,duration:20,startX:600,endX:400}},chill:true,freeze:false},
  {kind:'imp',patch:{landingIn:10},chill:true,freeze:false},{kind:'pole',patch:{vaultIn:20},chill:true,freeze:false},
  {kind:'jack',patch:{jackOpening:true},chill:true,freeze:false},
  ...(['down','up','wait'] as const).map(phase=>({kind:'bungee' as const,patch:{bungee:{phase,remaining:100,column:2}},chill:true,freeze:phase==='wait'})),
  {kind:'digger',chill:false,freeze:false},{kind:'digger',patch:{underground:false,emergingIn:20},chill:false,freeze:false},
  {kind:'normal',patch:{riseIn:20},chill:false,freeze:false},{kind:'normal',patch:{hypnotized:true},chill:false,freeze:false},
  {kind:'bobsled',patch:{sled:99},chill:false,freeze:false},{kind:'normal',patch:{health:0},chill:false,freeze:false},
  {kind:'normal',patch:{health:80},chill:true,freeze:true},
 ];
 for(const [i,c] of cases.entries()){
  const g=new Game(49,23),z=g['spawnZombie'](c.kind,0,600,0);Object.assign(z,c.patch);const health=z.health,rng=g['randomState'];freeze(g);
  assert.equal(z.chillIn,c.chill?2000:0,`${i}/${c.kind} chill`);assert.equal((z.frozenIn??0)>0,c.freeze,`${i}/${c.kind} freeze`);assert.equal(z.health,health-(c.freeze?20:0),`${i}/${c.kind} damage`);
  if(!c.freeze)assert.equal(g['randomState'],rng,'non-freezable states must not draw a freeze duration');
 }
});
test('ice trap and ice peas retain a longer existing chill, including catapults',()=>{
 for(const kind of ['normal','catapult'] as const){
  const g=new Game(49,23),z=g['spawnZombie'](kind,0,400,0);z.chillIn=4000;freeze(g);assert.equal(z.chillIn,4000);assert.ok(z.frozenIn!>=300&&z.frozenIn!<=400);
  for(const prior of [0,2000]){const g=new Game(49,23);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));const z=g['spawnZombie'](kind,0,400,0);z.chillIn=prior;z.frozenIn=10000;const hp=z.health;g.peas.push({id:99999,row:0,x:420,age:0,ice:true,puff:false});g.step();assert.equal(z.health,hp-20);assert.equal(z.chillIn,Math.max(1000,prior-Number(prior>0)));}
 }
});
function lob(g:Game,z:Zombie,kind:'butter'|'wintermelon'){
 g['updateLob']({id:99999,row:z.row,x:400,y:100,age:100,ice:false,puff:false,lob:{kind,target:z.id,startX:100,startY:100,endX:400,endY:100,duration:120,flight:{vx:0,vz:0,z:0,planeY:100}}});
}
test('wintermelon chill also preserves duration on living headless bodies',()=>{
 const g=new Game(49,23),z=g['spawnZombie']('normal',0,400,0);z.health=90;z.chillIn=3000;lob(g,z,'wintermelon');assert.equal(z.health,10);assert.equal(z.chillIn,3000);
 const fresh=new Game(49,23),h=fresh['spawnZombie']('normal',0,400,0);h.health=90;lob(fresh,h,'wintermelon');assert.equal(h.health,10);assert.equal(h.chillIn,1000);
});
test('butter uses freeze eligibility and living-head/kelp guards while catapults remain eligible',()=>{
 for(const [kind,patch,expected] of [
  ['catapult',{},true],['zomboni',{},false],['normal',{},true],['normal',{health:50},false],['jack',{jackOpening:true},false],['pogo',{},false],
 ] as [Zombie['kind'],Partial<Zombie>,boolean][]){const g=new Game(49,23),z=g['spawnZombie'](kind,0,400,0);Object.assign(z,patch);const hp=z.health;lob(g,z,'butter');assert.equal(z.health,hp-40);assert.equal((z.butterIn??0)>0,expected,kind);}
 const g=new Game(21,23),z=g['spawnZombie']('normal',0,400,0);g.plants.push({...ice,kind:'tanglekelp',kelp:{target:z.id,remaining:100}});lob(g,z,'butter');assert.equal(z.health,230);assert.equal(z.butterIn,undefined);
});

test('catapult ice trap stops its actual clock and movement, survives saves, and agrees across render rates',()=>{
 const create=()=>{const g=new Game(49,23);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));g.plants.push({...ice,actionIn:1});const z=g['spawnZombie']('catapult',0,500,0);z.speed=.25;return {g,z};};
 const run=(hz:number,speed:1|2|4)=>{const {g,z}=create(),clock=new GameClock();clock.speed=speed;let elapsed=0;while(elapsed<2000/speed){const dt=Math.min(1000/hz,2000/speed-elapsed);clock.advance(g,dt,()=>{});elapsed+=dt;}clock.advance(g,1e-6,()=>{});assert.equal(z.x,500);assert.equal(z.animationTime,0);assert.equal(z.health,830);assert.ok(z.frozenIn!>0);return g.snapshot();};
 const expected=run(60,1);for(const hz of [30,60,144])for(const speed of [1,2,4] as const)assert.deepEqual(run(hz,speed),expected);
 const {g}=create();for(let n=0;n<200;n++)g.step();const restored=Game.restore(g.snapshot());for(let n=0;n<600;n++){g.step();restored.step();}assert.deepEqual(restored.snapshot(),g.snapshot());
});
