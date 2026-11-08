import { Assets, Container, Matrix, Sprite, Texture } from 'pixi.js';
import { loadInBatches } from '../platform/load-queue';
import {loadMotionAtlas} from './load-atlas';
import { applyPose, motionFrame, poseMatrix, type Pose } from './plant-motion';
import { giantFrame } from './giant-motion';
import index from './actor-motion-index.json';
import metadata from './actor-motion-metadata.json';
import type {PeaArt} from './pea-art';
import{nativeActorFrame,sampleNativeActorPose,ordinaryFrameStarts,type ActorFrame}from'./native-actor-frame';
import type {OrdinaryBodyBlend,OrdinaryBodyPose} from '../game/ground-walk';

export const ACTOR_MOTION = index as Record<string, string>;
export const ACTOR_METADATA = metadata as Record<string,string>;
export const hasActorMotion = (clip: string) => Object.hasOwn(ACTOR_MOTION, clip);
type Group = { length: number; tracks: { name: string; poses: Pose[] }[]; attachment?: Pose[] };
export type ActorMotionClip = { duration: number; origin: [number, number]; scale: number; healthTop: number; groups: Group[]; nativeFrameTime?:boolean; blendFrom?:string };
export type ActorDefinition = { clips: Record<string, ActorMotionClip>; frames: Record<string, [number, number, number, number]> };
type Loaded = { definition: ActorDefinition; textures: Record<string, Texture>;file:string };

const catapultStock:Record<string,number>={Zombie_catapult_basketball:4,Zombie_catapult_basketball2:3,Zombie_catapult_basketball3:2,Zombie_catapult_basketball4:1};

type RigLayout = { partCounts: number[]; bound: Map<Group, Matrix>; tracks:Map<string,Map<string,Pose[]>> };
// Damage/attack clips share one immutable allocation layout per loaded family.
// Spawning another zombie only creates its display objects, not this metadata.
const layouts = new WeakMap<ActorDefinition, RigLayout>();
function rigLayout(definition: ActorDefinition): RigLayout {
  let layout = layouts.get(definition);
  if (!layout) {
    const clips = Object.values(definition.clips);
    const partCounts = Array.from({ length: Math.max(...clips.map(c => c.groups.length)) }, (_, i) =>
      Math.max(...clips.map(c => c.groups[i]?.tracks.length ?? 0)));
    const bound = new Map<Group, Matrix>();
    for (const clip of clips) for (const group of clip.groups) if (group.attachment)
      bound.set(group, poseMatrix(new Matrix(), group.attachment[0], group.attachment[0], 0).invert());
    layout = { partCounts, bound,tracks:new Map() }; layouts.set(definition, layout);
  }
  return layout;
}

// One sprite per source image track; never cross-fade entire silhouettes.
// Parts are allocated once per actor, including slots needed by later damage/death states.
export class ActorRig {
  readonly root = new Container();
  private lastName = "";
  private lastTicks = NaN;
  private lastLoop = false;
  private lastHeadless = false;
  private lastNativeRoot = false;
  private lastNormalizedTime?:number;
  private lastCatapultAmmo = 20;
  private lastBlendLeft=0;
  private lastBlendFrom?:OrdinaryBodyPose;
  private blendPose:Pose=[0,0,1,1,0,0,-1,1,''];
  private blendScratch:Pose[]=[];
  private trackLookup:Map<string,Map<string,Pose[]>>;
  private sourceFrame:ActorFrame={frame:0,next:0,fraction:0};
  private sampleBodyPose(state:OrdinaryBodyPose,group:number,track:string,out:Pose,depth=0){
    const key=state.clip+':'+group;
    let tracks=this.trackLookup.get(key);
    if(!tracks){tracks=new Map(this.loaded.definition.clips[state.clip].groups[group]?.tracks.map(t=>[t.name,t.poses]));this.trackLookup.set(key,tracks);}
    const poses=tracks.get(track);if(!poses){out[6]=-1;return;}
    const start=this.family==='zombie'?ordinaryFrameStarts[state.clip]:undefined;
    const {frame,next,fraction}=start===undefined?motionFrame(state.time,1,poses.length,false):nativeActorFrame(state.time,start,poses.length,this.sourceFrame);
    sampleNativeActorPose(out,poses[frame],poses[next],fraction);
    if(state.blend&&out[6]>=0){
      const from=this.blendScratch[depth]??(this.blendScratch[depth]=[0,0,1,1,0,0,-1,1,'']);
      this.sampleBodyPose(state.blend.from,group,track,from,depth+1);
      this.mixBodyPose(out,from,state.blend.left/20);
    }
  }
  private mixBodyPose(out:Pose,from:Pose,amount:number){
    if(from[6]<0||out[6]<0)return;
    const f=Math.fround;amount=f(amount);
    for(let axis=0;axis<8;axis++)if(axis!==6){
      if((axis===4||axis===5)&&(from[axis]>f(out[axis]+180)||from[axis]<f(out[axis]-180)))continue;
      out[axis]=f((out[axis] as number)+f(amount*f((from[axis] as number)-(out[axis] as number))));
    }
  }
  private matrix = new Matrix();
  private groups: { root: Container; parts: Sprite[] }[];
  private bound: Map<Group, Matrix>;
  constructor(readonly family: string, private loaded: Loaded) {
    const layout = rigLayout(loaded.definition);
    this.bound = layout.bound;this.trackLookup=layout.tracks;
    this.groups = layout.partCounts.map(count => {
      const root = new Container(); this.root.addChild(root);
      const parts = Array.from({ length: count }, () => {
        const sprite = new Sprite(); root.addChild(sprite); return sprite;
      });
      return { root, parts };
    });
  }
  healthTop(clip: string) { return this.loaded.definition.clips[clip].healthTop; }
  renderCached(name:string) {
    this.render(name,0,false,false,true);
    for(let g=0;g<this.loaded.definition.clips[name].groups.length;g++){
      const tracks=this.loaded.definition.clips[name].groups[g].tracks;
      for(let i=0;i<tracks.length;i++)if(tracks[i].name==='anim_waterline')this.groups[g].parts[i].visible=false;
    }
  }
  render(name: string, ticks: number, loop: boolean, headless = false, nativeRoot = false, catapultAmmo = 20, normalizedTime?:number,bodyBlend?:OrdinaryBodyBlend,blendLeft=bodyBlend?.left??0) {
    if (blendLeft===this.lastBlendLeft && bodyBlend?.from===this.lastBlendFrom && normalizedTime===this.lastNormalizedTime && name === this.lastName && ticks === this.lastTicks && loop === this.lastLoop && headless === this.lastHeadless && nativeRoot === this.lastNativeRoot && catapultAmmo === this.lastCatapultAmmo) return;
    this.lastBlendLeft=blendLeft;this.lastBlendFrom=bodyBlend?.from;
    this.lastName = name; this.lastTicks = ticks; this.lastLoop = loop; this.lastHeadless = headless; this.lastNativeRoot=nativeRoot; this.lastCatapultAmmo=catapultAmmo; this.lastNormalizedTime=normalizedTime;
    const clip = this.loaded.definition.clips[name];
    const sourceStart=this.family==='zombie'?ordinaryFrameStarts[name]:undefined;
    if(nativeRoot){this.root.position.set(0);this.root.scale.set(1);}
    else {this.root.position.set(...clip.origin);this.root.scale.set(clip.scale);}
    for (let g = 0; g < this.groups.length; g++) {
      const { root, parts } = this.groups[g], group = clip.groups[g];
      root.visible = g < clip.groups.length;
      if (!root.visible) continue;
      const { frame, next, fraction } = normalizedTime!==undefined ? sourceStart===undefined?motionFrame(normalizedTime,1,group.length,false):nativeActorFrame(normalizedTime,sourceStart,group.length,this.sourceFrame) : clip.nativeFrameTime
        ? motionFrame(loop?((ticks%clip.duration+clip.duration)%clip.duration):ticks,clip.duration,group.length,false)
        : giantFrame(ticks, clip.duration, group.length, loop);
      if (group.attachment) {
        const a = giantFrame(ticks, clip.duration, group.attachment.length, loop);
        root.setFromMatrix(poseMatrix(this.matrix, group.attachment[a.frame], group.attachment[a.next], a.fraction).append(this.bound.get(group)!));
      } else { root.position.set(0); root.scale.set(1); root.skew.set(0); root.rotation = 0; }
      for (let i = 0; i < parts.length; i++) {
        const sprite = parts[i];
        if (i >= group.tracks.length) { sprite.visible = false; continue; }
        const poses = group.tracks[i].poses, a = poses[frame], b = poses[next];
        const track=group.tracks[i].name;
        let pose:Pose|undefined;
        if(normalizedTime!==undefined&&(sourceStart!==undefined||bodyBlend&&blendLeft>0)){
          pose=sampleNativeActorPose(this.blendPose,a,b,fraction);
          if(bodyBlend&&blendLeft>0){
            const from=this.blendScratch[0]??(this.blendScratch[0]=[0,0,1,1,0,0,-1,1,'']);
            this.sampleBodyPose(bodyBlend.from,g,track,from,1);this.mixBodyPose(pose,from,blendLeft/20);
          }
        }
        const opacity=pose?pose[7]:a[7]+(b[7]-a[7])*fraction;
        sprite.visible = !(catapultAmmo <= catapultStock[track]) && !!a[8] && (pose?pose[6]:a[6]) >= 0 && opacity > 0 && !(clip.nativeFrameTime&&b[6]===-1&&fraction>0) && !(headless&&(track.startsWith('anim_head')||track.startsWith('anim_hair')||track.startsWith('anim_tongue')));
        if (!sprite.visible) continue;
        sprite.texture = this.loaded.textures[a[8]];
        sprite.alpha = opacity;
        if(pose)applyPose(sprite,pose,pose,0);else applyPose(sprite, a, b, fraction);
        // PlayBodyReanim starts a ten-update transform blend from the held land pose.
        if(clip.blendFrom&&ticks<10){
          const previous=this.loaded.definition.clips[clip.blendFrom].groups[g].tracks.find(t=>t.name===track)?.poses.at(-1);
          if(previous&&previous[6]>=0){
            const blend=Math.max(0,10-ticks)/10;
            sprite.position.set(sprite.x+(previous[0]-sprite.x)*blend,sprite.y+(previous[1]-sprite.y)*blend);
            sprite.scale.set(sprite.scale.x+(previous[2]-sprite.scale.x)*blend,sprite.scale.y+(previous[3]-sprite.scale.y)*blend);
            sprite.skew.set(sprite.skew.x+(-previous[5]*Math.PI/180-sprite.skew.x)*blend,sprite.skew.y+(previous[4]*Math.PI/180-sprite.skew.y)*blend);
            sprite.alpha+=(previous[7]-sprite.alpha)*blend;
          }
        }
      }
    }
  }
}

export class ActorMotion {
  private loaded = new Map<string, Loaded>();
  private base = `${import.meta.env.BASE_URL}assets/runtime/actor-motion/`;
  async prepare(clips: string[], progress: (done: number, total: number) => void, upload: (texture: Texture) => Promise<void>) {
    const families = new Set(clips.filter(hasActorMotion).map(clip => ACTOR_MOTION[clip]));
    for (const family of this.loaded.keys()) if (!families.has(family)) await this.unload(family);
    const pending = [...families].filter(family => !this.loaded.has(family)); let done = 0;
    progress(done, pending.length);
    await loadInBatches(pending, 3, async family => {
      this.loaded.set(family,await loadMotionAtlas<ActorDefinition>(`${this.base}${family}`,upload,`${this.base}${ACTOR_METADATA[family]??family+'.json'}`));progress(++done,pending.length);
    });
  }
  create(clip: string) { const family = ACTOR_MOTION[clip]; return new ActorRig(family, this.loaded.get(family)!); }
  createPea(kind:'snowpea'|'repeater'|'splitpea',art:PeaArt){return art.create(kind,this.loaded.get(ACTOR_MOTION[kind])!.textures);}
  duration(clip: string) { return this.loaded.get(ACTOR_MOTION[clip])!.definition.clips[clip].duration; }
  private async unload(family: string) {
    for (const texture of Object.values(this.loaded.get(family)!.textures)) texture.destroy();
    await Assets.unload(this.loaded.get(family)!.file); this.loaded.delete(family);
  }
  async destroy() { for (const family of this.loaded.keys()) await this.unload(family); }
}
