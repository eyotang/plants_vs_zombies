import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {loadInBatches,loadGraphics} from '../src/platform/load-queue';
import {releaseBitmapOnDestroy} from '../src/rendering/bitmap-lifetime';
const turn=()=>new Promise(r=>setImmediate(r));
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
// Execute real resource methods with controlled network/GPU boundaries, without a browser or Pixi mocks in production.
function harness(file:string,name:string,methods:string[],fields:string,bindings:Record<string,unknown>={}){
 const ast=ts.createSourceFile(file,readFileSync(new URL(`../src/rendering/${file}`,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const declaration=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===name) as ts.ClassDeclaration;
 const members=declaration.members.filter(n=>n.name&&methods.includes(n.name.getText(ast))).map(n=>n.getText(ast));
 const context=vm.createContext({loadInBatches,loadGraphics,releaseBitmapOnDestroy,...bindings});
 const helper=new URL('../src/rendering/load-atlas.ts',import.meta.url);
 if(existsSync(helper))vm.runInContext(ts.transpileModule(readFileSync(helper,'utf8').replace(/^import .*;\n/gm,'').replace('export async function','async function'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
 const source=`class Harness {${fields}\n${members.join('\n')}};var subject=new Harness();`.replaceAll('import.meta.env.BASE_URL','"/"');
 vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
 return context.subject;
}
function scene(bindings:Record<string,unknown>={},realActors=false,realTextures=false){
 return harness('scene.ts','Scene',['prepareBoard','prepareActors','release','queueResources',...(realActors?['loadActors']:[]),...(realTextures?['prepareTextures']:[])],`
 resourceWork=Promise.resolve();app={stop(){},renderer:{prepare:{upload:async()=>{}}}};
 textures={};textureFiles=[];clips={};effects=[];plantMotion={prepare:async()=>{}};actorMotion={prepare:async()=>{}};giantMotion={prepare:async()=>{}};peaArt={prepare:async()=>{}};
 loadBoard=async()=>{};${realActors?'':'loadActors=async()=>{};'}${realTextures?'':'prepareTextures=async()=>{};'}clearResources=async()=>{};
 `,{fetch:async()=>({ok:true,json:async()=>({animations:{}})}),isPeaKind:()=>false,hasPlantMotion:()=>false,hasPlantMotionClip:()=>false,animationNames:()=>[],combatTextureFiles:()=>({}),ACTOR_MOTION:{},GIANT_CLIPS:[],hasGiantMotion:()=>false,hasActorMotion:()=>false,...bindings});
}
const emptyGame={seeds:[],plants:[],squishedPlants:[]};
test('jack self-explosion destroys only its own rig instead of leaving a corpse; ordinary explosions retain other actors',()=>{
 class Burst {position={set(){}};circle(){return this}fill(){return this}}
 const h=harness('scene.ts','Scene',['event'],'actors=new Map();effects=[];explosions=[];world={addChild(){}};time=0;',{Graphics:Burst});
 const destroyed:number[]=[];for(const id of [7,8])h.actors.set(`z${id}`,{root:{destroy(){destroyed.push(id)}}});
 h.event({kind:'explode',x:200,y:100,zombieId:7});assert.deepEqual(destroyed,[7]);assert.ok(!h.actors.has('z7'));assert.ok(h.actors.has('z8'));assert.equal(h.effects.length,1);
 h.event({kind:'explode',x:200,y:100});assert.deepEqual(destroyed,[7]);assert.ok(h.actors.has('z8'));
 h.event({kind:'swallow',x:200,y:100,zombieId:8});assert.deepEqual(destroyed,[7,8]);
});
test('failed resource work rejects its caller while later board and actor requests can retry',async()=>{
 const h=scene(),failure=new Error('offline'),calls:string[]=[];
 h.loadBoard=async()=>{calls.push('failed');throw failure;};await assert.rejects(h.prepareBoard({},()=>{}),e=>e===failure);
 h.loadBoard=async()=>{calls.push('board');};h.loadActors=async()=>{calls.push('actors');};
 await assert.doesNotReject(h.prepareBoard({},()=>{}));await h.prepareActors({},()=>{});assert.deepEqual(calls,['failed','board','actors']);
});
test('release still clears resources after failed actor work and does not race another board',async()=>{
 const h=scene(),failure=new Error('upload'),gate=deferred<void>(),calls:string[]=[];
 h.loadActors=async()=>{throw failure;};await assert.rejects(h.prepareActors({},()=>{}));
 h.clearResources=async()=>{calls.push('clear');await gate.promise;calls.push('cleared');};h.loadBoard=async()=>{calls.push('board');};
 const release=h.release(),board=h.prepareBoard({},()=>{});await turn();const before=[...calls];gate.resolve();await Promise.all([release,board]);
 assert.deepEqual(before,['clear']);assert.deepEqual(calls,['clear','cleared','board']);
});
test('a failed batch stops scheduling but waits for all active work before allowing cleanup',async()=>{
 const gate=deferred<void>(),failure=new Error('download'),started:number[]=[];let finished=false,settled=false;
 const task=loadInBatches([0,1,2,3],2,async item=>{started.push(item);if(item===0)throw failure;await gate.promise;finished=true;}).catch(e=>{settled=true;return e;});
 await turn();const early=settled;gate.resolve();const result=await task;
 assert.equal(early,false);assert.equal(finished,true);assert.equal(result,failure);assert.deepEqual(started,[0,1]);
});
function atlasHarness(family:'plant'|'actor'|'giant',fetcher:(url:string)=>unknown,loader:(asset:{src:string;data:{resolution:number}})=>unknown,metadata:Record<string,string>={}){
 const removed:string[]=[],destroyed:unknown[]=[];
 class Texture {source:unknown;constructor(options:{source:unknown}){this.source=options.source;}destroy(){destroyed.push(this);}}
 const bindings={fetch:fetcher,Assets:{load:loader,unload:async(src:string)=>{removed.push(src);}},Texture,Rectangle:class{},hasActorMotion:()=>true,ACTOR_MOTION:{walk:'normal'},ACTOR_METADATA:metadata};
 const h=family==='plant'?harness('plant-motion.ts','PlantMotion',['prepare','unload','destroy'],'loaded=new Map();base="/fixture/";',bindings):family==='actor'?harness('actor-motion.ts','ActorMotion',['prepare','unload','destroy'],'loaded=new Map();base="/fixture/";',bindings):harness('giant-motion.ts','GiantMotion',['prepare','destroy'],'loaded=undefined;base="/fixture/gargantuar";',bindings);
 return {h,removed,destroyed,run:(upload:(value:unknown)=>Promise<void>)=>family==='giant'?h.prepare(true,upload):h.prepare([family==='plant'?'peashooter':'walk'],()=>{},upload)};
}
test('updated actor metadata uses its independent URL while the existing classic atlas is loaded only once',async()=>{
 const metadata:string[]=[],images:string[]=[];
 const h=atlasHarness('actor',async url=>{metadata.push(url);return {ok:true,json:async()=>({frames:{part:[0,0,1,1]}})};},async asset=>{images.push(asset.src);return {source:{}};},{normal:'normal-version2.json'});
 await h.run(async()=>{});await h.run(async()=>{});await h.h.destroy();
 assert.deepEqual(metadata,['/fixture/normal-version2.json']);assert.deepEqual(images,['/fixture/normal.classic.webp']);assert.deepEqual(h.removed,images);
});
for(const family of ['plant','actor','giant'] as const){
 test(`${family} original-size atlas uses one-pixel resolution and releases its actual source URL`,async()=>{
  const requests:{src:string;data:{resolution:number}}[]=[];
  const h=atlasHarness(family,async()=>({ok:true,json:async()=>({frames:{part:[0,0,1,1]}})}),async asset=>{requests.push(asset);return {source:{}};});
  await h.run(async()=>{});await h.h.destroy();assert.equal(requests[0].data.resolution,1);assert.ok(requests[0].src.endsWith('.classic.webp'));assert.equal(h.removed[0],requests[0].src);
 });
 test(`${family} atlas waits for and unloads an image that finishes after metadata failed`,async()=>{
  const gate=deferred<unknown>(),failure=new Error('metadata'),atlas={source:{}};let loads=0,settled=false;
  const h=atlasHarness(family,()=>Promise.reject(failure),()=>{loads++;return gate.promise;});
  const task=h.run(async()=>{}).catch(e=>{settled=true;return e;});await turn();const early=settled;gate.resolve(atlas);const result=await task;
  assert.equal(early,false);assert.equal(result,failure);assert.equal(loads,1);assert.equal(h.removed.length,1);
 });
 test(`${family} atlas upload failure releases its texture and can retry`,async()=>{
  const failure=new Error('GPU'),h=atlasHarness(family,async()=>({ok:true,json:async()=>({frames:{part:[0,0,1,1]}})}),async()=>({source:{}}));
  await assert.rejects(h.run(async()=>{throw failure;}),e=>e===failure);assert.equal(h.removed.length,1);assert.equal(h.destroyed.length,1);
  await h.run(async()=>{});assert.ok(family==='giant'?h.h.loaded:h.h.loaded.size===1);
 });
}
test('failed animation metadata is fetched again on actor retry',async()=>{
 let requests=0;const failure=new Error('metadata');
 const h=scene({fetch:async()=>{if(++requests===1)throw failure;return {ok:true,json:async()=>({animations:{}})};}},true);
 await assert.rejects(h.prepareActors(emptyGame,()=>{}),e=>e===failure);await h.prepareActors(emptyGame,()=>{});assert.equal(requests,2);
});
test('partially loaded effect pages are unloaded even before clips are registered',async()=>{
 const failure=new Error('page'),removed:string[][]=[];
 const animations=Object.fromEntries(['first','second'].map(name=>[name,{pages:[name+'.webp'],frames:[[0,0,0,1,1]],durations:[1],anchor:[0,0]}]));
 const h=scene({fetch:async()=>({ok:true,json:async()=>({animations})}),animationNames:()=>['first','second'],Assets:{load:async({src}:{src:string})=>{if(src.endsWith('second.webp'))throw failure;return {source:{}};},unload:async(src:string[])=>{removed.push(src);}}},true);
 await assert.rejects(h.prepareActors(emptyGame,()=>{}),e=>e===failure);assert.equal(removed.flat().filter(s=>s.endsWith('first.webp')).length,1);assert.equal(Object.keys(h.clips).length,0);
});
test('failed boss preparation destroys the partially loaded boss before retry',async()=>{
 const failure=new Error('boss');let cleared=0;
 const h=scene({BossArt:class {async load(){throw failure;}async destroy(){cleared++;}}},true);
 await assert.rejects(h.prepareActors({...emptyGame,boss:{}},()=>{}),e=>e===failure);assert.equal(cleared,1);
});
test('failed board texture upload is not registered as ready and is released before retry',async()=>{
 const failure=new Error('upload'),removed:string[]=[];let loads=0,uploads=0;
 const h=scene({NATIVE_SCENERY:new Set(),Assets:{load:async()=>{loads++;return {source:{}};},unload:async(src:string)=>{removed.push(src);}}},false,true);
 h.app.renderer.prepare.upload=async()=>{if(++uploads===1)throw failure;};
 await assert.rejects(h.prepareTextures({mower:'mower.webp'},()=>{}),e=>e===failure);assert.equal(Object.keys(h.textures).length,0);assert.equal(removed.length,1);
 await h.prepareTextures({mower:'mower.webp'},()=>{});assert.equal(loads,2);assert.equal(h.textureFiles.length,1);
});

test('independent actor resource families start while combat textures are still pending',async()=>{
 const gate=deferred<void>(),started:string[]=[];
 const h=scene({fetch:async()=>{started.push('metadata');return {ok:true,json:async()=>({animations:{}})};}},true);
 h.prepareTextures=async()=>{started.push('textures');await gate.promise;};
 h.plantMotion.prepare=async()=>{started.push('plants');};h.actorMotion.prepare=async()=>{started.push('actors');};h.peaArt.prepare=async()=>{started.push('pea-heads');};
 const work=h.prepareActors(emptyGame,()=>{});await turn();const early=[...started];gate.resolve();await work;
 assert.deepEqual(new Set(early),new Set(['textures','plants','metadata','actors','pea-heads']));
});
test('an actor family failure cannot finish resource work before another active family has settled',async()=>{
 const gate=deferred<void>(),failure=new Error('texture download');let settled=false,finished=false;
 const h=scene({fetch:async()=>({ok:true,json:async()=>({animations:{}})})},true);
 h.prepareTextures=async()=>{throw failure;};h.plantMotion.prepare=async()=>{await gate.promise;finished=true;};
 const work=h.prepareActors(emptyGame,()=>{}).catch(e=>{settled=true;return e;});await turn();const early=settled;gate.resolve();const result=await work;
 assert.equal(early,false);assert.equal(finished,true);assert.equal(result,failure);
});
