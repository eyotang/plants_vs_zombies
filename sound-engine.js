'use strict';
// One cached music buffer and bounded, short effects. No downloaded audio or per-frame audio work.
const GameAudio=(()=>{
 let context,master,musicGain,fxGain,music,buffer,rendering,enabled=true,active=false,idleTimer,voices=0,notesPlayed=0,musicRms=0,musicRenderMs=0;
 const recent=new Map();
 function stopMusic(){if(music){try{music.stop()}catch{}music.disconnect();music=null}}
 function tone(frequency,duration=.1,type='sine',volume=.1,delay=0,endFrequency=frequency*.55){
  if(!context||!enabled||context.state!=='running'||voices>=12)return;
  const o=context.createOscillator(),g=context.createGain(),when=context.currentTime+delay;voices++;notesPlayed++;
  o.type=type;o.frequency.setValueAtTime(frequency,when);o.frequency.exponentialRampToValueAtTime(Math.max(25,endFrequency),when+duration);
  g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(volume,when+.005);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
  o.connect(g);g.connect(fxGain);o.onended=()=>{o.disconnect();g.disconnect();voices=Math.max(0,voices-1)};o.start(when);o.stop(when+duration+.01);
 }
 async function makeMusic(){
  if(!enabled)return;
  if(rendering)return rendering;
  const renderStart=performance.now();rendering=(async()=>{
   const beat=60/108,bars=8,rate=22050,offline=new OfflineAudioContext(1,Math.ceil(bars*4*beat*rate),rate);
   const output=offline.createGain();output.gain.value=1.8;output.connect(offline.destination);
   function note(midi,start,duration,volume,kind='triangle'){
    const o=offline.createOscillator(),g=offline.createGain();o.type=kind;o.frequency.value=440*2**((midi-69)/12);
    g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(volume,start+.008);g.gain.exponentialRampToValueAtTime(.0001,start+duration);
    o.connect(g);g.connect(output);o.start(start);o.stop(start+duration+.01);
   }
   const tunes=[[74,0,77,76,74,69,72,0],[70,0,74,72,70,67,69,0],[73,0,76,74,73,69,67,0],[74,77,81,0,79,77,76,72],[74,0,69,72,77,76,74,0],[79,0,77,74,70,72,74,0],[76,0,73,69,76,74,73,0],[74,0,77,76,74,0,69,0]];
   const chords=[[50,57,62,65],[43,50,55,58],[45,52,57,61],[50,57,62,65]];
   for(let bar=0;bar<bars;bar++){
    const chord=chords[bar%4],phrase=tunes[bar%8],base=bar*4*beat;
    for(let i=0;i<8;i++)if(phrase[i]){const t=base+i*beat/2;note(phrase[i],t,beat*.65,.052);note(phrase[i]+12,t,beat*.35,.009,'sine')}
    for(let i=0;i<4;i++){note(i%2?chord[1]:chord[0],base+i*beat,beat*.7,.065,'sine');if(i%2)for(const n of chord.slice(1))note(n+12,base+(i+.1)*beat,beat*.35,.012)}
   }
   return offline.startRendering();
  })();
  try{buffer=await rendering;musicRenderMs=performance.now()-renderStart;const samples=buffer.getChannelData(0);let power=0,count=0;for(let i=0;i<samples.length;i+=64){power+=samples[i]*samples[i];count++}musicRms=Math.sqrt(power/count);if(active&&enabled)startMusic()}catch{rendering=null}
 }
 function startMusic(){if(!context||!buffer||music||!enabled||!active)return;music=context.createBufferSource();music.buffer=buffer;music.loop=true;music.connect(musicGain);music.start()}
 function unlock(){
  if(!enabled)return;
  try{
   if(!context){context=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});master=context.createGain();master.gain.value=.75;master.connect(context.destination);musicGain=context.createGain();musicGain.gain.value=1.05;musicGain.connect(master);fxGain=context.createGain();fxGain.gain.value=.55;fxGain.connect(master)}
   if(!buffer&&!rendering)setTimeout(makeMusic,80);
   if(context.state==='suspended')context.resume().then(startMusic).catch(()=>{});else startMusic();
  }catch{}
 }
 function setScene(running,immediate=false){active=running;clearTimeout(idleTimer);if(running&&enabled){unlock();startMusic()}else{stopMusic();if(context){if(immediate)context.suspend().catch(()=>{});else idleTimer=setTimeout(()=>{if(!active)context.suspend().catch(()=>{})},2000)}}}
 function setMuted(muted){enabled=!muted;if(!enabled){stopMusic();if(context)context.suspend().catch(()=>{})}else if(active)unlock()}
 function play(name){
  if(!enabled)return;unlock();if(!context)return;
  const now=context.currentTime,minimum={shoot:.075,hit:.08,chomp:.45,zombie:3,collect:.055}[name]??.025;
  if(now-(recent.get(name)??-100)<minimum)return;recent.set(name,now);
  const sequence=(notes,step=.11,volume=.12)=>notes.forEach((n,i)=>tone(n,step*1.4,'triangle',volume,i*step,n));
  switch(name){
   case 'select':tone(520,.045,'triangle',.07);break;
   case 'plant':tone(180,.11,'triangle',.18);tone(95,.13,'sine',.16,.025,45);break;
   case 'shovel':tone(950,.07,'triangle',.055,0,280);tone(130,.12,'triangle',.12,.04,55);break;
   case 'shoot':tone(430,.065,'sine',.1,0,85);break;
   case 'hit':tone(165,.045,'triangle',.065,0,65);break;
   case 'ice':tone(1300,.12,'sine',.05,0,700);break;
   case 'collect':sequence([880,1175],.07,.14);break;
   case 'chomp':tone(90,.075,'sawtooth',.035,0,45);tone(155,.05,'triangle',.06,.05,60);break;
   case 'zombie':tone(74,.5,'sawtooth',.035,0,48);tone(108,.4,'sine',.05,.06,55);break;
   case 'boom':tone(65,.6,'sawtooth',.18,0,25);tone(130,.25,'triangle',.15,.025,30);break;
   case 'mower':tone(90,.8,'sawtooth',.055,0,140);tone(44,.9,'triangle',.07,0,70);break;
   case 'wave':sequence([294,349,440],.14,.12);break;
   case 'buy':sequence([660,880,1175],.09,.15);break;
   case 'win':sequence([523,659,784,1047,784,1047],.16,.15);break;
   case 'lose':sequence([220,196,147,110],.23,.14);break;
   case 'kill':tone(110,.1,'triangle',.065,0,42);break;
  }
 }
 return {unlock,setScene,setMuted,play,tone,stats:()=>({enabled,active,voices,notesPlayed,state:context?.state??'not-started',musicReady:!!buffer,musicRms,musicRenderMs,musicBytes:buffer?buffer.length*4:0})};
})();
