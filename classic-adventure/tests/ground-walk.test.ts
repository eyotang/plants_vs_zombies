import test from'node:test';import assert from'node:assert/strict';import{Texture}from'pixi.js';
import{Game,type Zombie}from'../src/game/model';import{groundWalkStep,groundWalkTime}from'../src/game/ground-walk';import{ActorRig,type ActorDefinition}from'../src/rendering/actor-motion';
import reference from'./helpers/ground-walk-reference.json';import ground from'../src/game/data/zombie-ground.json';
function game(kind:Zombie['kind']='normal',mini=false,cold=false){const g=new Game(9,23);g.phase='playing';g.started=true;g.waveIn=1e9;const z=g.spawnZombie(kind,0,630,0);z.speed=.3;z.walkVariant=1;z.walkTime=0;z.mini=mini;z.chillIn=cold?1000000:0;return{g,z};}
test('ground clock and float displacement match independently compiled source arithmetic for100000updates',()=>{
 for(const mini of[false,true])for(const cold of[false,true]){const{z}=game('normal',mini,cold);let x=Math.fround(600);const expected=reference.filter(r=>!!r.mini===mini&&!!r.cold===cold);for(let n=1;n<=100000;n++){x=Math.fround(x-groundWalkStep(z,cold));const row=expected.find(r=>r.tick===n);if(row){assert.equal(z.walkTime,row.time,`${mini}/${cold}/${n} time`);assert.equal(x,row.rawX,`${mini}/${cold}/${n} position`);}}}
});
test('four ordinary walking families use actual source footsteps in Game.step, including mini and cold',()=>{
 for(const kind of['normal','cone','bucket','door']as const)for(const mini of[false,true])for(const cold of[false,true]){const{g,z}=game(kind,mini,cold);for(let n=0;n<1000;n++)g.step();const expected=reference.find(r=>!!r.mini===mini&&!!r.cold===cold&&r.tick===1000)!;assert.equal(z.walkTime,expected.time);assert.equal(z.x,expected.rawX+30,kind);}
});
test('source ground intervals include held feet and uneven steps rather than uniform motion',()=>{
 const{z}=game();const velocities=[];for(let n=0;n<600;n++)velocities.push(groundWalkStep(z,false));assert.ok(velocities.includes(0));assert.ok(new Set(velocities).size>10);assert.equal(ground.x.length,47);
});
test('footstep clock holds through immobilization,pause and save then resumes the same phase',()=>{
 const{g,z}=game();for(let n=0;n<50;n++)g.step();z.frozenIn=10;z.butterIn=20;const time=z.walkTime,x=z.x;for(let n=0;n<19;n++)g.step();assert.equal(z.walkTime,time);assert.equal(z.x,x);g.pause();const saved=g.snapshot();for(let n=0;n<10;n++)g.step();assert.deepEqual(g.snapshot(),saved);const restored=Game.restore(saved);g.resume();restored.resume();for(let n=0;n<20;n++){g.step();restored.step();}assert.deepEqual(g.snapshot(),restored.snapshot());
});
test('backwards walking mirrors displacement while retaining source clock and rendering does not mutate it',()=>{
 const{g,z}=game();z.backwards=true;g.step();const r=reference.find(r=>!r.mini&&!r.cold&&r.tick===1)!;assert.equal(z.x,Math.fround(600+Math.fround(600-r.rawX))+30);const before=g.snapshot();assert.equal(groundWalkTime(z,.8),z.walkTime);assert.ok(groundWalkTime(z,.5,0)<z.walkTime!);assert.deepEqual(g.snapshot(),before);
});
test('ActorRig native normalized frame uses frameCount-minus-one and cache restores ordinary playback',()=>{
 const poses=ground.x.map((x)=>[x,0,1,1,0,0,0,1,'part']as [number,number,number,number,number,number,number,number,string]);const definition={frames:{},clips:{walk:{duration:188,origin:[0,0],scale:1,healthTop:0,groups:[{length:47,tracks:[{name:'body',poses}]}]}}}as unknown as ActorDefinition;
 const rig=new ActorRig('test',{definition,textures:{part:Texture.WHITE},file:''});rig.render('walk',47,true,false,true,20,.25);const part=rig.root.children[0].children[0];assert.ok(Math.abs(part.x-(ground.x[11]+ground.x[12])/2)<1e-6);const native=part.x;rig.render('walk',47,true,false,true);assert.notEqual(part.x,native);rig.root.destroy({children:true});
});
