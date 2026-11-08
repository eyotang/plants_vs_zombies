import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Zombie} from '../src/game/model';

function setup(){const g=new Game(9,1);g.phase='playing';g.started=true;g.waveIn=100000;return g;}
function enemy(g:Game,x:number,kind:Zombie['kind']='normal',row=0){const z=g.spawnZombie(kind,row,x,0);z.health=1000;z.armor=0;z.speed=0;z.frozenIn=10000;return z;}
function fire(g:Game,vx=3.33){g.peas=[{id:900,row:0,x:414,originY:120,age:0,ice:false,puff:false,fire:true,vx}];g.step();}

test('fire splash starts at the prior projectile integer X, rather than centering on the direct enemy',()=>{
 const g=setup(),direct=enemy(g,400),behind=enemy(g,350),ahead=enemy(g,490);
 fire(g);
 assert.deepEqual([direct.health,behind.health,ahead.health],[960,1000,987]);
 assert.equal(direct.frozenIn,0);assert.equal(ahead.frozenIn,9999,'only direct impact removes cold');
});
test('fire splash includes the 100px right edge but excludes the next integer body edge in either direction',()=>{
 for(const vx of [-3.33,3.33])for(const x of [494,494.999,495]){
  const g=setup(),direct=enemy(g,400),other=enemy(g,x);fire(g,vx);
  assert.equal(direct.health,960);assert.equal(other.health,x<495?987:1000,`vx=${vx}, x=${x}`);
 }
});
test('splash uses native wide body rectangles beyond a 50px center radius',()=>{
 for(const kind of ['gargantuar','football','digger'] as const){
  const g=setup(),direct=enemy(g,400),wide=enemy(g,kind==='gargantuar'?530:480,kind);if(kind==='digger')wide.underground=false;
  fire(g);assert.equal(direct.health,960);assert.equal(wide.health,987,kind);
 }
});
test('source body-edge contacts remain inclusive for four body families and both orientations',()=>{
 // GetZombieRect: raw zombie X is model X-30. The native rightward
 // splash edge is400+100. Backward bodies use width-offset-bodyWidth.
 const edges:[Zombie['kind'],number,number][]=[['normal',494,488],['football',480,517],['gargantuar',547,458],['digger',480,488]];
 for(const [kind,front,rear]of edges)for(const backwards of [false,true])for(const vx of [-3.33,3.33])for(const miss of [0,1]){
  const g=setup(),direct=enemy(g,400),other=enemy(g,(backwards?rear:front)+miss,kind);
  other.backwards=backwards;if(kind==='digger')other.underground=false;
  fire(g,vx);assert.equal(direct.health,960);assert.equal(other.health,miss?1000:987,`${kind}, backwards=${backwards}, vx=${vx}, miss=${miss}`);
 }
});
test('fire splash budget counts only overlapping non-resistant bodies in the projectile row',()=>{
 const g=setup(),direct=enemy(g,400),splashed=[460,470,480,490,494].map(x=>enemy(g,x));
 const outside=enemy(g,495),behind=enemy(g,350),otherRow=enemy(g,470,'normal',1),resistant=enemy(g,470,'door');resistant.shield=100;
 fire(g);assert.equal(direct.health,960);assert.deepEqual(splashed.map(z=>z.health),[992,992,992,992,992]);
 assert.deepEqual([outside.health,behind.health,otherRow.health,resistant.health,resistant.shield],[1000,1000,1000,1000,100]);
});
test('fire splash keeps source eligibility and resistant direct-only behavior',()=>{
 for(const state of [{health:0},{hypnotized:true},{vaultIn:20},{riseIn:20},{sledLeader:800}] as const){
  const g=setup(),direct=enemy(g,400),other=Object.assign(enemy(g,490),state);fire(g);
  assert.equal(direct.health,960);assert.equal(other.health,'health'in state?0:1000,JSON.stringify(state));
 }
 for(const kind of ['door','ladder','catapult','zomboni'] as const){
  const g=setup(),direct=enemy(g,400,kind),other=enemy(g,490);if(kind==='door'||kind==='ladder')direct.shield=100;
  fire(g);assert.equal(other.health,1000,kind);
 }
});
