import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Zombie} from '../src/game/model';

function fixture(kind:Zombie['kind']='normal',backwards=false){
 const g=new Game(9,1);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));g.plants[0].actionIn=10000;
 const z:Zombie={id:900,kind,row:0,x:200.75,health:270,armor:0,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,frozenIn:10000,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0,backwards};g.zombies=[z];return {g,z};
}
test('ordinary and snow peas use prior integer source rectangles against native ground bodies in both directions',()=>{
 for(const kind of ['normal','football','catapult','gargantuar'] as const)for(const backwards of [false,true])for(const ice of [false,true])for(const direction of [-1,1])for(const touching of [false,true]){
  const {g,z}=fixture(kind,backwards),width=kind==='football'?57:kind==='catapult'?153:kind==='gargantuar'?125:42;
  const offset=kind==='football'?50:kind==='catapult'?0:kind==='gargantuar'?-17:36;
  const left=170+(backwards?(kind==='gargantuar'?180:120)-offset-width:offset),right=left+width;
  // Pea image width is 28. Its model X is the image center; native mX is 14 left.
  // Native GetProjectileRect is [mX-15,mX+40], sampled before the new position.
  const center=direction===1?left-26-(touching?0:.01):right+29+(touching?0:1);
  g.peas=[{id:999,row:0,x:center,vx:direction*3.33,age:0,ice,puff:false}];g.step();
  assert.equal(z.health,touching?250:270,`${kind}/${backwards}/${ice}/${direction}/${touching}`);
  if(!touching){assert.equal(g.peas.length,1);g.step();assert.equal(z.health,250,'the next integer rectangle reaches the edge');}
 }
});
test('equal integer body positions preserve source iteration order rather than choosing the smaller fractional X',()=>{
 const {g,z}=fixture();z.x=200.9;const second={...z,id:901,x:200.1};g.zombies=[z,second];g.peas=[{id:999,row:0,x:210,age:0,ice:false,puff:false}];g.step();
 assert.equal(z.health,250);assert.equal(second.health,270);
});
