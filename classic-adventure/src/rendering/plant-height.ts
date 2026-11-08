import type {PlantKind} from '../game/config';
import type {Game} from '../game/model';

const height:Partial<Record<PlantKind,number>>={flowerpot:26,lilypad:25,starfruit:10,tanglekelp:24,seashroom:28,coffeebean:-20,pumpkin:15,puffshroom:5,scaredyshroom:-14,gravebuster:-40};

// PlantDrawHeightOffset / PlantFlowerPotHeightOffset at flowerpot scale1.
// Squished bodies skip ordinary pot support; source spike placement still uses it.
export function plantHeightOffset(game:Game,kind:PlantKind,column:number,row:number,squished=false) {
 const pot=game.plants.some(p=>p.kind==='flowerpot'&&p.column===column&&p.row===row&&p.health>0);
 let dy=height[kind]??0;
 if(game.waterRow(row)&&kind!=='coffeebean')dy+=Math.sin(row*Math.PI+column*.25*Math.PI+game.ticks*2*Math.PI/200)*2;
 if(!squished&&pot&&kind!=='flowerpot')dy+=kind==='chomper'||kind==='plantern'?-10:kind==='scaredyshroom'?0:-5;
 if(kind==='spikeweed'||kind==='spikerock'){
  if(kind==='spikerock')dy+=6;
  const bottom=game.config.rows.length===6?5:4;
  dy+=pot?5:game.config.environment==='roof'?15:game.waterRow(row)?0:row===bottom&&column>=7&&bottom===5?1:row===bottom&&column<7?12:15;
 }
 return dy;
}
