import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Texture,Container} from 'pixi.js';
import vm from 'node:vm';
import ts from 'typescript';
import {Game} from '../src/game/model';
import {cellX} from '../src/game/config';
import {ActorRig,ACTOR_METADATA,type ActorDefinition} from '../src/rendering/actor-motion';
import {plantHeightOffset} from '../src/rendering/plant-height';

const definition=JSON.parse(readFileSync(new URL(`../public/assets/runtime/actor-motion/${ACTOR_METADATA.gravebuster}`,import.meta.url),'utf8')) as ActorDefinition;
function setup(rate:number){
 const game=new Game(14,1);for(const k of ['gravebuster','puffshroom','sunflower','wallnut','peashooter','cherrybomb'] as const)game.chooseSeed(k);game.start();game.sun=1000;
 Object.assign(game,{random:()=>(rate-10)/5});
 const grave=game.graves[0];game.select('gravebuster');assert.equal(game.plant(grave.column,grave.row),true);Reflect.deleteProperty(game,'random');
 return {game,grave,plant:game.plants[0]};
}
function ticks(g:Game,n:number){for(let i=0;i<n;i++){g.step();g.drainEvents();}}

test('native seven-frame landing precedes 400 eating updates at every initial animation rate',()=>{
 for(const rate of [10,10.01,12,12.5,14.99,15]){
  const {game,grave,plant}=setup(rate),landUpdates=Math.ceil(700/rate);
  assert.deepEqual(plant.gravebuster,{phase:'landing',rate,ticks:0});
  ticks(game,landUpdates);assert.equal(plant.gravebuster!.phase,'landing');assert.equal(plant.actionIn,400);assert.ok(game.graves.includes(grave));
  game.step();assert.deepEqual(plant.gravebuster,{phase:'eating',rate:12,ticks:1});assert.equal(plant.actionIn,400);
  ticks(game,399);assert.equal(plant.actionIn,1);assert.ok(game.graves.includes(grave));game.step();assert.equal(plant.health,0);assert.ok(!game.graves.includes(grave));assert.ok(!game.plants.includes(plant));
 }
 const imitated=setup(12);imitated.plant.kind='imitater';imitated.plant.morphTarget='gravebuster';imitated.plant.actionIn=1;delete imitated.plant.gravebuster;imitated.game.step();assert.equal(imitated.plant.kind,'gravebuster');assert.equal(imitated.plant.gravebuster!.phase,'landing');assert.ok(imitated.plant.gravebuster!.rate>=10&&imitated.plant.gravebuster!.rate<=15);assert.equal(imitated.plant.gravebuster!.ticks,0);assert.equal(imitated.plant.actionIn,400);
});

test('paused, restored and old saves retain the correct clear deadline; shoveling either phase cancels it',()=>{
 for(const age of [20,100]){
  const {game,grave,plant}=setup(12.5);ticks(game,age);game.phase='paused';const before=JSON.stringify(plant);ticks(game,100);assert.equal(JSON.stringify(plant),before);
  game.phase='playing';const restored=Game.restore(JSON.parse(JSON.stringify(game.snapshot())));
  for(let t=0;t<500&&game.plants.length;t++){game.step();restored.step();assert.deepEqual(restored.snapshot(),game.snapshot());}assert.equal(game.plants.length,0);
  const cancelled=setup(12.5);ticks(cancelled.game,age);cancelled.game.toggleShovel();cancelled.game.dig(cancelled.grave.column,cancelled.grave.row);assert.equal(cancelled.game.plants.length,0);ticks(cancelled.game,500);assert.ok(cancelled.game.graves.includes(cancelled.grave));
  assert.ok(!game.graves.includes(grave));
 }
 const old=setup(12);delete old.plant.gravebuster;old.plant.actionIn=100;ticks(old.game,99);assert.ok(old.game.graves.includes(old.grave));old.game.step();assert.ok(!old.game.graves.includes(old.grave));
});

test('land/eat source poses and ten-update transition reuse the same rig and atlas parts',()=>{
 const textures=Object.fromEntries(Object.keys(definition.frames).map(k=>[k,Texture.EMPTY]));const rig=new ActorRig('gravebuster',{definition,textures});
 const count=()=>rig.root.children.reduce((n,g)=>n+g.children.length,0),initial=count(),land=definition.clips['gravebuster-land'],eat=definition.clips['gravebuster-eating'];
 assert.equal(land.groups[0].length,7);assert.equal(eat.groups[0].length,28);assert.equal(land.duration,70);assert.equal(eat.duration,28/12*100);
 for(const time of [0,17.5,35,70,100]){
  rig.render('gravebuster-land',time,false,false,true);
  const position=Math.min(time/70,1)*6,frame=Math.floor(position),next=Math.min(frame+1,6),f=position-frame;
  for(let i=0;i<land.groups[0].tracks.length;i++){const p=rig.root.children[0].children[i],a=land.groups[0].tracks[i].poses[frame],b=land.groups[0].tracks[i].poses[next];assert.ok(Math.abs(p.x-a[0]-(b[0]-a[0])*f)<1e-8);}
 }
 for(const time of [0,1,5,9,10,50,234,500]){
  rig.render('gravebuster-eating',time,true,false,true);
  const position=(time%eat.duration)/eat.duration*27,frame=Math.floor(position),f=position-frame;
  for(let i=0;i<eat.groups[0].tracks.length;i++){
   const track=eat.groups[0].tracks[i],a=track.poses[frame],b=track.poses[Math.min(frame+1,27)],previous=land.groups[0].tracks.find(t=>t.name===track.name)?.poses.at(-1),blend=previous&&time<10?(10-time)/10:0;
   const x=a[0]+(b[0]-a[0])*f,expected=x+((previous?.[0]??x)-x)*blend;
   assert.ok(Math.abs(rig.root.children[0].children[i].x-expected)<1e-8,`${track.name}/${time}`);
  }
  assert.equal(count(),initial);
 }
 rig.root.destroy({children:true});
});

test('live gravebuster sinks thirty source pixels while cursor and squished base positioning stay independent',()=>{
 const ast=ts.createSourceFile('scene.ts',readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const scene=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Scene') as ts.ClassDeclaration;
 const method=scene.members.find(n=>n.name?.getText(ast)==='positionPlant')!;
 const context=vm.createContext({cellX,plantHeightOffset});vm.runInContext(ts.transpileModule(`class Harness{${method.getText(ast)}};var h=new Harness()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const {game,plant}=setup(12),actor={root:new Container(),nativeRig:{root:new Container()}};
 const place=(preview=false)=>context.h.positionPlant(actor,game,plant.kind,plant.column,plant.row,preview?undefined:plant),base=game.gridY(plant.column,plant.row)-40;
 place();assert.equal(actor.root.y,base);
 plant.gravebuster!.phase='eating';for(const remaining of [400,300,200,100,1,0]){plant.actionIn=remaining;place();assert.equal(actor.root.y,base+(400-remaining)*.075);place(true);assert.equal(actor.root.y,base);}
 actor.root.destroy();actor.nativeRig.root.destroy();
});
