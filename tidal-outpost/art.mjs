import {rowY,columnX,facilities} from './game.mjs';

function path(ctx,points,fill,stroke){
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  if (fill){ctx.fillStyle=fill;ctx.fill();}
  if (stroke){ctx.strokeStyle=stroke;ctx.stroke();}
}
function disc(ctx,x,y,r,fill){
  ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
}
export function facility(ctx, kind, x, y, size=1){
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(size,size);
  ctx.lineWidth=2;
  path(ctx,[[-23,7],[-16,-10],[10,-14],[23,-2],[18,12],[-12,15]],'#10232b','#578d8e');
  path(ctx,[[-19,4],[-12,-8],[9,-9],[18,0],[10,8],[-9,11]],'#376168');
  if (kind==='relay'){
    ctx.fillStyle='#e2a761';
    ctx.fillRect(-9,-21,17,27);
    disc(ctx,0,-14,12,'#404846');
    disc(ctx,0,-14,8,'#f6cd82');
    path(ctx,[[0,-22],[5,-15],[1,-15],[1,-6],[-5,-15],[-1,-15]],'#845329');
  } else if(kind==='pulse'){
    path(ctx,[[-14,-4],[-13,-17],[-4,-25],[11,-21],[13,-9],[5,-3]],'#7cbcae','#c4f2d4');
    path(ctx,[[1,-18],[24,-16],[24,-11],[1,-12]],'#d3f4d8','#345f65');
    disc(ctx,-5,-14,4,'#356960');
  }else{
    path(ctx,[[-14,1],[-13,-19],[-5,-22],[-2,-8],[7,-23],[14,-20],[12,0]],'#648fc6','#bee6ff');
    disc(ctx,0,-16,7,'#a0f0ff');disc(ctx,0,-16,3,'#e5fcff');
  }
  ctx.restore();
}
export function backdrop(ctx,w,h){
  const water=ctx.createLinearGradient(0,0,0,h);
  water.addColorStop(0,'#163f48');water.addColorStop(.54,'#153842');water.addColorStop(1,'#0a2937');
  ctx.fillStyle=water;ctx.fillRect(0,0,w,h);
  let seed=32853;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<440;i++){
    const x=random()*w,y=random()*h;
    ctx.fillStyle=i%3?'#8eddd418':'#1227375c';
    ctx.fillRect(x,y,4+random()*37,1);
  }
  path(ctx,[[0,0],[87,0],[108,34],[88,75],[102,128],[78,167],[91,210],[68,249],[102,301],[86,351],[104,400],[0,400]],'#192c35','#558486');
  path(ctx,[[0,28],[66,17],[83,60],[57,98],[82,158],[58,196],[71,258],[52,319],[79,371],[0,392]],'#243e46');
  ctx.font='11px ui-monospace, monospace';
  ctx.fillStyle='#8ab2ba';ctx.fillText('航道',120,24);
  ctx.fillStyle='#d9ab72';ctx.textAlign='right';ctx.fillText('外海入口',919,24);ctx.textAlign='left';
  ctx.setLineDash([5,8]);
  for(let row=0;row<4;row++){
    const y=rowY(row);
    ctx.strokeStyle='#73c2bd45';ctx.beginPath();ctx.moveTo(110,y);ctx.lineTo(938,y);ctx.stroke();
    ctx.fillStyle='#aaccce';ctx.fillText(String(row+1).padStart(2,'0'),14,y+4);
  }
  ctx.setLineDash([]);
  for(let row=0;row<4;row++){
    const y=rowY(row);
    disc(ctx,53,y,18,'#192e32');disc(ctx,53,y,11,'#3d7b6d');disc(ctx,53,y,6,'#b9fad0');
    for(let col=0;col<7;col++){
      const x=columnX(col);
      path(ctx,[[x-23,y],[x-10,y-13],[x+10,y-13],[x+23,y],[x+10,y+13],[x-10,y+13]],'#0d2934','#4b8588');
      ctx.fillStyle='#6eb6ae';ctx.fillRect(x-2,y-2,4,4);
    }
  }
}
function enemyArt(ctx, enemy){
  const { x, row, kind, slow } = enemy;
  const y=rowY(row);
  const size=kind==='barge'?1.32:kind==='dart'?.77:1;
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  path(ctx,[[4,-12],[41,-7],[32,-2],[48,4],[19,12],[5,9]],'#b8e4d34d');
  path(ctx,[[-24,1],[-10,-11],[17,-9],[22,7],[11,14],[-9,11]],slow?'#658eb3':'#915e4c','#e6ad7e');
  path(ctx,[[-8,-10],[1,-20],[12,-18],[13,-5],[-9,-3]],'#c48c66');
  ctx.fillStyle='#f7d5a1';ctx.fillRect(-5,-11,10,3);
  ctx.fillStyle='#071a23';ctx.fillRect(-16,18,34,3);
  ctx.fillStyle=slow?'#a1e4fc':'#ffbc80';ctx.fillRect(-16,18,34*enemy.hp/({barge:155,dart:40,skiff:64}[kind]),3);
  ctx.restore();
}
export function draw(ctx, background, game){
  ctx.drawImage(background,0,0);
  for(const tower of game.towers){
    const y=rowY(tower.row);
    facility(ctx,tower.kind,tower.x,y);
    if(tower.hp<facilities[tower.kind].hp){
      ctx.fillStyle='#101e29';ctx.fillRect(tower.x-17,y+18,34,3);
      ctx.fillStyle='#96e5ac';ctx.fillRect(tower.x-17,y+18,34*tower.hp/facilities[tower.kind].hp,3);
    }
  }
  for(const enemy of game.enemies) enemyArt(ctx,enemy);
  for(const shot of game.shots){
    const y=rowY(shot.row)-12;
    ctx.globalAlpha=Math.min(1,shot.life*8);
    ctx.strokeStyle=shot.kind==='arc'?'#8de7ff':'#fcdc8c';ctx.lineWidth=shot.kind==='arc'?3:2;
    ctx.beginPath();ctx.moveTo(shot.x+12,y);
    if(shot.kind==='arc')ctx.lineTo((shot.x+shot.end)/2,y-8);
    ctx.lineTo(shot.end,y);ctx.stroke();
    disc(ctx,shot.end,y,3,ctx.strokeStyle);ctx.globalAlpha=1;
  }
}
