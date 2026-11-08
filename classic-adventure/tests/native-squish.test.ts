import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Plant} from '../src/game/model';
import {squishedFrame,squishedPosition} from '../src/rendering/squished';
import {animationNames} from '../src/rendering/asset-plan';
import {soundFiles} from '../src/platform/audio-plan';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import audio from '../docs/squish-audio.json';

const plant=(kind:Plant['kind']='sunflower'):Plant=>({id:9001,kind,row:0,column:4,health:300,born:0,shotAt:-100,actionIn:1000});
const fixture=()=>{const g=new Game(49,23);g.phase='playing';g['started']=true;g.plants=[plant()];const z=g['spawnZombie']('catapult',0,400,0);z.catapult!.ammo=0;g['updateCatapult'](z);g.zombies=[];return g;};

test('source squish leaves a 500-counter static residue without occupying a planting slot',()=>{
 const g=fixture();g.step();assert.equal(g.plants.length,0);g.seeds=['flowerpot'];assert.equal(g.canPlant('flowerpot',4,0),true);
 assert.deepEqual(g.squishedPlants,[{id:9001,kind:'sunflower',row:0,column:4,remaining:499}]);
 for(let i=0;i<499;i++)g.step();assert.equal(g.squishedPlants[0].remaining,0);
 g.step();assert.equal(g.squishedPlants.length,0);
});
test('squish countdown pauses and resumes through JSON saves, including older saves',()=>{
 const g=fixture();g.phase='paused';for(let i=0;i<100;i++)g.step();assert.equal(g.squishedPlants[0].remaining,500);
 const restored=Game.restore(JSON.parse(JSON.stringify(g.snapshot())));assert.deepEqual(restored.squishedPlants,g.squishedPlants);
 g.phase=restored.phase='playing';for(let i=0;i<501;i++){g.step();restored.step();}assert.deepEqual(restored.snapshot(),g.snapshot());assert.equal(g.squishedPlants.length,0);
 const old=JSON.parse(JSON.stringify(g.snapshot()));delete old.squishedPlants;assert.deepEqual(Game.restore(old).squishedPlants,[]);
});
test('shared squish triggers awake explosives, preserves active squash and never duplicates residue',()=>{
 const g=new Game(49,23),p=plant();g.plants=[p];g['squishPlant'](p);g['squishPlant'](p);assert.equal(g.squishedPlants.length,1);assert.equal(g.drainEvents().filter(e=>e.kind==='squish').length,1);
 const squash=plant('squash');squash.squash={remaining:160,x:400,target:1};g.plants=[squash];g['squishPlant'](squash);assert.equal(squash.health,300);assert.equal(g.squishedPlants.length,1);
 const bomb=plant('cherrybomb');g.plants=[bomb];g['squishPlant'](bomb);assert.equal(bomb.health,0);assert.equal(g.squishedPlants.length,1);assert.equal(g.drainEvents().filter(e=>e.kind==='explode').length,1);
});
test('source squish audio variants are traceable and excluded from early-level loading',()=>{
 assert.equal(soundFiles(new Game(1,1)).squish,undefined);
 const files=soundFiles(new Game(49,23));assert.deepEqual([files.squish,files.squish2],audio.files.map(f=>f.file));assert.deepEqual(audio.variants,['chomp','chomp2']);
 let bytes=0;for(const f of audio.files){const data=readFileSync(new URL('../public/assets/original/'+f.file,import.meta.url));assert.equal(data.length,f.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256);bytes+=data.length;}assert.ok(bytes<32768);
});
test('boss RV pressure uses shared special handling and removes dead planting occupants immediately',()=>{
 const g=new Game(50,23);g.start();const b=g.boss!;Object.assign(b,{phase:'rv',duration:100,elapsed:64,row:0,column:4});
 const list=['flowerpot','sunflower','cherrybomb','squash','sunflower'].map((kind,i)=>({...plant(kind as Plant['kind']),id:9001+i,column:i<2?4:i===2?5:i===3?6:7}));
 list[3].squash={remaining:160,x:560,target:1};g.plants=list;g['updateBoss']();
 assert.deepEqual(list.map(p=>p.health),[0,0,0,300,300]);assert.deepEqual(g.plants.map(p=>p.id),[9004,9005]);assert.deepEqual(g.squishedPlants.map(p=>p.kind),['flowerpot','sunflower']);assert.equal(g.drainEvents().filter(e=>e.kind==='explode').length,1);
});
test('rolling boss balls skip spikes, flatten ordinary plants and trigger matching ice counters',()=>{
 const g=new Game(50,23);g.start();g.plants=['sunflower','spikeweed','spikerock'].map((k,i)=>({...plant(k as Plant['kind']),id:9001+i}));g.boss!.ball={kind:'fire',row:0,x:400,age:100};g['updateBoss']();
 assert.deepEqual(g.plants.map(p=>p.kind),['spikeweed','spikerock']);assert.deepEqual(g.squishedPlants.map(p=>p.kind),['sunflower']);
 const h=new Game(50,23);h.start();h.plants=[plant('iceshroom')];h.boss!.ball={kind:'fire',row:0,x:400,age:100};h['updateBoss']();assert.equal(h.boss!.ball,null);assert.equal(h.squishedPlants.length,0);assert.equal(h.plants.length,0);
});
test('idle squash is squishable by sled and giant pressure, while active grounded squash is protected',()=>{
 for(const kind of ['bobsled','gargantuar']as const)for(const active of [false,true]){
  const g=new Game(9,23),p=plant('squash');if(active)p.squash={remaining:160,x:400,target:1};g.plants=[p];
  const z=g['spawnZombie'](kind,0,400,0);
  if(kind==='gargantuar'){z.giant={thrown:true,phase:'smash',remaining:49};g['updateGiant'](z,1);}
  else{z.sled=z.id;z.armor=100;g.iceTrails=[{row:0,x:0,remaining:1000}];g['updateSled'](z);}
  assert.equal(p.health,active?300:0,`${kind}/${active}`);assert.equal(g.squishedPlants.length,active?0:1);
 }
});
test('cached plant frames use source bounds and quarter-scaled offset around the native grid root',()=>{
 assert.deepEqual(squishedFrame('sunflower'),{x:-20,y:-20,width:120,height:120});assert.deepEqual(squishedFrame('tallnut'),{x:-20,y:-40,width:120,height:160});assert.deepEqual(squishedFrame('wintermelon'),{x:-40,y:-20,width:160,height:120});assert.deepEqual(squishedFrame('cobcannon'),{x:-20,y:-20,width:200,height:120});
 const g=new Game(49,23),p={id:1,kind:'flowerpot' as const,column:0,row:0,remaining:500};assert.deepEqual(squishedPosition(g,p),[40,g.gridY(0,0)+71]);
 assert.deepEqual(squishedPosition(g,{...p,kind:'sunflower'}),[40,g.gridY(0,0)+60]);assert.deepEqual(squishedPosition(g,{...p,kind:'coffeebean'}),[40,g.gridY(0,0)+50]);
 g.seeds=[];g.plants=[];g.squishedPlants=[{...p,kind:'sunflower'}];assert.deepEqual(animationNames(g,['sunflower','sunflower-attack','kernelpult']),['sunflower','sunflower-attack']);
});
