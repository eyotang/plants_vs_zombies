// 按正常阳光收入、卡牌冷却和指定出怪脚本自动试玩五关；不增加阳光或伤害。
(async()=>{
 const old=structuredClone(progress),stored=localStorage.getItem('pvz-progress-v1'),oldDeck=[...selectedDeck],oldMuted=muted,reports=[];
 const deck=['sun','pea','nut','ice','twin','cherry','mine','three'];
 const seed=(type,r,c)=>{if(!selectedDeck.includes(type)||plantAt(r,c)||state.sun<TYPES[type].cost||state.cooldowns[type]>0)return false;state.selected=type;place(r,c);return !!plantAt(r,c)};
 const savedEntitlement=localStorage.getItem('pvz-collector-owned-v1');
 try{
 localStorage.removeItem('pvz-collector-owned-v1');localStorage.removeItem('pvz-progress-v1');muted=true;syncAudioButton();progress.collector=false;
 for(const number of [1,2,3,4,5]){
  await prepareAndStart({mode:'campaign',level:number,deck:number>=4?[]:number===3?['sunshroom','puff','scaredy','nut','ice','mine','iceShroom','hypno']:deck});cancelAnimationFrame(raf);progress.collector=false;
  for(let step=0;step<30*260&&!state.over;step++){
   for(const sun of state.suns)if(!sun.dead&&sun.y>=GRID.y)collect(sun,true);
   const rows=Array.from({length:5},(_,r)=>({r,enemies:state.enemies.filter(e=>!e.dead&&!e.hypno&&e.r===r)})).sort((a,b)=>Math.min(...a.enemies.map(e=>e.x))-Math.min(...b.enemies.map(e=>e.x)));
   if(number>=4){
    const threats=state.enemies.filter(e=>!e.dead&&!e.hypno).sort((a,b)=>a.x-b.x);
    for(const card of [...state.belt]){
     if(!threats.length)break;
     let target=threats[0],c=2;
     if(number===5){
      if(card.type==='rednut'&&threats.length===1&&target.hp<=200&&state.belt.some(other=>other.type==='rollnut'))continue;
      if(card.type==='rednut')target=threats.slice().sort((a,b)=>threats.filter(e=>Math.abs(e.r-b.r)<=1&&Math.abs(e.x-b.x)<180).length-threats.filter(e=>Math.abs(e.r-a.r)<=1&&Math.abs(e.x-a.x)<180).length)[0];
      select(card.type,card.id);place(target.r,1);
     }else{
      const shooters=state.plants.filter(p=>!p.dead&&['pea','ice','twin'].includes(p.type));
      if(['pea','ice','twin'].includes(card.type))target=threats.find(e=>!shooters.some(p=>p.r===e.r))??target;
      c=card.type==='nut'?6:card.type==='mine'?5:['cherry','chomper'].includes(card.type)?Math.max(0,Math.min(8,Math.floor((target.x-GRID.x)/CW))):2;
      for(const cell of [c,c-1,c+1,3,1])if(cell>=0&&cell<9&&!plantAt(target.r,cell)){select(card.type,card.id);place(target.r,cell);break}
     }
    }
   }else if(number<=2){
    for(const {r,enemies} of rows)if(enemies.length){if(!state.plants.some(p=>!p.dead&&p.r===r&&p.type==='pea'))seed('pea',r,2);if(enemies.some(e=>e.x<GRID.x+CW*6.6)&&!plantAt(r,5))seed('nut',r,5);if(enemies.length>=2)seed('pea',r,1)}
    if(state.plants.filter(p=>!p.dead&&p.type==='sun').length<2&&state.time<25){seed('sun',0,0);seed('sun',1,0)}
   }else{
    if(state.plants.filter(p=>!p.dead&&p.type==='sunshroom').length<2){seed('sunshroom',0,0);seed('sunshroom',1,0)}
    for(const {r,enemies} of rows)if(enemies.length){const nearest=enemies.reduce((a,b)=>a.x<b.x?a:b);if(nearest.x<320){const c=Math.max(0,Math.min(8,Math.floor((nearest.x-GRID.x)/CW)));for(const cell of [c,c-1,c+1])if(cell>=0&&cell<9&&seed('hypno',r,cell))break}seed('scaredy',r,1);}
    for(const c of [4,3,2])for(const {r} of rows)seed('puff',r,c);
    for(const {r,enemies} of rows)if(enemies.some(e=>e.x<GRID.x+500))seed('nut',r,6);
   }
   update(1/30);
  }
  const won=state.over&&state.scriptIndex===state.level.enemies.length&&!state.enemies.some(e=>!e.dead&&!e.hypno);reports.push({level:number,won,gameSeconds:Math.round(state.time),kills:state.kills,sun:state.sun,remaining:state.enemies.map(e=>({type:e.type,hypno:!!e.hypno,r:e.r,x:Math.round(e.x)}))});if(!won)throw Error('第'+number+'关试玩未通关：'+JSON.stringify(reports.at(-1)));
 }
 return reports;
 }finally{if(savedEntitlement===null)localStorage.removeItem('pvz-collector-owned-v1');else localStorage.setItem('pvz-collector-owned-v1',savedEntitlement);progress=old;progressDirty=false;selectedDeck=oldDeck;muted=oldMuted;syncAudioButton();if(stored===null)localStorage.removeItem('pvz-progress-v1');else localStorage.setItem('pvz-progress-v1',stored);home();renderShop()}
})()
