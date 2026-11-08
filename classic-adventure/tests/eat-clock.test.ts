import test from'node:test';import assert from'node:assert/strict';import{Game,type Zombie}from'../src/game/model';import{cellX}from'../src/game/config';
function fixture(kind:Zombie['kind']='normal',cold=false){const g=new Game(9,23);g.phase='playing';g.started=true;g.waveIn=1e9;g.plants=[{id:900,kind:'wallnut',row:0,column:3,health:4000,born:0,shotAt:-100,actionIn:0}];const z=g.spawnZombie(kind,0,cellX(3)-10,0);z.speed=.3;z.chillIn=cold?1000000:0;return{g,z};}
test('four ordinary families keep a source40-pose36fps eating clock in authoritative state',()=>{
 for(const kind of['normal','cone','bucket','door']as const)for(const cold of[false,true]){const{g,z}=fixture(kind,cold);g.step();assert.equal(z.eating,true);assert.equal(z.eatTime,Math.fround(Math.fround(.01)*(cold?18:36)/40));assert.equal(z.walkTime,undefined);}
});
test('eating clock holds during ice,butter and pause then survives a save',()=>{
 const{g,z}=fixture();g.step();const time=z.eatTime;assert.equal(typeof time,'number');z.frozenIn=3;z.butterIn=5;for(let n=0;n<4;n++)g.step();assert.equal(z.eatTime,time);g.pause();const saved=g.snapshot();for(let n=0;n<10;n++)g.step();assert.deepEqual(g.snapshot(),saved);const copy=Game.restore(saved);g.resume();copy.resume();for(let n=0;n<20;n++){g.step();copy.step();}assert.deepEqual(g.snapshot(),copy.snapshot());
});
test('leaving food resets the walking clock and entering food again starts a fresh eating clock',()=>{
 const{g,z}=fixture();for(let n=0;n<17;n++)g.step();assert.ok(z.eatTime!>0);g.plants=[];g.step();assert.equal(z.eating,false);assert.equal(z.eatTime,undefined);assert.ok(z.walkTime!>0);g.plants=[{id:901,kind:'wallnut',row:0,column:3,health:4000,born:0,shotAt:-100,actionIn:0}];g.step();assert.equal(z.eating,true);assert.equal(z.eatTime,Math.fround(Math.fround(.01)*36/40));
});
test('switching food while continuously chewing preserves the clock and existing bite damage',()=>{
 const{g,z}=fixture();for(let n=0;n<17;n++)g.step();const before=z.eatTime!;g.plants[0].id=901;const health=g.plants[0].health;g.step();assert.equal(z.eatTime,Math.fround(before+Math.fround(.01)*36/40));assert.ok(g.plants[0].health===health||g.plants[0].health===health-4);
});

import{advanceEatingAnimation,eatAnimationTime}from'../src/game/ground-walk';import reference from'./helpers/eat-clock-reference.json';import{readFileSync}from'node:fs';
test('eating clock matches independent C++ through100000updates and actual four40-pose clips',()=>{
 const definition=JSON.parse(readFileSync(new URL('../public/assets/runtime/actor-motion/zombie.json',import.meta.url),'utf8'));
 for(const name of['zombie-eat','cone-eat','bucket-eat','door-eat'])assert.equal(definition.clips[name].groups[0].length,40);
 for(const cold of[false,true]){const{z}=fixture();const rows=reference.filter(r=>r.rate===(cold?18:36));for(let n=1;n<=100000;n++){advanceEatingAnimation(z,cold);const row=rows.find(r=>r.tick===n);if(row)assert.equal(z.eatTime,row.time,`${cold}/${n}`);}}
});
test('normalized chewing interpolation wraps cleanly and reading a saved pose never changes game state',()=>{
 const{g,z}=fixture();z.eatTime=.02;const before=g.snapshot();assert.ok(Math.abs(eatAnimationTime(z,.5,.98))<1e-12);assert.equal(eatAnimationTime(z,1),z.eatTime);assert.deepEqual(g.snapshot(),before);
});
test('head loss retains the source chewing state and clock without taking another bite',()=>{
 const{g,z}=fixture();g.step();const before=z.eatTime!;assert.ok(before>0);z.health=89;const hp=g.plants[0].health,x=z.x;g.step();assert.equal(z.eating,true);assert.equal(z.eatTime,Math.fround(before+Math.fround(.01)*36/40));assert.equal(z.x,x);assert.equal(g.plants[0].health,hp);
});
