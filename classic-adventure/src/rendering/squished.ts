import {cellX,type PlantKind} from '../game/config';
import type {Game,SquishedPlant} from '../game/model';
import {plantHeightOffset} from './plant-height';

// ReanimationLawn.cpp::GetPlantImageSize / MakeCachedPlantFrame.
export function squishedFrame(kind:PlantKind) {
 return {x:kind==='melonpult'||kind==='wintermelon'?-40:-20,y:kind==='tallnut'?-40:-20,
   width:kind==='cobcannon'?200:kind==='melonpult'||kind==='wintermelon'?160:120,height:kind==='tallnut'?160:120};
}
// Plant::Draw uses the grid root, a static cached seed pose and quarter height.
export function squishedPosition(game:Game,p:SquishedPlant) {
 const {kind,column,row}=p;
 const dy=plantHeightOffset(game,kind,column,row,true)+(kind==='flowerpot'?-15:kind==='coffeebean'?10:0);
 return [cellX(column)-40,game.gridY(column,row)+60+dy] as const;
}
