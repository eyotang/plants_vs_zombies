// 打开游戏后，将本文件整体粘贴到浏览器控制台运行。测试会重置对局。
(()=>{
 const previousProgress=structuredClone(progress);const previousStored=localStorage.getItem('pvz-progress-v1');const results=[];const assert=(condition,label)=>{if(!condition)throw Error(label);results.push(label)};
 const savedEntitlement=localStorage.getItem('pvz-collector-owned-v1');
 const reset=()=>{start('adventure');cancelAnimationFrame(raf);state.nextSpawn=999};
 const enemy=(type='basic',x=700,r=0)=>({type,r,x,y:GRID.y+(r+.5)*RH,...ENEMIES[type],maxHp:ENEMIES[type].hp,slow:0,hit:0,age:0,attack:false});
 try{localStorage.removeItem('pvz-collector-owned-v1');localStorage.removeItem('pvz-progress-v1');
 reset();select('sun');const rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:rect.left+(GRID.x+CW/2)/W*rect.width,clientY:rect.top+(GRID.y+RH/2)/H*rect.height,button:0}));assert(state.plants.length===1&&state.sun===100,'种植位置与扣费');place(0,0);assert(state.plants.length===1,'同格无法重复种植');
 state.selected='sun';state.sun=0;place(1,0);assert(state.plants.length===1,'阳光不足不能种植');
 state.shovel=true;place(0,0);assert(state.plants[0].dead,'铲子移除');
 reset();dropSun(300,100,150);collect(state.suns[0]);collect(state.suns[0]);assert(state.sun===175,'阳光仅收集一次');
 reset();state.sun=500;select('ice');place(0,0);state.enemies=[enemy('basic',GRID.x+CW/2+60)];for(let i=0;i<8;i++)update(.04);assert(state.enemies[0].slow>0,'寒冰命中减速');
 reset();state.sun=500;select('cherry');place(1,4);state.enemies=[enemy('bucket',GRID.x+4.5*CW,0),enemy('cone',GRID.x+4.5*CW,1),enemy('basic',GRID.x+4.5*CW,2),enemy('basic',GRID.x+4.5*CW,4)];for(let i=0;i<25;i++)update(.04);assert(state.kills===3&&state.enemies.length===1,'炸弹范围三行与击杀唯一结算');
 reset();state.enemies=[enemy('paper')];state.enemies[0].hp=100;update(.04);assert(state.enemies[0].angry,'报纸破损后狂暴');
 reset();state.enemies=[enemy('basic',20,2)];update(.04);assert(state.mowers[2].used&&state.kills===1,'割草机触发与击杀');
 reset();state.mowers[1].used=true;state.enemies=[enemy('basic',-45,1)];update(.04);assert(state.over&&!state.running,'失败结算');
 reset();state.wave=5;state.spawned=totalForWave(5);update(.04);assert(state.over,'冒险通关');
 start('endless');cancelAnimationFrame(raf);state.wave=5;state.spawned=totalForWave(5);state.nextSpawn=999;for(let i=0;i<160;i++)update(.04);assert(!state.over&&state.wave===6,'无尽进入第六波');
 reset();pause(true);assert(state.paused&&!$('pauseOverlay').hidden,'暂停菜单');pause(false);cancelAnimationFrame(raf);assert(!state.paused,'继续游戏');
 reset();for(let r=0;r<5;r++)for(let c=0;c<9;c++)state.plants.push({type:'twin',r,c,x:GRID.x+(c+.5)*CW,y:GRID.y+(r+.5)*RH,hp:100,maxHp:100,timer:0,hit:0,age:0});for(let i=0;i<50;i++)state.enemies.push(enemy('bucket',W-40+i*2,i%5));
 const begin=performance.now();for(let i=0;i<300;i++){update(1/30);draw()}const elapsed=performance.now()-begin;
 const report={passed:results,stressFrames:300,averageFrameMs:+(elapsed/300).toFixed(2),heapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null};console.table(report);return report;
 }finally{progress=previousProgress;progressDirty=false;if(previousStored===null)localStorage.removeItem('pvz-progress-v1');else localStorage.setItem('pvz-progress-v1',previousStored);home();renderShop();if(savedEntitlement===null)localStorage.removeItem('pvz-collector-owned-v1');else localStorage.setItem('pvz-collector-owned-v1',savedEntitlement);}
})()
