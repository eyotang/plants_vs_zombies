import test from'node:test';import assert from'node:assert/strict';import{Game,type Pea,type Plant,type Zombie}from'../src/game/model';import{cellX}from'../src/game/config';
function fixture(rawX:number,patch:Partial<Pea>={},column=3){
 const g=new Game(29,23);g.phase='playing';g.started=true;g.waveIn=100000;
 const tree:Plant={id:901,kind:'torchwood',row:0,column,health:300,actionIn:0,born:0,shotAt:-100};g.plants=[tree];
 const pea:Pea={id:902,row:0,x:rawX+14,age:0,ice:false,puff:false,...patch};g.peas=[pea];return{g,tree,pea};
}
function enemy(x:number):Zombie{return{id:903,kind:'normal',row:0,x,health:1000,armor:0,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0,frozenIn:10000};}

test('torchwood conversion uses prior integer pea rectangles with inclusive10px overlap at both edges',()=>{
 const left=cellX(3)+10,right=left+30;
 for(const [rawX,convert]of [[left-31,false],[left-30,true],[left-30+.99,true],[right+5,true],[right+5.99,true],[right+6,false]]as const){
  const{g,pea}=fixture(rawX);g.step();assert.equal(!!pea.fire,convert,String(rawX));
 }
 // At the right edge: pea left=x-15;10px overlap ends at x=right+5.
});

test('straight peas wait for fire at strict look-ahead overlap greater than10; backward and curved peas do not',()=>{
 const first=cellX(3)+10-80+10;
 for(const [rawX,patch,defer]of [[first,{},false],[first+1,{},true],[first+1,{vx:-3.33},false],[first+1,{nativePea:{rawX:first+1,rawY:100,vy:0,shadowY:157}},false]]as const){
  const{g,pea}=fixture(rawX,patch),z=enemy(rawX+30);g.zombies=[z];g.step();assert.equal(z.health,defer?1000:980,JSON.stringify(patch));assert.equal(g.peas.includes(pea),defer);
 }
 const{g,pea}=fixture(first+1),z=enemy(first+31);g.zombies=[z];for(let n=0;n<30&&g.peas.includes(pea);n++)g.step();assert.equal(z.health,960);assert.ok(pea.fire);
 const reverse=fixture(460,{ice:true,vx:-3.33,nativePea:{rawX:460,shadowY:157}},5);reverse.g.plants.push({...reverse.tree,id:904,column:3});const close=enemy(310);reverse.g.zombies=[close];for(let n=0;n<70;n++)reverse.g.step();assert.equal(close.health,980);assert.equal(reverse.pea.fire,undefined,'reverse shot hits before reaching the second tree');
});

test('ice peas melt once per column and another tree ignites them in either direction',()=>{
 for(const backwards of [false,true]){
  const first=backwards?5:3,next=backwards?3:5,{g,tree,pea}=fixture(cellX(first)-20,{ice:true,...(backwards?{vx:-3.33}:{})},first);
  g.step();assert.equal(pea.ice,false);assert.equal(pea.fire,undefined);assert.equal(pea.torch,first);
  pea.x=cellX(first)-6;g.step();assert.equal(pea.fire,undefined,'same tree cannot ignite its melted pea');
  g.plants.push({...tree,id:904,column:next});pea.x=cellX(next)-6;g.step();assert.equal(pea.fire,true);assert.equal(pea.torch,next);
 }
});

test('tree abilities see the position from the previous projectile update rather than a swept crossing',()=>{
 const{g,pea}=fixture(cellX(3)-20.2);g.step();assert.equal(pea.fire,undefined);assert.ok(pea.x-14>cellX(3)-20);
 g.step();assert.equal(pea.fire,true);
 for(const change of [{health:0},{row:1}]){const{g,tree}=fixture(cellX(3)-59);Object.assign(tree,change);const z=enemy(cellX(3)-29);g.zombies=[z];g.step();assert.equal(z.health,980);}
});

test('dead or other-row trees and non-pea projectiles cannot convert or defer a hit',()=>{
 for(const patch of [{puff:true},{spike:true},{star:true,vy:0,vx:3.33},{homing:123,spike:true},{lob:{kind:'kernel' as const,target:0,startX:300,endX:500,startY:100,endY:100,duration:120}}]){
  const{g,pea}=fixture(cellX(3)-20,patch);g.step();assert.equal(pea.fire,undefined);assert.equal(pea.torch,undefined);
 }
 for(const change of [{health:0},{row:1}]){const{g,tree,pea}=fixture(cellX(3)-20);Object.assign(tree,change);g.step();assert.equal(pea.fire,undefined);}
});

test('fire peas use the native30px horizontal rectangle and save/restore preserves conversion decisions',()=>{
 for(const delta of [30,31]){const{g,pea}=fixture(200,{fire:true});g.plants=[];const z=enemy(200+delta-6);g.zombies=[z];g.step();assert.equal(z.health,delta===30?960:1000);assert.equal(g.peas.includes(pea),delta!==30);}
 const{g}=fixture(cellX(3)-20,{ice:true});g.step();const copy=Game.restore(g.snapshot());for(let n=0;n<40;n++){g.step();copy.step();assert.deepEqual(copy.snapshot(),g.snapshot());}
});
