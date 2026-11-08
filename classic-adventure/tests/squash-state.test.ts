import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Zombie} from '../src/game/model';
import {GameClock} from '../src/game/clock';
function fixture(){const g=new Game(9,1);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));const p=g.plants[0];p.kind='squash';p.row=0;p.column=1;return {g,p};}
const enemy=(id:number,x=180):Zombie=>({id,kind:'normal',row:0,x,health:270,armor:0,shield:0,speed:.4,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,frozenIn:1000,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0});
const step=(g:Game,n:number)=>{for(let i=0;i<n;i++)g.step();};
test('squash damages halfway through its ten-tick fall, then holds its grounded pose for 100 ticks',()=>{
 const {g,p}=fixture(),z=enemy(900);g.zombies=[z];g.step();assert.equal(p.squash?.remaining,185);
 step(g,179);assert.equal(p.squash?.remaining,6);assert.equal(z.health,270);
 g.step();assert.equal(p.squash?.remaining,5);assert.ok(z.health<=0);assert.ok(g.plants.includes(p));
 step(g,5);assert.equal(p.squash?.remaining,0);assert.ok(g.plants.includes(p));
 step(g,99);assert.ok(g.plants.includes(p));g.step();assert.ok(!g.plants.includes(p));
});
test('squash reacquires a living target at takeoff but retains its original target while eligible',()=>{
 for(const originalAlive of [true,false]){
  const {g,p}=fixture(),old=enemy(900,200),replacement=enemy(901,175);old.health=originalAlive?270:0;
  p.squash={remaining:61,x:200,target:old.id};g.zombies=[old,replacement];g.step();
  assert.equal(p.squash.remaining,60);assert.equal(p.squash.x,originalAlive?227:202);
 }
});
test('squash thirty-tick landing prediction honors frozen, chilled and backward targets',()=>{
 for(const [state,expected] of [[{frozenIn:500},237],[{frozenIn:0,chillIn:500},232],[{frozenIn:0,backwards:true},255]] as const){
  const {g,p}=fixture(),z=Object.assign(enemy(900,210),state);p.squash={remaining:61,x:0,target:z.id};g.zombies=[z];g.step();
  assert.equal(p.squash.x,expected);
 }
});
test('squash timing and damage stay identical at desktop/mobile render rates and game speeds',()=>{
 const run=(hz:number,speed:1|2|4)=>{
  const {g}=fixture();g.zombies=[enemy(900)];const clock=new GameClock();clock.speed=speed;
  const duration=2400/speed;let elapsed=0;
  while(elapsed<duration){const frame=Math.min(1000/hz,duration-elapsed);clock.advance(g,frame,()=>{});elapsed+=frame;}
  clock.advance(g,1e-6,()=>{});return g.snapshot();
 };
 const expected=run(60,1);for(const hz of [30,60,144])for(const speed of [1,2,4] as const)assert.deepEqual(run(hz,speed),expected);
});
