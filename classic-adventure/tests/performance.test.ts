import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/model';
import {GameClock,type GameSpeed} from '../src/game/clock';
import { loadInBatches } from '../src/platform/load-queue';
import { denseGame } from './helpers/performance';

test('asset loading bounds concurrent work and completes each requested file once', async () => {
  let active=0, peak=0; const seen:number[]=[];
  await loadInBatches(Array.from({length:25},(_,i)=>i),4,async item=>{
    active++;peak=Math.max(peak,active);await Promise.resolve();seen.push(item);active--;
  });
  assert.equal(peak,4);assert.equal(active,0);
  assert.deepEqual(seen.sort((a,b)=>a-b),Array.from({length:25},(_,i)=>i));
});
test('asset loading propagates a failed download without retries', async () => {
  let calls=0;const error=new Error('download failed');
  await assert.rejects(loadInBatches(['missing'],4,async()=>{calls++;throw error;}),e=>e===error);
  assert.equal(calls,1);
});
// Native-rule corrections intentionally change the old port's full-state hashes.
// The original hashes and checks remain in performance.upstream.ts.
for(const scene of ['day','pool','roof'] as const)test(`dense ${scene} battle agrees across render rates, speeds, pause and saved continuation`,()=>{
  const reference=denseGame(scene);
  const initialPositions=reference.zombies.map(z=>z.x),initialPlantHealth=reference.plants.reduce((sum,p)=>sum+p.health,0);
  for(let i=0;i<1000;i++){reference.step();reference.drainEvents();}
  const expected=reference.snapshot();
  assert.equal(reference.ticks,1000);assert.equal(reference.phase,'playing');
  assert.ok(reference.zombies.some((z,i)=>z.x!==initialPositions[i]),'fixture must exercise actual movement');
  assert.ok(reference.plants.reduce((sum,p)=>sum+p.health,0)<initialPlantHealth,'fixture must exercise actual attacks');
  assert.equal(expected.stormFlash,1);assert.equal(expected.wintermelonCooldown,0);
  assert.ok(Object.values(expected.upgradeCooldowns).every(value=>value===0));
  assert.deepEqual([expected.bankedMoney,expected.tutorial,expected.tutorialFinished,expected.davePicks,expected.campaign,expected.imitaterTarget,expected.cannonTarget,expected.rake],[0,'off',false,[],null,null,null,null]);
  assert.equal(expected.cooldowns.imitater,0);
  for(const hz of [30,60,144])for(const speed of [1,2,4] as GameSpeed[]){
    const g=denseGame(scene),clock=new GameClock();clock.speed=speed;let elapsed=0;
    while(elapsed<10000/speed){const dt=Math.min(1000/hz,10000/speed-elapsed);clock.advance(g,dt,()=>{});g.drainEvents();elapsed+=dt;}
    clock.advance(g,1e-6,()=>{});g.drainEvents();
    assert.equal(g.ticks,1000,`${hz}Hz/${speed}x steps`);
    assert.deepEqual(g.snapshot(),expected,`${hz}Hz/${speed}x complete state`);
  }
  const original=denseGame(scene);for(let i=0;i<400;i++){original.step();original.drainEvents();}
  original.pause();const paused=original.snapshot();const clock=new GameClock();assert.equal(clock.advance(original,5000,()=>{}),0);assert.deepEqual(original.snapshot(),paused);original.resume();
  const restored=Game.restore(original.snapshot());for(let i=0;i<600;i++){restored.step();restored.drainEvents();}
  assert.deepEqual(restored.snapshot(),expected,'restored complete state');
});
