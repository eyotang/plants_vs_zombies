import firePea from './fire-pea.json';
import type {LobKind} from '../game/lob-flight';
import type {Pea} from '../game/model';
import{fireAnimationTime}from'../game/pea-motion';

export const lobDrawScale=(kind:LobKind)=>kind==='kernel'?.95:kind==='butter'?.8:kind==='basketball'?1.1:1;

// Legacy atlas fallback uses the previous stable50–80fps visual rate.
export function firePeaFrame(ticks: number, id: number, rate?:number) {
  const fps = rate??50 + (Math.imul(id, 2654435761) >>> 0) % 31;
  return Math.floor(ticks * fps / 100) % firePea.frames;
}

// A rebuilt Scene has no original actor.since. Persist ignition time/rate in
// the model; older saves use projectile age because ignition history is absent.
export function firePeaShotFrame(pea:Pea,ticks:number){return Math.floor(fireAnimationTime(pea,ticks)*(firePea.frames-1));}
