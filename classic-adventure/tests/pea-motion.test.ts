import test from 'node:test';import assert from 'node:assert/strict';
import {createPeaMotion,beginPeaShot,updatePeaShooting,advancePeaMotion,peaHeadOffset,type PeaKind} from '../src/game/pea-motion';
import reference from './helpers/pea-clock-reference.json';
import geometry from '../src/game/data/pea-geometry.json';

test('body and held head clocks match independently compiled C++ arithmetic through100000 updates',()=>{
 for(const rate of [15,17.5,20]){
  const state=createPeaMotion('peashooter',rate),cases=reference.body.filter(c=>c.rate===rate);
  for(let tick=1;tick<=100000;tick++){advancePeaMotion(state,'peashooter');const expected=cases.find(c=>c.tick===tick);if(expected)assert.equal(state.bodyTime,expected.time,`${rate}/${tick}`);}
 }
 for(const [kind,rear,rate,frames]of [['peashooter',false,35,25],['repeater',false,45,25],['gatlingpea',false,38,39],['splitpea',true,35,13]]as const){
  const state=createPeaMotion(kind,17.5);beginPeaShot(state,kind,rear);const head=state.heads[rear?1:0],cases=reference.oneShot.filter(c=>c.rate===rate&&c.frames===frames);
  for(let tick=1;tick<=110;tick++){advancePeaMotion(state,kind);const expected=cases.find(c=>c.tick===tick);if(expected){assert.equal(head.time,expected.time,`${kind}/${tick}`);assert.equal(head.looped,expected.loops>0);}}
 }
});

test('native fire counters emit at34/25 updates and gatling32/49/65/82, without prematurely resetting head loops',()=>{
 for(const kind of Object.keys(geometry)as PeaKind[]){
  const state=createPeaMotion(kind,17.5);beginPeaShot(state,kind);const shots:number[]=[];
  for(let tick=1;tick<=110;tick++){if(updatePeaShooting(state,kind)&1)shots.push(tick);advancePeaMotion(state,kind);}
  assert.deepEqual(shots,kind==='gatlingpea'?[32,49,65,82]:kind==='repeater'||kind==='splitpea'?[25]:[34],kind);
 }
 const first=createPeaMotion('peashooter',17.5);beginPeaShot(first,'peashooter');for(let i=0;i<72;i++){updatePeaShooting(first,'peashooter');advancePeaMotion(first,'peashooter');}assert.equal(first.heads[0].phase,'shoot');assert.equal(first.heads[0].looped,true);updatePeaShooting(first,'peashooter');advancePeaMotion(first,'peashooter');assert.equal(first.heads[0].phase,'idle');assert.equal(first.heads[0].time,first.bodyTime);
 const later=createPeaMotion('peashooter',17.5);for(let i=0;i<200;i++)advancePeaMotion(later,'peashooter');assert.equal(later.heads[0].looped,true);beginPeaShot(later,'peashooter');assert.equal(later.heads[0].looped,true);for(let i=0;i<35;i++){updatePeaShooting(later,'peashooter');advancePeaMotion(later,'peashooter');}assert.equal(later.heads[0].phase,'idle');assert.equal(later.heads[0].time,later.bodyTime);
});

test('Split Pea uses independent front/rear animation rates and the source shared fire counter',()=>{
 const state=createPeaMotion('splitpea',16);beginPeaShot(state,'splitpea',true);assert.equal(state.heads[1].rate,35);assert.equal(state.heads[0].phase,'idle');
 let shot=0;for(let tick=0;tick<25;tick++){shot=updatePeaShooting(state,'splitpea');advancePeaMotion(state,'splitpea');}assert.equal(shot,2);
 beginPeaShot(state,'splitpea');assert.equal(state.heads[0].rate,45);for(let tick=0;tick<25;tick++){shot=updatePeaShooting(state,'splitpea');advancePeaMotion(state,'splitpea');}assert.equal(shot,3);
});

test('head blend snapshots remain frozen and survive JSON restore without growing on repeated25-tick attacks',()=>{
 const state=createPeaMotion('repeater',17.5),depth=(h:typeof state.heads[number]):number=>h.blend?1+depth(h.blend.from):0;
 for(let cycle=0;cycle<200;cycle++){
  beginPeaShot(state,'repeater');const frozen=JSON.stringify(state.heads[0].blend!.from);advancePeaMotion(state,'repeater');assert.equal(JSON.stringify(state.heads[0].blend!.from),frozen);
  assert.ok(depth(state.heads[0])<=2);const restored=JSON.parse(JSON.stringify(state));
  for(let tick=1;tick<25;tick++){assert.equal(updatePeaShooting(state,'repeater'),updatePeaShooting(restored,'repeater'));advancePeaMotion(state,'repeater');advancePeaMotion(restored,'repeater');}assert.deepEqual(restored,state);
 }
});

test('five body anchor tables keep source quarter-cycle coordinates and integer head offsets',()=>{
 for(const kind of Object.keys(geometry)as PeaKind[]){
  const state=createPeaMotion(kind,17.5);assert.equal(geometry[kind].bodyFrames,25);assert.equal(geometry[kind].stem.length,25);
  for(const time of [0,.25,.5,.75,1]){state.bodyTime=time;const pose=geometry[kind].stem[time*24];assert.deepEqual(peaHeadOffset(kind,state),[Math.trunc(Math.fround(pose[0])),Math.trunc(Math.fround(pose[1]))]);}
 }
 const pea=createPeaMotion('peashooter',17.5);assert.deepEqual(peaHeadOffset('peashooter',pea),[37,48]);pea.bodyTime=.5;assert.deepEqual(peaHeadOffset('peashooter',pea),[47,46]);
});
