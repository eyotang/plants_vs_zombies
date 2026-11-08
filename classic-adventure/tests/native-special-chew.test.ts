import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/model';
import {cellX,type PlantKind} from '../src/game/config';
function fixture(kind:PlantKind,awake=true){
 const g=new Game(49,23);for(const k of ['sunflower','cherrybomb','jalapeno','iceshroom','doomshroom','squash'] as const)g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));g.sun=1000;
 g.select(kind);assert.ok(g.plant(1,0));const p=g.plants.find(p=>p.kind===kind&&p.column===1&&p.row===0)!;if(['iceshroom','doomshroom'].includes(kind))p.awake=awake;
 const enemies=Array.from({length:3},()=>{const z=g['spawnZombie']('normal',0,cellX(1)-20,0);z.speed=0;z.biteIn=1;return z;});return{g,p,enemies};
}
function step(g:Game,n:number){for(let i=0;i<n;i++)g.step();}
test('awake timed explosives stop chewing zombies without taking bite damage before the unchanged100-tick fuse',()=>{
 for(const kind of ['cherrybomb','jalapeno','iceshroom','doomshroom'] as const){
  const{g,p,enemies}=fixture(kind);step(g,99);
  assert.ok(g.plants.includes(p),`${kind} survives its fuse`);assert.equal(p.health,300,kind);assert.equal(p.actionIn,1,kind);
  assert.ok(enemies.every(z=>z.eating&&z.x===cellX(1)-20),`${kind} holds its attackers`);
  assert.ok(enemies.every(z=>z.health===270),`${kind} does not fire early`);
  g.step();assert.ok(!g.plants.includes(p),`${kind} consumed once at100`);
  if(kind==='iceshroom'){assert.ok(enemies.every(z=>z.health===250&&z.frozenIn!>0));assert.equal(g.drainEvents().filter(e=>e.kind==='freeze').length,1);}
  else{assert.ok(enemies.every(z=>z.health<=0));assert.equal(g.drainEvents().filter(e=>e.kind===(kind==='jalapeno'?'fire':'explode')).length,1);}
 }
});
test('sleeping ice and doom mushrooms remain edible',()=>{
 for(const kind of ['iceshroom','doomshroom'] as const){const{g,p,enemies}=fixture(kind,false);g.step();assert.equal(p.health,288);assert.ok(enemies.every(z=>z.eating));assert.equal(p.actionIn,100);}
});
test('squash look and pre-launch states survive bites until the airborne action',()=>{
 const{g,p,enemies}=fixture('squash');step(g,120);assert.ok(g.plants.includes(p));assert.equal(p.health,300);assert.ok(p.squash&&p.squash.remaining>60);assert.ok(enemies.every(z=>z.eating));
 step(g,6);assert.equal(p.squash!.remaining,60);assert.equal(p.health,300);assert.ok(g.plants.find(p=>p.kind==='flowerpot'&&p.column===1&&p.row===0)!.health<300,'airborne squash exposes its edible pot');step(g,55);assert.ok(enemies.every(z=>z.health<=0));
});
test('a protected bomb survives pause and saved continuation with the same detonation',()=>{
 const{g,p}=fixture('cherrybomb');step(g,50);assert.equal(p.health,300);g.pause();const paused=g.snapshot();step(g,20);assert.deepEqual(g.snapshot(),paused);g.resume();const restored=Game.restore(g.snapshot());step(g,50);step(restored,50);assert.deepEqual(restored.snapshot(),g.snapshot());assert.equal(g.zombies.length,0);
});
