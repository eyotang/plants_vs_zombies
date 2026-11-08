import {Assets,Container,Matrix,Sprite,type Texture} from 'pixi.js';
import {applyPose,poseMatrix,type Pose} from './plant-motion';
import {loadMotionAtlas} from './load-atlas';
import {loadInBatches} from '../platform/load-queue';
import {createPeaMotion,type PeaHeadClock,type PeaKind,type PeaMotion} from '../game/pea-motion';
import index from './pea-art-index.json';

export type PeaDefinition={body:{length:number;stem:Pose[];tracks:{name:string;poses:Pose[]}[]};heads:{attachment?:Pose[];names:string[];idle:Pose[][];shoot:Pose[][]}[]};
type Blink={definition:{frames:Record<string,[number,number,number,number]>};textures:Record<string,Texture>;file:string};
const f=Math.fround;
const blank=():Pose=>[0,0,1,1,0,0,-1,0,''];
function frame(time:number,length:number){const position=f(time*(length-1)),before=Math.min(length-1,Math.floor(position));return {before,after:Math.min(length-1,before+1),fraction:f(position-before)};}

export class PeaRig{
 readonly root=new Container();
 private body:Sprite[];
 private heads:{root:Container;parts:Sprite[];bindInverse?:Matrix}[];
 private bindInverse:Matrix;
 private matrix=new Matrix();
 private scratch:Pose[]=[blank(),blank(),blank()];
 private pose=blank();
 private lastBodyTime=NaN;
 private rest:PeaMotion;
 private lastHeads:{time:number;phase:string;blend:number;from?:PeaHeadClock}[]=[];
 constructor(kind:PeaKind,private definition:PeaDefinition,private textures:Readonly<Record<string,Texture>>,private blink:Readonly<Record<string,Texture>>){
  this.rest=createPeaMotion(kind,17.5);
  const body=new Container();this.root.addChild(body);this.body=definition.body.tracks.map(()=>{const part=new Sprite();body.addChild(part);return part});
  this.heads=definition.heads.map(head=>{const root=new Container();this.root.addChild(root);const first=head.attachment?.[0];return {root,bindInverse:first?poseMatrix(new Matrix(),first,first,0).invert():undefined,parts:head.names.map(()=>{const part=new Sprite();root.addChild(part);return part})}});
  if(kind==='threepeater')this.root.addChild(this.heads[1].root); // Source draw order:1,3,2.
  const first=definition.body.stem[0];this.bindInverse=poseMatrix(new Matrix(),first,first,0).invert();
 }
 private sample(head:PeaHeadClock,index:number,track:number,out:Pose,depth=0){
  const poses=this.definition.heads[index][head.phase][track],{before,after,fraction}=frame(head.time,poses.length),a=poses[before],b=poses[after];
  for(let axis=0;axis<8;axis++)if(axis!==6)out[axis]=f(f(a[axis] as number)+f(fraction*f(f(b[axis] as number)-f(a[axis] as number))));
  out[6]=a[6]!==-1&&b[6]===-1&&fraction>0?-1:a[6];out[8]=a[8];
  if(head.blend&&out[6]>=0){
   const previous=this.scratch[depth]??(this.scratch[depth]=blank());this.sample(head.blend.from,index,track,previous,depth+1);
   if(previous[6]>=0){const amount=f(head.blend.left/(head.blend.duration??20));for(let axis=0;axis<8;axis++)if(axis!==6){
    // Native BlendTransform ignores a prior skew outside the180-degree window.
    const current=out[axis] as number,from=previous[axis] as number;
    if((axis===4||axis===5)&&Math.abs(from-current)>180)continue;
    out[axis]=f(current+f(amount*f(from-current)));
   }}
  }
 }
 render(state:PeaMotion=this.rest){
  let same=state.bodyTime===this.lastBodyTime;
  for(let i=0;i<state.heads.length;i++){
   const h=state.heads[i],last=this.lastHeads[i];same&&=!!last&&last.time===h.time&&last.phase===h.phase&&last.blend===(h.blend?.left??0)&&last.from===h.blend?.from;
  }
  if(same)return;
  this.lastBodyTime=state.bodyTime;
  const body=this.definition.body,{before,after,fraction}=frame(state.bodyTime,body.length);
  for(let i=0;i<this.body.length;i++){
   const sprite=this.body[i],a=body.tracks[i].poses[before],b=body.tracks[i].poses[after];sprite.visible=!!a[8]&&a[6]>=0&&!(b[6]===-1&&fraction>0)&&a[7]>0;
   if(sprite.visible){sprite.texture=this.textures[a[8]];sprite.alpha=a[7]+(b[7]-a[7])*fraction;applyPose(sprite,a,b,fraction);}
  }
  poseMatrix(this.matrix,body.stem[before],body.stem[after],fraction).append(this.bindInverse);
  for(let index=0;index<this.heads.length;index++){
   const head=this.heads[index],clock=state.heads[index],attachment=this.definition.heads[index].attachment;
   if(attachment)poseMatrix(this.matrix,attachment[before],attachment[after],fraction).append(head.bindInverse!);
   head.root.setFromMatrix(this.matrix);
   for(let track=0;track<head.parts.length;track++){
    const sprite=head.parts[track];this.sample(clock,index,track,this.pose);sprite.visible=!!this.pose[8]&&this.pose[6]>=0&&this.pose[7]>0;
    if(!sprite.visible)continue;
    sprite.texture=this.textures[this.pose[8]]??this.blink[this.pose[8]];sprite.alpha=this.pose[7];applyPose(sprite,this.pose,this.pose,0);
   }
   const last=this.lastHeads[index]??(this.lastHeads[index]={time:0,phase:'',blend:0});last.time=clock.time;last.phase=clock.phase;last.blend=clock.blend?.left??0;last.from=clock.blend?.from;
  }
 }
}

export class PeaArt{
 private definitions=new Map<PeaKind,PeaDefinition>();
 private blink?:Blink;
 private base=`${import.meta.env.BASE_URL}assets/runtime/pea-motion/`;
 async prepare(kinds:PeaKind[],progress:(done:number,total:number)=>void,upload:(texture:Texture)=>Promise<void>){
  for(const kind of this.definitions.keys())if(!kinds.includes(kind))this.definitions.delete(kind);
  if(!kinds.length){await this.destroy();return;}
  this.blink??=await loadMotionAtlas(`${this.base}${index.blink}`,upload);
  const pending=kinds.filter(kind=>!this.definitions.has(kind));let done=0;progress(done,pending.length);
  await loadInBatches(pending,3,async kind=>{const response=await fetch(`${this.base}${index.kinds[kind]}`);if(!response.ok)throw new Error(`Pea metadata: HTTP ${response.status}`);this.definitions.set(kind,await response.json() as PeaDefinition);progress(++done,pending.length)});
 }
 create(kind:PeaKind,textures:Readonly<Record<string,Texture>>){return new PeaRig(kind,this.definitions.get(kind)!,textures,this.blink!.textures)}
 async destroy(){this.definitions.clear();if(this.blink){for(const texture of Object.values(this.blink.textures))texture.destroy();await Assets.unload(this.blink.file);this.blink=undefined;}}
}
