import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import{Texture}from'pixi.js';
import{ActorRig,type ActorDefinition}from'../src/rendering/actor-motion';import parts from'../src/rendering/fire-parts.json';import source from'../docs/fire-parts-source.json';import clocks from'./helpers/fire-clock-reference.json';import{advanceFireAnimation,fireAnimationTime}from'../src/game/pea-motion';import{Game,type Pea}from'../src/game/model';
const definition=parts as unknown as ActorDefinition,textures=Object.fromEntries(Object.keys(parts.frames).map(n=>[n,Texture.WHITE]));
const pea=(rate=65):Pea=>({id:900,row:0,x:300,age:0,ice:false,puff:false,fire:true,fireAt:1,fireRate:rate,fireTime:0});
test('original lossless fire part atlas has five source images and cuts decoded RGBA by over97percent',()=>{
 const file=readFileSync(new URL('../'+source.atlas.file,import.meta.url));assert.equal(file.length,source.atlas.bytes);assert.equal(createHash('sha256').update(file).digest('hex'),source.atlas.sha256);assert.equal(Object.keys(parts.frames).length,5);assert.equal(definition.clips.fire.groups[0].tracks.length,5);assert.ok(source.atlas.decodedRGBA<1440000*.03);assert.ok(file.length<8192);
 for(const track of definition.clips.fire.groups[0].tracks){assert.equal(track.poses.length,25);for(const pose of track.poses)assert.ok(!pose[8]||pose[8]in textures);}
});
test('native fire clock matches independently compiled source float32 arithmetic through100000updates',()=>{
 for(const rate of [50,65,80]){const p=pea(rate),expected=clocks.filter(c=>c.rate===rate);for(let n=1;n<=100000;n++){p.age++;advanceFireAnimation(p,n);const c=expected.find(c=>c.tick===n);if(c)assert.equal(p.fireTime,c.time,`${rate}/${n}`);}assert.equal(fireAnimationTime(p,100000),p.fireTime);}
});
test('fire parts interpolate source transforms,visibility,image switches and retain every allocated sprite',()=>{
 const rig=new ActorRig('firepea',{definition,textures,file:''}),group=rig.root.children[0],allocated=[...group.children],tracks=definition.clips.fire.groups[0].tracks;
 for(const time of [0,.125,.25,.375,.5,13.5/24,.625,.75,.875,21.5/24,.999]){rig.render('fire',time,false,false,true);const position=time*24,index=Math.floor(position),fraction=position-index;for(let i=0;i<tracks.length;i++){
  const a=tracks[i].poses[index],b=tracks[i].poses[Math.min(24,index+1)],part=group.children[i];assert.equal(part.visible,a[6]>=0&&a[7]+(b[7]-a[7])*fraction>0&&!(b[6]===-1&&fraction>0));if(part.visible){assert.ok(Math.abs(part.x-(a[0]+(b[0]-a[0])*fraction))<.00001);assert.ok(Math.abs(part.y-(a[1]+(b[1]-a[1])*fraction))<.00001);assert.ok(Math.abs(part.alpha-(a[7]+(b[7]-a[7])*fraction))<.00001);}
 }assert.deepEqual(group.children,allocated);}
 rig.root.destroy({children:true});
});
test('fire clock saves and independent rebuilt rigs produce identical poses without render mutation',()=>{
 const g=new Game(29,23);g.phase='playing';g.started=true;g.waveIn=100000;g.peas=[pea()];g.peas[0].vx=0;for(let n=0;n<17;n++)g.step();g.phase='paused';const before=g.snapshot(),copy=Game.restore(JSON.parse(JSON.stringify(before)));
 const a=new ActorRig('firepea',{definition,textures,file:''}),b=new ActorRig('firepea',{definition,textures,file:''});a.render('fire',fireAnimationTime(g.peas[0],g.ticks),false,false,true);b.render('fire',fireAnimationTime(copy.peas[0],copy.ticks),false,false,true);
 const poses=(r:ActorRig)=>r.root.children[0].children.map(p=>[p.x,p.y,p.scale.x,p.scale.y,p.skew.x,p.skew.y,p.alpha,p.visible]);assert.deepEqual(poses(a),poses(b));assert.deepEqual(g.snapshot(),before);a.root.destroy({children:true});b.root.destroy({children:true});
});
