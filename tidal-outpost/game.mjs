export const facilities = {
  relay: {name:'潮汐轮', cost:45, note:'每 3 秒产生 12 能量', hp:90},
  pulse: {name:'脉冲塔', cost:65, note:'对航道上的船只连续射击', hp:105},
  arc: {name:'弧光台', cost:80, note:'减速目标，并打击附近船只', hp:120},
};
export const sectors = ['雾湾', '断潮峡', '深渊门'];
const craft = {
  skiff:{hp:64, speed:37, damage:29},
  dart:{hp:40, speed:66, damage:22},
  barge:{hp:155, speed:23, damage:54},
};
export const rowY = row => 80 + row * 80;
export const columnX = column => 160 + column * 100;
export function createGame(sector = 0){
  return {sector, phase:'build', wave:0, energy:150, health:5, time:0, towers:[], enemies:[], shots:[], queue:[], sound:[]};
}
export function deploy(game, kind, row, col){
  const existing = game.towers.find(t => t.row === row && t.col === col);
  if (!['build','battle'].includes(game.phase) || row < 0 || row >= 4 || col < 0 || col >= 7) return '这里无法部署。';
  if (kind === 'recycle'){
    if (!existing) return '这个泊位是空的。';
    game.towers.splice(game.towers.indexOf(existing),1);
    const refund = Math.floor(facilities[existing.kind].cost / 2);
    game.energy += refund;
    return `已拆除，返还 ${refund} 能量。`;
  }
  if (!facilities[kind]) return '先选择一座设施。';
  if (existing) return '这个泊位已有设施。';
  const spec = facilities[kind];
  if (game.energy < spec.cost) return '能量不足。';
  game.energy -= spec.cost;
  game.towers.push({kind,row,col,x:columnX(col),hp:spec.hp,cooldown:kind === 'relay'?3:.2});
  game.sound.push('build');
  return '';
}
export function launch(game){
  if (game.phase !== 'build') return false;
  game.phase = 'battle';
  game.wave++;
  game.time = 0;
  const count = 3 + game.wave + game.sector * 2;
  const offset = game.wave + game.sector;
  const lanes = [[0,2,1,3],[2,3,0,1],[1,0,3,2]][game.sector];
  game.queue = Array.from({length:count}, (_, i) => {
    const kind = offset >= 4 && i % 4 === 3 ? 'barge' : offset >= 2 && i % 3 === 1 ? 'dart' : 'skiff';
    return {at:.8 + i * Math.max(.62,1.62 - offset * .12), row:lanes[(i + game.wave - 1) % 4], kind};
  });
  game.sound.push('wave');
  return true;
}
export function advance(game, dt){
  if (game.phase !== 'battle') return;
  game.time += dt;
  while (game.queue[0]?.at <= game.time){
    const {row,kind} = game.queue.shift();
    const spec = craft[kind];
    game.enemies.push({row,kind,x:925,hp:spec.hp,slow:0});
  }
  for (const tower of game.towers){
    tower.cooldown -= dt;
    if (tower.cooldown > 0 || tower.hp <= 0) continue;
    if (tower.kind === 'relay'){
      game.energy += 12;
      tower.cooldown += 3;
      game.sound.push('power');
      continue;
    }
    let target;
    for (const enemy of game.enemies){
      if (enemy.hp > 0 && enemy.row === tower.row && enemy.x >= tower.x - 20 && (!target || enemy.x < target.x)) target = enemy;
    }
    if (!target) continue;
    if (tower.kind === 'arc'){
      target.slow = 1.35;
      for (const enemy of game.enemies){
        if (enemy.row === tower.row && Math.abs(enemy.x-target.x) < 58) enemy.hp -= 16;
      }
    } else target.hp -= 23;
    tower.cooldown = tower.kind === 'arc' ? 1.05 : .72;
    game.shots.push({x:tower.x, end:target.x, row:tower.row, kind:tower.kind, life:.14});
    game.sound.push('fire');
  }
  for (const enemy of game.enemies){
    if (enemy.hp <= 0){game.energy += enemy.kind === 'barge'?22:12;continue;}
    const spec = craft[enemy.kind];
    enemy.slow = Math.max(0,enemy.slow-dt);
    const step = spec.speed * (enemy.slow ? .55:1) * dt;
    const barrier = game.towers.find(t => t.hp > 0 && t.row === enemy.row && enemy.x >= t.x && enemy.x-step <= t.x+31);
    if (barrier) barrier.hp -= dt * spec.damage;
    else enemy.x -= step;
    if (enemy.x < 65){game.health--;game.sound.push('hit');}
  }
  game.towers = game.towers.filter(t=>t.hp>0);
  game.enemies = game.enemies.filter(e=>e.hp>0 && e.x>=65);
  for (const shot of game.shots) shot.life -= dt;
  game.shots = game.shots.filter(shot=>shot.life>0);
  if (game.health <= 0) game.phase = 'lost';
  else if (!game.queue.length && !game.enemies.length){
    game.phase = game.wave === 5 ? 'won' : 'build';
    game.energy += 24;
    game.shots.length = 0;
  }
}
