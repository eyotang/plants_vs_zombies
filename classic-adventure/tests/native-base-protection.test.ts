import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/model';
import {GameClock,type GameSpeed} from '../src/game/clock';
import {cellX,type PlantKind} from '../src/game/config';
function fixture(kind:'flowerpot'|'lilypad'){
 const g=new Game(kind==='flowerpot'?49:29,23);for(const k of ['sunflower',kind,'peashooter','squash','cherrybomb','wallnut'] as PlantKind[])g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));g.sun=1000;
 const row=kind==='lilypad'?2:0;g.select(kind);assert.ok(g.plant(4,row));const p=g.plants.find(p=>p.kind===kind&&p.column===4&&p.row===row)!;
 const z=g['spawnZombie']('normal',row,cellX(4)-20,0);z.speed=0;z.biteIn=1;return{g,p,z,row};
}
function step(g:Game,n:number){for(let i=0;i<n;i++)g.step();}
test('new flower pots and lily pads block bites for99 steps and become edible at the100th',()=>{
 for(const kind of ['flowerpot','lilypad'] as const){const{g,p,z}=fixture(kind);g.step();assert.equal(p.health,300,kind);assert.equal(p.invulnerableIn,99);assert.ok(z.eating);step(g,98);assert.equal(p.invulnerableIn,1);assert.equal(p.health,300);g.step();assert.equal(p.invulnerableIn,0);assert.equal(p.health,296);}
});
test('base protection does not protect an ordinary top plant or a preplaced roof pot',()=>{
 const{g,p,row}=fixture('lilypad');g.select('peashooter');assert.ok(g.plant(4,row));const top=g.plants.at(-1)!;g.step();assert.equal(top.health,296);assert.equal(p.health,300);
 const roof=new Game(49,23);for(const k of roof.config.seeds.slice(0,6))roof.chooseSeed(k);roof.start();roof.select('sunflower');assert.ok(roof.plant(0,4));const old=roof.plants.find(p=>p.kind==='flowerpot'&&p.column===1&&p.row===0)!;const z=roof['spawnZombie']('normal',0,cellX(1)-20,0);z.speed=0;z.biteIn=1;roof.step();assert.equal(old.health,296);assert.equal(old.invulnerableIn,undefined);
});
test('fresh base protection does not prevent vehicle crushing',()=>{
 const{g,p,z}=fixture('flowerpot');g.zombies=[];const car=g['spawnZombie']('zomboni',z.row,cellX(4)+30,0);car.speed=0;g.step();assert.equal(p.health,0);
});
test('base protection uses fixed logic time, pauses, and survives saved continuation',()=>{
 for(const kind of ['flowerpot','lilypad'] as const){let expected;
  for(const hz of [30,60,144])for(const speed of [1,2,4] as GameSpeed[]){const{g,p}=fixture(kind);const clock=new GameClock();clock.speed=speed;let elapsed=0;while(elapsed<500/speed){const dt=Math.min(1000/hz,500/speed-elapsed);clock.advance(g,dt,()=>{});elapsed+=dt;}clock.advance(g,1e-6,()=>{});assert.equal(p.health,300);assert.equal(p.invulnerableIn,50);g.pause();const paused=g.snapshot();step(g,20);assert.deepEqual(g.snapshot(),paused);g.resume();const restored=Game.restore(g.snapshot());step(g,75);step(restored,75);assert.deepEqual(restored.snapshot(),g.snapshot());expected??=g.snapshot();assert.deepEqual(g.snapshot(),expected,`${kind}/${hz}/${speed}`);}
 }
});
test('imitater initializes the copied base protection at transformation rather than at seed placement',()=>{
 for(const kind of ['flowerpot','lilypad'] as const){const{g,p}=fixture(kind);p.kind='imitater';p.morphTarget=kind;p.actionIn=1;delete p.invulnerableIn;g.step();assert.equal(p.kind,kind);assert.equal(p.health,300);assert.equal(p.invulnerableIn,100);step(g,99);assert.equal(p.health,300);assert.equal(p.invulnerableIn,1);g.step();assert.equal(p.invulnerableIn,0);assert.equal(p.health,296);}
});
