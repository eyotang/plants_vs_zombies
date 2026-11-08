// Uses only the same six-card selection, planting, collecting and shovel commands as the UI.
import { Game, headless, type Zombie } from '../../src/game/model';
import { cellX, type LevelId, type PlantKind } from '../../src/game/config';
export function playRoofFinale(level:LevelId,seed:number,observe?:(g:Game)=>void){
 const g=new Game(level,seed);
 const loadout:PlantKind[]=level<48?['sunflower','cabbagepult','flowerpot',level===46?'kernelpult':'umbrella','cherrybomb','squash']:level===48?['sunflower','cabbagepult','flowerpot','jalapeno','cherrybomb','squash']:['sunflower','cabbagepult','flowerpot','jalapeno','squash','melonpult'];
 for(const k of loadout)g.chooseSeed(k);g.start();
 const occupied=(c:number,r:number)=>g.plants.find(p=>p.row===r&&p.column===c&&p.kind!=='flowerpot');
 const place=(kind:PlantKind,c:number,r:number)=>{
  if(['cabbagepult','melonpult','sunflower'].includes(kind)&&g.zombies.some(z=>z.health>0&&z.x<350&&!z.bungee)&&g.sun<200)return false;
  if(kind==='melonpult'&&g.zombies.some(z=>z.kind==='gargantuar'&&z.health>0)&&g.sun<500)return false;
  if(!g.seeds.includes(kind)||g.cooldown(kind)>0||occupied(c,r))return false;
  if(!g.plants.some(p=>p.row===r&&p.column===c&&p.kind==='flowerpot')){
   if(g.sun<g.plantCost(kind)+g.plantCost('flowerpot')||!g.canPlant('flowerpot',c,r))return false;
   g.cancelSelection();g.select('flowerpot');g.plant(c,r);
  }
  if(!g.canPlant(kind,c,r))return false;g.cancelSelection();g.select(kind);return g.plant(c,r);
 };
 const clear=(c:number,r:number)=>{if(!occupied(c,r))return;g.cancelSelection();g.toggleShovel();g.dig(c,r);};
 const pendingDamage=(z:Zombie)=>g.plants.reduce((damage,p)=>damage+(
   p.kind==='jalapeno'&&p.row===z.row||p.kind==='cherrybomb'&&Math.abs(p.row-z.row)<=1&&Math.abs(cellX(p.column)-z.x)<115||p.kind==='squash'&&(!p.squash||p.squash.remaining>5)&&p.row===z.row&&Math.abs(cellX(p.column)-z.x)<85?1800:0),0);
 for(let t=0;t<260000&&g.phase==='playing';t++){
  if(t%10===0){
   const foes=g.zombies.filter(z=>!z.hypnotized&&!headless(z)&&!z.bungee&&!z.flight).sort((a,b)=>a.x-b.x);
   const rows=[...g.config.rows].sort((a,b)=>{const strength=(r:number)=>g.plants.filter(p=>p.row===r&&['cabbagepult','melonpult'].includes(p.kind)).reduce((n,p)=>n+(p.kind==='melonpult'?2:1),0)*900+(foes.find(z=>z.row===r)?.x??1000);return strength(a)-strength(b);});
   for(const z of foes){
    if(pendingDamage(z)>=z.health+z.armor)continue;
    if(level>=48&&(z.kind==='gargantuar'&&z.x<650||level===49&&z.kind==='catapult'&&z.x<720||z.x<350&&foes.filter(o=>o.row===z.row).length>=2)){
     const rowTargets=foes.filter(o=>o.row===z.row);if(rowTargets.some(o=>o.health>1000)||level===49&&z.kind==='catapult'||z.x<350){
      let done=false;for(const c of [8,7,6,5,4,3,2,1,0])if(Math.abs(cellX(c)-z.x)>90&&place('jalapeno',c,z.row)){done=true;break;}
      if(!done&&g.sun>=125&&g.cooldowns.jalapeno===0){clear(0,z.row);place('jalapeno',0,z.row);}
     }
    }
    if(pendingDamage(z)>=z.health+z.armor)continue;
    if(z.kind==='gargantuar'&&z.x<730||z.x<360){
     let planted=false;
     for(const c of [6,5,4,3,2,1,0]){
      const distance=z.x-cellX(c),safe=z.kind==='gargantuar'?distance>60:z.kind==='catapult'?distance< -60:true;
      if(Math.abs(distance)<95&&safe&&place('squash',c,z.row)){planted=true;break;}
     }
     if(!planted&&(z.kind==='gargantuar'||z.x<300)&&g.seeds.includes('squash')&&g.sun>=50&&g.cooldown('squash')===0)for(const c of [6,5,4,3,2,1,0]){
      const distance=z.x-cellX(c);
      if(Math.abs(distance)<=60||Math.abs(distance)>=95||z.kind==='gargantuar'&&distance<0||z.kind==='catapult'&&distance>0||!occupied(c,z.row))continue;
      clear(c,z.row);if(place('squash',c,z.row))break;
     }
    }
    if(pendingDamage(z)>=z.health+z.armor)continue;
    const crowd=foes.filter(o=>Math.abs(o.row-z.row)<=1&&Math.abs(o.x-z.x)<115);
    if(z.x<240||z.kind==='gargantuar'&&z.health>0&&z.x<650||crowd.length>=5&&z.x<420){
     let planted=false;for(const r of [z.row-1,z.row+1,z.row].filter(r=>g.config.rows.includes(r))) {for(const c of [6,5,4,3,2,1,7,8,0])if(Math.abs(cellX(c)-z.x)<110&&place('cherrybomb',c,r)){planted=true;break;}if(planted)break;}
     if(!planted&&g.sun>=150&&g.cooldowns.cherrybomb===0){const c=Math.max(0,Math.min(8,Math.round((z.x-80)/80)));if(g.plants.some(p=>p.row===z.row&&p.column===c&&p.kind==='flowerpot')){clear(c,z.row);place('cherrybomb',c,z.row);}}
    }
   }
   for(const z of foes)if(z.x<750&&!g.plants.some(p=>p.row===z.row&&p.kind==='cabbagepult'))place('cabbagepult',2,z.row);
   const unguarded=foes.some(z=>z.x<750&&!g.plants.some(p=>p.row===z.row&&['cabbagepult','melonpult'].includes(p.kind)));
   if(!unguarded||g.sun>=150)for(const c of [0,1])for(const r of g.config.rows){if(c===1&&[1,3].includes(r)&&g.seeds.includes('umbrella'))continue;place('sunflower',c,r);}
   for(const r of rows)place('cabbagepult',2,r);
   if(g.plants.filter(p=>p.kind==='sunflower').length>=5){
    if(g.wave>=6)for(const r of [1,3])place('umbrella',1,r);
    for(const r of rows)for(const c of level===49?[3,4,5]:[3,4])place(level===49&&c===4&&g.seeds.includes('melonpult')?'melonpult':'cabbagepult',c,r);
    if(level<48)for(const r of rows)place('cabbagepult',5,r);
   }

  }
  g.step();for(const sun of [...g.suns])if(sun.y>=sun.targetY)g.collectSun(sun.id);g.drainEvents();if(t%100===0)observe?.(g);
 }
 return g;
}
