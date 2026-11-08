import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/model';
function fixture(){
 const g=new Game(49,23);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));
 const z=g['spawnZombie']('normal',0,500,0);z.speed=.2;return {g,z};
}
test('native cold counters progress concurrently while butter immobilizes the body',()=>{
 const {g,z}=fixture();z.frozenIn=3;z.chillIn=5;z.butterIn=7;
 for(let t=1;t<=7;t++){
  g.step();assert.deepEqual([z.frozenIn,z.chillIn,z.butterIn],[Math.max(0,3-t),Math.max(0,5-t),7-t],`counter tick ${t}`);
  if(t<7)assert.equal(z.x,500,`motion tick ${t}`);else assert.ok(z.x<500,'motion resumes on the final butter tick');
 }
});
test('native action gate reads cold counters after decrement on their final tick',()=>{
 for(const [freeze,butter,chill] of [[1,0,20],[0,1,20],[1,1,1]]){
  const {g,z}=fixture();z.frozenIn=freeze;z.butterIn=butter;z.chillIn=chill;g.step();
  assert.ok(z.x<500,`${freeze}/${butter}/${chill}: native actions resume on the final counter tick`);
  assert.equal(z.frozenIn,0);assert.equal(z.butterIn,0);assert.equal(z.chillIn,chill-1);
 }
});
test('overlapping cold clocks pause together and resume identically from a saved battle',()=>{
 const {g,z}=fixture();z.frozenIn=3;z.chillIn=5;z.butterIn=7;g.step();
 g.pause();const paused=[z.frozenIn,z.chillIn,z.butterIn,z.x];for(let t=0;t<20;t++)g.step();assert.deepEqual([z.frozenIn,z.chillIn,z.butterIn,z.x],paused);g.resume();
 const restored=Game.restore(g.snapshot());assert.ok(restored);
 for(let t=0;t<10;t++){g.step();restored.step();}
 assert.deepEqual(restored.snapshot(),g.snapshot());
});
