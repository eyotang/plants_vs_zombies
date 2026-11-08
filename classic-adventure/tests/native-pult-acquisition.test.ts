import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant} from '../src/game/model';import {cellX} from '../src/game/config';
const plant=(kind:Plant['kind']='cabbagepult',column=0):Plant=>({id:9000,kind,column,row:0,health:300,born:0,shotAt:-100,actionIn:100000});
function fixture(kind:Plant['kind']='cabbagepult',column=0){const g=new Game(49,23),p=plant(kind,column);g.plants=[p];return {g,p};}
function shoot(g:Game,p:Plant){g['fireLob'](p);return g.peas.at(-1)?.lob?.target;}
test('pults acquire touching integer body rectangles throughout the native 800-pixel attack span',()=>{
 for(const pk of ['cabbagepult','kernelpult','melonpult','wintermelon'] as const)for(const kind of ['normal','football','gargantuar','catapult'] as const)for(const backwards of [false,true])for(const column of [0,4]){
  const width=kind==='football'?57:kind==='gargantuar'?125:kind==='catapult'?153:42;
  const offset=kind==='football'?50:kind==='gargantuar'?-17:kind==='catapult'?0:36;
  const dx=backwards?(kind==='gargantuar'?180:120)-offset-width:offset,left=cellX(column)+20,right=left+800;
  for(const [x,hit] of [[left-width-dx+30,true],[left-width-dx+29,false],[right-dx+30.99,true],[right-dx+31,false]] as const){
   const {g,p}=fixture(pk,column),z=g['spawnZombie'](kind,0,x,0);z.backwards=backwards;
   assert.equal(shoot(g,p),hit?z.id:undefined,`${pk}/${kind}/${backwards}/${column}/${x}`);
  }
 }
});
test('pults prefer the smallest integer body left and preserve source iteration ties',()=>{
 const {g,p}=fixture();const car=g['spawnZombie']('catapult',0,200,0),normal=g['spawnZombie']('normal',0,190,0);
 assert.equal(shoot(g,p),car.id,'the longer vehicle reaches left of the smaller center X');
 g.peas=[];g.zombies=[];const a=g['spawnZombie']('normal',0,200.9,0);g['spawnZombie']('normal',0,200.1,0);
 assert.equal(shoot(g,p),a.id,'equal integer left retains the first zombie');
});
test('winter preparation uses the same acquisition bounds and keeps off-ground and legacy exclusions',()=>{
 const {g,p}=fixture('wintermelon'),z=g['spawnZombie']('catapult',0,0,0);g['fireLob'](p,true);assert.equal(p.winterLaunchIn,36);
 for(const state of [{health:0},{hypnotized:true},{vaultIn:10},{riseIn:10},{flight:{remaining:100}}]){
  const {g,p}=fixture(),z=g['spawnZombie']('normal',0,200,0);Object.assign(z,state);assert.equal(shoot(g,p),undefined);
 }
 const legacy=fixture();const mini=legacy.g['spawnZombie']('normal',0,70,0);mini.mini=true;assert.equal(shoot(legacy.g,legacy.p),undefined);mini.x=71;assert.equal(shoot(legacy.g,legacy.p),mini.id);
});
