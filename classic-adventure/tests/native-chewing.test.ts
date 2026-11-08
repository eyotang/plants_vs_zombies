import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Zombie,type Plant} from '../src/game/model';
import {cellX} from '../src/game/config';

function fixture(kind:Zombie['kind']='normal',plantKind:Plant['kind']='sunflower',x=390,backwards=false){
 const g=new Game(9,1);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));
 const p=g.plants[0];Object.assign(p,{kind:plantKind,column:4,row:0,actionIn:10000});
 const z:Zombie={id:900,kind,row:0,x,health:kind==='yeti'?1350:kind==='jack'||kind==='ladder'?500:270,armor:0,shield:0,speed:0,biteIn:1,eating:false,wave:0,hitAt:-100,chillIn:0,frozenIn:0,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0,backwards,metalRemoved:true,yetiIn:10000};
 g.zombies=[z];return {g,p,z};
}
test('ordinary ground chewing starts only with twenty pixels of native attack/plant overlap',()=>{
 for(const kind of ['normal','football','jack','newspaper','yeti','ladder'] as const)for(const plantKind of ['sunflower','tallnut','pumpkin','cobcannon'] as const)for(const backwards of [false,true])for(const x of [300,339,340,349,350,359,360,379,380,389,390,391,410,411,430,460,461,500]){
  const {g,p,z}=fixture(kind,plantKind,x,backwards);
  const offset=kind==='ladder'?10:kind==='jack'||kind==='newspaper'||kind==='yeti'?20:50;
  const width=kind==='jack'||kind==='newspaper'||kind==='yeti'||kind==='ladder'?50:20;
  const attackLeft=Math.trunc(x-30)+(backwards?120-offset-width:offset);
  const plantLeft=cellX(4)-(plantKind==='pumpkin'||plantKind==='cobcannon'?40:30),plantWidth=plantKind==='tallnut'?80:plantKind==='cobcannon'?140:60;
  const eats=Math.min(attackLeft+width,plantLeft+plantWidth)-Math.max(attackLeft,plantLeft)>=20;
  g.step();assert.equal(z.eating,eats,`${kind}/${plantKind}/${backwards}/${x}`);assert.equal(p.health,eats?296:300);
 }
});
test('a protected ordinary plant is eaten after its pumpkin, while an unsupported ground spike is ignored',()=>{
 const {g,p,z}=fixture('normal','sunflower',380);const pumpkin={...p,id:902,kind:'pumpkin' as const,health:4000};g.plants.push(pumpkin);g.step();assert.equal(p.health,300);assert.equal(pumpkin.health,3996);
 const second=fixture('normal','spikeweed',380);second.g.step();assert.equal(second.z.eating,false);
 const supported=fixture('normal','spikeweed',380);supported.g.plants.push({...supported.p,id:903,kind:'flowerpot'});supported.g.step();assert.equal(supported.z.eating,true);assert.equal(supported.p.health,296);assert.equal(supported.g.plants.find(p=>p.kind==='flowerpot')!.health,300);
});
test('ladder placement keeps the native contact position and rechecks its plant before consuming the ladder',()=>{
 for(const survives of [false,true]){
  const {g,p,z}=fixture('ladder','pumpkin',420);z.shield=500;g.step();assert.equal(z.ladderIn,100);assert.equal(z.x,420);assert.equal(z.eating,false);
  if(!survives)g.plants=[];
  for(let i=0;i<100;i++)g.step();
  assert.equal(z.shield,survives?0:500);assert.deepEqual(g.ladders,survives?[{column:4,row:0}]:[]);assert.equal(p.health,300);
 }
});
