import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Container,Sprite,Texture} from 'pixi.js';
import {Game,type Plant,type Zombie} from '../src/game/model';import {cellX} from '../src/game/config';
import {createPeaMotion,beginPeaShot,advancePeaMotion,type PeaKind} from '../src/game/pea-motion';
import {PeaRig,type PeaDefinition} from '../src/rendering/pea-art';import index from '../src/rendering/pea-art-index.json';
const root=new URL('../public/assets/runtime/',import.meta.url),read=(name:string)=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const families={peashooter:'plant-motion/peashooter',snowpea:'actor-motion/snowpea',repeater:'actor-motion/peashooter',gatlingpea:'plant-motion/gatlingpea',splitpea:'actor-motion/splitpea'};
const blink=read('pea-motion/'+index.blink+'.json');
const enemy:Zombie={id:900,kind:'bucket',row:2,x:700,health:270,armor:10000,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0};
const plant=(kind:PeaKind,column=0,row=2):Plant=>({id:901,kind,column,row,health:300,actionIn:0,born:0,shotAt:-100,peaMotion:createPeaMotion(kind,17.5)});
function simulation(kind:PeaKind){const g=new Game(9,23);g.phase='playing';g.started=true;g.waveIn=10000;g.plants=[plant(kind)];g.zombies=[{...enemy}];return g;}

test('five pea families emit from the body stem with native image-center and pot bridges on every terrain',()=>{
 for(const level of [9,18,21,31,41]as const)for(const kind of Object.keys(families)as PeaKind[])for(const column of [0,4,8])for(const pot of [false,true])for(const rear of kind==='splitpea'?[false,true]:[false]){
  const g=new Game(level,23),p=plant(kind,column);p.peaMotion!.bodyTime=.5;g.plants=pot?[{...p,id:902,kind:'flowerpot'}]:[];
  if(rear)(g as any).fireRear(p,true);else(g as any).firePea(p,true);
  const shot=g.peas[0],rawX=40+column*80+47+(rear?-64:kind==='gatlingpea'?34:24),rawY=g.gridY(column,2)+46-33-(pot?5:0);
  assert.equal(shot.x,rawX+14,`${level}/${kind}/${column}/${pot}/${rear}`);assert.equal(shot.originY,rawY+14);assert.equal(shot.nativePea!.rawX,rawX);assert.equal(shot.ice,kind==='snowpea');
  const sourceColumn=Math.max(0,Math.min(8,Math.trunc((rawX-40)/80)));assert.equal(shot.nativePea!.shadowY,g.gridY(sourceColumn,2)+67-(level===41&&rawX<480?12:0));
 }
});

test('actual model acquires before windup, commits that shot after target loss, and keeps body clocks advancing',()=>{
 for(const kind of ['peashooter','snowpea','repeater','gatlingpea']as const){
  const g=simulation(kind);g.step();assert.equal(g.peas.length,0);assert.ok(g.plants[0].peaMotion!.bodyTime>0);g.zombies=[];
  const delay=kind==='gatlingpea'?32:kind==='repeater'?25:34;for(let i=1;i<delay;i++)g.step();assert.equal(g.peas.length,0);g.step();assert.equal(g.peas.length,1);assert.equal(g.plants[0].shotAt,delay+1);
 }
});

test('model pause, JSON resume and legacy saves retain launch deadlines and native body/head state',()=>{
 const g=simulation('repeater');for(let i=0;i<15;i++)g.step();g.phase='paused';const frozen=g.snapshot();for(let i=0;i<50;i++)g.step();assert.deepEqual(g.snapshot(),frozen);g.phase='playing';
 const copy=Game.restore(JSON.parse(JSON.stringify(g.snapshot())));for(let i=0;i<250;i++){g.step();copy.step();assert.deepEqual(copy.snapshot(),g.snapshot());}
 const old=g.snapshot();for(const p of old.plants)delete p.peaMotion;const remaining=old.plants[0].actionIn,restored=Game.restore(old);assert.equal(restored.plants[0].actionIn,remaining);assert.ok(restored.plants[0].peaMotion);assert.equal(restored.plants[0].health,old.plants[0].health);
});

test('source roof shadow plane checks previous height after collision and then follows the slope',()=>{
 const g=simulation('peashooter');Object.assign(g,{config:{...g.config,environment:'roof'}});g.plants=[];g.zombies=[];g.peas=[{id:900,row:2,x:114,originY:213,age:0,ice:false,puff:false,nativePea:{rawX:100,shadowY:227}}];
 // rawY199; shadow delta28 survives one check, then drops below28 on the slope.
 g.step();assert.equal(g.peas.length,1);assert.equal(g.peas[0].nativePea!.rawX,Math.fround(100+Math.fround(3.33)));assert.ok(g.peas[0].nativePea!.shadowY<227);g.step();assert.equal(g.peas.length,0);assert.ok(g.drainEvents().some(e=>e.kind==='hit'));
});

test('native body/head idle uses source head-layer anchors while attacks reuse all allocated parts and blink textures',()=>{
 for(const kind of Object.keys(families)as PeaKind[]){
  const definition=read('pea-motion/'+index.kinds[kind])as PeaDefinition,old=read(families[kind]+'.json'),textures=Object.fromEntries(Object.keys(old.frames).map(k=>[k,Texture.WHITE])),blinks=Object.fromEntries(Object.keys(blink.frames).map(k=>[k,Texture.EMPTY]));
  const rig=new PeaRig(kind,definition,textures,blinks),state=createPeaMotion(kind,17.5);rig.render(state);
  // anim_full_idle is a distinct preview clip (e.g. sprout x8). The attached
  // native anim_head_idle starts at x7.7; retain the source layer coordinates.
  const sourceAnchors:Record<PeaKind,number[][]>={peashooter:[[7.7,27.7]],snowpea:[[10.2,15.9]],repeater:[[12.9,38.1]],gatlingpea:[[19.2,17.8]],splitpea:[[19.2,17.8],[-1.6,14.6]]};
  sourceAnchors[kind].forEach(([x,y],i)=>{
   const head=rig.root.children[i+1]as Container,part=head.children.find(p=>p.visible)!;head.updateLocalTransform();const matrix=head.localTransform;
   assert.ok(Math.abs(part.x*matrix.a+part.y*matrix.c+matrix.tx-x)<1e-5,`${kind}/${i}/x`);
   assert.ok(Math.abs(part.x*matrix.b+part.y*matrix.d+matrix.ty-y)<1e-5,`${kind}/${i}/y`);
  });
  const all=rig.root.children.flatMap(g=>g.children),count=all.length;let blinkSeen=false;beginPeaShot(state,kind);
  for(let tick=0;tick<200;tick++){advancePeaMotion(state,kind);rig.render(state);if(all.some(p=>p.visible&&(p as Sprite).texture===Texture.EMPTY))blinkSeen=true;assert.equal(rig.root.children.reduce((n,g)=>n+g.children.length,0),count);}
  assert.ok(blinkSeen,kind);assert.ok(rig.root.children.flatMap(g=>g.children).every(p=>all.includes(p)));rig.root.destroy({children:true});
 }
});

test('source head blends and cached redraws preserve identical transforms after JSON restoration',()=>{
 const kind='repeater',definition=read('pea-motion/'+index.kinds[kind])as PeaDefinition,old=read(families[kind]+'.json'),textures=Object.fromEntries(Object.keys(old.frames).map(k=>[k,Texture.WHITE])),blinks=Object.fromEntries(Object.keys(blink.frames).map(k=>[k,Texture.EMPTY]));
 const a=new PeaRig(kind,definition,textures,blinks),b=new PeaRig(kind,definition,textures,blinks),state=createPeaMotion(kind,17.5);
 const pose=(rig:PeaRig)=>rig.root.children.flatMap(g=>g.children.map(p=>({visible:p.visible,x:p.x,y:p.y,sx:p.scale.x,sy:p.scale.y,skewX:p.skew.x,skewY:p.skew.y,alpha:p.alpha})));
 for(let tick=0;tick<300;tick++){if(tick%25===0)beginPeaShot(state,kind);advancePeaMotion(state,kind);a.render(state);b.render(JSON.parse(JSON.stringify(state)));assert.deepEqual(pose(a),pose(b));const before=pose(a);a.render(state);assert.deepEqual(pose(a),before);}
 a.root.destroy({children:true});b.root.destroy({children:true});
});
