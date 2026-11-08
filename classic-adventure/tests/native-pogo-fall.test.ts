import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant} from '../src/game/model';
import type {LevelId} from '../src/game/config';
import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {Container} from 'pixi.js';
function fixture(level:LevelId=44){
 const g=new Game(level,23);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));
 const z=g['spawnZombie']('pogo',0,260,0);z.pogoState={phase:'high',remaining:40,altitude:59,animTime:1};
 const magnet:Plant={id:9000,kind:'magnetshroom',row:0,column:1,health:300,born:0,shotAt:-100,actionIn:0,awake:true};g.plants.push(magnet);return {g,z,magnet};
}
test('magnet retains pogo altitude and falls one pixel per unpaused, unfrozen logic tick until grounded',()=>{
 const {g,z}=fixture();g.step();assert.equal(z.pogo,false);assert.ok(z.pogoState,'stick removal must retain the airborne position');assert.equal(z.pogoState.altitude,58);assert.equal(z.speed,.45);
 g.pause();g.step();assert.equal(z.pogoState.altitude,58);g.resume();z.frozenIn=10;for(let n=0;n<9;n++)g.step();assert.equal(z.pogoState.altitude,58);g.step();assert.equal(z.pogoState.altitude,57,'native final frozen tick resumes falling after the counter reaches zero');
 const restored=Game.restore(g.snapshot());for(let n=0;n<58;n++){g.step();restored.step();}assert.equal(z.pogoState.altitude,0);assert.deepEqual(restored.snapshot(),g.snapshot());
});
test('pogo vertical origins and broken-stick body rectangles keep the native16 and17 pixel offsets',()=>{
 for(const level of [9,44] as const){const {g,z}=fixture(level);const ground=()=>level===44?40+Math.max(0,440-(z.x+10))*.25-16:34;
  assert.equal(g.nativeGroundY(z),ground());assert.equal(g.zombieBodyTop(z),Math.trunc(Math.trunc(ground())-59));
  g.step();assert.equal(g.nativeGroundY(z),ground());assert.equal(g.zombieBodyTop(z),Math.trunc(Math.trunc(ground())-58)+17);
 }
});
test('losing its head breaks the pogo without discarding its current altitude',()=>{
 const {g,z}=fixture();g.plants=g.plants.filter(p=>p.id!==9000);g['damageZombie'](z,340,true);assert.equal(z.health,160);assert.equal(z.pogo,false);assert.equal(z.pogoState?.altitude,59);
 g.step();assert.equal(z.pogoState?.altitude,58);
});
test('a falling pogo keeps walking but cannot start chewing before it lands',()=>{
 const {g,z}=fixture();const wall:Plant={id:9001,kind:'wallnut',column:2,row:0,health:4000,born:0,shotAt:-100,actionIn:100000};g.plants.push(wall);
 for(let n=0;n<4;n++)g.step();assert.equal(z.eating,false);assert.equal(wall.health,4000);
});
test('ice mushroom chills a bouncing pogo without trapping it, but can freeze a broken-stick pogo',()=>{
 for(const broken of [false,true]){const {g,z,magnet}=fixture();if(broken)g['updateMagnet'](magnet);const ice:Plant={...magnet,kind:'iceshroom'};g['doSpecial'](ice);assert.equal(z.health,broken?480:500);assert.equal(z.chillIn,2000);assert.equal((z.frozenIn??0)>0,broken);}
});
test('butter damages a bouncing pogo without immobilizing it; a broken-stick pogo can be buttered and grounded',()=>{
 for(const broken of [false,true]){
  const {g,z,magnet}=fixture();if(broken)g['updateMagnet'](magnet);
  const pea={id:99999,row:0,x:230,y:100,age:100,ice:false,puff:false,lob:{kind:'butter' as const,target:z.id,startX:100,startY:100,endX:260,endY:100,duration:120,flight:{vx:0,vz:0,z:0,planeY:100}}};
  g['updateLob'](pea);assert.equal(z.health,460);assert.equal((z.butterIn??0)>0,broken);assert.equal(z.pogoState?.altitude,broken?0:59);
 }
});

test('actual Scene positioning retains the native pogo root through break, fall and landing',()=>{
 const ast=ts.createSourceFile('scene.ts',readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true),scene=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Scene') as ts.ClassDeclaration;
 const method=scene.members.find(n=>n.name?.getText(ast)==='positionZombie')!;
 const ctx=vm.createContext({});vm.runInContext(ts.transpileModule(`class Harness{${method.getText(ast)}};var h=new Harness()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 for(const level of [9,44] as const){const {g,z}=fixture(level),actor={root:new Container(),nativeAligned:false};
  for(let n=0;n<=59;n++){
   actor.root.position.set(z.x,0);ctx.h.positionZombie(actor,g,z);assert.equal(actor.nativeAligned,true);
   const sourceY=level===44?40+Math.max(0,440-(z.x+10))*.25-16:34;
   assert.equal(actor.root.x,z.x-15);assert.equal(actor.root.y,sourceY+8-z.pogoState!.altitude);
   if(n<59)g.step();
  }
  actor.root.destroy();
 }
});
