import geometry from './data/pea-geometry.json';
import type {PlantKind} from './config';
import type {Pea} from './model';

export type PeaKind=keyof typeof geometry;
export const isPeaKind=(kind:PlantKind):kind is PeaKind=>Object.hasOwn(geometry,kind);
export interface PeaHeadClock {
 phase:'idle'|'shoot';time:number;rate:number;looped:boolean;
 blend?:{left:number;duration?:number;from:PeaHeadClock};
}
export interface PeaMotion {rate:number;bodyTime:number;shooting:number;heads:PeaHeadClock[]}
const f=Math.fround;
// Reanimator.h declares a double initialized from0.01f; only the accumulated
// result is assigned back to the float animation time (not each intermediate).
const increment=(rate:number,frames:number)=>f(.01)*rate/frames;

const fireRate=(pea:Pea)=>pea.fireRate??50+(Math.imul(pea.id,2654435761)>>>0)%31;
const fireAge=(pea:Pea,ticks:number)=>Math.max(0,pea.fireAt===undefined?pea.age:ticks-pea.fireAt+1);
export function fireAnimationTime(pea:Pea,ticks:number){return pea.fireTime??f((fireAge(pea,ticks)*increment(fireRate(pea),25))%1);}
export function advanceFireAnimation(pea:Pea,ticks:number){
 const step=increment(fireRate(pea),25);
 pea.fireTime=f((pea.fireTime??f((Math.max(0,fireAge(pea,ticks)-1)*step)%1))+step);
 while(pea.fireTime>=1)pea.fireTime=f(pea.fireTime-1);
}

export function createPeaMotion(kind:PeaKind,rate:number):PeaMotion{
 return {rate:f(rate),bodyTime:0,shooting:0,heads:geometry[kind].heads.map(()=>({phase:'idle',time:0,rate:f(rate),looped:false}))};
}
function snapshot(head:PeaHeadClock):PeaHeadClock{
 return {phase:head.phase,time:head.time,rate:head.rate,looped:head.looped,...(head.blend&&head.blend.left>0?{blend:{left:head.blend.left,...(head.blend.duration?{duration:head.blend.duration}:{}),from:snapshot(head.blend.from)}}:{})};
}
function change(head:PeaHeadClock,phase:'idle'|'shoot',time:number,rate:number,duration=20){
 const from=snapshot(head);head.phase=phase;head.time=time;head.rate=rate;head.blend={left:duration,...(duration!==20?{duration}:{}),from};
 // Native SetFramesForLayer does not clear the existing loop count.
}

// FindTargetAndFire after acquisition. Counter is shared by both Split Pea heads.
export function beginPeaShot(state:PeaMotion,kind:PeaKind,rear=false){
 if(kind==='threepeater'){beginThreepeaterShot(state);return;}
 const index=rear?1:0,rate=rear?35:kind==='repeater'||kind==='splitpea'?45:kind==='gatlingpea'?38:35;
 change(state.heads[index],'shoot',0,rate);
 state.shooting=rear||kind==='repeater'||kind==='splitpea'?26:kind==='gatlingpea'?100:35;
}

export function beginThreepeaterShot(state:PeaMotion,below=true,above=true){
 for(let i=0;i<3;i++)if(i===1||(i===0?below:above))change(state.heads[i],'shoot',0,20,10);
 state.shooting=35;
}

// UpdateShooting runs before UpdateShooter and before body/head clock advance.
// Bit1 emits the front projectile; bit2 emits the rear projectile.
export function updatePeaShooting(state:PeaMotion,kind:PeaKind){
 if(state.shooting===0)return 0;
 state.shooting--;
 if(kind==='threepeater'){
  if(state.shooting===1)return state.heads.reduce((mask,head,i)=>mask|(head.phase==='shoot'?1<<i:0),0);
  if(state.shooting===0){
   if(state.heads[1].looped){for(const head of state.heads)if(head.phase==='shoot')change(head,'idle',state.bodyTime,state.rate);}
   else state.shooting=1;
  }
  return 0;
 }
 let fire=0;
 if(kind==='gatlingpea'){
  if([18,35,51,68].includes(state.shooting))fire=1;
 }else if(state.shooting===1){
  return kind==='splitpea'?(state.heads[0].phase==='shoot'?1:0)|(state.heads[1].phase==='shoot'?2:0):1;
 }
 if(state.shooting!==0)return fire;
 if(kind==='splitpea'){
  for(const head of state.heads)if(head.looped)change(head,'idle',state.bodyTime,state.rate);
  return fire;
 }
 if(state.heads[0].looped)change(state.heads[0],'idle',state.bodyTime,state.rate);
 else state.shooting=1;
 return fire;
}

export function advancePeaMotion(state:PeaMotion,kind:PeaKind){
 state.bodyTime=f(state.bodyTime+increment(state.rate,geometry[kind].bodyFrames));
 while(state.bodyTime>=1)state.bodyTime=f(state.bodyTime-1);
 for(let index=0;index<state.heads.length;index++){
  const head=state.heads[index],definition=geometry[kind].heads[index];
  head.time=f(head.time+increment(head.rate,head.phase==='idle'?definition.idleFrames:definition.shootFrames));
  if(head.time>=1){head.looped=true;if(head.phase==='shoot')head.time=1;else while(head.time>=1)head.time=f(head.time-1);}
  if(head.blend&&--head.blend.left===0)delete head.blend;
 }
}

// Native GetTransformAtTime uses frameCount-1 and integer assignment truncates.
export function peaHeadOffset(kind:PeaKind,state:PeaMotion):[number,number]{
 const stem=geometry[kind].stem,position=f(state.bodyTime*(stem.length-1)),before=Math.min(stem.length-1,Math.floor(position)),after=Math.min(stem.length-1,before+1),fraction=f(position-before);
 const value=(axis:number)=>Math.trunc(f(f(stem[before][axis])+f(f(f(stem[after][axis])-f(stem[before][axis]))*fraction)));
 return [value(0),value(1)];
}
