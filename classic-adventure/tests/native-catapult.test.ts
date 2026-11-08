import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Plant,type Zombie} from '../src/game/model';
const plant=(kind:Plant['kind'],column:number,row=0):Plant=>({id:100+column,kind,column,row,health:300,born:0,shotAt:-100,actionIn:1000});
const spawn=(g:Game,x:number)=>(g as any).spawnZombie('catapult',0,x,0) as Zombie;
const update=(g:Game,z:Zombie)=>(g as any).updateCatapult(z);
const grid=(env:string,c:number)=>env==='roof'?70+Math.max(0,5-c)*20:80;

test('catapult stops at native object X650 and includes the integer target-distance boundary',()=>{
 for(const [x,column,shoot] of [[680,0,true],[680.01,0,false],[170,0,true],[169.99,0,false],[570,5,true],[569.99,5,false]] as const){
  const g=new Game(9,23),z=spawn(g,x);g.plants=[plant('sunflower',column)];z.speed=0;
  update(g,z);assert.equal(z.catapult!.phase,shoot?'shoot':'walk',`${x}/${column}`);
 }
});
test('catapult basketball uses native integer origins and plant top-left targets on flat and roof terrain',()=>{
 for(const level of [9,41] as const)for(const x of [350.75,550.75,650.9])for(const column of [0,4])for(const pot of [false,true]){
  if(Math.trunc(x-30)<140+column*80)continue;
  const g=new Game(level,23),z=spawn(g,x),p=plant('sunflower',column);g.plants=pot?[plant('flowerpot',column),p]:[p];
  Object.assign(z.catapult!,{phase:'shoot',remaining:231});update(g,z);
  const rawX=x+83,rawY=(level===41?40+Math.max(0,430-x)*.25:50)-44;
  const shot=g.peas[0].lob!,originX=Math.trunc(rawX),originY=Math.trunc(rawY);
  assert.equal(shot.startX,originX);assert.equal(shot.startY,originY);
  const targetX=40+80*column,targetY=grid(g.config.environment,column);
  assert.equal(shot.endX,originX-Math.max(40,rawX-targetX-20));
  assert.equal(shot.endY,originY+targetY-rawY);assert.equal(shot.flight!.vx,-Math.max(40,rawX-targetX-20)/120);
  assert.equal(shot.flight!.vz,(targetY-rawY)/120-7);
 }
});
test('catapult still releases a basketball after its target disappears during the windup',()=>{
 const g=new Game(41,23),z=spawn(g,650.9);g.plants=[];
 Object.assign(z.catapult!,{phase:'shoot',remaining:231});update(g,z);
 assert.equal(g.peas.length,1);const shot=g.peas[0].lob!;
 assert.equal(shot.target,-1);assert.equal(shot.startX,733);assert.equal(shot.startY,-4);
 assert.equal(shot.endX,733-(733.9-320-20));assert.equal(shot.endY,0);
});
