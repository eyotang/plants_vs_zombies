import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Plant,type Zombie} from '../src/game/model';
import {GameClock} from '../src/game/clock';
const target:Plant={id:9000,kind:'sunflower',column:0,row:0,health:300,born:0,shotAt:-100,actionIn:100000};
function fixture(chilled=false){const g=new Game(9,23);g.plants=[{...target}];const z=g['spawnZombie']('catapult',0,650,0);z.speed=.25;z.chillIn=chilled?10000:0;return {g,z};}
const step=(g:Game,z:Zombie)=>g['updateCatapult'](z);
// Independent float32 reference: Update actions reads the previous reanimation
// update, and Reanimation::Update advances by .01 * animRate /32 afterwards.
function reference(chilled:boolean){
 let time=0,last=0,fire=0,done=0;const delta=Math.fround(Math.fround(Math.fround(.01)*(chilled?12:24))/32),event=Math.fround(.545);
 for(let tick=0;tick<400;tick++){
  if(last>0&&event>=last&&event<time)fire=tick;
  if(time>=1){done=tick;break;}
  last=time;time=Math.min(1,Math.fround(time+delta));
 }
 return {fire,done};
}
test('new catapult attacks fire and finish from the native float32 animation clock, including chill',()=>{
 for(const chilled of [false,true]){
  const {g,z}=fixture(chilled),expected=reference(chilled);step(g,z);assert.equal(z.catapult!.phase,'shoot');
  let fire=0,done=0;
  for(let tick=1;tick<400;tick++){
   const shots=g.peas.length;step(g,z);if(g.peas.length>shots)fire=tick;
   if(z.catapult!.phase==='reload'){done=tick;break;}
  }
  assert.equal(fire,expected.fire);assert.equal(done,expected.done);assert.equal(z.catapult!.remaining,300-done);assert.equal(z.catapult!.ammo,19);
 }
});
test('the last ball resumes native movement immediately when its animation finishes',()=>{
 for(const chilled of [false,true]){
  const {g,z}=fixture(chilled);z.catapult!.ammo=1;step(g,z);const end=reference(chilled).done;
  for(let tick=1;tick<end;tick++)step(g,z);assert.equal(z.x,650);assert.equal(z.catapult!.phase,'shoot');
  step(g,z);assert.equal(z.catapult!.phase,'walk');assert.equal(z.catapult!.ammo,0);assert.equal(z.x,650-.25*(chilled?.4:1));
 }
});
test('native catapult movement is chilled while its separate reload countdown is not',()=>{
 const {g,z}=fixture(true);z.x=800;step(g,z);assert.equal(z.x,799.9);
 z.x=650;step(g,z);const end=reference(true).done;for(let tick=1;tick<=end;tick++)step(g,z);
 assert.equal(z.catapult!.phase,'reload');assert.equal(z.catapult!.remaining,300-end);
 for(let tick=end+1;tick<=300;tick++)step(g,z);assert.equal(z.catapult!.phase,'shoot');assert.equal(z.catapult!.remaining,300);
});
test('pre-clock saved attacks keep their existing timing until the next native attack begins',()=>{
 const {g,z}=fixture();Object.assign(z.catapult!,{phase:'shoot',remaining:231});step(g,z);assert.equal(g.peas.length,1);
 z.catapult!.remaining=172;step(g,z);assert.equal(z.catapult!.phase,'reload');assert.equal(z.catapult!.ammo,19);
 z.catapult!.remaining=1;step(g,z);assert.equal(z.catapult!.phase,'shoot');assert.equal(z.catapult!.remaining,300);
 assert.ok(z.catapult!.animTime!>0);
});
test('native catapult clocks survive saves and agree across render rates and game speeds',()=>{
 const create=()=>{const g=new Game(9,23);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));Object.assign(g.plants[0],{column:0,row:0,actionIn:100000});const z=g['spawnZombie']('catapult',0,650,0);z.speed=.25;z.chillIn=10000;z.catapult!.ammo=1;return g;};
 const run=(hz:number,speed:1|2|4)=>{const g=create(),clock=new GameClock();clock.speed=speed;let elapsed=0;while(elapsed<3000/speed){const dt=Math.min(1000/hz,3000/speed-elapsed);clock.advance(g,dt,()=>{});elapsed+=dt;}clock.advance(g,1e-6,()=>{});return g.snapshot();};
 const expected=run(60,1);for(const hz of [30,60,144])for(const speed of [1,2,4] as const)assert.deepEqual(run(hz,speed),expected);
 const original=create();for(let i=0;i<100;i++)original.step();const restored=Game.restore(original.snapshot());for(let i=0;i<200;i++){original.step();restored.step();}assert.deepEqual(restored.snapshot(),original.snapshot());
});
