import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{Texture}from'pixi.js';import{createPeaMotion,beginThreepeaterShot,updatePeaShooting,advancePeaMotion}from'../src/game/pea-motion';
import{PeaRig,type PeaDefinition}from'../src/rendering/pea-art';import index from'../src/rendering/pea-art-index.json';import anchors from'./helpers/three-head-anchors.json';import{Game,type Plant}from'../src/game/model';
const read=(name:string)=>JSON.parse(readFileSync(new URL('../public/assets/runtime/'+name,import.meta.url),'utf8'));
function rig(){const definition=read('pea-motion/'+index.kinds.threepeater)as PeaDefinition,atlas=read('plant-motion/threepeater.json'),blink=read('pea-motion/'+index.blink+'.json');return{definition,rig:new PeaRig('threepeater',definition,Object.fromEntries(Object.keys(atlas.frames).map(k=>[k,Texture.WHITE])),Object.fromEntries(Object.keys(blink.frames).map(k=>[k,Texture.EMPTY])))}};

test('three native head clocks suppress absent lanes, blend10 into shooting and20 back to body phase',()=>{
 for(const [below,above,mask]of [[true,true,7],[true,false,3],[false,true,6]]as const){
  const state=createPeaMotion('threepeater',17.5);beginThreepeaterShot(state,below,above);
  assert.deepEqual(state.heads.map(h=>h.phase),[below?'shoot':'idle','shoot',above?'shoot':'idle']);
  assert.equal(state.heads[1].rate,20);assert.equal(state.heads[1].blend!.duration,10);const emissions:number[]=[];
  for(let n=1;n<=66;n++){
   const fire=updatePeaShooting(state,'threepeater');if(fire){emissions.push(n);assert.equal(fire,mask);}
   advancePeaMotion(state,'threepeater');if(n===10)assert.equal(state.heads[1].blend,undefined);
   if(n===65)assert.equal(state.heads[1].phase,'shoot');
  }
  assert.deepEqual(emissions,[34]);assert.ok(state.heads.every(h=>h.phase==='idle'));assert.equal(state.heads[1].time,state.bodyTime);assert.equal(state.heads[1].blend!.left,19);
  for(let n=0;n<19;n++)advancePeaMotion(state,'threepeater');assert.equal(state.heads[1].blend,undefined);
 }
 // SetFramesForLayer preserves prior idle loop counts, including edge heads.
 const mature=createPeaMotion('threepeater',17.5);for(let n=0;n<150;n++)advancePeaMotion(mature,'threepeater');beginThreepeaterShot(mature,false,true);
 for(let n=0;n<35;n++){updatePeaShooting(mature,'threepeater');advancePeaMotion(mature,'threepeater');}assert.ok(mature.heads.every(h=>h.phase==='idle'));
});

test('three separate attachments match independently sampled source quarter-cycle anchors',()=>{
 const{rig:r,definition}=rig();assert.equal(definition.heads.length,3);
 assert.equal(anchors.sourceSha256,'a7ef991fb3943562b3cf54255bad49ea3cd8d0de8ce9c24e0a4fb09115ec19af');
 const state=createPeaMotion('threepeater',17.5);
 for(const a of anchors.cases){state.bodyTime=a.bodyTime;r.render(state);const head=(r as any).heads[a.head],part=head.parts[definition.heads[a.head].names.indexOf(a.name)];head.root.updateLocalTransform();const m=head.root.localTransform;
  assert.ok(Math.abs(m.a*part.x+m.c*part.y+m.tx-a.x)<.0001,`${a.head}/${a.bodyTime}/x`);assert.ok(Math.abs(m.b*part.x+m.d*part.y+m.ty-a.y)<.0001,`${a.head}/${a.bodyTime}/y`);
 }
 assert.deepEqual(r.root.children.slice(1),[(r as any).heads[0].root,(r as any).heads[2].root,(r as any).heads[1].root]);r.root.destroy({children:true});
});

test('three-head animation reuses every sprite and restores identical transforms throughout attacks',()=>{
 const{rig:a}=rig(),{rig:b}=rig(),state=createPeaMotion('threepeater',17.5),parts=a.root.children.flatMap(g=>g.children);
 const poses=(r:PeaRig)=>r.root.children.map(g=>({x:g.x,y:g.y,sx:g.scale.x,sy:g.scale.y,skew:[g.skew.x,g.skew.y],parts:g.children.map(p=>({x:p.x,y:p.y,sx:p.scale.x,sy:p.scale.y,skew:[p.skew.x,p.skew.y],visible:p.visible,alpha:p.alpha}))}));
 let blink=false;
 for(let n=0;n<600;n++){if(n%140===0)beginThreepeaterShot(state);updatePeaShooting(state,'threepeater');advancePeaMotion(state,'threepeater');a.render(state);b.render(JSON.parse(JSON.stringify(state)));assert.deepEqual(poses(a),poses(b));assert.deepEqual(a.root.children.flatMap(g=>g.children),parts);blink||=parts.some(p=>p.visible&&(p as any).texture===Texture.EMPTY);}
 assert.ok(blink);a.root.destroy({children:true});b.root.destroy({children:true});
});

test('previous-release threepeater saves retain committed volley deadlines when head state is absent',()=>{
 const g=new Game(31,23);g.phase='playing';g.started=true;g.waveIn=100000;g.ticks=13;
 const p:Plant={id:901,kind:'threepeater',row:0,column:0,health:300,actionIn:120,born:0,shotAt:1,threepeaterIn:23};g.plants=[p];
 const restored=Game.restore(g.snapshot());assert.equal(restored.plants[0].peaMotion!.shooting,23);assert.deepEqual(restored.plants[0].peaMotion!.heads.map(h=>h.phase),['shoot','shoot','idle']);
 for(let n=0;n<21;n++)restored.step();assert.equal(restored.peas.length,0);restored.step();assert.deepEqual(restored.peas.map(p=>p.row),[1,0]);
});
