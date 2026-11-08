import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {Container,Graphics,Sprite,Texture} from 'pixi.js';import {Powie,powieRandom} from '../src/rendering/powie';import {Game} from '../src/game/model';import {combatTextureFiles} from '../src/rendering/asset-plan';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('Powie source spawn limits, friction-before-motion, color and lifetimes use fixed ticks',()=>{
 const effect=new Powie(Texture.EMPTY,Texture.EMPTY,()=>.5),small=effect.root.children[13] as Sprite,big=effect.root.children[27] as Sprite;
 assert.equal(effect.root.children.length,29);assert.equal(effect.root.children.filter(s=>s.visible).length,3);
 close(small.x,0);close(small.y,-48.45);close(big.y,-36.97);close(small.scale.x,.5);close(big.scale.x,1.4);
 assert.equal(small.tint,0xffb300);assert.equal(big.tint,0xffe600);
 effect.update(10);assert.equal(effect.root.children.filter(s=>s.visible).length,29);
 effect.update(50);assert.equal(effect.root.children[28].visible,false);
 effect.update(59);assert.equal(effect.root.children.filter(s=>s.visible).length,0);
 effect.update(200);assert.equal(effect.root.children.length,29);effect.root.destroy({children:true});
});
test('Powie repeated, skipped and varied-rate renders do not advance particles differently or allocate more sprites',()=>{
 const capture=(p:Powie)=>p.root.children.map(s=>[s.visible,s.x,s.y,s.rotation,s.scale.x,s.alpha,(s as Sprite).tint]);
 const a=new Powie(Texture.EMPTY,Texture.EMPTY,powieRandom(23)),b=new Powie(Texture.EMPTY,Texture.EMPTY,powieRandom(23));
 a.update(35);for(let age=0;age<=35;age++)b.update(age);assert.deepEqual(capture(a),capture(b));
 const state=capture(a),nodes=[...a.root.children];a.update(35);assert.deepEqual(capture(a),state);assert.deepEqual(a.root.children,nodes);
 a.update(34);a.update(35);assert.deepEqual(capture(a),state);
 a.root.destroy({children:true});b.root.destroy({children:true});
});
function scene(){
 const ast=ts.createSourceFile('scene.ts',readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true),klass=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Scene') as ts.ClassDeclaration;
 const methods=['event','updateEffects'].map(name=>klass.members.find(n=>n.name?.getText(ast)===name)?.getText(ast)??'');
 const context=vm.createContext({Container,Graphics,Sprite,Texture,Powie,powieRandom});
 vm.runInContext(ts.transpileModule(`class Harness{world=new Container();effects=[];explosions=[];actors=new Map();time=80;textures={powieCloud:Texture.EMPTY,powieWord:Texture.EMPTY};${methods.join('\n')}};var h=new Harness();`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);return context.h;
}
test('actual explosion event creates native sprites at its logic tick and releases them after the source system ends',()=>{
 const h=scene();h.event({kind:'explode',effect:'powie',tick:81,x:200,y:120});const effect=h.effects[0];
 assert.ok(effect.powie instanceof Powie,'native Powie must replace the generic circle');assert.equal(effect.born,81);assert.equal(effect.duration,200);assert.equal(effect.node.children.length,29);
 assert.equal(effect.node.x,200);assert.equal(effect.node.y,120);h.time=101;h.updateEffects();assert.equal(effect.node.alpha,1);
 const sprites=[...effect.node.children];h.time=281;h.updateEffects();assert.equal(h.effects.length,0);assert.ok(effect.node.destroyed);assert.ok(sprites.every(s=>s.destroyed));
});
test('native Powie textures load only for selected bombs, bowling and possible vase contents',()=>{
 assert.equal(combatTextureFiles(new Game(1,23)).powieWord,undefined);
 for(const level of [5,10,25,45] as const){const files=combatTextureFiles(new Game(level,23));assert.equal(files.powieCloud,'particles/powie-cloud.png');assert.equal(files.powieWord,'particles/powie-word.png');}
 const vases=new Game(35,23);assert.equal(combatTextureFiles(vases).powieWord,undefined);
 vases.seedDrops.push({id:900,kind:'cherrybomb',row:0,column:0,remaining:100,timesDropped:0});assert.equal(combatTextureFiles(vases).powieWord,'particles/powie-word.png');
 const g=new Game(9,23);g.chooseSeed('cherrybomb');assert.equal(combatTextureFiles(g).powieWord,'particles/powie-word.png');
});
test('cherry Powie events use native plant center and logical time without consuming gameplay randomness',()=>{
 for(const level of [9,18,21,41] as const)for(const column of [0,4,8])for(const row of [0,2]){
  const g=new Game(level,23);g.ticks=42;g.plants=[];g.zombies=[];const random=g['randomState'];
  (g as any).doSpecial({id:900,kind:'cherrybomb',column,row,health:300,born:0,shotAt:0,actionIn:0});
  const e=g.drainEvents().find(e=>e.kind==='explode')!;assert.equal(e.kind,'explode');if(e.kind!=='explode')throw new Error('missing explosion');
  assert.equal(e.effect,'powie');assert.equal(e.tick,42);assert.equal(e.x,80+column*80);
  const y=level===41?70+row*85+Math.max(0,5-column)*20:80+row*(level===21?85:100);
  assert.equal(e.y,y+40);assert.equal(g['randomState'],random);
 }
});
