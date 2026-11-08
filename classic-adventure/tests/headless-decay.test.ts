import test from 'node:test';import assert from 'node:assert/strict';
import {Game,headless,type Zombie} from '../src/game/model';
import {GameClock} from '../src/game/clock';
function fixture(){
 const g=new Game(31,1234);for(const k of ['sunshroom','puffshroom','seashroom','lilypad','fumeshroom','doomshroom'] as const)g.chooseSeed(k);g.start();g.select('puffshroom');assert.ok(g.plant(4,0));g.plants[0].actionIn=1000;return g;
}
const spawn=(g:Game,k:Zombie['kind'])=>(g as unknown as {spawnZombie(k:Zombie['kind'],r:number,x:number,w:number):Zombie}).spawnZombie(k,0,650,0);
test('source headless decay is three health for a 500+ maximum body and one for regular or miniature bodies',()=>{
 for(const [kind,health,mini,damage] of [['normal',80,false,1],['football',80,false,1],['jack',100,false,3],['pole',100,false,3],['yeti',100,false,3],['pole',30,true,1]] as const){
  const g=fixture(),z=spawn(g,kind);z.health=health;z.mini=mini;
  Object.defineProperty(g,'random',{value:()=>0});g.step();assert.equal(z.health,health-damage,`${kind}, mini=${mini}`);
 }
});
test('a headless opening jack still decays and can die before its box explodes',()=>{
 const g=fixture(),z=spawn(g,'jack');z.health=3;z.jackOpening=true;z.jackIn=10;
 Object.defineProperty(g,'random',{value:()=>0});g.step();assert.equal(z.health,0);assert.ok(!g.zombies.includes(z));assert.equal(g.plants[0].health,300);assert.ok(!g.drainEvents().some(e=>e.kind==='explode'));
});
test('a self-exploding jack identifies its disappearing body for the renderer',()=>{
 const g=fixture(),z=spawn(g,'jack');z.jackOpening=true;z.jackIn=1;
 g.step();const explosion=g.drainEvents().find(e=>e.kind==='explode');assert.equal(explosion?.zombieId,z.id);
});
test('source body-part immunity keeps bungees, vehicles, giants, flying balloons and sled riders headed',()=>{
 const g=fixture();
 for(const [kind,state] of [['bungee',{}],['zomboni',{}],['catapult',{}],['gargantuar',{}],['balloon',{flying:true}],['balloon',{flying:false,popIn:20}],['bobsled',{sled:900}]] as const){
  const z=spawn(g,kind);Object.assign(z,{health:1},state);assert.equal(headless(z),false,kind);
 }
 for(const kind of ['balloon','bobsled'] as const){const z=spawn(g,kind);Object.assign(z,{health:80,flying:false,popIn:0,sled:undefined});assert.equal(headless(z),true,`${kind} after landing/crashing`);}
});
test('headless opening, decay and explosion are identical across render rates and game speeds',()=>{
 const run=(hz:number,speed:1|2|4,duration:number)=>{
  const g=fixture(),z=spawn(g,'jack');z.health=100;z.jackOpening=true;z.jackIn=110;
  const clock=new GameClock();clock.speed=speed;let elapsed=0;
  while(elapsed<duration/speed){const frame=Math.min(1000/hz,duration/speed-elapsed);clock.advance(g,frame,()=>{});elapsed+=frame;}
  clock.advance(g,1e-6,()=>{});return g.snapshot();
 };
 for(const duration of [900,1200]){const expected=run(60,1,duration);for(const hz of [30,60,144])for(const speed of [1,2,4] as const)assert.deepEqual(run(hz,speed,duration),expected);}
});
