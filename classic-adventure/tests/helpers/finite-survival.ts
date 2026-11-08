// Integration player uses selected cards, real produced sun, planting and the shovel only.
import { Game, headless, type Zombie } from '../../src/game/model';
import { cellX, isNight, type PlantKind, type SurvivalMode, type SurvivalScene } from '../../src/game/config';
import {walkingSpeed} from '../../src/game/zombie-motion';
export function playFinite(mode: Exclude<SurvivalMode,'endless'>, scene: SurvivalScene, seed: number) {
  const g=new Game(9,seed,mode,scene), night=isNight(scene), roof=scene==='roof', pool=scene==='pool'||scene==='fog';
  const producer:PlantKind=night?'sunshroom':'sunflower', shooter:PlantKind=roof?'cabbagepult':night?'fumeshroom':'peashooter';
  const loadout:PlantKind[]=[producer,shooter,'melonpult',roof?'wallnut':'wintermelon','cherrybomb','jalapeno',roof&&mode==='survival-normal'?'wintermelon':'blover',night?'hypnoshroom':'squash'];
  if(pool)loadout.push('lilypad',night?'puffshroom':'wallnut');
  else if(roof)loadout.push('flowerpot','umbrella');
  else if(night)loadout.push('puffshroom','gravebuster');
  else loadout.push('snowpea','splitpea');
  for(const kind of loadout)g.chooseSeed(kind);g.start();g.autoCollectSun=true;
  const occupied=(c:number,r:number)=>g.plants.find(p=>p.column===c&&p.row===r&&!['lilypad','flowerpot','pumpkin'].includes(p.kind));
  const place=(kind:PlantKind,c:number,r:number)=>{
    if(!g.seeds.includes(kind)||g.cooldown(kind)>0)return false;
    if(roof&&kind==='blover'&&g.zombies.some(z=>z.kind==='zomboni'&&z.health>0&&z.row===r&&Math.abs(z.x-cellX(c))<220))return false;
    if(roof&&mode==='survival-hard'&&g.seeds.includes('tallnut')&&!['tallnut','squash','jalapeno','cherrybomb','blover'].includes(kind)&&g.zombies.some(z=>z.pogo&&!z.hypnotized&&z.x<750&&!g.plants.some(p=>p.kind==='tallnut'&&p.row===z.row&&cellX(p.column)<z.x))&&g.sun<g.plantCost(kind)+150)return false;
    if(roof&&mode==='survival-hard'&&!['squash','jalapeno','cherrybomb','blover','tallnut'].includes(kind)
      &&g.zombies.some(z=>!z.hypnotized&&z.health>0&&['zomboni','catapult','gargantuar'].includes(z.kind)&&z.x<825)){
      // Keep a pot plus Squash affordable while emergency cards recharge.
      const reserve=Math.max(75,g.cooldown('jalapeno')===0?150:g.cooldown('cherrybomb')===0?175:g.cooldown('squash')===0?75:0);
      if(g.sun<g.plantCost(kind)+reserve)return false;
    }
    if(roof&&mode==='survival-normal'&&!['squash','jalapeno','cherrybomb'].includes(kind)&&g.cooldown('squash')===0
      &&g.zombies.some(z=>!z.hypnotized&&!headless(z)&&!z.bungee&&!z.flying&&z.x<400)&&g.sun<g.plantCost(kind)+75)return false;
    // Keep an instant answer before a thrown imp reaches the rear production.
    if(pool&&!['squash','jalapeno','cherrybomb','blover'].includes(kind)
      &&g.zombies.some(z=>!z.hypnotized&&z.health>0&&(z.kind==='imp'&&z.x<400||z.kind==='gargantuar'&&z.health<1500&&z.x<650))
      &&g.sun<g.plantCost(kind)+75)return false;
    // A group of diving snorkels needs an area bomb, not repeated rear rebuilding.
    if(pool&&!['squash','jalapeno','cherrybomb','blover','tanglekelp'].includes(kind)&&g.cooldown('cherrybomb')<750
      &&g.zombies.some(z=>!z.hypnotized&&!headless(z)&&g.waterRow(z.row)&&z.x<450)&&g.sun<g.plantCost(kind)+175)return false;
    if(kind!=='blover'&&g.zombies.some(z=>z.flying&&z.x<650)&&g.sun<g.plantCost(kind)+(roof?125:100))return false;
    if(roof&&['melonpult','wintermelon'].includes(kind)&&g.survivalEnemies.includes('jack')&&g.sun<g.plantCost(kind)+150)return false;
    if(['melonpult','wintermelon'].includes(kind)&&g.survivalEnemies.includes('balloon')&&g.sun<g.plantCost(kind)+100)return false;
    const base=roof?'flowerpot':g.waterRow(r)&&!['lilypad','tanglekelp','seashroom'].includes(kind)?'lilypad':null;
    if(base&&!g.plants.some(p=>p.kind===base&&p.column===c&&p.row===r)){
      if(g.sun<g.plantCost(kind)+g.plantCost(base)||!g.canPlant(base,c,r))return false;
      g.cancelSelection();g.select(base);g.plant(c,r);
    }
    if(!g.canPlant(kind,c,r))return false;g.cancelSelection();g.select(kind);return g.plant(c,r);
  };
  const clear=(c:number,r:number)=>{if(occupied(c,r)){g.cancelSelection();g.toggleShovel();g.dig(c,r);}};
  const pendingDamage=(z:Zombie)=>g.plants.reduce((damage,p)=>damage+(
    p.kind==='jalapeno'&&p.row===z.row||p.kind==='cherrybomb'&&Math.abs(p.row-z.row)<=1&&Math.abs(cellX(p.column)-z.x)<115||p.kind==='squash'&&(!p.squash||p.squash.remaining>5)&&p.row===z.row&&Math.abs(cellX(p.column)-z.x)<85?1800:0),0);
  let transitions=0;
  for(let t=0;t<650000&&g.phase!=='won'&&g.phase!=='lost';t++){
    if(g.phase==='intermission'){
      transitions++;g.nextSurvivalStage();
      if(roof&&mode==='survival-hard'&&g.plants.filter(p=>p.kind==='melonpult').length>=3)g.replaceSeed('wallnut','wintermelon');
      if(roof&&mode==='survival-hard'&&g.survivalEnemies.includes('pogo'))g.replaceSeed(g.seeds.includes('wallnut')?'wallnut':'wintermelon','tallnut');
      if(g.survivalEnemies.some(k=>k==='gargantuar'||k==='digger'))g.replaceSeed(pool?shooter:roof?
        g.survivalEnemies.some(k=>k==='bungee'||k==='catapult')?'squash':'umbrella':night?'gravebuster':'tallnut','splitpea');
      if(roof&&g.survivalEnemies.some(k=>k==='bungee'||k==='catapult')&&!g.seeds.includes('umbrella')){
        g.replaceSeed(!g.survivalEnemies.includes('balloon')?'blover':g.seeds.includes('wintermelon')?'wintermelon':'wallnut','umbrella');
      }
      if(pool&&!night&&g.survivalEnemies.includes('snorkel'))g.replaceSeed('wallnut','tanglekelp');
      g.start();
    }
    if(t%10===0){
      const guardUmbrella=roof&&g.survivalEnemies.some(kind=>kind==='bungee'||kind==='catapult');
      if(roof&&!guardUmbrella)for(const r of [1,3])if(occupied(1,r)?.kind==='umbrella')clear(1,r);
      const enemies=g.zombies.filter(z=>!z.hypnotized&&!headless(z)&&!z.bungee&&!z.flight&&!z.underground).sort((a,b)=>a.x-b.x);
      const rows=[...g.config.rows].sort((a,b)=>{
        const value=(r:number)=>g.plants.filter(p=>p.row===r&&[shooter,'splitpea','melonpult','wintermelon','snowpea'].includes(p.kind)).reduce((n,p)=>n+(p.kind==='wintermelon'?4:p.kind==='melonpult'?3:1),0)*1000+(enemies.find(z=>z.row===r)?.x??1000);
        return value(a)-value(b);
      });
      if(g.seeds.includes('tanglekelp'))for(const z of enemies)if(g.waterRow(z.row)&&z.x<720&&z.x>80)for(let c=8;c>=0;c--)if(Math.abs(cellX(c)-z.x)<55&&place('tanglekelp',c,z.row))break;
      // Rear defense for miners and thrown imps; their airborne phases cannot be shot down.
      const rearRows=roof?new Set(g.zombies.filter(z=>z.health>0&&(z.kind==='digger'||z.kind==='imp'||z.kind==='gargantuar'&&z.health<1500)).map(z=>z.row)):null;
      if(g.seeds.includes('splitpea')&&g.survivalEnemies.some(k=>k==='gargantuar'||k==='digger')&&g.plants.filter(p=>p.kind===producer).length>=4&&g.sun>=125&&g.cooldown('splitpea')===0){
        const column=roof?5:night?3:2;
        for(const r of rows.filter(r=>!g.waterRow(r)&&(!rearRows||rearRows.has(r)))){
          if(roof&&!g.plants.some(p=>p.row===r&&['melonpult','wintermelon'].includes(p.kind)&&p.column<column))continue;
          const p=occupied(column,r);if(p?.kind==='splitpea')continue;
          if(p?.kind===shooter||roof&&p?.kind==='melonpult')clear(column,r);
          if(place('splitpea',column,r))break;
        }
      }
      if(enemies.some(z=>z.flying&&z.x<450)){
        let planted=false;
        for(const r of rows)for(const c of roof?[3,2,1,0,4,5,6,7,8]:[8,7,6,5])if(place('blover',c,r)){planted=true;break;}
        // A full free-mushroom screen still needs an empty cell for balloon defense.
        if(!planted&&g.sun>=100&&g.cooldown('blover')===0){
          const puff=g.plants.find(p=>p.kind==='puffshroom'&&!g.waterRow(p.row));
          if(puff){clear(puff.column,puff.row);place('blover',puff.column,puff.row);}
        }
      }
      for(const z of enemies){
        if(roof&&z.pogo&&z.x<700)for(const c of[5,4,3,2])if(z.x>cellX(c)&&z.x-cellX(c)<180&&!occupied(c,z.row)&&g.sun>=125+(g.plants.some(p=>p.kind==='flowerpot'&&p.column===c&&p.row===z.row)?0:25)&&place('tallnut',c,z.row))break;
        if(pendingDamage(z)>=z.health+z.armor)continue;
        // Let squash take off before a crusher arrives; save row bombs for the remaining health.
        if(roof&&['zomboni','gargantuar'].includes(z.kind)&&z.x<750&&g.sun>=75&&g.cooldown('squash')===0){
          const closing=z.kind==='zomboni'?z.speed:walkingSpeed(z)*(z.chillIn>0?.4:1);
          for(const c of [7,6,5,4,3,2,1,0]){
            const distance=z.x-cellX(c);
            if(distance>55+125*closing&&distance<100&&place('squash',c,z.row))break;
          }
          if(pendingDamage(z)>=z.health+z.armor)continue;
        }
        if(roof&&z.x<560&&!z.hasPole&&!z.pogo&&!['gargantuar','zomboni','catapult','jack'].includes(z.kind)){
          for(const c of [4,3,5,2])if(z.x>cellX(c)&&z.x-cellX(c)<160&&!occupied(c,z.row)&&place('wallnut',c,z.row))break;
        }
        if(pool&&z.x<400&&!z.hasPole&&!z.pogo&&!z.dolphin&&!['zomboni','gargantuar'].includes(z.kind)&&g.sun>=(g.waterRow(z.row)?75:50)&&g.cooldown('wallnut')===0){
          const c=Math.max(0,Math.min(8,Math.floor((z.x-80)/80))),p=occupied(c,z.row);
          if(!p)place('wallnut',c,z.row);
        }
        if(night&&(['football','dancer','bucket'].includes(z.kind)||z.kind==='imp')&&!z.hypnotized&&z.x<600&&z.x>80&&g.sun>=75&&g.cooldown('hypnoshroom')===0){const c=Math.floor((z.x-80)/80);if(z.kind==='imp'||g.plants.some(p=>p.column===c&&p.row===z.row&&p.kind==='puffshroom'))clear(c,z.row);place('hypnoshroom',c,z.row);}
        const heavy=['gargantuar','zomboni','catapult','jack'].includes(z.kind),crowd=enemies.filter(o=>Math.abs(o.row-z.row)<=1&&Math.abs(o.x-z.x)<115).length;
        if(heavy&&z.x<720||z.x<300||crowd>=6&&z.x<500){
          if(g.sun>=125&&g.cooldown('jalapeno')===0){let done=false;for(const c of [8,7,6,5,4,3,2,1,0])if(place('jalapeno',c,z.row)){done=true;break;}if(!done){clear(0,z.row);place('jalapeno',0,z.row);}}
          if(pendingDamage(z)>=z.health+z.armor)continue;
          if(g.sun>=150&&g.cooldown('cherrybomb')===0){let done=false;for(const r of rows.filter(r=>Math.abs(r-z.row)<=1)){for(const c of [6,5,4,3,2,1,7,8,0])if(Math.abs(cellX(c)-z.x)<110&&place('cherrybomb',c,r)){done=true;break;}if(done)break;}if(!done){const c=Math.max(0,Math.min(8,Math.round((z.x-80)/80)));clear(c,z.row);place('cherrybomb',c,z.row);}}
        }
        if(pendingDamage(z)>=z.health+z.armor)continue;
        if(z.kind==='imp'&&z.x<300&&g.sun>=50&&g.cooldown('squash')===0){const c=Math.max(0,Math.min(8,Math.round((z.x-80)/80)));clear(c,z.row);place('squash',c,z.row);}
        if(z.x<400||heavy&&z.x<700){
          let planted=false;for(const c of [6,5,4,3,2,1,0])if(Math.abs(cellX(c)-z.x)<85&&place('squash',c,z.row)){planted=true;break;}
          if(!planted&&roof&&z.x<300&&g.sun>=50&&g.cooldown('squash')===0)for(const c of [3,2,1,0]){
            const distance=z.x-cellX(c),p=occupied(c,z.row);
            if(distance< -20||distance>=85||!p||p.kind==='squash'||!g.plants.some(base=>base.kind==='flowerpot'&&base.column===c&&base.row===z.row))continue;
            clear(c,z.row);if(place('squash',c,z.row))break;
          }
        }
      }
      // Recover production after a lane is damaged before spending the remaining sun on upgrades.
      if(g.plants.filter(p=>p.kind===producer).length<6)for(const c of [0,1])for(const r of rows.filter(r=>!g.waterRow(r)&&(!guardUmbrella||c!==1||![1,3].includes(r)))){
        if(!enemies.some(z=>z.row===r&&z.x<250))place(producer,c,r);
      }
      if(guardUmbrella&&g.wave>=5&&g.plants.filter(p=>p.kind===producer).length>=4)for(const r of [1,3]){
        if(occupied(1,r)?.kind===producer&&g.sun>=100&&g.cooldown('umbrella')===0)clear(1,r);
        place('umbrella',1,r);
      }
      if(night)for(const r of rows.filter(r=>!g.waterRow(r)))for(const c of [6,7,5,8])if(place('puffshroom',c,r))break;
      for(const z of enemies)if(scene!=='fog'&&z.x<700&&!g.plants.some(p=>p.row===z.row&&p.kind===shooter))place(shooter,2,z.row);
      const unguarded=enemies.some(z=>z.x<650&&!g.plants.some(p=>p.row===z.row&&[shooter,'splitpea','melonpult','wintermelon'].includes(p.kind)));
      if(scene==='fog'||!unguarded||g.sun>=150)for(const c of [0,1])for(const r of rows.filter(r=>!g.waterRow(r))){if(guardUmbrella&&c===1&&[1,3].includes(r))continue;place(producer,c,r);}
      for(const r of rows){if(scene!=='fog'||g.plants.filter(p=>p.kind===producer).length>=4)place(shooter,scene==='fog'?4:2,r);if(night&&g.plants.filter(p=>p.kind===producer).length>=4)place(shooter,3,r);}
      if(g.plants.filter(p=>p.kind===producer).length>=4){
        if(roof&&mode==='survival-normal')for(const r of rows)place(shooter,3,r);
        if(scene==='night'&&g.sun>=150)for(const grave of g.graves)if(place('gravebuster',grave.column,grave.row))break;
        for(const r of rows){
          if(roof&&mode==='survival-normal'){for(const melon of g.plants.filter(p=>p.kind==='melonpult'&&p.row===r))if(place('wintermelon',melon.column,r))break;}else if(g.plants.some(p=>p.kind==='melonpult'&&p.row===r&&p.column===(night?4:3)))place('wintermelon',night?4:3,r);
          for(const c of night?[4,5]:[3,4,5])place('melonpult',c,r);
          if(!night&&!roof)place(pool?'wallnut':'tallnut',7,r);
        }
      }
    }
    g.step();g.drainEvents();
  }
  return { game:g, transitions };
}
