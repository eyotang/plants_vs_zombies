import test from 'node:test';import assert from 'node:assert/strict';
import {plantHeightOffset} from '../src/rendering/plant-height';
import {squashClip,squashTicks,squashPosition} from '../src/rendering/squash-motion';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import metadata from '../src/rendering/actor-motion-metadata.json';
import vm from 'node:vm';import ts from 'typescript';import {Container} from 'pixi.js';import {Game,type Plant} from '../src/game/model';import {cellX} from '../src/game/config';
const bytes=readFileSync(new URL('../public/assets/runtime/actor-motion/'+metadata.squash,import.meta.url));const data=JSON.parse(bytes.toString());
test('new squash metadata has an immutable URL and reuses the unchanged legacy atlas',()=>{
 assert.equal(metadata.squash,'squash-'+createHash('sha256').update(bytes).digest('hex').slice(0,16)+'.json');
 const legacy=JSON.parse(readFileSync(new URL('../public/assets/runtime/actor-motion/squash.json',import.meta.url),'utf8'));
 assert.equal(legacy.clips['squash-look-left'],undefined);assert.equal(legacy.clips['squash-attack'].duration,36);assert.equal(data.atlas,'squash');assert.deepEqual(data.frames,legacy.frames);
});
test('squash uses original directional look, continuous jumpup and held jumpdown poses',()=>{
 for(const [remaining,clip,ticks] of [[185,'squash-look-left',0],[106,'squash-look-left',79],[105,'squash-rise',0],[60,'squash-rise',45],[11,'squash-rise',94],[10,'squash-attack',0],[5,'squash-attack',5]] as const){
  const s={remaining,x:100,target:1};assert.equal(squashClip(s,200),clip);assert.equal(squashTicks(s),ticks);
 }
 assert.equal(squashClip({remaining:185,x:300,target:1},200),'squash-look-right');
 assert.equal(squashTicks({remaining:0,x:100,target:1,restIn:90}),20);
 const expected={'squash-look-left':6/24*100,'squash-look-right':6/24*100,'squash-rise':15/24*100,'squash-attack':8/60*100};
 for(const [name,duration] of Object.entries(expected))assert.equal(Reflect.get(data.clips,name)?.duration,duration,name);
});
test('squash reaches both apex coordinates after thirty rise ticks, holds for twenty and falls linearly for ten',()=>{
 const pos=(remaining:number)=>squashPosition({remaining,x:300,target:1},100,200,208);
 assert.deepEqual(pos(61),[100,200]);assert.deepEqual(pos(60),[100,200]);
 assert.deepEqual(pos(30),[300,88]);assert.deepEqual(pos(11),[300,88]);assert.deepEqual(pos(10),[300,88]);assert.deepEqual(pos(5),[300,148]);assert.deepEqual(pos(0),[300,208]);
});
test('Scene squash roots use native plant coordinates and the destination roof column, retaining pot height',()=>{
 const ast=ts.createSourceFile('scene.ts',readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const scene=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Scene') as ts.ClassDeclaration;
 const methods=['positionPlant','positionSquash'].map(name=>{const m=scene.members.find(n=>n.name?.getText(ast)===name);assert.ok(m,`missing ${name}`);return m.getText(ast)});
 const ctx=vm.createContext({cellX,squashPosition,plantHeightOffset});vm.runInContext(ts.transpileModule(`class Harness{${methods.join('\n')}};var h=new Harness()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 for(const level of [9,41] as const)for(const column of [0,4,5])for(const center of [399,400,439,440,520,678])for(const pot of [false,true])for(const remaining of [60,30,11,10,5,0]){
  const g=new Game(level,1),p:Plant={id:900,kind:'squash',column,row:0,health:300,actionIn:0,born:0,shotAt:-100,squash:{remaining,x:center,target:901}};
  g.plants=pot?[{...p,kind:'flowerpot',squash:undefined}]:[];
  const actor={root:new Container(),nativeRig:{root:new Container()}};actor.nativeRig.root.position.set(-40,-80);actor.nativeRig.root.scale.set(.99);
  ctx.h.positionPlant(actor,g,'squash',column,0);ctx.h.positionSquash(actor,g,p);
  const nativeGrid=(c:number)=>level===41?70+Math.max(0,5-c)*20:80,targetCol=Math.max(0,Math.min(8,Math.floor((center-80)/80))),dest=nativeGrid(targetCol)+8;
  assert.equal(actor.root.x,remaining===60?40+80*column:center-40);
  assert.equal(actor.root.y,(remaining===60?nativeGrid(column):remaining>10?dest-120:dest-remaining*12)-(pot?5:0));
  assert.equal(actor.nativeRig.root.x,0);assert.equal(actor.nativeRig.root.y,0);assert.equal(actor.nativeRig.root.scale.x,1);
  actor.root.destroy();actor.nativeRig.root.destroy();
 }
});
