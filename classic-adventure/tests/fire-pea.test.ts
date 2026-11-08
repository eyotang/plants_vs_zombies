import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Game } from '../src/game/model';
import { combatTextureFiles } from '../src/rendering/asset-plan';
import { firePeaFrame, lobDrawScale } from '../src/rendering/projectiles';
import atlas from '../src/rendering/fire-pea.json';

test('lob images use native Projectile::Draw scales for cabbage, kernel, butter, melons and basketball',()=>{
 for(const [kind,scale] of [['cabbage',1],['kernel',.95],['butter',.8],['melon',1],['wintermelon',1],['basketball',1.1]] as const)assert.equal(lobDrawScale(kind),scale,kind);
});

test('fire pea atlas is loaded for torchwood and retained fire shots, not ordinary early levels', () => {
  assert.equal(combatTextureFiles(new Game(1, 1)).firePea, undefined);
  const game = new Game(9, 1, 'endless', 'day'); game.seeds = ['torchwood'];
  assert.equal(combatTextureFiles(game).firePea, 'particles/fire-pea-parts.classic.webp');
  game.seeds = []; game.peas.push({ id: 10, row: 0, x: 500, age: 10, ice: false, puff: false, fire: true });
  assert.equal(combatTextureFiles(game).firePea, 'particles/fire-pea-parts.classic.webp');
  assert.ok(existsSync(new URL('../public/assets/runtime/particles/fire-pea-parts.classic.webp', import.meta.url)));
});
test('source fire animation loops all 25 frames and is independent of display refresh rate', () => {
  assert.equal(atlas.frames,25);
  for (const id of [1, 2, 300]) {
    const seen=new Set<number>();
    for(let tick=0;tick<100;tick+=.1){const frame=firePeaFrame(tick,id);assert.ok(frame>=0&&frame<25);seen.add(frame);}
    assert.equal(seen.size,25);
    for(const hz of [30,60,144]) {
      let time=0;for(let i=0;i<hz;i++)time+=100/hz;
      assert.equal(firePeaFrame(time+.000001,id),firePeaFrame(100+.000001,id));
    }
  }
});
