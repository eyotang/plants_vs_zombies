import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {Sprite,Texture,Container,Graphics} from 'pixi.js';import ts from 'typescript';import vm from 'node:vm';
import {GraveDebris} from '../src/rendering/grave-debris';import {powieRandom} from '../src/rendering/powie';
import {Game} from '../src/game/model';import {cellX} from '../src/game/config';import {GameAudio} from '../src/platform/audio';
import {soundFiles} from '../src/platform/audio-plan';import {combatTextureFiles} from '../src/rendering/asset-plan';
import assets from '../docs/gravebuster-feedback-assets.json';
const frames=Array.from({length:8},()=>Texture.EMPTY),close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('native rock/dirt emitters preserve spawn rate, source field order, alpha and bounded slots',()=>{
 const chew=new GraveDebris(frames,'chew',()=>.5),clear=new GraveDebris(frames,'clear',()=>.5);
 assert.equal(chew.root.children.length,10);assert.equal(clear.root.children.length,20);
 assert.equal(chew.root.children.filter(p=>p.visible).length,0);chew.update(3);assert.equal(chew.root.children.filter(p=>p.visible).length,0);
 chew.update(4);const rock=chew.root.children.find(p=>p.visible) as Sprite;assert.ok(rock);close(rock.x,0);close(rock.y,-14+4/399*30);close(rock.scale.x,.55);assert.equal(rock.alpha,1);
 chew.update(5);close(rock.y,-14+4/399*30-1.42);
 assert.equal(clear.root.children.filter(p=>p.visible).length,20);const dirt=clear.root.children[0] as Sprite;close(dirt.y,-14);clear.update(1);close(dirt.y,-16.16625);close(dirt.scale.x,.8);
 const rockSlots=new Set(chew.root.children),dirtSlots=new Set(clear.root.children);
 for(let age=6;age<=500;age++){chew.update(age);clear.update(age);assert.ok(chew.root.children.filter(p=>p.visible).length<=10);assert.ok(clear.root.children.filter(p=>p.visible).length<=20);}
 assert.ok(chew.root.children.every(p=>rockSlots.has(p)&&!p.visible));assert.ok(clear.root.children.every(p=>dirtSlots.has(p)&&!p.visible));
 chew.root.destroy({children:true});clear.root.destroy({children:true});
});

test('particle clocks match uninterrupted, skipped-render and paused draws without new objects',()=>{
 for(const mode of ['chew','clear'] as const){
  const a=new GraveDebris(frames,mode,powieRandom(23)),b=new GraveDebris(frames,mode,powieRandom(23));const slots=[...a.root.children];
  for(const age of [25,100,200,399,400,500]){
   const start=age===25?0:age===100?25:age===200?100:age===399?200:age===400?399:400;
   for(let tick=start;tick<=age;tick++)a.update(tick);b.update(age);
   const snapshot=(g:GraveDebris)=>g.root.children.map(p=>p.visible?{visible:true,x:p.x,y:p.y,scale:p.scale.x,alpha:p.alpha,rotation:p.rotation}:{visible:false});
   assert.deepEqual(snapshot(a),snapshot(b));const before=snapshot(a);a.update(age);a.update(age);assert.deepEqual(snapshot(a),before);assert.ok(a.root.children.every(p=>slots.includes(p)));
  }
  a.root.destroy({children:true});b.root.destroy({children:true});
 }
});

test('new feedback assets preserve source PNG bytes and are excluded from an ordinary first-level load',()=>{
 assert.equal(assets.commit,'325b2229a7225d73870bb69322eefcda3a45bf8d');assert.equal(assets.files.length,3);
 for(const item of assets.files){const data=readFileSync(new URL('../public/'+item.file,import.meta.url));assert.equal(data.length,item.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);}
 assert.equal(soundFiles(new Game(1,1))['grave-chomp'],undefined);assert.equal(combatTextureFiles(new Game(1,1)).graveRock,undefined);
 const g=new Game(14,1);g.seeds=['gravebuster'];assert.equal(soundFiles(g)['grave-chomp'],'gravebuster-chomp.mp3');assert.equal(combatTextureFiles(g).graveRock,'particles/grave-rock.png');assert.equal(combatTextureFiles(g).graveDirt,'particles/grave-dirt.png');
 g.seeds=['imitater'];g.imitaterTarget='gravebuster';assert.ok(soundFiles(g)['grave-chomp']);assert.ok(combatTextureFiles(g).graveDirt);
 g.seeds=[];g.imitaterTarget=null;g.plants=[{id:900,kind:'gravebuster',column:4,row:1,health:300,actionIn:200,born:0,shotAt:0}];assert.ok(soundFiles(g)['grave-chomp']);assert.ok(combatTextureFiles(g).graveRock);
 assert.ok(assets.files.reduce((n,f)=>n+f.bytes,0)<70*1024);
});

test('completion emits one source-centered dirt burst; the actual Scene disposes it at system expiry',()=>{
 const g=new Game(14,1);g.phase='playing';g.started=true;g.ticks=100;g.plants=[{id:900,kind:'gravebuster',column:4,row:1,health:300,actionIn:1,born:0,shotAt:0,gravebuster:{phase:'eating',rate:12,ticks:400}}];g.graves=[{id:901,column:4,row:1}];g.step();
 const event=g.drainEvents().find(e=>e.kind==='grave-clear')!;assert.deepEqual(event,{kind:'grave-clear',x:cellX(4),y:g.gridY(4,1)+40,row:1,tick:101});g.step();assert.ok(!g.drainEvents().some(e=>e.kind==='grave-clear'));
 const ast=ts.createSourceFile('scene.ts',readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true),scene=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Scene') as ts.ClassDeclaration;
 const methods=['event','updateEffects'].map(name=>scene.members.find(n=>n.name?.getText(ast)===name)!.getText(ast));
 const context=vm.createContext({Container,Graphics,Sprite,Texture,GraveDebris,powieRandom});vm.runInContext(ts.transpileModule(`class Harness{world=new Container();effects=[];time=101;graveDirtFrames=Array.from({length:8},()=>Texture.EMPTY);viewport={artScaleX:1,artScaleY:1};${methods.join('\n')}};var h=new Harness()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const h=context.h;h.event(event);assert.equal(h.effects.length,1);const effect=h.effects[0];assert.equal(effect.node.x,event.x);assert.equal(effect.node.y,event.y);assert.equal(effect.node.children.length,20);h.time=601;h.updateEffects();assert.equal(h.effects.length,0);assert.ok(effect.node.destroyed);
});

test('grave Foley uses the native pause-mute flag, without changing ordinary combat gain or the voice cap',async t=>{
 const previous=globalThis.AudioContext,sources:any[]=[],gains:any[]=[];let context:any;
 class Context{currentTime=0;destination={};constructor(){context=this}async resume(){}async suspend(){}async decodeAudioData(){return {duration:4.61}}createGain(){const n={gain:{value:1},connect(){}};gains.push(n);return n}createBufferSource(){const n={buffer:null,connect(output:any){this.output=output},output:null as any,start(){},stop(){},disconnect(){},onended:null};sources.push(n);return n}}
 globalThis.AudioContext=Context as unknown as typeof AudioContext;t.after(()=>{globalThis.AudioContext=previous});t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([1])));
 const game=new Game(14,1);game.seeds=['gravebuster'];const audio=new GameAudio('/');await audio.unlock(game);audio.play('grave-chomp');assert.equal(sources.length,1);const pauseGain=sources[0].output;assert.equal(pauseGain.gain.value,1);
 audio.setPaused(true);assert.equal(pauseGain.gain.value,0);audio.setPaused(false);assert.equal(pauseGain.gain.value,1);context.currentTime+=.1;audio.play('shoot');assert.equal(sources[1].output.gain.value,.3);
 audio.muted=true;assert.equal(gains[0].gain.value,0);audio.muted=false;assert.equal(gains[0].gain.value,1);await audio.release();assert.equal(audio['sources'].size,0);assert.equal(audio['buffers'].size,0);
 const entry=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');assert.match(entry,/audio\.setPaused\(document\.hidden \|\| screen === 'battle' && game\.phase === 'paused'\)/);
});
