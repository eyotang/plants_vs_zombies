import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';
import metadata from '../docs/impact-audio.json';import {soundFiles} from '../src/platform/audio-plan';import {Game} from '../src/game/model';import {LEVEL_IDS,SURVIVAL_SCENES} from '../src/game/config';
test('eleven impact recordings have pinned source hashes and stay below 60 KiB',()=>{
 assert.equal(metadata.files.length,11);let total=0;
 for(const file of metadata.files){const body=readFileSync(new URL('../public/assets/original/'+file.file,import.meta.url));assert.equal(createHash('sha256').update(body).digest('hex'),file.sha256);assert.equal(body.length,file.bytes);total+=body.length;}
 assert.ok(total<61440);
});
test('first-stage audio excludes later armor, fire and lob sounds; late stages prepare their own sounds',()=>{
 const early=soundFiles(new Game(1,1));for(const key of ['shield','plastic','ignite','kernel','butter','melon'])assert.equal(early[key],undefined);
 const armored=soundFiles(new Game(9,1));assert.equal(armored.shield,'shieldhit.mp3');assert.equal(armored.plastic,'plastichit.mp3');assert.equal(armored.melon,undefined);
 const late=new Game(49,1);late.seeds=['torchwood','kernelpult','melonpult'];const sounds=soundFiles(late);for(const key of ['shield','plastic','ignite','kernel','butter','melon'])assert.ok(sounds[key],key);
 for(const level of [35,50] as const){const files=soundFiles(new Game(level,1));assert.ok(files.shield);assert.ok(files.plastic);}
});
test('restored projectiles keep required sounds after their launching plant is gone',()=>{
 const game=new Game(1,1);game.seeds=[];game.peas=[{id:1,x:100,row:0,age:0,ice:false,puff:false,fire:true},{id:2,x:100,row:0,age:0,ice:false,puff:false,lob:{kind:'kernel',target:1,startX:100,endX:300,startY:100,endY:100,duration:100}},{id:3,x:100,row:0,age:0,ice:false,puff:false,lob:{kind:'wintermelon',target:1,startX:100,endX:300,startY:100,endY:100,duration:100}}];
 const restored=Game.restore(game.snapshot()),files=soundFiles(restored);for(const key of ['ignite','kernel','butter','melon'])assert.ok(files[key],key);
});
test('audio plans for every adventure and survival scene resolve all declared local files',()=>{
 for(const game of [...LEVEL_IDS.map(l=>new Game(l,1)),...SURVIVAL_SCENES.map(s=>new Game(9,1,'endless',s))]){
  game.seeds=[...game.config.seeds];for(const file of Object.values(soundFiles(game)))assert.ok(existsSync(new URL('../public/assets/original/'+file,import.meta.url)),file);
 }
});
