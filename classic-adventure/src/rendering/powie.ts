import {Container,Sprite,type Texture} from 'pixi.js';

// Powie.xml only: two capped cloud emitters and a 50-tick word emitter.
const holdFade=(time:number,hold:number)=>Math.max(0,Math.min(1,(1-time)/(1-hold)));
export function powieRandom(seed:number) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
}
type Cloud={sprite:Sprite;born:number;duration:number;x:number;y:number;vx:number;vy:number;spin:number;scale:number;large:boolean};
export class Powie {
  readonly root=new Container();
  private clouds:Cloud[]=[];
  private word:Sprite;
  private age=-1;
  constructor(cloud:Texture,word:Texture,random:()=>number) {
    for(const large of [false,true]){
      const group:Sprite[]=[];
      for(let i=0;i<14;i++){
        const duration=Math.max(1,Math.trunc(40+random()*20));
        const speed=large?5+random()*7:20+random()*5,angle=random()*2*Math.PI,radius=10+random()*40;
        const sprite=new Sprite(cloud);sprite.anchor.set(.5);sprite.visible=false;group.unshift(sprite);
        sprite.rotation=random()*2*Math.PI;
        this.clouds.push({sprite,born:Math.ceil((i+1)/1.5)-1,duration,x:Math.sin(angle)*radius,y:Math.cos(angle)*radius,vx:Math.sin(angle)*speed,vy:Math.cos(angle)*speed,spin:(-200+random()*400)*.01*Math.PI/180,scale:large?1.2+random()*.4:.5,large});
      }
      // The native linked list draws the newest cloud before older clouds.
      this.root.addChild(...group);
    }
    this.word=new Sprite(word);this.word.anchor.set(.5);this.root.addChild(this.word);
    this.update(0);
  }
  update(age:number) {
    const next=Math.max(this.age,Math.max(0,Math.min(200,Math.floor(age))));
    // Fixed 10ms particle updates, independent of render frequency or game speed.
    for(let tick=this.age+1;tick<=next;tick++)for(const p of this.clouds){
      const lived=tick-p.born;if(lived<0||lived>=p.duration)continue;
      const t=lived/(p.duration-1),friction=1-holdFade(t,.4),fx=p.large?.12:.15;
      p.vx*=1-(fx+(1-fx)*friction);p.vy*=1-(.18+.82*friction);
      p.x+=p.vx;p.y+=p.vy;p.sprite.rotation+=p.spin;
    }
    this.age=next;
    const systemAlpha=holdFade(next/199,.8);
    for(const p of this.clouds){
      const lived=next-p.born;p.sprite.visible=lived>=0&&lived<p.duration;
      if(!p.sprite.visible)continue;
      const t=lived/(p.duration-1);
      p.sprite.position.set(p.x,p.y);p.sprite.scale.set(p.scale*holdFade(t,.6));
      p.sprite.alpha=Math.round(255*holdFade(t,.7)*systemAlpha)/255;
      const green=p.large?.9-.5*t:.7*(1-t);
      p.sprite.tint=0xff0000|(Math.round(green*255)<<8);
    }
    this.word.visible=next<50;
  }
}
