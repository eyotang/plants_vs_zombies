import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Zombie,type Plant} from '../src/game/model';
function fixture(kind:Zombie['kind'],airborne:boolean,base=false){
 const g=new Game(kind==='dolphin'?21:9,1);for(const kind of g.config.seeds.slice(0,6))g.chooseSeed(kind);g.start();g.select('sunflower');assert.ok(g.plant(0,4));
 const row=kind==='dolphin'?2:0,p=g.plants[0];p.kind='squash';p.column=1;p.row=row;p.squash={remaining:airborne?61:62,x:180,target:900};
 if(base)g.plants.unshift({id:901,kind:'flowerpot',column:1,row:0,health:300,actionIn:0,born:0,shotAt:-100} satisfies Plant);
 const z:Zombie={id:900,kind,row,x:180,health:500,armor:0,shield:0,speed:0,biteIn:1,eating:false,wave:0,hitAt:-100,chillIn:0,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0};
 if(kind==='normal')z.x=150; // Native twenty-pixel chew rectangle is in contact with column 1.
 if(kind==='gargantuar')z.giant={thrown:true,phase:'smash',remaining:49};
 if(kind==='catapult')z.catapult={ammo:0,phase:'walk',remaining:0};
 if(kind==='bobsled'){z.sled=900;z.armor=100;g.iceTrails=[{row:0,x:0,remaining:1000}];}
 if(kind==='bungee')z.bungee={phase:'wait',remaining:1,column:1};
 g.zombies=[z];return {g,p,z};
}
test('airborne squash is excluded from chewing, vehicle crushing, giant smash and bungee theft',()=>{
 for(const kind of ['normal','zomboni','catapult','bobsled','gargantuar','bungee'] as const)for(const air of [false,true]){
  const {g,p}=fixture(kind,air);g.step();
  // Plant::Squish also protects an active squash before takeoff. Bungee theft
  // uses a different path and can still remove a grounded plant.
  assert.equal(p.health,!air&&kind==='bungee'?0:300,`${kind}, airborne=${air}`);
 }
});
test('pole and dolphin vaults do not treat airborne squash as a ground barrier',()=>{
 for(const kind of ['pole','dolphin'] as const)for(const air of [false,true]){
  const {g,z}=fixture(kind,air);if(kind==='pole')z.hasPole=true;else z.dolphin=true;g.step();
  assert.equal(kind==='pole'?z.hasPole:z.dolphin,air,`${kind}, airborne=${air}`);
 }
});
test('smashing the roof pot cannot destroy a squash that has already jumped',()=>{
 const {g,p}=fixture('gargantuar',true,true),pot=g.plants[0];g.step();
 assert.equal(pot.health,0);assert.equal(p.health,300);assert.ok(g.plants.includes(p));
});
test('a basketball landing also ignores an airborne squash',()=>{
 for(const air of [false,true]){
  const {g,p,z}=fixture('normal',air);z.x=650;z.biteIn=4;
  g.peas=[{id:902,row:0,x:160,y:100,age:119,ice:false,puff:false,lob:{kind:'basketball',target:p.id,startX:160,endX:160,startY:100,endY:100,duration:120}}];
  g.step();assert.equal(p.health,air?300:225);
 }
});
