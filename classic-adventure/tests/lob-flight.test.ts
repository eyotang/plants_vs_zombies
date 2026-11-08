import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,type Zombie,type Pea} from '../src/game/model';
import {lobCanCollide,type LobKind} from '../src/game/lob-flight';
import {GameClock} from '../src/game/clock';

function launch(){
 const g=new Game(9,1);for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();g.select('sunflower');assert.ok(g.plant(0,4));
 const p=g.plants[0];p.kind='cabbagepult';p.row=0;p.column=0;p.actionIn=1;
 const z:Zombie={id:900,kind:'normal',row:0,x:650,health:270,armor:0,shield:0,speed:0,biteIn:4,eating:false,wave:0,hitAt:-100,chillIn:0,frozenIn:1000,hasPole:false,vaultIn:0,animationTime:0,rageIn:0,riseIn:0};
 g.zombies=[z];g.step();return g;
}
test('new pult shots accelerate by the classic 0.115 pixels per tick squared',()=>{
 const g=launch(),y:number[]=[g.peas[0].y!];for(let i=0;i<3;i++){g.step();y.push(g.peas[0].y!);}
 for(let i=2;i<y.length;i++)assert.ok(Math.abs((y[i]-2*y[i-1]+y[i-2])-.115)<1e-8,`vertical acceleration ${y[i]-2*y[i-1]+y[i-2]}`);
});
test('flight follows the source discrete recurrence, including terrain compensation',()=>{
 const g=launch(),p=g.peas[0],s=p.lob!,f=s.flight!;
 const initial={...f};let previous=p.y!,previousX=p.x;
 for(let i=0;i<35;i++){
  g.step();const n=i+1;
  assert.ok(Math.abs(p.x-(previousX+initial.vx*n))<1e-8);
  assert.ok(Math.abs(p.y!-(previous+initial.vz*n+.115*n*(n+1)/2))<1e-8);
 }
 const roof=new Game(41,1,'endless','roof');for(const k of roof.config.seeds.slice(0,6))roof.chooseSeed(k);roof.start();assert.equal(roof.phase,'playing');
 const shot:Pea={id:999,row:0,x:430,y:150,age:30,ice:false,puff:false,lob:{kind:'cabbage',target:999,startX:430,startY:150,endX:670,endY:150,duration:120,flight:{vx:2,vz:-2,z:-100,planeY:250}}};
 roof.peas=[shot];roof.step();assert.ok(Math.abs(shot.y!-148.115)<1e-8);
 assert.ok(Math.abs(shot.lob!.flight!.planeY-249.5)<1e-8);
 assert.ok(Math.abs(shot.lob!.flight!.z+101.385)<1e-8,'terrain changes local height, not the world-space parabola');
});
test('source collision windows distinguish rising, falling, butter, melons and pool rows',()=>{
 for(const [kind,min] of [['cabbage',-30],['kernel',-30],['butter',-32],['melon',-35],['wintermelon',-35],['basketball',60]] as [LobKind,number][])for(const water of [false,true]){
  const threshold=min+(water?40:0),f={vx:1,vz:1,z:threshold,planeY:100};
  assert.equal(lobCanCollide(kind,60,f,water),false);
  f.z+=.001;assert.equal(lobCanCollide(kind,60,f,water),true);
  f.vz=-1;assert.equal(lobCanCollide(kind,60,f,water),false);
  assert.equal(lobCanCollide(kind,20,f,water),kind!=='basketball');
 }
});
test('high lob arcs survive above the viewport and miss the ground without their old target',()=>{
 const g=launch(),p=g.peas[0];g.zombies=[];
 for(let i=0;i<60;i++)g.step();assert.ok(p.y! < -80);assert.ok(g.peas.includes(p),'a high arc must not disappear at the render boundary');
 let steps=0;while(g.peas.includes(p)&&steps++<200)g.step();assert.ok(steps<200);assert.ok(p.lob!.flight!.z>80,'a miss ends at source ground height, not a fixed duration');
});
test('new-flight saves resume deterministically while old in-flight saves remain readable',()=>{
 const g=launch();for(let i=0;i<40;i++)g.step();const restored=Game.restore(g.snapshot());
 for(let i=0;i<120;i++){g.step();restored.step();}assert.deepEqual(restored.snapshot(),g.snapshot());
 const old=launch();old.peas[0].lob!.flight=undefined;const resumed=Game.restore(old.snapshot());
 for(let i=0;i<130;i++)resumed.step();assert.equal(resumed.peas.filter(p=>p.lob&&!p.lob.flight).length,0);
});
test('physical lob collisions reach replacement bodies and deep snorkels; missed melons still splash',()=>{
 for(const kind of ['cabbage','kernel','butter','melon','wintermelon'] as const){
  const g=launch(),target=g.zombies[0];target.x=200;
  g.plants[0].actionIn=1000;g.peas=[{id:999,row:0,x:200,y:110,age:59,ice:false,puff:false,lob:{kind,target:-999,startX:200,endX:200,startY:110,endY:110,duration:120,flight:{vx:0,vz:1,z:50,planeY:60}}}];
  g.step();assert.equal(target.health,kind==='kernel'?250:kind==='melon'||kind==='wintermelon'?190:230,kind);
  assert.equal(g.peas.length,0);
 }
 for(const z of [44.885,45]){
  const g=new Game(21,1,'endless','pool');for(const k of g.config.seeds.slice(0,6))g.chooseSeed(k);g.start();
  const target={...launch().zombies[0],row:2,x:200,kind:'snorkel' as const};g.zombies=[target];
  g.peas=[{id:999,row:2,x:200,y:300,age:59,ice:false,puff:false,lob:{kind:'cabbage',target:target.id,startX:200,endX:200,startY:300,endY:300,duration:120,flight:{vx:0,vz:-.115+0.115,z,planeY:300-z}}}];
  g.step();assert.equal(target.health,z===45?230:270,'submerged direct hits require height strictly greater than 45');
 }
 const g=launch(),adjacent=g.zombies[0];adjacent.row=1;adjacent.x=200;g.plants[0].actionIn=1000;
 g.peas=[{id:999,row:0,x:200,y:110,age:150,ice:false,puff:false,lob:{kind:'melon',target:-999,startX:200,endX:200,startY:110,endY:110,duration:120,flight:{vx:0,vz:1,z:80,planeY:30}}}];
 g.step();assert.equal(adjacent.health,244);assert.equal(g.peas.length,0);
});
test('vehicle and giant body sizes are retained instead of using a normal zombie rectangle',()=>{
 for(const kind of ['normal','catapult','gargantuar'] as const){
  const g=launch(),target=g.zombies[0];target.kind=kind;g.plants[0].actionIn=1000;
  g.peas=[{id:999,row:0,x:590,y:50,age:59,ice:false,puff:false,lob:{kind:'cabbage',target:target.id,startX:590,endX:590,startY:50,endY:50,duration:120,flight:{vx:0,vz:1,z:50,planeY:0}}}];
  g.step();assert.equal(target.health,kind==='normal'?270:230,kind);
 }
});
test('ballistic state and damage agree across mobile/desktop frame rates and all game speeds',()=>{
 const run=(hz:number,speed:1|2|4)=>{
  const g=launch(),clock=new GameClock();clock.speed=speed;let elapsed=0;const duration=1800/speed;
  while(elapsed<duration){const frame=Math.min(1000/hz,duration-elapsed);clock.advance(g,frame,()=>{});elapsed+=frame;}
  clock.advance(g,1e-6,()=>{});return g.snapshot();
 };
 const expected=run(60,1);for(const hz of [30,60,144])for(const speed of [1,2,4] as const)assert.deepEqual(run(hz,speed),expected);
});
test('falling lobs use horizontal overlap after height gating, regardless of the drawn vertical rectangle',()=>{
 for(const y of [-200,600]){
  const g=launch(),target=g.zombies[0];target.x=200;g.plants[0].actionIn=1000;
  g.peas=[{id:999,row:0,x:180,y,age:59,ice:false,puff:false,lob:{kind:'cabbage',target:target.id,startX:180,endX:200,startY:y,endY:y,duration:120,flight:{vx:0,vz:1,z:0,planeY:y}}}];
  g.step();assert.equal(target.health,230,`draw y=${y}; Board::GetRectOverlap ignores Y`);
 }
});
test('collision samples the prior integer draw X, not the just-integrated position',()=>{
 const g=launch(),target=g.zombies[0];target.x=200;g.plants[0].actionIn=1000;
 g.peas=[{id:999,row:0,x:165.99,y:100,age:59,ice:false,puff:false,lob:{kind:'cabbage',target:target.id,startX:165.99,endX:200,startY:100,endY:100,duration:120,flight:{vx:2,vz:1,z:0,planeY:100}}}];
 g.step();assert.equal(target.health,270,'old integer right edge 205 is short of native zombie left edge 206');
 g.step();assert.equal(target.health,230,'next old integer right edge 207 overlaps');
});
test('melon splash uses its horizontal source rectangle, including wide bodies and excluding the rear radius',()=>{
 const g=launch(),primary=g.zombies[0];primary.kind='catapult';primary.health=850;primary.x=400;
 const adjacent={...primary,id:901,kind:'normal' as const,health:270,row:1,x:540},behind={...adjacent,id:902,x:450};
 g.zombies=[primary,adjacent,behind];g.plants[0].actionIn=1000;
 g.peas=[{id:999,row:0,x:500,y:-200,age:59,ice:false,puff:false,lob:{kind:'melon',target:primary.id,startX:500,endX:500,startY:-200,endY:-200,duration:120,flight:{vx:0,vz:1,z:0,planeY:-200}}}];
 g.step();assert.equal(primary.health,770,'a wide directly hit body receives 80 even beyond the old radius');
 assert.equal(adjacent.health,244);assert.equal(behind.health,270);
});
test('basketball needs more than eight pixels of overlap with the sixty-pixel regular plant rectangle',()=>{
 for(const x of [18,19]){
  const g=launch(),p=g.plants[0];p.actionIn=1000;g.zombies=[];
  g.peas=[{id:999,row:0,x,y:500,age:59,ice:false,puff:false,lob:{kind:'basketball',target:p.id,startX:x,endX:x,startY:500,endY:500,duration:120,flight:{vx:0,vz:1,z:61,planeY:439}}}];
  g.step();assert.equal(p.health,x===18?300:225,`horizontal overlap ${x-10}`);
 }
});
test('basketball hits a remaining pumpkin before its supporting pot',()=>{
 const g=launch(),pot=g.plants[0];pot.kind='flowerpot';pot.actionIn=1000;g.zombies=[];
 const pumpkin={...pot,id:910,kind:'pumpkin' as const,health:4000};g.plants.push(pumpkin);
 g.peas=[{id:999,row:0,x:80,y:500,age:59,ice:false,puff:false,lob:{kind:'basketball',target:pumpkin.id,startX:80,endX:80,startY:500,endY:500,duration:120,flight:{vx:0,vz:1,z:61,planeY:439}}}];
 g.step();assert.equal(pot.health,300);assert.equal(pumpkin.health,3925);
});
