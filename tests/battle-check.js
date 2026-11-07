// 在浏览器控制台中执行本文件。将重置当前对局，验证战斗逻辑并运行压力测试。
(()=>{
 start();select('sun');const box=canvas.getBoundingClientRect();canvas.dispatchEvent(new MouseEvent('click',{clientX:box.left+240/W*box.width,clientY:box.top+189/H*box.height}));const results=[];const assert=(v,m)=>{if(!v)throw Error(m);results.push(m)};
 assert(state.plants.length===1&&state.sun===100,'实际点击种植与扣费');
 togglePause();assert(state.paused,'暂停');togglePause();assert(!state.paused,'继续');cancelAnimationFrame(raf);
 state=fresh();state.running=true;state.nextSpawn=999;state.plants.push({type:'ice',r:0,c:0,x:240,y:189,hp:100,maxHp:100,timer:0,hit:0});state.enemies.push({type:'basic',r:0,x:300,y:189,hp:180,maxHp:180,speed:13,damage:24,slow:0,hit:0});update(.04);update(.04);assert(state.enemies[0].slow>0,'寒冰命中减速');
 state.plants=[{type:'cherry',r:0,c:0,x:240,y:189,hp:999,maxHp:999,timer:0,hit:0}];update(.04);assert(state.kills===1&&state.enemies.length===0&&state.plants.length===0,'樱桃范围伤害与击杀只结算一次');
 state=fresh();state.running=true;state.nextSpawn=999;state.enemies.push({type:'basic',r:1,x:130,y:300,hp:180,maxHp:180,speed:13,damage:24,slow:0,hit:0});update(.04);assert(state.mowers[1].used&&state.enemies.length===0,'割草机救场');
 state=fresh();state.running=true;state.nextSpawn=999;state.mowers[1].used=true;state.enemies.push({type:'basic',r:1,x:35,y:300,hp:180,maxHp:180,speed:13,damage:24,slow:0,hit:0});update(.04);assert(state.over,'失败结算');
 state=fresh();state.running=true;state.wave=5;state.waveSpawned=19;update(.04);assert(state.over,'冒险胜利');
 mode='endless';state=fresh();state.running=true;state.wave=5;state.waveSpawned=19;for(let i=0;i<100;i++)update(.04);assert(!state.over&&state.wave===6,'无尽模式进入第六波');mode='adventure';
 state=fresh();state.running=true;state.nextSpawn=999;for(let r=0;r<5;r++)for(let c=0;c<9;c++)state.plants.push({type:'twin',r,c,x:GRID.x+(c+.5)*CW,y:GRID.y+(r+.5)*RH,hp:100,maxHp:100,timer:0,hit:0});for(let i=0;i<50;i++)state.enemies.push({type:'cone',r:i%5,x:1300+i,y:GRID.y+(i%5+.5)*RH,hp:360,maxHp:360,speed:10,damage:28,slow:0,hit:0});
 const begin=performance.now();for(let i=0;i<300;i++){update(1/30);draw()}const ms=performance.now()-begin;const memory=performance.memory?.usedJSHeapSize;start();return {results,stressFrames:300,stressMilliseconds:Math.round(ms),averageMillisecondsPerFrame:+(ms/300).toFixed(2),jsHeapMB:memory?+(memory/1048576).toFixed(1):null};
})()
