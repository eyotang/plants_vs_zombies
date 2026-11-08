// 在本地浏览器中运行，检查受伤与退场动画；不会保留测试产生的金币或进度。
(async()=>{
 const saved=structuredClone(progress),stored=localStorage.getItem('pvz-progress-v1'),wasMuted=muted;const passed=[];
 const check=(ok,label)=>{if(!ok)throw Error(label);passed.push(label)};
 const reset=()=>{start('adventure');cancelAnimationFrame(raf);state.nextSpawn=999;state.sky=999};
 const savedEntitlement=localStorage.getItem('pvz-collector-owned-v1');
 try{
 localStorage.removeItem('pvz-collector-owned-v1');localStorage.removeItem('pvz-progress-v1');
 muted=true;await loadExpansionPack('combat',true);check(art.headless&&art.paperFall&&art.charred,'延后加载受伤与退场素材');
 reset();let e=spawnEnemy('basic',0);e.x=500;damageEnemy(e,100);update(.04);check(e.headless&&enemyArtKey(e)==='headless','半血后进入原参考的掉头状态');check(state.corpses.filter(c=>c.key==='head').length===1,'只生成一次掉头动画');update(.04);check(state.corpses.filter(c=>c.key==='head').length===1,'重复更新不重复生成头部');e.attack=true;check(enemyArtKey(e)==='headlessAttack','无头啃食使用对应动画');
 reset();e=spawnEnemy('paper',1);e.x=500;damageEnemy(e,300);check(state.corpses[0].key==='paperFall','报纸僵尸保留独立倒地动画');const c=state.corpses[0];update(.4);check(c.age===.4&&c.life>0,'倒地按时间推进且不循环');
 reset();e=spawnEnemy('bucket',2);e.x=500;blast({r:2,x:500,y:e.y});check(state.corpses[0].key==='charred','爆炸产生焦黑退场动画');const coins=progress.coins;kill(e);check(progress.coins===coins,'退场只结算一次');
 reset();e=spawnEnemy('bucket',2);kill(e,'swallowed');check(state.kills===1&&state.corpses.length===0,'吞食直接移除，不再显示倒地身体');
 reset();for(let i=0;i<35;i++)addCorpse(spawnEnemy('basic',i%5),'fall');check(state.corpses.length===20,'退场动画保持20个上限');
 reset();state.level=CAMPAIGN_LEVELS[0];state.scriptIndex=state.level.enemies.length;e=spawnEnemy('basic',2);kill(e);update(.04);check(!state.over,'最后一只倒地时不提前弹出胜利面板');for(let i=0;i<200&&!state.over;i++)update(.04);check(state.over,'退场播完后正常通关');
 reset();e=spawnEnemy('flag',0);e.hp=100;update(.04);check(enemyArtKey(e)==='flagHeadless','旗帜僵尸保留旗帜受伤动作');draw();
 return {passed};
 }finally{if(savedEntitlement===null)localStorage.removeItem('pvz-collector-owned-v1');else localStorage.setItem('pvz-collector-owned-v1',savedEntitlement);progress=saved;progressDirty=false;muted=wasMuted;syncAudioButton();if(stored===null)localStorage.removeItem('pvz-progress-v1');else localStorage.setItem('pvz-progress-v1',stored);home();renderShop()}
})()
