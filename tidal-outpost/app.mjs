import {createGame,deploy,launch,advance,sectors,facilities} from './game.mjs';
import {backdrop,draw,facility} from './art.mjs';
const $ = id => document.getElementById(id);
const canvas=$('field'), ctx=canvas.getContext('2d',{alpha:false});
const background=document.createElement('canvas');
background.width=canvas.width;background.height=canvas.height;
backdrop(background.getContext('2d'),canvas.width,canvas.height);
const controls=['sector','energy','health','wave','status','launch','pause','audio','overlay','overlay-title','overlay-message','overlay-action','recycle'].reduce((map,id)=>({...map,[id]:$(id)}),{});
const keys=Object.keys(facilities);
let game=createGame(), selected='pulse', paused=false, muted=false, time=0, frame=0, note='', audio;
try{muted=localStorage.getItem('tidal-muted')==='1';}catch{}
const cards=keys.map((kind,index)=>{
  const data=facilities[kind];
  const button=document.createElement('button');
  button.className='card';
  button.innerHTML=`<canvas width="64" height="64" aria-hidden="true"></canvas><strong>${data.name}</strong><b>${data.cost}</b><small>${data.note}</small>`;
  button.dataset.facility=kind;
  button.setAttribute('aria-label',`${index+1}，${data.name}，${data.cost} 能量。${data.note}`);
  facility(button.firstElementChild.getContext('2d'),kind,32,37,1.08);
  button.onclick=()=>select(kind);
  $('cards').append(button);
  return button;
});
const pads=Array.from({length:28},(_,index)=>{
  const row=Math.floor(index/7),col=index%7;
  const button=document.createElement('button');
  button.setAttribute('aria-label',`航道 ${row+1}，泊位 ${col+1}`);
  button.tabIndex=index===0?0:-1;
  button.onclick=()=>{
    if(paused)return;
    unlock();
    note=deploy(game,selected,row,col);
    drawFrame();
  };
  button.onkeydown=e=>{
    const offset={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7}[e.key];
    if(!offset)return;
    e.preventDefault();
    const next=index+offset;
    if (next<0 || next>=28 || Math.abs(offset)===1 && Math.floor(next/7)!==row) return;
    button.tabIndex=-1;pads[next].tabIndex=0;pads[next].focus();
  };
  $('pads').append(button);
  return button;
});
function select(kind){selected=kind;note='';update();}
function unlock(){
  if (muted) return;
  const Audio=window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try{audio??=new Audio();if(audio.state==='suspended')void audio.resume().catch(()=>{});}catch{}
}
function sound(){
  if(!muted&&audio?.state==='running'){
    for(const event of new Set(game.sound)){
      const now=audio.currentTime;
      const hz={build:420,power:620,fire:190,hit:80,wave:280}[event];
      const oscillator=audio.createOscillator(),gain=audio.createGain();
      oscillator.frequency.setValueAtTime(hz,now);
      oscillator.frequency.exponentialRampToValueAtTime(hz*(event==='wave'?1.7:.59),now+.13);
      gain.gain.setValueAtTime(event==='fire'?.023:.065,now);
      gain.gain.exponentialRampToValueAtTime(.001,now+.16);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);oscillator.stop(now+.17);
    }
  }
  game.sound.length=0;
}
function setText(node,text){if(node.textContent!==text)node.textContent=text;}
function update(){
  setText(controls.sector,sectors[game.sector]);setText(controls.energy,String(game.energy));
  setText(controls.health,`${Math.max(0,game.health)} / 5`);setText(controls.wave,`${game.wave} / 5`);
  setText(controls.status,note||(game.phase==='battle'
    ? `外海还有 ${game.enemies.length+game.queue.length} 艘来袭船只。`
    : game.wave===0?'四条航道都会受袭。部署后启动第一波。':'已补给 24 能量。可以调整设施，再迎击下一波。'));
  controls.launch.disabled=game.phase!=='build'||paused;
  setText(controls.launch,game.wave===0?'迎击第一波':'迎击下一波');
  controls.pause.disabled=game.phase!=='battle';
  setText(controls.pause,paused?'继续':'暂停');
  setText(controls.audio,muted?'音效关':'音效开');controls.audio.setAttribute('aria-pressed',String(!muted));
  controls.recycle.setAttribute('aria-pressed',String(selected==='recycle'));
  cards.forEach((card,index)=>{
    const pressed=String(selected===keys[index]), affordable=String(game.energy>=facilities[keys[index]].cost);
    if(card.getAttribute('aria-pressed')!==pressed)card.setAttribute('aria-pressed',pressed);
    if(card.dataset.affordable!==affordable)card.dataset.affordable=affordable;
  });
  const shown=paused||game.phase==='lost'||game.phase==='won';
  if(controls.overlay.hidden===shown){
    controls.overlay.hidden=!shown;
    $('pads').inert=shown;
  }
  if(!shown)return;
  const next=game.phase==='won'&&game.sector<sectors.length-1;
  setText(controls['overlay-title'],paused?'已暂停':game.phase==='lost'?'信标熄灭':next?'海域已守住':'信标长明');
  setText(controls['overlay-message'],paused?'准备好后，继续守望。':game.phase==='lost'?'试着在开局优先保护薄弱航道。':next?`下一站 · ${sectors[game.sector+1]}`:'三片海域均已守住。');
  setText(controls['overlay-action'],paused?'继续战斗':next?'进入下一海域':game.phase==='lost'?'重试该海域':'重新出航');
}
function drawFrame(){draw(ctx,background,game);update();sound();}
function tick(now){
  frame=0;
  if(paused||game.phase!=='battle')return;
  if(now-time>=31){
    advance(game,Math.min((now-time)/1000,.08));
    time=now;drawFrame();
  }
  if(game.phase==='battle')frame=requestAnimationFrame(tick);
  else if(!controls.overlay.hidden)controls['overlay-action'].focus();
}
function begin(){if(!frame){time=performance.now();frame=requestAnimationFrame(tick);}}
controls.launch.onclick=()=>{unlock();note='';if(launch(game)){drawFrame();begin();}};
function togglePause(){
  if(game.phase!=='battle')return;
  paused=!paused;drawFrame();
  if(paused){cancelAnimationFrame(frame);frame=0;controls['overlay-action'].focus();}
  else {begin();controls.pause.focus();}
}
controls.pause.onclick=togglePause;
controls['overlay-action'].onclick=()=>{
  if(paused){togglePause();return;}
  const sector=game.phase==='lost'?game.sector:game.sector<sectors.length-1?game.sector+1:0;
  game=createGame(sector);selected='pulse';note='';drawFrame();controls.launch.focus();
};
controls.recycle.onclick=()=>select(selected==='recycle'?'pulse':'recycle');
controls.audio.onclick=()=>{muted=!muted;if(!muted)unlock();try{localStorage.setItem('tidal-muted',muted?'1':'0');}catch{}update();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused&&game.phase==='battle')togglePause();});
document.addEventListener('keydown',e=>{
  if(e.altKey||e.ctrlKey||e.metaKey)return;
  if(keys[Number(e.key)-1])select(keys[Number(e.key)-1]);
  if(e.key==='Escape')togglePause();
});
drawFrame();
