import test from'node:test';import assert from'node:assert/strict';import{Texture,Sprite}from'pixi.js';
import{ActorRig,type ActorDefinition}from'../src/rendering/actor-motion';import type{Pose}from'../src/rendering/plant-motion';import reference from'./helpers/actor-frame-reference.json';
const f=Math.fround;
test('ordinary source global frame positions and float transforms match independent C++ samples',()=>{
 for(const row of reference){const name=row.start===44?'zombie-walk':row.start===91?'zombie-walk2':'zombie-eat';const poses=Array.from({length:row.count},(_,i)=>[f(f(12.34567)+f(i*f(.12345))),0,1,1,0,0,0,1,'body'] as Pose);const definition:ActorDefinition={frames:{body:[0,0,1,1]},clips:{[name]:{duration:188,origin:[0,0],scale:1,healthTop:0,groups:[{length:row.count,tracks:[{name:'body',poses}]}]}}};const rig=new ActorRig('zombie',{definition,textures:{body:Texture.WHITE},file:''});rig.render(name,0,true,false,true,20,row.time);assert.equal(rig.root.children[0].children[0].x,row.pose,`${name}/${row.tick}`);rig.root.destroy({children:true});}
});
test('a visible incoming frame with zero alpha still blends from held visible alpha',()=>{
 const pose=(alpha:number):Pose=>[0,0,1,1,0,0,0,alpha,'body'];const definition:ActorDefinition={frames:{body:[0,0,1,1]},clips:Object.fromEntries(['old','next'].map((name,i)=>[name,{duration:1,origin:[0,0],scale:1,healthTop:0,groups:[{length:1,tracks:[{name:'body',poses:[pose(i?0:1)]}]}]}]))};const rig=new ActorRig('test',{definition,textures:{body:Texture.WHITE},file:''});rig.render('next',0,true,false,true,20,0,{left:10,from:{clip:'old',time:0}});const part=rig.root.children[0].children[0] as Sprite;assert.equal(part.visible,true);assert.equal(part.alpha,.5);assert.equal(part.texture,Texture.WHITE);rig.root.destroy({children:true});
});

import{nativeActorFrame,sampleNativeActorPose}from'../src/rendering/native-actor-frame';
test('source sampling reuses caller storage and clamps the last frame while truncating disappearing parts',()=>{
 const out={frame:0,next:0,fraction:0};for(const row of reference){assert.equal(nativeActorFrame(row.time,row.start,row.count,out),out);assert.equal(out.frame,row.frame);assert.equal(out.next,row.next);assert.equal(out.fraction,row.fraction);}for(let n=0;n<100000;n++)assert.equal(nativeActorFrame((n%1000)/1000,44,47,out),out);nativeActorFrame(1,91,47,out);assert.deepEqual(out,{frame:46,next:46,fraction:0});
 const a:Pose=[1,2,1,1,0,0,0,1,'current'],b:Pose=[2,3,1,1,0,0,-1,0,'next'],pose:Pose=[0,0,1,1,0,0,0,1,''];assert.equal(sampleNativeActorPose(pose,a,b,.5),pose);assert.equal(pose[6],-1);assert.equal(pose[8],'current');sampleNativeActorPose(pose,a,b,0);assert.equal(pose[6],0);assert.equal(pose[7],1);
});
