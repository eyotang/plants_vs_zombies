import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Texture,Sprite} from 'pixi.js';
import {Game,type Zombie} from '../src/game/model';
import {cellX} from '../src/game/config';
import {groundWalkStep,ordinaryBodyClip,advanceEatingAnimation} from '../src/game/ground-walk';
import {ActorRig,type ActorDefinition} from '../src/rendering/actor-motion';
function fixture(kind:Zombie['kind']='normal',eating=false){
 const g=new Game(9,23);g.phase='playing';g.started=true;g.waveIn=1e9;
 const z=g.spawnZombie(kind,0,eating?cellX(3)-10:630,0);z.speed=.3;z.walkVariant=1;z.walkTime=.37;
 if(eating)g.plants=[{id:900,kind:'wallnut',row:0,column:3,health:4000,born:0,shotAt:-100,actionIn:0}];
 Object.defineProperty(g,'random',{value:()=>.99});return{g,z};
}
test('head loss preserves both ordinary walk variants and uses their native footsteps for normal,mini and chilled bodies',()=>{
 for(const kind of ['normal','cone','bucket','door'] as const)for(const variant of [1,2]as const)for(const mini of [false,true])for(const cold of [false,true]){
  const{g,z}=fixture(kind);z.walkVariant=variant;z.mini=mini;z.chillIn=cold?10000:0;z.health=mini?20:80;
  const expected=structuredClone(z);const velocity=groundWalkStep(expected,cold);const x=Math.fround(Math.fround(z.x-30)-velocity)+30;
  g.step();assert.equal(z.x,x,`${kind}/${variant}/${mini}/${cold}`);assert.equal(z.walkTime,expected.walkTime);assert.equal(z.speed,.3);assert.equal(z.walkVariant,variant);assert.equal(z.eating,false);
 }
});
test('a headless chewing body holds position, keeps phase and active blend, and never bites again even when its food disappears',()=>{
 for(const kind of ['normal','cone','bucket','door']as const)for(const cold of [false,true]){
  const{g,z}=fixture(kind,true);z.chillIn=cold?10000:0;g.step();const blend=z.bodyBlend!;assert.equal(blend.left,19);z.health=80;
  const expected=structuredClone(z),x=z.x,hp=g.plants[0].health;advanceEatingAnimation(expected,cold);g.step();
  assert.equal(z.eating,true);assert.equal(z.x,x);assert.equal(z.eatTime,expected.eatTime);assert.equal(z.bodyBlend,blend);assert.equal(z.bodyBlend?.left,18);assert.equal(g.plants[0].health,hp);
  g.plants=[];for(let i=0;i<20;i++)g.step();assert.equal(z.x,x);assert.equal(z.eating,true);assert.equal(z.bodyBlend,undefined);assert.equal(z.biteIn,expected.biteIn);
 }
});
test('headless chewing state holds under ice and pause and resumes identically after save and restore',()=>{
 const{g,z}=fixture('normal',true);g.step();z.health=80;z.frozenIn=5;const phase=z.eatTime,x=z.x;for(let i=0;i<4;i++)g.step();assert.equal(z.eatTime,phase);assert.equal(z.x,x);
 g.pause();const saved=g.snapshot();for(let i=0;i<5;i++)g.step();assert.deepEqual(g.snapshot(),saved);const copy=Game.restore(saved);Object.defineProperty(copy,'random',{value:()=>.99});g.resume();copy.resume();for(let i=0;i<30;i++){g.step();copy.step();}assert.deepEqual(g.snapshot(),copy.snapshot());assert.equal(z.eating,true);assert.equal(z.x,x);
});
test('ordinary native rig hides only source head prefixes and reuses every body part and texture without changing its walk or eat pose',()=>{
 const definition=JSON.parse(readFileSync(new URL('../public/assets/runtime/actor-motion/zombie-8282926a88309728.json',import.meta.url),'utf8'))as ActorDefinition;
 const textures=Object.fromEntries(Object.keys(definition.frames).map(key=>[key,Texture.WHITE]));
 for(const kind of ['normal','cone','bucket','door']as const)for(const eating of [false,true])for(const variant of [1,2]as const){
  const{z}=fixture(kind);z.eating=eating;z.walkVariant=variant;const name=ordinaryBodyClip(z),rig=new ActorRig('zombie',{definition,textures,file:''});
  const nodes=rig.root.children.flatMap(g=>g.children)as Sprite[];rig.render(name,0,true,false,true,20,.37);
  const before=nodes.map(p=>({part:p,texture:p.texture,visible:p.visible,pose:[p.x,p.y,p.scale.x,p.scale.y,p.skew.x,p.skew.y,p.alpha]}));
  rig.render(name,0,true,true,true,20,.37);let hidden=0;
  for(let i=0;i<nodes.length;i++){const p=nodes[i],track=definition.clips[name].groups.flatMap(g=>g.tracks)[i]?.name??'';assert.equal(p,before[i].part);assert.equal(p.texture,before[i].texture);assert.deepEqual([p.x,p.y,p.scale.x,p.scale.y,p.skew.x,p.skew.y,p.alpha],before[i].pose);if(/^(anim_head|anim_hair|anim_tongue)/.test(track)){assert.equal(p.visible,false);if(before[i].visible)hidden++;}else assert.equal(p.visible,before[i].visible);}
  assert.ok(hidden>0);rig.root.destroy({children:true});
 }
});
