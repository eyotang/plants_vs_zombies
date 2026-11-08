import test from 'node:test';
import assert from 'node:assert/strict';
import {Texture,Sprite} from 'pixi.js';
import {Game} from '../src/game/model';
import {cellX} from '../src/game/config';
import {ActorRig,type ActorDefinition} from '../src/rendering/actor-motion';
function fixture(){const g=new Game(9,23);g.phase='playing';g.started=true;g.waveIn=1e9;const z=g.spawnZombie('normal',0,cellX(3)-10,0);z.walkTime=.37;z.walkVariant=1;return{g,z};}
const food=()=>({id:900,kind:'wallnut' as const,row:0,column:3,health:4000,born:0,shotAt:-100,actionIn:0});
test('walk/eat transitions capture authoritative pose and finish after20updates, including frozen updates',()=>{
 const{g,z}=fixture();g.plants=[food()];g.step();assert.equal(z.bodyBlend?.left,19);assert.deepEqual(z.bodyBlend?.from,{clip:'zombie-walk',time:.37});
 const clock=z.eatTime;z.frozenIn=30;for(let n=0;n<19;n++)g.step();assert.equal(z.eatTime,clock);assert.equal(z.bodyBlend,undefined);
});
test('interrupted blend captures its held composite and survives pause, save and continuation',()=>{
 const{g,z}=fixture();g.plants=[food()];g.step();const first=structuredClone(z.bodyBlend);g.plants=[];g.step();assert.equal(z.bodyBlend?.left,19);assert.equal(z.bodyBlend?.from.clip,'zombie-eat');assert.deepEqual(z.bodyBlend?.from.blend,first);
 g.pause();const saved=g.snapshot();for(let i=0;i<5;i++)g.step();assert.deepEqual(g.snapshot(),saved);const copy=Game.restore(saved);g.resume();copy.resume();for(let i=0;i<25;i++){g.step();copy.step();}assert.deepEqual(g.snapshot(),copy.snapshot());assert.equal(z.bodyBlend,undefined);
});
test('ordinary transform blend holds incoming texture, blends alpha and ignores source skew beyond180degrees',()=>{
 const definition:ActorDefinition={frames:{old:[0,0,1,1],next:[0,0,1,1]},clips:{
  old:{duration:1,origin:[0,0],scale:1,healthTop:0,groups:[{length:1,tracks:[{name:'body',poses:[[100,50,2,3,350,-350,0,.5,'old']]}]}]},
  next:{duration:1,origin:[0,0],scale:1,healthTop:0,groups:[{length:1,tracks:[{name:'body',poses:[[0,10,1,1,0,0,0,1,'next']]}]}]}
 }};
 const rig=new ActorRig('test',{definition,textures:{old:Texture.EMPTY,next:Texture.WHITE},file:''});const before=rig.root.children[0].children[0];const blend={left:10,from:{clip:'old',time:0}};
 rig.render('next',0,true,false,true,20,0,blend);const part=rig.root.children[0].children[0] as Sprite;
 assert.equal(part,before);assert.equal(part.x,50);assert.equal(part.y,30);assert.equal(part.scale.x,1.5);assert.equal(part.scale.y,2);assert.equal(part.alpha,.75);assert.equal(part.skew.x,0);assert.equal(part.skew.y,0);assert.equal(part.texture,Texture.WHITE);
 blend.left=0;rig.render('next',0,true,false,true,20,0,blend);assert.equal(part.x,0);assert.equal(part.alpha,1);rig.root.destroy({children:true});
});

import blendReference from './helpers/body-blend-reference.json';
import type {Pose} from '../src/rendering/plant-motion';
test('all21 blend weights match independent C++ float transforms and keep texture identity',()=>{
 for(const row of blendReference){
  const current=[...row.current,'next'] as Pose,from=[...row.from,'old'] as Pose;
  const definition:ActorDefinition={frames:{next:[0,0,1,1],old:[0,0,1,1]},clips:{next:{duration:1,origin:[0,0],scale:1,healthTop:0,groups:[{length:1,tracks:[{name:'body',poses:[current]}]}]},old:{duration:1,origin:[0,0],scale:1,healthTop:0,groups:[{length:1,tracks:[{name:'body',poses:[from]}]}]}}};
  const rig=new ActorRig('test',{definition,textures:{next:Texture.WHITE,old:Texture.EMPTY},file:''});rig.render('next',0,true,false,true,20,0,{left:row.left,from:{clip:'old',time:0}});
  const part=rig.root.children[0].children[0] as Sprite;
  const actual=[part.x,part.y,part.scale.x,part.scale.y,part.skew.y*180/Math.PI,-part.skew.x*180/Math.PI,0,part.alpha];
  for(let axis=0;axis<8;axis++)assert.ok(Math.abs(actual[axis]-row.result[axis])<1e-10,`left${row.left}/axis${axis}: ${actual[axis]} vs${row.result[axis]}`);
  assert.equal(part.texture,Texture.WHITE);rig.root.destroy({children:true});
 }
});
