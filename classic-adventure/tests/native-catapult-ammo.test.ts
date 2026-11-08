import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Texture, type Sprite} from 'pixi.js';
import {ActorRig,type ActorDefinition} from '../src/rendering/actor-motion';
const definition=JSON.parse(readFileSync(new URL('../public/assets/runtime/actor-motion/zombie_catapult.json',import.meta.url),'utf8')) as ActorDefinition;
const textures=Object.fromEntries(Object.keys(definition.frames).map(k=>[k,Texture.EMPTY]));
// Source hides stock tracks at remaining 4,3,2,1 after an attack completes.
const tracks=['Zombie_catapult_basketball','Zombie_catapult_basketball2','Zombie_catapult_basketball3','Zombie_catapult_basketball4'];
test('catapult stock follows native final four ammo thresholds across every clip without allocating parts',()=>{
 const rig=new ActorRig('zombie_catapult',{definition,textures});
 const nodes=rig.root.children.flatMap(g=>g.children);
 for(const name of Object.keys(definition.clips)){
  const clip=definition.clips[name];
  for(const ammo of [20,5,4,3,2,1,0,20]){
   rig.render(name,0,true,false,true,ammo);
   for(const [gi,group] of clip.groups.entries())for(const [i,track] of group.tracks.entries()){
    const p=track.poses[0],index=tracks.indexOf(track.name),nativeVisible=!!p[8]&&p[6]>=0&&p[7]>0;
    assert.equal((rig.root.children[gi].children[i] as Sprite).visible,nativeVisible&&(index<0||ammo>4-index),`${name}/${ammo}/${track.name}`);
   }
   assert.deepEqual(rig.root.children.flatMap(g=>g.children),nodes);
  }
 }
 rig.root.destroy({children:true});
});
