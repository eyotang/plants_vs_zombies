// 对齐参考项目的每秒啃食、动画相位、豌豆速度和落地阳光寿命。
(async()=>{
 const saved=structuredClone(progress),stored=localStorage.getItem('pvz-progress-v1'),oldMuted=muted;const passed=[];
 const check=(ok,label)=>{if(!ok)throw Error(label);passed.push(label)};
 const reset=()=>{start('adventure');cancelAnimationFrame(raf);progress.collector=false;state.nextSpawn=999;state.sky=999;state.sun=10000};
 const ticks=n=>{for(let i=0;i<n;i++)update(.04)};
 const setup=()=>{reset();state.selected='nut';place(2,2);const p=plantAt(2,2),e=spawnEnemy('basic',2);e.x=p.x+15;return {p,e}};
 const savedEntitlement=localStorage.getItem('pvz-collector-owned-v1');
 try{
 localStorage.removeItem('pvz-collector-owned-v1');localStorage.removeItem('pvz-progress-v1');
 muted=true;await loadExpansionPack('combat',true);
 let {p,e}=setup();ticks(24);check(p.hp===p.maxHp,'第一口之前不持续扣血');ticks(1);check(p.hp===p.maxHp-20,'一秒完成一次20点啃食');check(p.hit===.2,'咬中时触发植物受伤反馈');ticks(25);check(p.hp===p.maxHp-40,'第二口按下一秒结算');
 ({p,e}=setup());e.slow=3;ticks(25);check(p.hp===p.maxHp,'减速时一秒尚未咬完');ticks(25);check(p.hp===p.maxHp-20,'寒冰使啃食间隔加倍');
 ({p,e}=setup());ticks(10);const biteTime=e.biteElapsed,pose=e.poseTime;e.freeze=2;ticks(25);check(p.hp===p.maxHp&&e.biteElapsed===biteTime,'冻结期间停止伤害与啃食计时');check(e.attack&&e.poseTime===pose,'冻结保留当前啃食姿态和动画帧');e.freeze=0;ticks(15);check(p.hp===p.maxHp-20,'解冻后从暂停处继续啃食');
 ({p,e}=setup());ticks(24);p.dead=true;state.selected='nut';state.cooldowns.nut=0;place(2,2);const replacement=plantAt(2,2);ticks(1);check(replacement.hp===replacement.maxHp,'换目标后重新等待第一口');ticks(24);check(replacement.hp===replacement.maxHp-20,'新目标按完整一秒后受伤');
 reset();e=spawnEnemy('basic',2);e.x=600;ticks(6);const before=e.poseTime;e.slow=2;ticks(1);check(Math.abs(e.poseTime-before-.02)<1e-8,'切换寒冰只改变后续速度，不跳动画帧');e.slow=0;const slowed=e.poseTime;ticks(1);check(Math.abs(e.poseTime-slowed-.04)<1e-8,'减速解除后动画连续推进');e.hp=100;ticks(1);check(e.pose==='headless'&&e.poseTime===0,'进入受伤姿态从首帧开始');
 reset();state.selected='twin';place(2,2);p=plantAt(2,2);shootPlant(p);check(state.peas.length===2&&state.peas[1].x-state.peas[0].x===40,'双发豌豆按参考间隔40像素');const x=state.peas[0].x;ticks(25);check(Math.abs(state.peas[0].x-x-240)<1e-6,'豌豆每秒240像素，等价参考60Hz每帧4像素');
 reset();dropSun(300,0,600);const sun=state.suns[0];ticks(200);check(!sun.dead&&sun.life===7&&Math.abs(sun.y-480)<1e-6,'下降途中不消耗落地七秒寿命');ticks(50);check(Math.abs(sun.y-600)<1e-6&&sun.life>6.99,'阳光按参考60像素每秒落下');ticks(174);check(!sun.dead,'落地后接近七秒仍可收集');ticks(2);check(sun.dead,'落地满七秒后消失');
 reset();state.night=true;state.selected='hypno';place(2,2);p=plantAt(2,2);e=spawnEnemy('basic',2);e.x=p.x+15;ticks(24);check(!e.hypno&&!p.dead,'魅惑在真正被咬之前不提前触发');ticks(1);check(e.hypno&&p.dead,'第一口完成时触发魅惑');
 return {passed};
 }finally{if(savedEntitlement===null)localStorage.removeItem('pvz-collector-owned-v1');else localStorage.setItem('pvz-collector-owned-v1',savedEntitlement);progress=saved;progressDirty=false;muted=oldMuted;syncAudioButton();if(stored===null)localStorage.removeItem('pvz-progress-v1');else localStorage.setItem('pvz-progress-v1',stored);home();renderShop()}
})()
