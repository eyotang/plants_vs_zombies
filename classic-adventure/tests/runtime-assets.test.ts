import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';
import {Game} from '../src/game/model';import {LEVEL_IDS,SURVIVAL_SCENES,PLANTS} from '../src/game/config';import {animationNames,combatTextureFiles} from '../src/rendering/asset-plan';import {ACTOR_MOTION,hasActorMotion} from '../src/rendering/actor-motion';import {GIANT_CLIPS,hasGiantMotion} from '../src/rendering/giant-motion';import {hasPlantMotionClip} from '../src/rendering/plant-motion';import effects from '../public/assets/runtime/effects.json';
const available=[...Object.keys(effects.animations),...Object.keys(ACTOR_MOTION),...GIANT_CLIPS];const root=new URL('../public/assets/runtime/',import.meta.url);
const file=(name:string)=>assert.ok(existsSync(new URL(name,root)),name);
test('all 50 stages and every survival scene resolve retained effects and actor families',()=>{
 for(const game of [...LEVEL_IDS.map(l=>new Game(l,1)),...SURVIVAL_SCENES.map(s=>new Game(9,1,'endless',s))]){
  game.seeds=[...game.config.seeds];for(const name of animationNames(game,available)){
   if(hasPlantMotionClip(name))continue;if(hasActorMotion(name)){file('actor-motion/'+ACTOR_MOTION[name]+'.json');file('actor-motion/'+ACTOR_MOTION[name]+'.webp')}
   else if(hasGiantMotion(name)){file('giant-motion/gargantuar.json');file('giant-motion/gargantuar.webp')}
   else{const clip=effects.animations[name as keyof typeof effects.animations];assert.ok(clip,name);for(const page of clip.pages)file(page)}
  }for(const name of Object.values(combatTextureFiles(game)))file(name);
 }
});
test('all plant portraits and five scene backgrounds remain local',()=>{
 for(const name of Object.keys(PLANTS))file('hd4/original/'+name+'.webp');for(const name of ['yard.webp','lawn.webp','original/night.webp','original/pool.webp','original/fog.webp','original/roof.webp','boss/tracks.json','hd4/original/collector.svg'])file(name);
});
test('production renderer caps frames and pixel budget without changing the fixed 10ms model clock',()=>{
 const scene=readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8');assert.ok(scene.includes('ticker.maxFPS = 30'));assert.ok(scene.includes('antialias: false'));
 const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');assert.ok(main.includes("if (game.phase === 'playing') scene.app.start();"));assert.ok(!main.includes('href="/pvz2/"'));
});
test('native scenery keeps the original logical camera without doubled texture memory',()=>{
 for(const name of ['yard.webp','lawn.webp','original/night.webp','original/pool.webp','original/fog.webp','original/roof.webp','boss/background.webp']){
  const bytes=readFileSync(new URL(name,root));assert.equal(bytes.toString('ascii',12,16),'VP8 ');assert.equal(bytes.readUInt16LE(26)&0x3fff,1400,name);assert.equal(bytes.readUInt16LE(28)&0x3fff,600,name);
 }
});
