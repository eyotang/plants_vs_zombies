import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant,type Zombie} from '../src/game/model';import {cellX}from'../src/game/config';import{createPeaMotion,type PeaKind}from'../src/game/pea-motion';
const body:Record<string,[number,number,number]>={normal:[36,42,120],football:[50,57,120],gargantuar:[-17,125,180],catapult:[0,153,120],zomboni:[0,153,120],snorkel:[12,62,120],digger:[50,28,120],bungee:[-20,110,120],bobsled:[-50,275,120],dolphin:[20,42,120]};
function fixture(kind:Zombie['kind']='normal',water=false,backwards=false){const g=new Game(water?31:9,23);g.phase='playing';g.started=true;g.waveIn=100000;const z:Zombie={id:900,kind,row:2,x:700,health:10000,armor:0,shield:0,speed:0,biteIn:4,eating:kind==='snorkel',wave:0,hitAt:-100,chillIn:0,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0,backwards,frozenIn:100000,...(kind==='bungee'?{bungee:{phase:'wait' as const,remaining:10000,column:0}}:{}),...(kind==='bobsled'?{sled:900}:{}),...(kind==='dolphin'?{dolphin:false}:{})};g.zombies=[z];return{g,z};}
function shooter(kind:PeaKind,column=4):Plant{return{id:901,kind,column,row:2,health:300,actionIn:0,born:0,shotAt:-100,peaMotion:createPeaMotion(kind,17.5)}}

test('five pea families acquire at native body edges, including contact, rear bounds and offscreen zombies',()=>{
 for(const kind of ['peashooter','snowpea','repeater','gatlingpea','splitpea']as const)for(const column of [0,4,8])for(const zk of Object.keys(body)as Zombie['kind'][])for(const backwards of [false,true])for(const rear of kind==='splitpea'?[false,true]:[false]){
  const{g,z}=fixture(zk,zk==='snorkel'||zk==='dolphin',backwards),p=shooter(kind,column),[offset,width,spriteWidth]=body[zk],localLeft=backwards?spriteWidth-offset-width:offset;
  const attackLeft=rear?0:cellX(column)+20,attackRight=rear?cellX(column)-24:cellX(column)+820;
  for(const [rawX,expected]of [[attackLeft-localLeft-width-1,false],[attackLeft-localLeft-width,true],[attackRight-localLeft,true],[attackRight-localLeft+1,false]]as const){z.x=rawX+30+(rawX<0?-.75:.75);assert.equal((g as any).peaTarget(p,rear),expected,`${kind}/c${column}/${zk}/${backwards}/${rear}/raw${rawX}`);}
 }
});

test('native acquisition keeps ground damage eligibility and row restrictions',()=>{
 const{g,z}=fixture(),p=shooter('peashooter');assert.equal((g as any).peaTarget(p),true);
 for(const patch of [{row:1},{health:0},{hypnotized:true},{vaultIn:1},{riseIn:1},{underground:true},{emergingIn:1},{flight:{remaining:10,duration:10,startX:700,endX:100}},{kind:'balloon',flying:true},{kind:'snorkel',eating:false}]){const old={...z};Object.assign(z,patch);if(patch.kind==='snorkel')Object.assign(g,{config:{...g.config,environment:'pool'}});assert.equal((g as any).peaTarget(p),false,JSON.stringify(patch));g.zombies=[{...old}];Object.assign(z,old);g.zombies=[z];}
});

test('actual model starts source windup for an offscreen target rather than waiting for center825',()=>{
 for(const kind of ['peashooter','snowpea','gatlingpea']as const){const{g,z}=fixture();z.x=900;g.plants=[shooter(kind)];g.step();assert.equal(g.plants[0].peaMotion!.heads[0].phase,'shoot',kind);assert.equal(g.peas.length,0);}
});

test('ordinary and snow peas collide against source horizontal bodies in water, special and mini cases',()=>{
 for(const zk of ['normal','snorkel','digger','bungee','bobsled','dolphin']as const)for(const water of [false,true])for(const backwards of [false,true])for(const mini of [false,true])for(const ice of [false,true]){
  const{g,z}=fixture(zk,water,backwards);z.x=400.75;z.mini=mini;const[offset,width,spriteWidth]=body[zk],left=370+(backwards?spriteWidth-offset-width:offset);
  g.peas=[{id:999,row:2,x:left-26,age:0,ice,puff:false}];g.step();assert.equal(z.health,9980,`${zk}/${water}/${backwards}/${mini}/${ice}`);
 }
});
