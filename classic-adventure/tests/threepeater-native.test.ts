import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant,type Zombie} from '../src/game/model';import{cellX}from'../src/game/config';
function fixture(row=1,column=0,level:9|31|41=9){
 const g=new Game(level,23);g.phase='playing';g.started=true;g.waveIn=100000;
 const p:Plant={id:901,kind:'threepeater',row,column,health:300,actionIn:1,born:0,shotAt:-100};
 const z:Zombie={id:902,kind:'normal',row,x:700,health:10000,armor:0,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0,frozenIn:100000};
 g.plants=[p];g.zombies=[z];return{g,p,z};
}
function step(g:Game,n:number){for(let i=0;i<n;i++)g.step();}

test('threepeater commits to a34-update windup and emits below, middle, above even after target loss',()=>{
 const{g,p}=fixture();g.step();assert.equal(p.threepeaterIn,35);assert.equal(p.shotAt,1);assert.equal(g.peas.length,0);
 g.zombies=[];step(g,33);assert.equal(g.peas.length,0);g.step();assert.deepEqual(g.peas.map(p=>p.row),[2,1,0]);
 assert.equal(p.shotAt,1,'emission does not restart windup animation');assert.equal(g.drainEvents().filter(e=>e.kind==='shoot').length,3);
 const copy=Game.restore(g.snapshot());step(g,50);step(copy,50);assert.deepEqual(copy.snapshot(),g.snapshot());
});

test('threepeater acquisition uses source body boundaries across all three eligible rows',()=>{
 for(const targetRow of [0,1,2,3])for(const [x,inRange] of [[cellX(4)+20-36-42+29,false],[cellX(4)+20-36-42+30,true],[900,true],[cellX(4)+820-36+30,true],[cellX(4)+820-36+31,false]]as const){
  const{g,p,z}=fixture(1,4);z.row=targetRow;z.x=x;g.step();
  assert.equal(p.threepeaterIn===35,targetRow<=2&&inRange,`${targetRow}/${x}`);
 }
 for(const row of [0,4]){const{g}=fixture(row);g.step();step(g,34);assert.deepEqual(g.peas.map(p=>p.row),row===0?[1,0]:[4,3]);}
});

test('threepeater shots share the plant origin and follow native float32 side trajectories',()=>{
 // Compiled C++ reference: float x=85,y=100,vy=+/-3,shadow=157;
 // x+=3.33f; y+=vy; vy*=.97f; shadow+=vy. Values at update34.
 for(const direction of [-1,1]){
  const{g,p}=fixture();g.zombies=[];p.actionIn=100000;(g as any).fireThreepeater(p);
  const pea=g.peas.find(pea=>pea.row===p.row+direction)!;
  const startY=pea.nativePea!.rawY!,startShadow=pea.nativePea!.shadowY;
  assert.equal(pea.x,cellX(0)+19);assert.equal(pea.originY,g.gridY(0,p.row)+24);
  step(g,34);assert.equal(pea.x,198.22006225585938+14);
  // Independent reference uses a translated initial Y/shadow; float rounding
  // depends on that starting value, so compare at the source float precision.
  assert.ok(Math.abs(pea.nativePea!.rawY!-(startY+(direction===-1?-64.4991646:64.4991608)))<.0001);
  assert.equal(pea.nativePea!.vy,direction*1.065027117729187);
  assert.ok(Math.abs(pea.nativePea!.shadowY-(startShadow+(direction===-1?-62.564209:62.564209)))<.0002);
  const center=g.peas.find(pea=>pea.row===p.row)!;assert.equal(center.originY,startY+14);assert.equal(center.nativePea!.rawY,undefined);
 }
});

test('pot offset, pool destination rows, windup pause and save restore retain native launch state',()=>{
 for(const level of [31,41]as const){const{g,p}=fixture(1,0,level);g.plants.push({...p,id:903,kind:'flowerpot'});g.step();step(g,12);
  const copy=Game.restore(g.snapshot());g.phase='paused';const paused=g.snapshot();step(g,100);assert.deepEqual(g.snapshot(),paused);
  g.phase='playing';step(g,22);step(copy,22);assert.deepEqual(copy.snapshot(),g.snapshot());
  assert.deepEqual(g.peas.map(pea=>pea.row),[2,1,0]);assert.equal(g.peas.find(pea=>pea.row===1)!.originY,g.gridY(0,1)+19);
 }
});
