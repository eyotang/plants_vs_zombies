// Historical compatibility check against the other port, not a native-fidelity acceptance gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
// Recorded against the verified upstream 45fe1f404 baseline; omit new state unused by these non-storm survival fixtures.
for (const [scene, hash] of Object.entries({
  day:'3b7b35afb0db6d3d0226086bbd57b99e2bc98641922fb6ee5aa1e07c6586acc8',
  pool:'00042b76a4f6e06cd1687f29381916640dc87d99137b7704ae87360d8de07aad',
  roof:'76f7e0c74feabfc46052df12a89ad626d7c61eb3de1d8ad6660eb14017798ae9',
}) as [Parameters<typeof denseGame>[0],string][]) test(`dense ${scene} simulation preserves the pinned upstream simulation result`,()=>{
  const game=denseGame(scene);for(let i=0;i<1000;i++){game.step();game.drainEvents();}
  const { wintermelonCooldown, upgradeCooldowns, stormFlash, bankedMoney, tutorial, tutorialFinished, davePicks, campaign, imitaterTarget, cannonTarget, rake, cooldowns } = game.snapshot();
  assert.equal(stormFlash, 1);
  assert.equal(wintermelonCooldown,0);
  assert.ok(Object.values(upgradeCooldowns).every(value=>value===0));
  assert.deepEqual([bankedMoney,tutorial,tutorialFinished,davePicks,campaign,imitaterTarget,cannonTarget,rake],[0,'off',false,[],null,null,null,null]);
  const {imitater,...oldCooldowns}=cooldowns;assert.equal(imitater,0);
  const originalState=game.snapshot() as Record<string,unknown>;
  for(const key of ['wintermelonCooldown','upgradeCooldowns','stormFlash','bankedMoney','tutorial','tutorialFinished','davePicks','firstCoinDropped','campaign','imitaterTarget','cannonTarget','rake'])delete originalState[key];
  originalState.cooldowns=oldCooldowns;
  assert.equal(createHash('sha256').update(JSON.stringify(originalState)).digest('hex'),hash);
});
