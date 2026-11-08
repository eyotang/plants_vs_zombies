// 浏览器控制台运行；验证全部植物能力、夜晚、传送带、保龄球与真实脚本关卡。
(async()=>{
 const old=structuredClone(progress),stored=localStorage.getItem('pvz-progress-v1'),oldDeck=[...selectedDeck],oldMuted=muted;const passed=[];
 const check=(value,label)=>{if(!value)throw Error(label);passed.push(label)};
 const reset=(night=false)=>{start('adventure');cancelAnimationFrame(raf);state.night=night;state.sky=999;state.nextSpawn=999;progress.collector=false;state.sun=10000};
 const plant=(type,r=2,c=2)=>{state.selected=type;state.cooldowns[type]=0;place(r,c);return plantAt(r,c)};
 const enemy=(type='basic',x=800,r=2)=>{const e=spawnEnemy(type,r);e.x=x;return e};const ticks=seconds=>{for(let i=0;i<Math.ceil(seconds/.04);i++)update(.04)};
 const savedEntitlement=localStorage.getItem('pvz-collector-owned-v1');
 try{
 localStorage.removeItem('pvz-collector-owned-v1');localStorage.removeItem('pvz-progress-v1');
 muted=true;syncAudioButton();await Promise.all(['garden','night','bowling'].map(group=>loadExpansionPack(group)));await Promise.all(['garden','night','bowling'].map(group=>loadExpansionPack(group,true)));
 check(PLANT_TYPES.length===17,'17种经典植物可选');check(CAMPAIGN_LEVELS.map(l=>l.enemies.length).join(',')==='13,13,14,26,23','五关保留参考项目的敌人数与顺序');
 reset();let p=plant('three',0,2);enemy('basic',800,1);p.timer=0;update(.04);check(state.peas.map(q=>q.r).sort().join(',')==='0,1','三线射手在草坪边界只覆盖有效行');
 reset();p=plant('mine');enemy('cone',p.x+40);p.age=14.8;update(.04);check(state.kills===0&&!p.dead,'土豆地雷尚未埋好不能引爆');ticks(.24);check(state.kills===1&&p.dead,'土豆地雷15秒后触碰引爆');
 reset();p=plant('chomper');enemy('bucket',p.x+65);ticks(.9);check(state.kills===1&&p.digest>14,'大嘴花吞掉水桶并进入消化');enemy('basic',p.x+65);ticks(1);check(state.kills===1,'消化期间不能再次吞食');
 reset();p=plant('squash');enemy('bucket',p.x+70);ticks(1.8);check(state.kills===1&&p.dead,'窝瓜瞄准跳起并压扁僵尸');
 reset();p=plant('spike');const e=enemy('basic',p.x);ticks(2.5);check(e.hp<e.maxHp&&p.hp===p.maxHp,'地刺伤害路过僵尸且不可被啃食');
 reset();p=plant('jalapeno');enemy('bucket',900,2);enemy('basic',900,3);ticks(1);check(state.kills===1&&state.enemies[0].r===3,'火爆辣椒清除整行且不波及其他行');
 reset(false);p=plant('puff');enemy('basic',p.x+200);ticks(.4);check(state.peas.length===0,'白天蘑菇睡眠不射击');state.night=true;p.timer=0;update(.04);check(state.peas.length===1&&state.peas[0].spore,'夜晚小喷菇正常短程攻击');
 reset(true);p=plant('scaredy');const foe=enemy('basic',p.x+100);p.timer=0;update(.04);check(p.scared&&state.peas.length===0,'胆小菇在僵尸靠近时躲藏');foe.x=p.x+350;p.timer=0;update(.04);check(!p.scared&&state.peas.length===1,'胆小菇危险解除后恢复射击');
 reset(true);p=plant('sunshroom');p.timer=0;update(.04);check(state.suns[0].value===12,'幼年阳光菇产12阳光');const before=state.sun;collect(state.suns[0]);check(state.sun===before+12,'小阳光按实际数值结算');p.age=25;p.timer=0;update(.04);check(state.suns.some(s=>s.value===25),'阳光菇长大后产25阳光');
 reset(true);p=plant('iceShroom');const frozen=enemy();p.timer=0;update(.04);const x=frozen.x,age=frozen.age;ticks(.6);check(frozen.freeze>6&&frozen.x===x&&frozen.age===age,'寒冰菇冻结全场并暂停移动');
 reset(true);p=plant('hypno');const friend=enemy('cone',p.x+5);ticks(1.04);check(friend.hypno&&p.dead,'魅惑菇被啃食后转化僵尸');const fx=friend.x;update(.1);check(friend.x>fx,'被魅惑僵尸反向移动');const kills=state.kills;kill(friend);check(state.kills===kills,'友军退场不重复结算金币');
 await prepareAndStart({mode:'campaign',level:3,deck:['sunshroom','puff','nut','ice','scaredy','iceShroom','hypno','jalapeno']});cancelAnimationFrame(raf);state.time=0;state.sky=0;update(.04);check(state.night&&state.suns.length===0,'夜间关卡没有天降阳光');
 await prepareAndStart({mode:'campaign',level:4,deck:[]});cancelAnimationFrame(raf);const card=state.belt[0],count=state.belt.length;select(card.type,card.id);place(0,0);check(state.sun===0&&state.plants.length===1&&state.belt.length===count-1,'传送带种植免费且消耗对应卡牌');ticks(6.1);check(state.belt.length===count,'传送带按游戏时间补充新卡');
 await prepareAndStart({mode:'campaign',level:5,deck:[]});cancelAnimationFrame(raf);const red=state.belt.find(c=>c.type==='rednut');select(red.type,red.id);place(2,4);check(state.balls.length===0,'保龄球只能在红线左侧投出');place(2,1);enemy('bucket',GRID.x+1.5*CW+40,2);enemy('basic',GRID.x+1.5*CW+40,3);updateBowling(.04);check(state.kills===2&&state.balls.length===0,'爆炸坚果命中后造成三行范围伤害');
 state.enemies=[];state.belt=[{type:'rollnut',id:99}];initBank();select('rollnut',99);place(0,0);enemy('basic',GRID.x+.5*CW+35,0);updateBowling(.04);check(state.balls[0].vy!==0&&state.kills===3,'普通坚果命中后反弹到其他行');
 await prepareAndStart({mode:'campaign',level:1,deck:['sun','pea','nut','ice','twin','cherry','mine','three']});cancelAnimationFrame(raf);state.time=19.99;update(.02);check(state.enemies.length===1&&state.enemies[0].r===0&&state.enemies[0].type==='basic','经典第1关20秒按指定路线出怪');state.scriptIndex=state.level.enemies.length;state.enemies=[];update(.04);check(state.over&&(progress.unlockedLevel??1)>=2&&!$('nextLevelBtn').hidden,'通关解锁下一关并提供继续入口');
 return {passed};
 }finally{if(savedEntitlement===null)localStorage.removeItem('pvz-collector-owned-v1');else localStorage.setItem('pvz-collector-owned-v1',savedEntitlement);progress=old;progressDirty=false;selectedDeck=oldDeck;muted=oldMuted;syncAudioButton();if(stored===null)localStorage.removeItem('pvz-progress-v1');else localStorage.setItem('pvz-progress-v1',stored);home();renderShop()}
})()
