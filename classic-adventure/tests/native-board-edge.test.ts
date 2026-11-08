import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/model';
import {zombieBodyHealth} from '../src/game/config';
import type {ZombieKind} from '../src/game/config';
const edges:[ZombieKind,number][]=[['normal',-100],['cone',-100],['flag',-100],['bucket',-100],['newspaper',-100],['door',-100],['jack',-100],['ducky',-100],['dolphin',-100],['balloon',-100],['digger',-100],['pogo',-100],['bungee',-100],['ladder',-100],['imp',-100],['yeti',-100],['bobsled',-100],['pole',-150],['gargantuar',-150],['catapult',-175],['football',-175],['zomboni',-175],['dancer',-130],['backup',-130],['snorkel',-130]];
function fixture(kind:ZombieKind,x:number){
 const g=new Game(49,23);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));g.mowers=[];
 const z=g['spawnZombie'](kind,0,x,0);Object.assign(z,{x,row:0,speed:0,riseIn:0,underground:false,emergingIn:0,pogo:false,pogoState:undefined,bungee:undefined,flight:undefined,landingIn:0,vaultIn:0});
 return {g,z};
}
test('native species house edges use prior integer object X and inclusive source thresholds',()=>{
 for(const [kind,edge] of edges)for(const offset of [.001,0,-.999]){
  const {g}=fixture(kind,edge+30+offset);g.step();assert.equal(g.phase,offset>0?'playing':'lost',`${kind} raw ${edge+offset}`);
 }
});
test('crossing the house edge during movement is observed on the next native integer-position check',()=>{
 const {g,z}=fixture('normal',-69.9);z.speed=10;g.step();assert.ok(z.x<-70);assert.equal(g.phase,'playing');g.step();assert.equal(g.phase,'lost');
});
test('native house checks wait for immobilization to end and emit loss once',()=>{
 const {g,z}=fixture('football',-145);z.frozenIn=3;z.butterIn=2;
 g.step();assert.equal(g.phase,'playing');g.drainEvents();g.step();assert.equal(g.phase,'playing');g.step();assert.equal(g.phase,'lost');assert.equal(g.drainEvents().filter(e=>e.kind==='lose').length,1);g.step();assert.equal(g.drainEvents().filter(e=>e.kind==='lose').length,0);
});
test('headless bodies are cleared at each species edge plus70 and never enter the house',()=>{
 for(const [kind,edge] of edges){
  if(['catapult','zomboni','gargantuar','bungee'].includes(kind))continue;
  for(const offset of [.001,0]){const {g,z}=fixture(kind,edge+100+offset);z.health=Math.trunc(zombieBodyHealth(kind)/3)-1;z.flying=false;z.popIn=0;z.sled=undefined;z.sledLeader=undefined;g.step();assert.equal(g.phase,'playing',kind);assert.equal(g.zombies.includes(z),offset>0,`${kind} headless ${offset}`);}
 }
});
test('backward walkers depart past raw850 without kills or loot, and frozen walkers wait',()=>{
 for(const direction of ['backwards','hypnotized'] as const){
  const {g,z}=fixture('normal',880);z[direction]=true;g.step();assert.ok(g.zombies.includes(z));z.x=880.001;z.frozenIn=2;g.step();assert.ok(g.zombies.includes(z));g.step();assert.ok(!g.zombies.includes(z));assert.equal(g.kills,0);assert.equal(g.coins.length,0);
 }
});
