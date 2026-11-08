// 点击一次“冒险模式”后在控制台执行，检查音频实际启用、音乐能量、效果音和暂停。
(async()=>{
 const oldMuted=muted,stored=localStorage.getItem('pvz-audio-muted');const passed=[];
 const assert=(value,label)=>{if(!value)throw Error(label);passed.push(label)};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
 muted=false;syncAudioButton();start();cancelAnimationFrame(raf);GameAudio.setScene(true);GameAudio.unlock();
 const deadline=performance.now()+5000;while(!GameAudio.stats().musicReady&&performance.now()<deadline)await wait(30);
 const music=GameAudio.stats();assert(music.musicReady&&music.musicRms>.001,'背景音乐已生成且有实际音频能量');assert(music.state==='running','点击开始后音频上下文正常运行');assert(music.musicBytes<4000000,'缓存音乐不超过4MB');
 await wait(700);const before=GameAudio.stats().notesPlayed;sfx('collect');sfx('shoot');sfx('plant');assert(GameAudio.stats().notesPlayed>before,'收阳光、射击、种植确实触发声音');
 for(let i=0;i<100;i++)sfx('hit');assert(GameAudio.stats().voices<=12,'声音并发有上限');await wait(700);assert(GameAudio.stats().voices===0,'短音效结束后释放节点');
 pause(true);await wait(40);assert(GameAudio.stats().state==='suspended'&&!GameAudio.stats().active,'暂停时停止背景音乐和音频处理');
 muted=true;syncAudioButton();const count=GameAudio.stats().notesPlayed;sfx('collect');assert(GameAudio.stats().notesPlayed===count,'静音时不生成音效');
 return {passed,musicRms:+music.musicRms.toFixed(4),musicRenderMs:Math.round(music.musicRenderMs),musicBytes:music.musicBytes};
 }finally{home();muted=oldMuted;syncAudioButton();if(stored===null)localStorage.removeItem('pvz-audio-muted');else localStorage.setItem('pvz-audio-muted',stored)}
})()
