import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Zombie} from '../src/game/model';import{walkingSpeed}from'../src/game/zombie-motion';
function game(){const g=new Game(19,23);g.phase='playing';g.started=true;g.waveIn=100000;return g;}
function enemy(g:Game,kind:Zombie['kind'],row=2,x=600){const z=g.spawnZombie(kind,row,x,0);z.speed=.4;z.riseIn=0;z.frozenIn=0;z.butterIn=0;z.animationTime=0;if(kind==='dancer'){z.dancePhase='dance';z.danceIn=0;z.summonIn=1000;}return z;}
function group(){const g=game(),leader=enemy(g,'dancer'),a=enemy(g,'backup',1),b=enemy(g,'backup',3);a.leader=b.leader=leader.id;a.slot=0;b.slot=1;return{g,leader,a,b};}

test('source chilled body animation advances at half rate rather than movement factor .4',()=>{
 for(const kind of ['normal','football','newspaper','pole','catapult']as const){const g=game(),z=enemy(g,kind);z.chillIn=100;g.step();assert.equal(z.animationTime,.5,kind);}
});
test('one chilled backup slows the leader and all members without applying cold tint counters to them',()=>{
 const {g,leader,a,b}=group();a.chillIn=100;const before=[leader,a,b].map(z=>z.x);g.step();
 for(const [i,z]of[leader,a,b].entries()){assert.ok(Math.abs(before[i]-z.x-walkingSpeed(z)*.4)<1e-9);assert.equal(z.animationTime,.5);}
 assert.equal(leader.chillIn,0);assert.equal(b.chillIn,0);
});
test('a chilled leader slows backups in other rows and unrelated dancers keep their normal rhythm',()=>{
 const {g,leader,a,b}=group();leader.chillIn=100;const unrelated=enemy(g,'dancer',0,700);g.step();
 for(const z of[leader,a,b])assert.equal(z.animationTime,.5);assert.equal(unrelated.animationTime,1);
});
test('dead companions and detached backups do not keep another dance group chilled',()=>{
 const {g,leader,a,b}=group();a.chillIn=100;a.health=0;const detached=enemy(g,'backup',4);detached.leader=99999;g.step();
 assert.equal(leader.animationTime,1);assert.equal(b.animationTime,1);assert.equal(detached.animationTime,1);
});
test('butter and ice hold visual interpolation still, then resume the source half-rate on thaw',()=>{
 const g=game(),z=enemy(g,'normal');z.chillIn=100;z.butterIn=2;assert.equal(g.zombieAnimationFactor(z),0);g.step();assert.equal(z.animationTime,0);assert.equal(g.zombieAnimationFactor(z),0);g.step();assert.equal(z.animationTime,.5);assert.equal(g.zombieAnimationFactor(z),.5);z.frozenIn=2;assert.equal(g.zombieAnimationFactor(z),0);
});
test('dance-group cold and visual clocks pause and survive a saved battle without render mutation',()=>{
 const {g,a}=group();a.chillIn=100;g.step();g.pause();const before=g.snapshot();for(let n=0;n<10;n++)g.step();assert.deepEqual(g.snapshot(),before);g.resume();const restored=Game.restore(g.snapshot());for(let n=0;n<10;n++){g.step();restored.step();}assert.deepEqual(g.snapshot(),restored.snapshot());
});
