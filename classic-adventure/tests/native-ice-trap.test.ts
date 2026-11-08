import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import vm from 'node:vm';import ts from 'typescript';
import {Container,Sprite,Texture} from 'pixi.js';import {Game} from '../src/game/model';import {combatTextureFiles} from '../src/rendering/asset-plan';
const root=new URL('../public/assets/runtime/particles/',import.meta.url),close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function harness(){const ast=ts.createSourceFile('scene.ts',readFileSync(new URL('../src/rendering/scene.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true),klass=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Scene') as ts.ClassDeclaration,method=klass.members.find(n=>n.name?.getText(ast)==='updateIceTrap');assert.ok(method);const ctx=vm.createContext({Sprite,Texture});vm.runInContext(ts.transpileModule(`class Harness{textures={iceTrapFront:Texture.EMPTY,iceTrapBack:Texture.EMPTY};${method.getText(ast)}};var h=new Harness()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.h;}
function actor(){const root=new Container(),visual=new Container(),body=new Container();root.addChild(visual);visual.addChild(body);return {root,visual,body,iceTrap:undefined as undefined|{back:Sprite,front:Sprite}};}
test('native ice-trap PNGs retain fixed source bytes and54x30 transparent dimensions',()=>{
 for(const [file,hash] of [['ice-trap-front.png','b89333d1a8085063c692d6f27002fd7e6f16f0d25202f04ac8d6f7804e90c413'],['ice-trap-back.png','888cdd1cbb7debefa597e0622e1342ee0cb02a28c41159e260da19962c88ba0b']]){const bytes=readFileSync(new URL(file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);assert.equal(bytes.readUInt32BE(16),54);assert.equal(bytes.readUInt32BE(20),30);assert.ok([4,6].includes(bytes[25]),'native alpha channel');}
});
test('ice overlay planning is lazy and covers selected ice, imitation, drops and resumed frozen zombies',()=>{
 const g=new Game(9,23);assert.equal(combatTextureFiles(new Game(1,23)).iceTrapFront,undefined);g.seeds=['snowpea','wintermelon'];assert.equal(combatTextureFiles(g).iceTrapFront,undefined);
 for(const setup of [(g:Game)=>g.seeds.push('iceshroom'),(g:Game)=>{g.seeds=['imitater'];g.imitaterTarget='iceshroom'},(g:Game)=>g.seedDrops.push({id:999,kind:'iceshroom',column:0,row:0,remaining:100,timesDropped:0}),(g:Game)=>{const z=g['spawnZombie']('normal',0,300,0);z.frozenIn=100}]){const g=new Game(9,23);setup(g);const f=combatTextureFiles(Game.restore(g.snapshot()));assert.equal(f.iceTrapFront,'particles/ice-trap-front.png');assert.equal(f.iceTrapBack,'particles/ice-trap-back.png');}
});
test('actual Scene overlay uses integer source coordinates and species scaling without reflection or miniature distortion',()=>{
 const h=harness();
 for(const level of [9,41] as const)for(const kind of ['normal','football','gargantuar','catapult','pogo','digger','bungee','balloon'] as const)for(const reverse of [false,true])for(const mini of [false,true])for(const fill of [false,true]){
  const g=new Game(level,23),z=g['spawnZombie'](kind,0,300.75,0);z.x=300.75;z.row=0;z.frozenIn=100;z.backwards=reverse;z.mini=mini;z.flying=false;z.popIn=0;z.underground=false;if(z.bungee)z.bungee.phase='wait';if(kind==='pogo'){z.pogo=false;z.pogoState={phase:'fall',altitude:17,remaining:0,animTime:0};}
  const a=actor();a.root.position.set(200.25,150.5);a.root.scale.set((reverse?-1:1)*(mini?.5:1),mini?.5:1);a.visual.scale.set(fill?.7:1,fill?.9:1);h.updateIceTrap(a,g,z);
  const dx=kind==='pogo'?36:kind==='gargantuar'?26:kind==='bungee'?1:kind==='digger'?19:kind==='catapult'?78:kind==='balloon'?37:46,dy=kind==='pogo'?112:kind==='gargantuar'?85:kind==='bungee'?69:kind==='balloon'?119:92,scale=kind==='gargantuar'?1.6:kind==='bungee'?1.2:1;
  const ground=(level===41?40+Math.max(0,440-(z.x+10))*.25:50)-(kind==='pogo'?16:kind==='balloon'?30:0);
  for(const sprite of [a.iceTrap!.back,a.iceTrap!.front]){close(a.root.x+a.root.scale.x*a.visual.scale.x*sprite.x,270+dx);close(a.root.y+a.root.scale.y*a.visual.scale.y*sprite.y,Math.trunc(ground)-(kind==='pogo'?17:0)+dy);close(a.root.scale.x*sprite.scale.x,scale);close(a.root.scale.y*sprite.scale.y,scale);assert.equal(sprite.visible,true);}
  assert.equal(a.visual.children[0],a.iceTrap!.back);assert.equal(a.visual.children.at(-1),a.iceTrap!.front);a.root.destroy({children:true});
 }
});
test('freeze/thaw cycles reuse two sprites, keep front/back around replacement body parts, and hide pool ice',()=>{
 const h=harness(),g=new Game(21,23),z=g['spawnZombie']('normal',0,400,0),a=actor();h.updateIceTrap(a,g,z);assert.equal(a.iceTrap,undefined);
 z.frozenIn=100;h.updateIceTrap(a,g,z);const pair=a.iceTrap!,nodes=[...a.visual.children];for(let i=0;i<100;i++)h.updateIceTrap(a,g,z);assert.deepEqual(a.visual.children,nodes);
 z.frozenIn=0;h.updateIceTrap(a,g,z);assert.equal(pair.front.visible,false);z.frozenIn=100;a.visual.addChild(new Container());h.updateIceTrap(a,g,z);assert.equal(a.iceTrap,pair);assert.equal(pair.front.visible,true);assert.equal(a.visual.children.at(-1),pair.front);
 z.row=2;h.updateIceTrap(a,g,z);assert.equal(pair.back.visible,false);assert.equal(pair.front.visible,false);z.x=850;h.updateIceTrap(a,g,z);assert.equal(pair.front.visible,true,'on the street in a pool lane is not yet in the pool');
 a.root.destroy({children:true});assert.equal(pair.front.destroyed,true);assert.equal(pair.back.destroyed,true);
});
