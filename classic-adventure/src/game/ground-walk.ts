import type {Zombie} from './model';
import ground from './data/zombie-ground.json';
import ground2 from './data/zombie-ground-walk2.json';
const f=Math.fround,dt=f(.01),count=ground.x.length;
const distance=f(f(ground.x[count-1])-f(ground.x[0]));
export function hasGroundWalk(z:Zombie){return z.kind==='normal'||z.kind==='cone'||z.kind==='bucket'||z.kind==='door';}
function rate(z:Zombie,chilled:boolean){return f(f(f(f(z.speed)*f(count/distance))*47)/(z.mini?.5:1))*(chilled?.5:1);}
export function groundWalkTime(z:Zombie,alpha=1,previous=z.walkTime??0){
 return phaseTime(z.walkTime??0,alpha,previous);
}
function phaseTime(current:number,alpha:number,previous:number){
 const delta=current>=previous?current-previous:current+1-previous;
 const time=previous+delta*alpha;
 return time-Math.floor(time);
}
export function eatAnimationTime(z:Zombie,alpha=1,previous=z.eatTime??0){return phaseTime(z.eatTime??0,alpha,previous);}
export function advanceEatingAnimation(z:Zombie,chilled:boolean){
 let time=f((z.eatTime??0)+dt*(chilled?18:36)/40);
 while(time>=1)time=f(time-1);
 z.eatTime=time;
}
export function groundWalkStep(z:Zombie,chilled:boolean){
 const groundTrack=z.walkVariant===2?ground2:ground;
 const time=z.walkTime??0,animRate=rate(z,chilled);
 // GetFrameTime includes the source frameStart before its float rounding.
 const index=Math.min(count-1,Math.floor(f(groundTrack.start+f(time*(count-1))))-groundTrack.start);
 const difference=f(f(groundTrack.x[Math.min(count-1,index+1)])-f(groundTrack.x[index]));
 const velocity=f(f(difference*dt*animRate)*(z.mini?.5:1));
 let next=f(time+dt*animRate/count);while(next>=1)next=f(next-1);
 z.walkTime=next;
 return velocity;
}

export interface OrdinaryBodyPose {clip:string;time:number;blend?:OrdinaryBodyBlend}
export interface OrdinaryBodyBlend {left:number;from:OrdinaryBodyPose}
export function ordinaryBodyClip(z:Zombie,eating=z.eating){
 const type=z.kind==='door'&&z.shield>0?'door':(z.kind==='cone'||z.kind==='bucket')&&z.armor>0?z.kind:'zombie';
 return `${type}-${eating?'eat':z.walkVariant===2?'walk2':'walk'}`;
}
export function advanceBodyBlend(z:Zombie){if(z.bodyBlend&&--z.bodyBlend.left===0)delete z.bodyBlend;}
