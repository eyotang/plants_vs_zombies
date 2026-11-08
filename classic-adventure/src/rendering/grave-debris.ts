import {Container,Sprite,type Texture} from 'pixi.js';

type Particle={sprite:Sprite;age:number;duration:number;time:number;x:number;y:number;vx:number;vy:number;spin:number;scale:number};
const fade=(time:number,hold:number)=>Math.max(0,Math.min(1,(1-time)/(1-hold)));

// GraveBuster.xml / GraveBusterDie.xml only. Reuse10/20 sprite slots; never
// create display objects in the fixed-tick spawn loop or depend on render FPS.
export class GraveDebris {
 readonly root=new Container();
 readonly duration:number;
 private age=-1;
 private spawnAccum=0;
 private particles:Particle[];
 constructor(private frames:Texture[],private mode:'chew'|'clear',private random:()=>number){
  this.duration=mode==='chew'?400:500;
  this.particles=Array.from({length:mode==='chew'?10:20},()=>{
   const sprite=new Sprite();sprite.anchor.set(.5);sprite.visible=false;this.root.addChild(sprite);
   return {sprite,age:-1,duration:0,time:0,x:0,y:0,vx:0,vy:0,spin:0,scale:1};
  });
  this.update(0);
 }
 update(age:number){
  const next=Math.max(this.age,Math.min(this.duration,Math.max(0,Math.floor(age)))),chew=this.mode==='chew';
  for(let tick=this.age+1;tick<=next;tick++){
   const systemTime=Math.min(tick,this.duration-1)/(this.duration-1);
   for(const p of this.particles)if(p.age>=0){
    if(p.age>=p.duration){p.age=-1;continue;}
    p.time=p.age/(p.duration-1);
    p.vx*=chew?.98:.985;p.vy=p.vy*(chew?.98:.985)+.05;
    p.x+=p.vx;p.y+=p.vy;p.sprite.rotation+=p.spin;p.age++;
   }
   let spawn=0;
   if(chew){this.spawnAccum+=.2;spawn=Math.floor(this.spawnAccum);this.spawnAccum-=spawn;}
   else if(tick===0)spawn=20; // min-active20→0 within25ticks; all live at least30ticks.
   for(let i=0;i<spawn;i++){
    const p=this.particles.find(p=>p.age<0);if(!p)throw new Error('Grave debris slot bound exceeded');
    const speed=(chew?100+this.random()*100:50+this.random()*350)*.01,angle=(140+this.random()*80)*Math.PI/180;
    p.duration=Math.max(1,Math.trunc((chew?40:30)+this.random()*10));p.age=0;p.time=0;
    p.x=(chew?-25:-35)+this.random()*(chew?50:70);p.y=chew?-10-this.random()*8+systemTime*30:-14;
    p.vx=Math.sin(angle)*speed;p.vy=Math.cos(angle)*speed;
    p.sprite.texture=this.frames[Math.min(7,Math.floor(this.random()*8))];p.sprite.rotation=this.random()*2*Math.PI;
    p.spin=(-720+this.random()*1440)*.01*Math.PI/180;p.scale=chew?.3+this.random()*.5:.7+this.random()*.2;
    this.root.addChildAt(p.sprite,0);
   }
   if(tick>=this.duration)for(const p of this.particles)p.age=-1;
  }
  this.age=next;
  const systemAlpha=fade(Math.min(next,this.duration-1)/(this.duration-1),.92);
  for(const p of this.particles){
   p.sprite.visible=p.age>=0;
   if(!p.sprite.visible)continue;
   p.sprite.position.set(p.x,p.y);p.sprite.scale.set(p.scale);p.sprite.alpha=Math.round(255*fade(p.time,.7)*systemAlpha)/255;
  }
 }
}
