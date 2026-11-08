import starts from './ordinary-frame-start.json';
import type{Pose}from'./plant-motion';
export const ordinaryFrameStarts=starts as Readonly<Record<string,number>>;
export type ActorFrame={frame:number;next:number;fraction:number};
const f=Math.fround;
// Reanimation::GetFrameTime rounds the global source position, not its local offset.
// The caller owns the result so sampling does not allocate an object every frame/track.
export function nativeActorFrame(time:number,start:number,count:number,out:ActorFrame){
 const position=f(start+f(f(time)*(count-1))),before=Math.floor(position);
 out.frame=Math.min(count-1,before-start);out.next=Math.min(count-1,out.frame+1);out.fraction=f(position-before);return out;
}
export function sampleNativeActorPose(out:Pose,a:Pose,b:Pose,fraction:number){
 fraction=f(fraction);
 for(let axis=0;axis<8;axis++)out[axis]=axis===6?a[axis]:f(f(a[axis] as number)+f(fraction*f(f(b[axis] as number)-f(a[axis] as number))));
 if(a[6]!==-1&&b[6]===-1&&fraction>0)out[6]=-1;
 out[8]=a[8];return out;
}
