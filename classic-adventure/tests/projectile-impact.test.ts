import test from 'node:test';import assert from 'node:assert/strict';
import {Game,type Zombie,type Pea} from '../src/game/model';
function enemy(kind:Zombie['kind']='normal',armor=0,x=200):Zombie{return {id:x,kind,row:0,x,armor,health:270,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:500,frozenIn:1000,hasPole:false,vaultIn:0,rageIn:0,riseIn:0,animationTime:0};}
// Fire fixtures touch the native30px rectangle at body-left206.
function run(foes:Zombie[],shot:Partial<Pea>={},level:9|21=9){
 const g=new Game(level,1);for(const kind of g.config.seeds.slice(0,6))g.chooseSeed(kind);g.start();g.select('sunflower');assert.ok(g.plant(0,4));g.drainEvents();
 g.zombies=foes;g.peas=[{id:999,row:0,x:shot.fire?190:180,age:0,ice:false,puff:false,...shot}];g.step();return g;
}
const sounds=(g:Game)=>g.drainEvents().filter(e=>e.kind==='hit').map(e=>Reflect.get(e,'impact'));
test('all four pults use source fifty-tick speed, chill, reverse motion and stationary target phases',()=>{
 const cases:[string,Partial<Zombie>,number][]=[
  ['walking',{},630],['chilled',{chillIn:500},642],['backwards',{backwards:true},670],
  ['backwards chilled',{backwards:true,chillIn:500},658],['frozen',{frozenIn:500},650],['buttered',{butterIn:500},650],
  ['eating',{eating:true},650],['newspaper rage',{kind:'newspaper',rageIn:100},650],
  ['jack opening',{kind:'jack',jackOpening:true,jackIn:100},650],['imp landing',{kind:'imp',landingIn:21},650],
  ['placing ladder',{kind:'ladder',ladderIn:100},650],['giant throwing',{kind:'gargantuar',giant:{thrown:true,phase:'throw',remaining:100}},650],
  ['catapult loading',{kind:'catapult',catapult:{ammo:1,remaining:100,phase:'reload'}},650],
  ['dancer pointing',{kind:'dancer',dancePhase:'point',danceIn:100},650],
  ['dancer holding',{kind:'dancer',dancePhase:'hold',danceIn:100},650],
 ];
 for(const kind of ['cabbagepult','kernelpult','melonpult','wintermelon'] as const)for(const [name,state,expected] of cases){
  const g=run([],{x:1000}),p=g.plants[0];p.kind=kind;p.column=0;p.row=0;p.actionIn=kind==='wintermelon'?100:1;
  if(kind==='wintermelon')p.winterLaunchIn=2;
  g.zombies=[Object.assign(enemy('normal',0,650),{speed:.4,chillIn:0,frozenIn:0},state)];g.peas=[];g.step();
  // Native lead begins at the integer body-rectangle center. Unsupported
  // special phases retain their old bridge while their altitude is ported.
  const centerOffset=name==='imp landing'||name.startsWith('dancer')?0:name==='giant throwing'?15:name==='catapult loading'?46:state.backwards?33:27;
  assert.equal(g.peas[0]?.lob?.endX,expected+centerOffset-30,`${kind}: ${name}; source rectangle-center aim`);
 }
});
test('a frozen or buttered dancer companion stops both group movement and lob prediction',()=>{
 for(const status of ['frozenIn','butterIn'] as const)for(const alive of [true,false]){
  const g=run([],{x:1000}),p=g.plants[0];p.kind='cabbagepult';p.column=0;p.row=0;p.actionIn=1;
  const leader=Object.assign(enemy('dancer',0,650),{speed:.4,chillIn:0,frozenIn:0,dancePhase:'dance' as const,summonIn:100});
  const companion=Object.assign(enemy('backup',0,750),{row:1,leader:leader.id,health:alive?270:0,speed:.4,chillIn:0,frozenIn:0,[status]:500});
  g.zombies=[leader,companion];g.peas=[];g.step();
  assert.equal(g.peas[0]?.lob?.endX,alive?620:600,status);
  if(alive)assert.equal(leader.x,650,`${status}: leader remains still`);else assert.ok(leader.x<650,'a dead companion cannot hold the group still');
 }
});
test('pult launch range remains at least forty pixels for a nearby target',()=>{
 const g=run([],{x:1000}),p=g.plants[0];p.kind='cabbagepult';p.column=4;p.row=0;p.actionIn=1;
 g.zombies=[Object.assign(enemy('normal',0,450),{speed:3,frozenIn:0,chillIn:0})];g.peas=[];g.step();
 assert.equal(g.peas[0]?.lob?.startX,365);assert.equal(g.peas[0]?.lob?.endX,405);
});
test('all four pults can hit a close body during launch instead of waiting for ground impact',()=>{
 for(const kind of ['cabbagepult','kernelpult','melonpult','wintermelon'] as const){
  const g=run([],{x:1000}),p=g.plants[0];p.kind=kind;p.column=4;p.row=0;p.actionIn=kind==='wintermelon'?100:1;
  if(kind==='wintermelon')p.winterLaunchIn=2;
  const target=enemy('normal',0,395);g.zombies=[target];g.peas=[];g.step();
  assert.ok(target.health<270,kind);assert.equal(g.peas.length,0,`${kind}: consumed on early impact`);
 }
});
test('lob launch collision closes after tick twenty even when a body overlaps the drawn projectile',()=>{
 for(const age of [0,20]){
  const target=enemy();run([target],{age,lob:{kind:'cabbage',target:target.id,startX:200,endX:200,startY:135,endY:135,duration:100}});
  assert.equal(target.health,age===0?230:270,`projectile age ${age+1}`);
 }
});
test('stars expire outside the classic vertical bounds while both boundary pixels remain active',()=>{
 for(const y of [39,40,600,601]){
  const g=run([],{x:300,y:y-3.33,vx:0,vy:3.33,star:true});
  assert.equal(g.peas.length,y>=40&&y<=600?1:0,`star y=${y}`);
 }
});
test('backward peas and left-moving stars bypass hand shields but retain helmet protection',()=>{
 for(const kind of ['door','newspaper','ladder'] as const)for(const star of [false,true])for(const vx of [-3.33,0,3.33]){
  const target=enemy(kind);target.shield=150;
  run([target],{x:200-vx,y:115,vx,vy:0,star});
  assert.equal(target.shield,vx<0?150:130,`${kind}, star=${star}, vx=${vx}`);
  assert.equal(target.health,vx<0?250:270);
  assert.equal(target.rageIn,0,'a rear hit must not tear the newspaper or trigger rage');
 }
 for(const star of [false,true]){
  const armored=enemy('bucket',100);armored.shield=150;
  run([armored],{x:203.33,y:115,vx:-3.33,vy:0,star});
  assert.deepEqual([armored.shield,armored.armor,armored.health],[150,80,270]);
 }
});
test('a backward ice pea chills through an intact shield; a forward ice pea must reach the body',()=>{
 for(const vx of [-3.33,3.33]){
  const target=enemy('door');target.shield=150;target.chillIn=0;
  run([target],{x:200-vx,vx,ice:true});
  assert.equal(target.chillIn,vx<0?1000:0);
 }
});
test('the last pea that removes a helmet still plays the pre-impact armor sound',()=>{
 const bucket=enemy('bucket',20);const g=run([bucket]);assert.equal(bucket.armor,0);assert.equal(bucket.health,270);assert.deepEqual(sounds(g),[['shield']]);
 const cone=enemy('cone',20);assert.deepEqual(sounds(run([cone])),[['plastic','hit']]);assert.equal(cone.armor,0);
});
test('fire peas deal 40 direct, 13 splash, and clear cold only on the direct target',()=>{
 const direct=enemy(),near=enemy('normal',0,220);const g=run([direct,near],{fire:true});
 assert.deepEqual([direct.health,near.health],[230,257]);assert.equal(direct.chillIn,0);assert.equal(direct.frozenIn,0);assert.equal(near.chillIn,499);assert.equal(near.frozenIn,999);assert.deepEqual(sounds(g),[['ignite']]);
});
test('fire splash caps its extra damage budget and hits paper and body together',()=>{
 const foes=[enemy(),...Array.from({length:5},(_,i)=>enemy('normal',0,205+i*4))];run(foes,{fire:true});assert.equal(foes[0].health,230);assert.deepEqual(foes.slice(1).map(z=>z.health),[262,262,262,262,262]);
 const paper=enemy('newspaper');paper.shield=150;run([paper],{fire:true});assert.equal(paper.shield,110);assert.equal(paper.health,230);
});
test('doors, ladders and vehicles take only the direct fire hit and resist nearby fire splash',()=>{
 for(const kind of ['door','ladder','catapult','zomboni'] as const){
  const direct=enemy(kind);if(kind==='door'||kind==='ladder')direct.shield=100;
  const near=enemy('normal',0,220),g=run([direct,near],{fire:true});assert.equal(near.health,270,kind);assert.equal(direct.frozenIn,999);assert.deepEqual(sounds(g),[['hit']]);
  assert.equal(direct.shield>0?direct.shield:direct.health,kind==='door'||kind==='ladder'?60:230);
  const primary=enemy(),resistant=enemy(kind,0,220);if(kind==='door'||kind==='ladder')resistant.shield=100;run([primary,resistant],{fire:true});assert.equal(resistant.health,270,kind);assert.equal(resistant.shield,kind==='door'||kind==='ladder'?100:0);
 }
});
test('a backward fireball bypasses a resistant hand shield without igniting nearby zombies',()=>{
 for(const kind of ['door','ladder'] as const){
  const target=enemy(kind);target.shield=100;const adjacent=enemy('normal',0,220);
  run([target,adjacent],{x:203.33,vx:-3.33,fire:true});
  assert.deepEqual([target.health,target.shield,adjacent.health],[230,100,270]);
  assert.equal(target.chillIn,499);
 }
});
test('kernel, butter, cabbage and melon land with their source impact and helmet layering',()=>{
 for(const [kind,expected] of [['kernel',['kernel']],['butter',['butter','shield']],['cabbage',['shield']],['melon',['melon','shield']],['wintermelon',['melon','shield']]] as const){
  const target=enemy('bucket',1100);const g=run([target],{age:99,lob:{kind,target:target.id,startX:120,endX:200,startY:80,endY:110,duration:100}});assert.deepEqual(sounds(g),[[...expected]],kind);
 }
});
test('star and homing impacts report sounds without changing their 20-point damage',()=>{
 const star=enemy();const a=run([star],{x:197,y:115,vx:3.33,vy:0,star:true});assert.equal(star.health,250);assert.deepEqual(sounds(a),[['hit']]);
 const target=enemy();const b=run([target],{x:195,y:113,spike:true,homing:target.id});assert.equal(target.health,250);assert.deepEqual(sounds(b),[['hit']]);
});
const protectedStates:Partial<Zombie>[]=[
 {kind:'pole',vaultIn:50},{kind:'backup',riseIn:50},
 {kind:'digger',underground:true},{kind:'digger',emergingIn:50},
 {kind:'imp',flight:{remaining:50,duration:100,startX:200,endX:200}},
 {kind:'balloon',flying:false,popIn:50},{kind:'bobsled',crashIn:50},
 {kind:'bobsled',sled:123,sledLeader:123},
 {kind:'bungee',bungee:{phase:'down',remaining:50,column:0}},
];
const shots:Partial<Pea>[]=[{}, {x:197,y:115,vx:3.33,vy:0,star:true},
 {x:195,y:113,spike:true,homing:200},
 {age:99,lob:{kind:'cabbage',target:200,startX:120,endX:200,startY:80,endY:110,duration:100}},
];
for(const [index,shot] of shots.entries())test(`projectile family ${index} cannot hit jumping, emerging, popping, crashing or riding followers`,()=>{
 const health=protectedStates.map(state=>{const target=Object.assign(enemy(),state);run([target],shot);return target.health;});
 assert.deepEqual(health,protectedStates.map(()=>270));
 const grounded=enemy('imp');grounded.landingIn=21;run([grounded],shot);
 assert.equal(grounded.health,shot.lob?230:250,'a landed imp is already vulnerable during its landing animation');
 const leader=enemy('bobsled');leader.sled=leader.id;run([leader],shot);
 assert.equal(leader.health,shot.lob?230:250,'the front sled rider remains vulnerable');
});
test('ground shots ignore diving snorkels but lobbed direct hits and melon splash reach them',()=>{
 const waterY=new Game(21,1).rowY(2)-43;
 for(const shot of shots){
  const target=enemy('snorkel');target.row=2;
  run([target],{...shot,row:2,y:waterY},21);
  assert.equal(target.health,shot.lob?230:270);
 }
 const primary=enemy();primary.row=2;const swimmer=enemy('snorkel',0,220);swimmer.row=2;
 run([primary,swimmer],{age:99,row:2,lob:{kind:'melon',target:200,startX:120,endX:200,startY:200,endY:waterY,duration:100}},21);
 assert.deepEqual([primary.health,swimmer.health],[190,244]);
 for(const eating of [false,true]){
  const g=run([],{x:1000},21),p=g.plants[0];p.kind='fumeshroom';p.row=2;p.column=0;p.awake=true;p.actionIn=1;
  const swimmer=enemy('snorkel');swimmer.row=2;swimmer.eating=eating;g.zombies=[swimmer];g.step();
  assert.equal(swimmer.health,eating?250:270,'fume reaches a surfaced eater, not a diving snorkel');
 }
});
test('fire and melon splash exclude off-ground states and sled followers',()=>{
 for(const kind of ['fire','melon'] as const)for(const state of protectedStates){
  const primary=enemy(),other=Object.assign(enemy('normal',0,220),state);
  const shot=kind==='fire'?{fire:true}:{age:99,lob:{kind:'melon' as const,target:200,startX:120,endX:200,startY:80,endY:110,duration:100}};
  run([primary,other],shot);assert.equal(other.health,270,`${kind}: ${JSON.stringify(state)}`);
 }
});
test('a homing shot retains its trajectory after its target becomes unavailable',()=>{
 for(const state of [{health:0},...protectedStates]){
  const target=Object.assign(enemy(),state),g=run([target],{x:300,y:113,vx:-2,vy:1,spike:true,homing:200});
  assert.deepEqual([g.peas[0].x,g.peas[0].y],[298,114]);
 }
});
test('shooters do not acquire targets that their projectiles cannot damage',()=>{
 for(const kind of ['peashooter','threepeater','splitpea','starfruit','cabbagepult','cattail','fumeshroom'] as const)for(const state of protectedStates){
  const g=run([],{x:1000}),p=g.plants[0];p.kind=kind;p.row=0;p.column=kind==='splitpea'?4:0;p.actionIn=1;p.awake=true;
  g.peas=[];g.zombies=[Object.assign(enemy(),state)];g.drainEvents();g.step();
  assert.equal(g.drainEvents().filter(e=>e.kind==='shoot'||e.kind==='fume').length,0,`${kind}: ${JSON.stringify(state)}`);
 }
});
test('cactus and homing spikes pop a flying balloon but cannot hit its popping phase again',()=>{
 for(const high of [true,false]){
  const target=enemy('balloon');target.flying=true;
  const shot=high?{high:true}:{x:195,y:63,spike:true,homing:200};run([target],shot);
  assert.equal(target.flying,false);assert.equal(target.popIn,50);
  const health=target.health;run([target],shot);assert.equal(target.health,health);
 }
});
test('non-leftward stars wait 25 ticks before hitting a grounded miner',()=>{
 for(const vx of [-3.33,0,3.33])for(const age of [23,24]){
  const target=enemy('digger');run([target],{x:200-vx,y:115,vx,vy:0,star:true,age});
  assert.equal(target.health,vx<0||age===24?250:270,`vx=${vx}, age=${age}`);
 }
});
test('lobbed shots collide with a replacement in their landing lane after losing the original target',()=>{
 const dead=enemy();dead.health=0;const replacement=enemy('normal',0,220);
 const g=run([dead,replacement],{age:99,lob:{kind:'cabbage',target:200,startX:120,endX:200,startY:80,endY:110,duration:100}});
 assert.equal(replacement.health,230);assert.deepEqual(sounds(g),[['hit']]);
});
test('melons splash on ground impact even when no direct target remains',()=>{
 for(const kind of ['melon','wintermelon'] as const){
  const dead=enemy();dead.health=0;const adjacent=enemy('normal',0,220);adjacent.row=1;adjacent.chillIn=0;
  const g=run([dead,adjacent],{age:99,lob:{kind,target:200,startX:120,endX:200,startY:80,endY:110,duration:100}});
  assert.equal(adjacent.health,244);assert.equal(adjacent.chillIn,kind==='wintermelon'?1000:0);assert.deepEqual(sounds(g),[['melon']]);
 }
});
test('homing spikes maintain source speed and turn gradually rather than snapping toward a target',()=>{
 const target=enemy(),g=run([target],{x:100,y:213,vx:2,vy:0,age:9,spike:true,homing:200});
 const shot=g.peas[0];assert.ok(Math.abs(Math.hypot(shot.vx!,shot.vy!)-2)<1e-12);
 assert.ok(shot.vx!>1.99&&shot.vy!<0&&shot.vy!>-.02,'a young spike initially continues almost straight right');
 const initialTurn=shot.vy!;for(let i=0;i<20;i++){g.step();assert.ok(Math.abs(Math.hypot(shot.vx!,shot.vy!)-2)<1e-12);}
 assert.ok(shot.vy!<initialTurn,'turning strength increases with projectile age');
 const behind=enemy(),b=run([behind],{x:300,y:213,vx:2,vy:0,spike:true,homing:200});
 assert.ok(b.peas[0].vx!>0,'a spike must curve around instead of immediately reversing');
});
test('a newly emitted cattail spike starts rightward at speed two even for a target in another row',()=>{
 const g=run([],{x:1000}),p=g.plants[0];p.kind='cattail';p.burstIn=20;p.actionIn=100;
 const target=enemy('balloon',0,650);target.flying=true;g.zombies=[target];g.peas=[];g.step();
 assert.equal(g.peas.length,1);const shot=g.peas[0];assert.equal(shot.age,1);
 assert.ok(Math.abs(Math.hypot(shot.vx!,shot.vy!)-2)<1e-12);assert.ok(shot.vx!>1.999&&Math.abs(shot.vy!)<.002);
});
test('threepeater shooting animation is triggered only by an eligible target in its three lanes',()=>{
 for(const state of [null,{row:1},{row:3},{row:1,underground:true},{row:1,vaultIn:50}]){
  const g=run([],{x:1000}),p=g.plants[0];p.kind='threepeater';p.row=1;p.column=0;p.actionIn=1;
  if(state)g.zombies=[Object.assign(enemy('normal',0,650),state)];g.drainEvents();const prior=p.shotAt;g.step();
  const fired=!!state&&state.row===1&&!('underground' in state)&&!('vaultIn' in state);
  assert.equal(p.shotAt,fired?g.ticks:prior,JSON.stringify(state));
  assert.equal(g.drainEvents().filter(e=>e.kind==='shoot').length,0,'windup has no projectile or throw sound');
  for(let n=0;n<34;n++)g.step();
  assert.equal(g.drainEvents().filter(e=>e.kind==='shoot').length,fired?3:0);
 }
});
