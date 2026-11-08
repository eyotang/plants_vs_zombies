import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Zombie} from '../src/game/model';
function fixture(kind:Zombie['kind'],x:number,center=300.8){
 const g=new Game(9,1);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));
 const p=g.plants[0];Object.assign(p,{kind:'squash',column:4,row:0,squash:{remaining:6,x:center,target:900}});
 const z:Zombie={id:900,kind,row:0,x,health:270,armor:0,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,frozenIn:10000,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0};g.zombies=[z];return {g,p,z};
}
test('squash damages native body rectangles, with strict ordinary edges and the source football tolerance',()=>{
 // Plant::GetPlantAttackRect at target top-left 260 is [280,325].
 // Normal body=[x+6,x+48]; football body=[x+20,x+77].
 for(const [kind,x,hit] of [['normal',232,false],['normal',233,true],['normal',318,true],['normal',319,false],['football',183,false],['football',184,true],['football',324,true],['football',325,false]] as const){
  const {g,z}=fixture(kind,x);g.step();assert.equal(z.health<=0,hit,`${kind}/${x}`);
 }
});
test('the observed vase football is hit by the falling squash despite being beyond the old center radius',()=>{
 const {g,z}=fixture('football',612.9331595117114,678);z.armor=1320;g.step();
 assert.ok(z.health<=0);assert.equal(z.armor,0);assert.equal(g.kills,1);
});
test('native squash acquisition uses rectangle gaps and preserves the source rear and pole restrictions',()=>{
 for(const [kind,x,eating,pole,hit] of [['normal',331,false,false,false],['normal',332,false,false,true],['normal',489,false,false,true],['normal',490,false,false,false],['normal',529,true,false,true],['normal',530,true,false,false],['football',242,false,false,false],['football',243,false,false,true],['football',475,false,false,true],['football',476,false,false,false],['pole',350,false,true,true],['pole',400,false,true,false]] as const){
  const {g,p,z}=fixture(kind,x);p.squash=undefined;z.eating=eating;z.hasPole=pole;g.step();assert.equal(!!p.squash,hit,`${kind}/${x}/${eating}/${pole}`);
 }
});
test('native squash prioritizes greatest rectangle overlap but keeps an eligible existing target',()=>{
 for(const retain of [false,true]){
  const {g,p,z}=fixture('normal',380);const football={...z,id:901,kind:'football' as const,x:350};g.zombies.push(football);
  p.squash=retain?{remaining:61,x:400,target:z.id}:undefined;g.step();assert.equal(p.squash?.target,retain?z.id:football.id);
 }
});
