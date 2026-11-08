import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Game } from '../src/game/model';

// Execute the actual UI callbacks without loading Pixi or making network requests.
const source=ts.createSourceFile('main.ts',readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
function code(target:string){
 let found:ts.Node|undefined;
 const visit=(node:ts.Node)=>{
  if(ts.isBinaryExpression(node)&&node.left.getText(source)===target)found=node.right;
  if(ts.isFunctionDeclaration(node)&&node.name?.text===target)found=node;
  ts.forEachChild(node,visit);
 };visit(source);assert.ok(found,target);
 return ts.transpileModule(ts.isFunctionDeclaration(found)?found.getText(source):`var action=${found.getText(source)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};}
function harness(target:string){
 const actors=deferred(),sound=deferred();const button={disabled:false,textContent:'',isConnected:true};
 const context=vm.createContext({game:new Game(1,1),screen:'battle',document:{hidden:false},$:()=>button,
  audio:{unlock:()=>sound.promise},scene:{prepareActors:()=>actors.promise},clock:{reset(){}},
  profile:{data:{purchases:{rake:0}},save(){}},updateHud(){},console:{warn(){}}});
 vm.runInContext(code(target),context);return {context,actors,sound,button};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('starting waits for actors but slow sound downloads do not hold the start button',async()=>{
 const h=harness("$('#start').onclick");let finished=false;const pending=h.context.action().then(()=>finished=true);
 await settle();assert.equal(h.context.game.phase,'ready');h.actors.resolve();await settle();
 const phase=h.context.game.phase;h.sound.resolve();await pending;
 assert.equal(finished,true);assert.equal(phase,'playing');
});
test('continue resumes immediately even while sound downloads are pending',async()=>{
 const h=harness("$('#resume').onclick");h.context.game.start();h.context.game.pause();
 const pending=h.context.action();await settle();const phase=h.context.game.phase;h.sound.resolve();await pending;
 assert.equal(phase,'playing');
});
test('leaving the battle during actor loading cannot start a hidden battle',async()=>{
 const h=harness("$('#start').onclick");const pending=h.context.action();h.context.screen='menu';h.actors.resolve();h.sound.resolve();await pending;
 assert.equal(h.context.game.phase,'ready');
});
test('a replaced level cannot be started by the previous start button',async()=>{
 const h=harness("$('#start').onclick");const pending=h.context.action();const former=h.context.game;h.context.game=new Game(2,2);
 h.actors.resolve();h.sound.resolve();await pending;assert.equal(former.phase,'ready');assert.equal(h.context.game.phase,'ready');
});
test('a late async start is paused before the hidden document can begin rendering',()=>{
 const h=harness("$('#start').onclick");h.context.game.start();h.context.document.hidden=true;h.context.screen='loading';
 vm.runInContext(code('updateHud'),h.context);h.context.updateHud();assert.equal(h.context.game.phase,'paused');
});
test('failed sound downloads cannot prevent a playable start or continue',async()=>{
 for(const target of ["$('#start').onclick","$('#resume').onclick"]){
  const h=harness(target);h.context.audio.unlock=()=>Promise.reject(new Error('offline sound'));
  if(target.includes('resume')){h.context.game.start();h.context.game.pause();}
  h.actors.resolve();await h.context.action();assert.equal(h.context.game.phase,'playing');
 }
});
