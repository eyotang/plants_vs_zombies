// 控制台运行；检查商店、永久道具、领取唯一性、存储及暂停恢复，并保留原进度。
(()=>{
 const oldProgress=structuredClone(progress),oldStored=localStorage.getItem('pvz-progress-v1');const passed=[];
 const assert=(v,name)=>{if(!v)throw Error(name);passed.push(name)};
 const savedEntitlement=localStorage.getItem('pvz-collector-owned-v1');
 try{
 localStorage.removeItem('pvz-collector-owned-v1');localStorage.removeItem('pvz-progress-v1');
 progress={coins:200,highestWave:1,collector:false,enabled:true,wins:0};start();cancelAnimationFrame(raf);state.nextSpawn=999;
 buyCollector();assert(!progress.collector&&progress.coins===200,'未解锁不能购买');
 reachWave(3);assert(progress.highestWave===3,'第3波永久解锁');
 progress.coins=149;buyCollector();assert(!progress.collector&&progress.coins===149,'金币不足不会扣款');
 progress.coins=150;buyCollector();assert(progress.collector&&progress.enabled&&progress.coins===0,'购买扣款并开启');
 buyCollector();assert(progress.coins===0,'已拥有不能重复购买');
 start();cancelAnimationFrame(raf);state.nextSpawn=999;state.sky=999;dropSun(300,300,300);for(let i=0;i<35;i++)update(.04);assert(state.sun===175&&state.suns.length===0,'拥有道具后自动收阳光');
 dropSun(300,300,300);const sun=state.suns[0];collect(sun);for(let i=0;i<35;i++)update(.04);collect(sun);assert(state.sun===200,'手动与自动不会重复领取');
 progress.enabled=false;progressDirty=true;saveProgress();dropSun(300,300,300);for(let i=0;i<35;i++)update(.04);assert(state.sun===200&&state.suns.length===1,'关闭自动后保留手动玩法');assert(readProgress().collector&&!readProgress().enabled,'拥有状态与开关持久保存');
 openShop();assert(state.paused&&!$('shopOverlay').hidden,'战斗打开商店自动暂停');const time=state.time;closeShop();cancelAnimationFrame(raf);assert(!state.paused&&state.time===time,'关闭商店回到原战斗');
 pause(true);openShop();closeShop();assert(state.paused&&!$('pauseOverlay').hidden,'从暂停菜单进入商店后仍暂停');
 progress.collector=false;start();cancelAnimationFrame(raf);state.wave=5;end(true);assert(progress.collector&&progress.enabled&&progress.wins===1,'首次通关获赠收集器');const coins=progress.coins;end(true);assert(progress.coins===coins&&progress.wins===1,'通关奖励只发一次');
 const result={passed};return result;
 }finally{if(savedEntitlement===null)localStorage.removeItem('pvz-collector-owned-v1');else localStorage.setItem('pvz-collector-owned-v1',savedEntitlement);progress=oldProgress;progressDirty=false;if(oldStored===null)localStorage.removeItem('pvz-progress-v1');else localStorage.setItem('pvz-progress-v1',oldStored);home();renderShop()}
})()
