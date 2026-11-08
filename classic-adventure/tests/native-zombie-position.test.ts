import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {Container,Texture} from 'pixi.js';
import {ActorRig} from '../src/rendering/actor-motion';
import {GiantRig} from '../src/rendering/giant-motion';
import {Game,type Zombie,type Plant} from '../src/game/model';

const zombie=(kind:Zombie['kind']='normal',x=300.75):Zombie=>({id:901,kind,row:0,x,health:270,armor:0,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,frozenIn:1000,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0});
const plant:Plant={id:900,kind:'cabbagepult',row:0,column:0,health:300,born:0,shotAt:-100,actionIn:1000};
// Board::GetPosYBasedOnRow(rawX+40,row)-30; rawX=modelX-30.
const sourceY=(env:string,x:number,row=0)=>env==='roof'?40+85*row+Math.max(0,440-(x+10))*.25:50+row*(env==='pool'||env==='fog'?85:100);
test('ground pult aims use the native integer body top, including vehicles and giants',()=>{
 for(const level of [9,18,21,31,41] as const)for(const x of [300.75,439.5,650])for(const kind of ['normal','football','pole','jack','yeti','ladder','imp','gargantuar','catapult','zomboni'] as const){
  const g=new Game(level,1),z=zombie(kind,x);g.zombies=[z];g.plants=[];(g as any).fireLob(plant);
  const dy=kind==='gargantuar'?-38:kind==='catapult'||kind==='zomboni'?-13:0;
  assert.equal(g.peas[0].lob!.endY,Math.trunc(sourceY(g.config.environment,x))+dy,`${level}/${kind}/${x}`);
  const width=kind==='football'?57:kind==='gargantuar'?125:kind==='catapult'||kind==='zomboni'?153:42;
  const dx=kind==='football'?50:kind==='gargantuar'?-17:kind==='catapult'||kind==='zomboni'?0:36;
  assert.equal(g.peas[0].lob!.endX,Math.max(85,Math.trunc(x-30)+dx+Math.trunc(width/2)-30),`${kind}: lead uses the integer rectangle center`);
 }
});
test('native ground body rectangles use object origin, integer X and reverse-facing offsets',()=>{
 for(const kind of ['normal','football','gargantuar','catapult','zomboni'] as const)for(const backwards of [false,true])for(const hit of [false,true]){
  const g=new Game(9,1);g.plants=[];const z={...zombie(kind,300.75),backwards};g.zombies=[z];
  const width=kind==='football'?57:kind==='gargantuar'?125:kind==='catapult'||kind==='zomboni'?153:42;
  const offset=kind==='football'?50:kind==='gargantuar'?-17:kind==='catapult'||kind==='zomboni'?0:36;
  const left=270+(backwards?(kind==='gargantuar'?180:120)-offset-width:offset);
  const shotX=left-40-(hit?0:1);
  g.peas=[{id:999,row:0,x:shotX,y:0,age:60,ice:false,puff:false,lob:{kind:'cabbage',target:z.id,startX:shotX,endX:shotX,startY:0,endY:0,duration:120,flight:{vx:0,vz:1,z:0,planeY:0}}}];
  (g as any).updateLob(g.peas[0]);assert.equal(z.health,hit?230:270,`${kind}/${backwards}/${hit}`);
 }
});
function positioning(){
 const ast=ts.createSourceFile('scene.ts',readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const scene=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Scene') as ts.ClassDeclaration;
 const method=scene.members.find(n=>n.name?.getText(ast)==='positionZombie');assert.ok(method);
 const ctx=vm.createContext({});vm.runInContext(ts.transpileModule(`class Harness{${method.getText(ast)}};var h=new Harness()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 return ctx.h.positionZombie.bind(ctx.h);
}
test('ground drawing uses native fractional position and species offsets; special phases retain their existing bridge',()=>{
 const position=positioning();
 for(const level of [9,41] as const)for(const kind of ['normal','football','pole','jack','yeti','ladder','imp','gargantuar','catapult','zomboni'] as const)for(const backwards of [false,true]){
  const g=new Game(level,1),z={...zombie(kind),backwards},actor={root:new Container(),nativeAligned:false};actor.root.position.set(z.x,g.rowY(0,z.x)+1);
  position(actor,g,z);
  assert.equal(actor.nativeAligned,true);
  const dx=kind==='pole'?-6:kind==='catapult'?-25:kind==='zomboni'?68:0;
  const dy=kind==='football'?-16:kind==='pole'?-11:kind==='yeti'?-20:kind==='catapult'?-18:kind==='zomboni'?-23:kind==='gargantuar'?-8:0;
  assert.equal(actor.root.x,z.x-30+15+dx+(backwards?90:0));
  assert.equal(actor.root.y,sourceY(g.config.environment,z.x)-8+dy);actor.root.destroy();
 }
 for(const patch of [{flight:{remaining:10,duration:30,startX:300,endX:200}},{riseIn:30},{vaultIn:30},{mini:true},{kind:'digger'},{kind:'pogo',pogo:true}] as Partial<Zombie>[]){
  const g=new Game(9,1),z={...zombie(),...patch},actor={root:new Container(),nativeAligned:true};actor.root.position.set(300,155);position(actor,g,z);assert.equal(actor.nativeAligned,false);assert.equal(actor.root.x,300);assert.equal(actor.root.y,155);actor.root.destroy();
 }
});
test('native root mode invalidates same-pose caches and survives death clips without new parts',()=>{
 const definition=JSON.parse(readFileSync(new URL('../public/assets/runtime/actor-motion/zombie.json',import.meta.url),'utf8'));
 const rig=new ActorRig('zombie',{definition,textures:Object.fromEntries(Object.keys(definition.frames).map(k=>[k,Texture.EMPTY]))});
 const count=()=>rig.root.children.reduce((n,g)=>n+g.children.length,0),initial=count();
 rig.render('zombie-walk',0,true);assert.equal(rig.root.x,definition.clips['zombie-walk'].origin[0]);
 rig.render('zombie-walk',0,true,false,true);assert.equal(rig.root.x,0);assert.equal(rig.root.y,0);assert.equal(rig.root.scale.x,1);
 rig.render('zombie-die',30,false,false,true);assert.equal(rig.root.y,0);assert.equal(count(),initial);
 rig.render('zombie-die',30,false,false,false);assert.equal(rig.root.y,definition.clips['zombie-die'].origin[1]);rig.root.destroy({children:true});
 const giant=JSON.parse(readFileSync(new URL('../public/assets/runtime/giant-motion/gargantuar.json',import.meta.url),'utf8'));
 const g=new GiantRig({definition:giant,textures:Object.fromEntries(Object.keys(giant.frames).map(k=>[k,Texture.EMPTY]))});
 g.render('gargantuar-walk',0,true);assert.equal(g.root.y,giant.origin[1]);g.render('gargantuar-walk',0,true,true);assert.equal(g.root.y,0);
 const parts=g.root.children.length;g.render('gargantuar-die',0,false,true);assert.equal(g.root.y,0);assert.equal(g.root.children.length,parts);
 g.render('gargantuar-die',0,false,false);assert.equal(g.root.y,giant.origin[1]);g.root.destroy({children:true});
});
test('boss-target pults use the native row ground rather than their own launch height',()=>{
 const g=new Game(50,1);assert.ok(g.boss);g.boss.phase='headBefore';g.zombies=[];g.plants=[];
 (g as any).fireLob(plant);assert.ok(g.peas.length);assert.equal(g.peas[0].lob!.endY,70);assert.notEqual(g.peas[0].lob!.endY,g.peas[0].lob!.startY);
});
