import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {Container} from 'pixi.js';
import {Game,type Plant,type Zombie} from '../src/game/model';
import {cellX,PLANTS} from '../src/game/config';
import {plantHeightOffset} from '../src/rendering/plant-height';

// Independent equations from pinned Board::GridToPixelY and Plant::Fire.
const gridY=(env:string,c:number,r:number)=>env==='roof'?70+85*r+Math.max(0,5-c)*20:80+r*(env==='pool'||env==='fog'?85:100);
const plant=(kind:Plant['kind'],column:number,row:number):Plant=>({id:900,kind,column,row,health:300,born:0,shotAt:-100,actionIn:0});
const enemy:Zombie={id:901,kind:'normal',row:0,x:800,health:270,armor:0,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,frozenIn:1000,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0};
test('pult launch origins use native grid top-left and fixed pot adjustment, without water bobbing',()=>{
 for(const level of [9,18,21,31,41] as const)for(const column of [0,4,5,8])for(const kind of ['cabbagepult','kernelpult','melonpult','wintermelon'] as const)for(const butter of [false,true])for(const pot of [false,true]){
  const g=new Game(level,1),p=plant(kind,column,0);g.zombies=[{...enemy}];g.plants=pot?[plant('flowerpot',column,0)]:[];g.ticks=37;
  // Controlled weapon choice exercises both kernel and butter emission paths.
  Object.assign(g,{random:()=>butter?0:.9});
  (g as any).fireLob(p);const shot=g.peas[0].lob!;
  const dx=shot.kind==='cabbage'?5:shot.kind==='kernel'?19:shot.kind==='butter'?12:25;
  const dy=shot.kind==='cabbage'?-12:shot.kind==='kernel'?-37:shot.kind==='butter'?-56:-46;
  assert.equal(shot.startX,40+column*80+dx);
  assert.equal(shot.startY,gridY(g.config.environment,column,0)+dy-(pot?5:0),`${level}/${column}/${shot.kind}/pot=${pot}`);
 }
});

function positioning(){
 const ast=ts.createSourceFile('scene.ts',readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const scene=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Scene') as ts.ClassDeclaration;
 const method=scene.members.find(n=>n.name?.getText(ast)==='positionPlant');assert.ok(method,'Scene must share actual and preview positioning');
 const ctx=vm.createContext({cellX,plantHeightOffset});
 vm.runInContext(ts.transpileModule(`class Harness{${method.getText(ast)}};var h=new Harness()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 return ctx.h.positionPlant.bind(ctx.h);
}
test('pults and pots share source render roots on flat ground, roof slope, water and cursor previews',()=>{
 const position=positioning();
 for(const level of [9,18,21,31,41] as const)for(const column of [0,4,5,8])for(const row of [0,2,4])for(const kind of ['cabbagepult','kernelpult','melonpult','wintermelon','flowerpot','squash'] as const)for(const pot of [false,true]){
  const g=new Game(level,1);g.ticks=37;g.plants=pot?[plant('flowerpot',column,row)]:[];
  const rig={root:new Container()},actor={root:new Container(),...(kind==='flowerpot'||kind==='squash'?{nativeRig:rig}:{rig})};
  rig.root.position.set(-40,-73);rig.root.scale.set(.99);
  position(actor,g,kind,column,row);
  const bob=g.waterRow(row)?Math.sin(row*Math.PI+column*.25*Math.PI+g.ticks*2*Math.PI/200)*2:0;
  const expectedY=gridY(g.config.environment,column,row)+bob+(kind==='flowerpot'?26:pot?-5:0);
  assert.equal(actor.root.x+rig.root.x,40+column*80);
  assert.ok(Math.abs(actor.root.y+rig.root.y-expectedY)<1e-9,`${level}/${column}/${row}/${kind}/pot=${pot}`);
  assert.equal(rig.root.scale.x,1);assert.equal(rig.root.scale.y,1);
  // Cached poses and cursor moves must not accumulate the old origin or scale.
  position(actor,g,kind,column,row);assert.ok(Math.abs(actor.root.y+rig.root.y-expectedY)<1e-9);
  actor.root.destroy({children:true});rig.root.destroy({children:true});
 }
});

test('all ordinary planted reanims use native grid roots, species offsets and scale instead of GIF bindings',()=>{
 const position=positioning();
 const offsets:Partial<Record<Plant['kind'],number>>={flowerpot:26,lilypad:25,starfruit:10,tanglekelp:24,seashroom:28,coffeebean:-20,pumpkin:15,puffshroom:5,scaredyshroom:-14,gravebuster:-40};
 for(const kind of Object.keys(PLANTS)as Plant['kind'][])if(kind!=='explodenut')for(const level of [9,18,21,31,41]as const)for(const column of [0,4,8])for(const row of [0,2,4,5])for(const pot of [false,true]){
  const g=new Game(level,1);if(!g.config.rows.includes(row))continue;g.ticks=37;g.plants=pot?[plant('flowerpot',column,row)]:[];
  const rig={root:new Container()},actor={root:new Container(),nativeRig:rig};rig.root.position.set(-41.5,-73.2);rig.root.scale.set(.93);
  position(actor,g,kind,column,row);
  let dy=offsets[kind]??0;if(pot&&kind!=='flowerpot')dy+=kind==='chomper'||kind==='plantern'?-10:kind==='scaredyshroom'?0:-5;
  if(g.waterRow(row)&&kind!=='coffeebean')dy+=Math.sin(row*Math.PI+column*.25*Math.PI+37*2*Math.PI/200)*2;
  if(kind==='spikeweed'||kind==='spikerock'){if(kind==='spikerock')dy+=6;const bottom=g.config.rows.length===6?5:4;dy+=pot?5:g.config.environment==='roof'?15:g.waterRow(row)?0:row===bottom&&column>=7&&bottom===5?1:row===bottom&&column<7?12:15;}
  if(kind==='coffeebean')dy+=10;if(kind==='potatomine')dy+=12;
  assert.equal(actor.root.x+rig.root.x,40+column*80+(['coffeebean','potatomine'].includes(kind)?12:0),`${kind}/${level}/${column}/${row}/x`);
  assert.ok(Math.abs(actor.root.y+rig.root.y-gridY(g.config.environment,column,row)-dy)<1e-9,`${kind}/${level}/${column}/${row}/pot=${pot}/y`);
  assert.equal(rig.root.scale.x,['coffeebean','potatomine'].includes(kind)?.8:1,kind);assert.equal(rig.root.scale.y,rig.root.scale.x);
  actor.root.destroy({children:true});rig.root.destroy({children:true});
 }
});
