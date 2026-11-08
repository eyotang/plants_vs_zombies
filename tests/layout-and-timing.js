// 浏览器控制台运行：验证当前屏幕布局、触控映射、不同刷新率下的游戏时间。
(()=>{
 const check=(v,label)=>{if(!v)throw Error(label)};const game=document.querySelector('#app').getBoundingClientRect(),board=canvas.getBoundingClientRect();
 check(game.left>=0&&game.right<=innerWidth+1,'游戏不能横向越界');check(game.top>=0&&game.bottom<=innerHeight+1,'游戏不能纵向越界');check(Math.abs(board.width/board.height-W/H)<.01,'草坪比例不能拉伸');
 start();cancelAnimationFrame(raf);select('sun');const r=3,c=4;canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',button:0,clientX:board.left+(GRID.x+(c+.5)*CW)/W*board.width,clientY:board.top+(GRID.y+(r+.5)*RH)/H*board.height}));check(plantAt(r,c)?.type==='sun','触控坐标必须映射到正确格子');
 const savedDraw=draw;const reports=[];try{for(const hz of [60,90,120,144]){state=fresh();state.running=true;state.nextSpawn=999;last=0;accumulator=0;let frames=0;draw=()=>frames++;for(let i=1;i<=hz;i++){loop(i*1000/hz);cancelAnimationFrame(raf)}check(Math.abs(state.time-1)<.001,'不同刷新率下都要前进一秒');check(frames===30,'一秒最多绘制30帧');reports.push({refreshHz:hz,renderedFrames:frames,gameSeconds:state.time})}}finally{draw=savedDraw;home()}
 return {viewport:[innerWidth,innerHeight],game:[Math.round(game.width),Math.round(game.height)],reports};
})()
