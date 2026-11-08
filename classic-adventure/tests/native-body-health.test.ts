import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,headless,type Zombie} from '../src/game/model';
import {zombieHealthFraction} from '../src/rendering/zombie-health';

const spawn=(g:Game,kind:Zombie['kind'])=>(g as unknown as {spawnZombie(k:Zombie['kind'],r:number,x:number,w:number):Zombie}).spawnZombie(kind,0,650,0);
// ZombieInitialize gives pogo 500 body health before miniature rounding.
test('native pogo body health and health bar survive loss of its pogo object',()=>{
 for(const level of [9,25] as const){
  const g=new Game(level,23),z=spawn(g,'pogo'),maximum=level===25?125:500;
  assert.equal(z.health,maximum);assert.equal(zombieHealthFraction(z),1);
  (g as any).damageZombie(z,20);assert.equal(z.health,maximum-20);
  assert.equal(zombieHealthFraction(z),(maximum-20)/maximum);
  z.pogo=false;z.metalRemoved=true;
  assert.equal(zombieHealthFraction(z),(maximum-20)/maximum);
 }
});
// UpdateDamageStates compares against integer mBodyMaxHealth / 3.
test('native decapitation thresholds retain the head at the exact integer boundary',()=>{
 for(const [kind,maximum] of [['normal',270],['pole',500],['dancer',500],['dolphin',500],['jack',500],['ladder',500],['pogo',500],['yeti',1350]] as const)for(const mini of [false,true]){
  const g=new Game(mini?25:9,23),z=spawn(g,kind),threshold=Math.trunc(Math.trunc(maximum/(mini?4:1))/3);
  z.health=threshold;assert.equal(headless(z),false,`${kind}/${mini}: boundary headed`);
  z.health=threshold-1;assert.equal(headless(z),true,`${kind}/${mini}: below boundary headless`);
 }
});
test('headless pogo uses native body decay before and after losing its object',()=>{
 for(const mini of [false,true])for(const pogo of [false,true]){
  const g=new Game(31,23);for(const k of ['sunshroom','puffshroom','seashroom','lilypad','fumeshroom','doomshroom'] as const)g.chooseSeed(k);g.start();
  g.select('puffshroom');assert.ok(g.plant(0,0));g.plants[0].actionIn=1000;
  const z=spawn(g,'pogo'),health=mini?40:165;Object.assign(z,{health,pogo,mini});
  Object.defineProperty(g,'random',{value:()=>0});
  g.step();assert.equal(z.health,health-(mini?1:3));
 }
});
