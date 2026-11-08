import {eatAnimationTime,groundWalkTime,hasGroundWalk,ordinaryBodyClip} from '../game/ground-walk';
import { ACTOR_MOTION, ActorMotion, hasActorMotion, ActorRig,type ActorDefinition } from './actor-motion';
import { ZombieHealthBar } from './zombie-health';
import { GIANT_CLIPS, GiantMotion, hasGiantMotion, type GiantRig } from './giant-motion';
import { hasPlantMotion, hasPlantMotionClip, PlantMotion, type PlantRig } from './plant-motion';
import { renderResolution } from './resolution';
import { sceneryPlan } from './scenery';
import { battleViewport, viewportToWorld, worldToViewport, type BattleDisplayMode } from './viewport';
import { stormOpacity } from './storm';
import {squashClip,squashTicks,squashPosition} from './squash-motion';
import {squishedFrame,squishedPosition} from './squished';
import {plantHeightOffset} from './plant-height';
import fireParts from './fire-parts.json';
import { firePeaShotFrame, lobDrawScale } from './projectiles';
import { loadInBatches, loadGraphics } from '../platform/load-queue';
import {releaseBitmapOnDestroy} from './bitmap-lifetime';
import { BossArt } from './boss';
import 'pixi.js/prepare';
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { BOARD, cellX, PLANTS, isPool } from '../game/config';
import { headless, type Game, type GameEvent, type Plant, type Zombie } from '../game/model';
import { walkingCycleTicks } from '../game/zombie-motion';
import {Powie,powieRandom} from './powie';
import {GraveDebris} from './grave-debris';
import {PeaArt,type PeaRig} from './pea-art';
import {isPeaKind,fireAnimationTime} from '../game/pea-motion';

import { animationNames, animationFrame, combatTextureFiles } from './asset-plan';

const NATIVE_SCENERY=new Set(['yard.webp','lawn.webp','original/night.webp','original/pool.webp','original/fog.webp','original/roof.webp','boss/background.webp']);

type ClipData = { frames: number[][]; durations: number[]; anchor: number[]; pages: string[] };
type Clip = { files: string[]; frames: Texture[]; ends: number[]; duration: number; anchors: number[][] };
type Actor = { fireRig?:ActorRig; peaRig?:PeaRig; debris?:GraveDebris; iceTrap?: { back:Sprite; front:Sprite }; nativeAligned?: boolean; nativeRig?: ActorRig; healthBar?: ZombieHealthBar; giantRig?: GiantRig; rig?: PlantRig; root: Container; visual: Container; stretch: boolean; art: Sprite; clip: string; since: number; frame: number; seen: number; previousX: number; previousY: number; previousWalkTime?:number; previousEatTime?:number; previousBlendLeft?:number; previousBlendFrom?:Zombie["bodyBlend"]; motion?: { x: number; y?: number } };
type Effect = { node: Container; born: number; duration: number; proportional?: boolean; actor?: Actor; powie?:Powie; debris?:GraveDebris };

export class Scene {
  readonly app = new Application();
  showZombieHealth = false;
  displayMode: BattleDisplayMode = 'contain';
  private host!: HTMLElement;
  private world = new Container();
  private bossArt?: BossArt;
  private plantMotion = new PlantMotion();
  private peaArt=new PeaArt();
  private actorMotion = new ActorMotion();
  private giantMotion = new GiantMotion();
  private actors = new Map<string, Actor>();
  private squishedTextures = new Map<Plant['kind'],Texture>();
  private effects: Effect[] = [];
  private projectilePool: Actor[] = [];
  private projectileLayers = new Map<number, Container>();
  private firePeaParts: Record<string,Texture> = {};
  private textures: Record<string, Texture> = {};
  private textureFiles: string[] = [];
  private resourceWork = Promise.resolve();
  private animationData?: Promise<{ animations: Record<string, ClipData> }>;
  private clips: Record<string, Clip> = {};
  private hover = new Graphics();
  private target = new Graphics();
  private health = new Graphics();
  private fog = new Container();
  private weather = new Graphics();
  private fogFrames: Texture[] = [];
  private fogKey = '';
  private pointer: { x: number; y: number } | null = null;
  private time = 0;
  private stamp = 0;
  private healthKey = '';
  private hoverKey = '';
  private lawnTextures: Texture[] = [];
  private vaseFrames: Texture[] = [];
  private kelpTargets = new Map<number, NonNullable<Plant['kelp']>>();
  private explosions: { x: number; y: number }[] = [];

  private viewport = battleViewport(BOARD.width, BOARD.height);
  private sceneryTextures: Texture[] = [];
  private scenerySourceX = 220;

  toWorld(x: number, y: number) { return viewportToWorld(this.viewport, x, y); }
  toScreen(x: number, y: number) { return worldToViewport(this.viewport, x, y); }

  setDisplayMode(mode: BattleDisplayMode) {
    this.displayMode = mode;
    this.resize(this.host.clientWidth, this.host.clientHeight);
  }

  private sizeActor(actor: Actor) {
    actor.visual.scale.set(actor.stretch ? 1 : this.viewport.artScaleX, actor.stretch ? 1 : this.viewport.artScaleY);
  }

  private positionPlant(actor:Actor,game:Game,kind:Plant['kind'],column:number,row:number,plant?:Plant) {
    const rig=actor.peaRig??actor.rig??actor.nativeRig;
    if(!rig){actor.root.position.set(cellX(column),game.rowY(row,cellX(column))-(game.config.environment==='roof'&&kind!=='flowerpot'?12:0));return;}
    // Reanim tracks already contain the source transforms, without GIF normalization.
    const small=kind==='potatomine'||kind==='coffeebean';
    rig.root.position.set(0,0);rig.root.scale.set(small?.8:1);
    actor.root.position.set(cellX(column)-40+(small?12:0),game.gridY(column,row)+plantHeightOffset(game,kind,column,row)+(kind==='coffeebean'?10:kind==='potatomine'?12:0));
    if(plant?.kind==='gravebuster'&&plant.gravebuster?.phase!=='landing')actor.root.y+=Math.max(0,Math.min(400,400-plant.actionIn))*.075;
  }

  private positionSquash(actor:Actor,game:Game,plant:Plant) {
    const s=plant.squash!,startY=game.gridY(plant.column,plant.row),offset=actor.root.y-startY;
    // PixelToGridXKeepOnBoard samples the target object's left edge, not its center.
    const column=Math.max(0,Math.min(8,Math.floor((s.x-80)/80)));
    const [x,y]=squashPosition(s,cellX(plant.column),startY,game.gridY(column,plant.row)+8);
    actor.root.position.set(x-40,y+offset);actor.root.zIndex=plant.row*100+60;
  }

  private positionZombie(actor:Actor,game:Game,z:Zombie) {
    const y=game.nativeGroundY(z,actor.root.x);
    actor.nativeAligned=y!==undefined;
    if(y===undefined)return;
    const dx=z.kind==='pole'?-6:z.kind==='catapult'?-25:z.kind==='zomboni'?68:0;
    const dy=z.kind==='football'?-16:z.kind==='pole'?-11:z.kind==='yeti'?-20:z.kind==='catapult'?-18:z.kind==='zomboni'?-23:z.kind==='gargantuar'?-8:z.kind==='pogo'?16:0;
    actor.root.x+=-30+15+dx+(z.backwards||z.hypnotized?90:0);
    actor.root.y=y-8+dy-(z.pogoState?.altitude??0);
  }

  private updateIceTrap(actor:Actor,game:Game,z:Zombie) {
    const inPool=game.waterRow(z.row)&&z.x>90&&z.x<780;
    if((z.frozenIn??0)<=0||inPool||!actor.root.visible||!this.textures.iceTrapFront||!this.textures.iceTrapBack){
      if(actor.iceTrap){actor.iceTrap.back.visible=false;actor.iceTrap.front.visible=false;}
      return;
    }
    if(!actor.iceTrap){
      const back=new Sprite(this.textures.iceTrapBack),front=new Sprite(this.textures.iceTrapFront);
      actor.visual.addChildAt(back,0);actor.visual.addChild(front);actor.iceTrap={back,front};
    }
    let dx=46,dy=92,scale=1;
    switch(z.kind){
      case 'pogo':dx-=10;dy+=20;break;
      case 'gargantuar':dx-=20;dy-=7;scale=1.6;break;
      case 'bungee':dx-=45;dy-=23;scale=1.2;break;
      case 'digger':dx-=27;break;
      case 'catapult':dx+=32;break;
      case 'balloon':dx-=9;dy+=27;break;
    }
    // BeginDraw translates by integer object X/Y. Ice does not inherit the
    // character's reflection or mini scale; DrawIceTrap supplies its own scale.
    const ground=game.nativeGroundY(z)??game.gridY(8,z.row)+game.slope(z.x+10)-30-(z.kind==='pogo'?16:z.kind==='balloon'?30:0);
    const x=Math.trunc(z.x-30)+dx,y=Math.trunc(ground)-(z.pogoState?.altitude??0)+dy;
    const sx=actor.root.scale.x,sy=actor.root.scale.y,{back,front}=actor.iceTrap;
    back.position.set((x-actor.root.x)/sx/actor.visual.scale.x,(y-actor.root.y)/sy/actor.visual.scale.y);
    front.position.copyFrom(back.position);
    back.scale.set(scale/sx,scale/sy);front.scale.copyFrom(back.scale);
    if(actor.visual.children[0]!==back)actor.visual.setChildIndex(back,0);
    if(actor.visual.children[actor.visual.children.length-1]!==front)actor.visual.setChildIndex(front,actor.visual.children.length-1);
    back.visible=true;front.visible=true;
  }

  private resize(width: number, height: number) {
    this.viewport = battleViewport(width, height, this.displayMode);
    const { scaleX, scaleY, x, y } = this.viewport;
    this.app.renderer.resize(width, height, renderResolution(width, height, window.devicePixelRatio));
    this.app.stage.scale.set(scaleX, scaleY);
    this.app.stage.position.set(x, y);
    this.app.canvas.style.width = '100%'; this.app.canvas.style.height = '100%';
    for (const actor of this.actors.values()) this.sizeActor(actor);
    for (const effect of this.effects) {
      if (effect.actor) this.sizeActor(effect.actor);
      else if (effect.proportional) effect.node.scale.set(this.viewport.artScaleX, this.viewport.artScaleY);
    }
    this.bossArt?.setViewport(this.viewport);
    this.app.render();
  }

  async init(host: HTMLElement) {
    this.host = host;
    this.viewport = battleViewport(host.clientWidth, host.clientHeight, this.displayMode);
    await this.app.init({ width: host.clientWidth, height: host.clientHeight, backgroundAlpha: 0, antialias: false,
      resolution: renderResolution(host.clientWidth, host.clientHeight, window.devicePixelRatio), autoDensity: true, autoStart: false });
    this.app.ticker.maxFPS = 30;
    this.app.ticker.minFPS = 10;
    // Pointer handling uses the canvas DOM listener and world-coordinate picking.
    // Pixi's scene-graph hit testing would traverse every animated part needlessly.
    this.app.stage.eventMode = 'none';
    host.appendChild(this.app.canvas);
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.setAttribute('aria-label', '庭院战场。先选植物，再点击草地种植；点击阳光收集。');
    new ResizeObserver(([entry]) => {
      this.resize(entry.contentRect.width, entry.contentRect.height);
    }).observe(host);
    this.world.sortableChildren = true;
  }

  prepareBoard(game: Game, progress: (done: number, total: number) => void) {
    return this.queueResources(() => this.loadBoard(game, progress));
  }

  private queueResources(work:()=>Promise<void>) {
    const task=this.resourceWork.then(work);
    // Preserve the error for this caller without poisoning later cleanup or retry work.
    this.resourceWork=task.catch(()=>{});
    return task;
  }

  private rakeFrames: Texture[]=[];
  private graveRockFrames:Texture[]=[];
  private graveDirtFrames:Texture[]=[];
  private async loadBoard(game: Game, progress: (done: number, total: number) => void) {
    await this.clearResources();
    const files: Record<string, string> = { mower: 'original/mower.webp' };
    const environment = game.config.environment;
    const scenery = sceneryPlan(environment, !!game.boss, this.app.renderer.resolution * Math.max(this.viewport.scaleX, this.viewport.scaleY));
    Object.assign(files, scenery.files);
    this.scenerySourceX = scenery.sourceX;
    if (environment === 'roof') files.flowerpot = 'original/flowerpot.webp';
    if (environment === 'night') files.grave = 'original/grave.webp';
    if(environment==='roof' && game.campaign?.roofCleaner)files.roofCleaner='original/roof-cleaner.webp';
    if (isPool(environment)) files.poolCleaner = 'original/pool-cleaner.webp';
    if (environment === 'fog') files.fogCloud = 'original/fog-cloud.webp';
    if (game.config.mode === 'bowling') files.stripe = 'original/bowling-stripe.webp';
    if (game.config.mode === 'whack') files.hammer = 'original/hammer.webp';
    if (game.config.mode === 'vase') {
      files.vases = 'original/vases.webp'; files.packet = 'original/seed-packet.webp';
      for (const kind of game.config.seeds) files[kind] = `original/${kind}.webp`;
    }
    await this.prepareTextures(files, progress);
    if (game.config.mode === 'vase' && this.vaseFrames.length === 0) this.vaseFrames = [0,1].map(i => new Texture({ source:this.textures.vases.source, frame:new Rectangle(i*80,101,80,101) }));
    if (environment === 'fog' && this.fogFrames.length === 0) this.fogFrames = Array.from({length:8}, (_,i) => new Texture({source:this.textures.fogCloud.source,frame:new Rectangle(i*210,0,210,190)}));
    if (environment === 'day' && this.lawnTextures.length === 0) this.lawnTextures = Array.from({length:5}, (_,row) => new Texture({source:this.textures.lawn.source,frame:new Rectangle(this.scenerySourceX,BOARD.top+row*100,800,100)}));
  }

  private async prepareTextures(files: Record<string, string>, progress: (done: number, total: number) => void) {
    const pending = Object.entries(files).filter(([key]) => !this.textures[key]);
    let done = 0; progress(done, pending.length);
    await loadInBatches(pending, 4, ([key, file]) => loadGraphics(async () => {
      const src=`${import.meta.env.BASE_URL}assets/runtime/${file}`;
      const texture=await Assets.load<Texture>({src,data:{resolution:file.startsWith('hd4/')?4:NATIVE_SCENERY.has(file)||file.startsWith('particles/')?1:2}});
      releaseBitmapOnDestroy(texture);
      try{await this.app.renderer.prepare.upload(texture);}catch(error){await Assets.unload(src);throw error;}
      this.textures[key]=texture;this.textureFiles.push(src);
      progress(++done, pending.length);
    }));
  }

  prepareActors(game: Game, progress: (done: number, total: number) => void) {
    return this.queueResources(() => this.loadActors(game, progress));
  }

  private async loadActors(game: Game, progress: (done: number, total: number) => void) {
    // Independent families overlap, but every image shares the three-slot gate.
    // Each batch settles active work before release or retry can clear resources.
    await loadInBatches([
      async()=>{
        await this.prepareTextures(combatTextureFiles(game), progress);
        if(this.textures.graveRock&&!this.graveRockFrames.length)this.graveRockFrames=Array.from({length:8},(_,i)=>new Texture({source:this.textures.graveRock.source,frame:new Rectangle(i*40,0,40,40)}));
        if(this.textures.graveDirt&&!this.graveDirtFrames.length)this.graveDirtFrames=Array.from({length:8},(_,i)=>new Texture({source:this.textures.graveDirt.source,frame:new Rectangle(i*40,40,40,40)}));
        if(this.textures.rake && this.rakeFrames.length===0)this.rakeFrames=Array.from({length:8},(_,i)=>new Texture({source:this.textures.rake.source,frame:new Rectangle(i*160,0,160,140)}));
    
        if(this.textures.firePea&&!Object.keys(this.firePeaParts).length)for(const[name,rect]of Object.entries(fireParts.frames))this.firePeaParts[name]=new Texture({source:this.textures.firePea.source,frame:new Rectangle(...rect as [number,number,number,number])});
      },
      ()=>this.plantMotion.prepare([...new Set([...game.seeds, ...(game.imitaterTarget?[game.imitaterTarget]:[]), ...game.plants.flatMap(p=>p.morphTarget?[p.kind,p.morphTarget]:[p.kind]),...game.squishedPlants.map(p=>p.kind)])].filter(hasPlantMotion), progress, texture => this.app.renderer.prepare.upload(texture)),
      async()=>{
        if(game.boss&&!this.bossArt){const bossArt=new BossArt();try{await bossArt.load(progress);}catch(error){await bossArt.destroy();throw error;}bossArt.setViewport(this.viewport);bossArt.root.zIndex=590;this.world.addChild(bossArt.root);this.bossArt=bossArt;}
      },
      async()=>{
        const base = `${import.meta.env.BASE_URL}assets/runtime/`;
        this.animationData ??= fetch(base + 'effects.json').then(response => {if(!response.ok)throw new Error(`Effects metadata: HTTP ${response.status}`);return response.json();}).catch(error=>{this.animationData=undefined;throw error;});
        const { animations } = await this.animationData;
        const needed = new Set(animationNames(game, [...new Set([...Object.keys(animations),...Object.keys(ACTOR_MOTION),...GIANT_CLIPS])]).filter(name => !hasPlantMotionClip(name)));
        for (const effect of this.effects) if (effect.actor) needed.add(effect.actor.clip);
        for (const [name, clip] of Object.entries(this.clips)) if (!needed.has(name)) {
          for (const texture of clip.frames) texture.destroy();
          await Assets.unload(clip.files);
          delete this.clips[name];
        }
        await loadInBatches([
          ()=>this.giantMotion.prepare([...needed].some(hasGiantMotion), texture => this.app.renderer.prepare.upload(texture)),
          ()=>this.actorMotion.prepare([...needed], progress, texture => this.app.renderer.prepare.upload(texture)),
          async()=>{
            const names = [...needed].filter(name => !hasGiantMotion(name) && !hasActorMotion(name) && !this.clips[name]);
            const files = [...new Set(names.flatMap(name => animations[name].pages))];
            const pages = new Map<string, Texture>();
            let done = 0; progress(done, files.length);
            try{
              await loadInBatches(files, 4, file => loadGraphics(async () => {
                const texture = await Assets.load<Texture>({ src: base + file, data: { resolution: 2 } });
                releaseBitmapOnDestroy(texture);
                pages.set(file, texture);
                await this.app.renderer.prepare.upload(texture);
                progress(++done, files.length);
              }));
            }catch(error){await Assets.unload([...pages.keys()].map(file=>base+file));throw error;}
            for (const name of names) {
              const clip = animations[name];
              let duration = 0;
              this.clips[name] = {
                files: clip.pages.map(file => base + file),
                ends: clip.durations.map(ticks => duration += ticks), duration,
                anchors: clip.frames.map(frame => [(clip.anchor[0]-frame[5])/frame[3], (clip.anchor[1]-frame[6])/frame[4]]),
                frames: clip.frames.map(([page,x,y,w,h]) => new Texture({source:pages.get(clip.pages[page])!.source,frame:new Rectangle(x,y,w,h)})),
              };
            }
          },
        ],3,load=>load());
      },
      ()=>this.peaArt.prepare([...new Set([...game.seeds,...(game.imitaterTarget?[game.imitaterTarget]:[]),...game.plants.flatMap(p=>p.morphTarget?[p.kind,p.morphTarget]:[p.kind])])].filter(isPeaKind),progress,texture=>this.app.renderer.prepare.upload(texture)),
    ],5,load=>load());
  }

  // Discard battle-owned CPU/GPU textures; HTTP/PWA caches still serve revisits.
  release() {
    this.app.stop();
    return this.queueResources(() => this.clearResources());
  }

  private async clearResources() {
    this.clearObjects();
    if (this.bossArt) { await this.bossArt.destroy(); this.bossArt = undefined; }
    await this.plantMotion.destroy();
    await this.peaArt.destroy();
    await this.actorMotion.destroy();
    await this.giantMotion.destroy();
    const files = [...this.textureFiles];
    for (const clip of Object.values(this.clips)) {
      clip.frames.forEach(texture => texture.destroy()); files.push(...clip.files);
    }
    for (const texture of [...this.lawnTextures, ...this.fogFrames, ...this.vaseFrames, ...Object.values(this.firePeaParts), ...this.rakeFrames,...this.graveRockFrames,...this.graveDirtFrames]) texture.destroy();
    this.graveRockFrames=[];this.graveDirtFrames=[];
    this.lawnTextures = []; this.fogFrames = []; this.vaseFrames = []; this.firePeaParts = {}; this.rakeFrames = [];
    this.clips = {}; this.textures = {}; this.textureFiles = [];
    await Assets.unload(files);
  }

  private clearObjects() {
    for (const texture of this.sceneryTextures) texture.destroy();
    this.sceneryTextures = [];
    for (const child of this.app.stage.removeChildren()) {
      if (child !== this.world && child !== this.hover && child !== this.target && child !== this.health && child !== this.fog && child !== this.weather) child.destroy({ children: true });
    }
    for (const actor of this.actors.values()) actor.root.destroy({ children: true });
    for(const texture of this.squishedTextures.values())texture.destroy(true);
    this.squishedTextures.clear();
    for (const effect of this.effects) effect.node.destroy({ children: true });
    for (const actor of this.projectilePool) actor.root.destroy({ children: true });
    this.projectilePool = [];
    for (const layer of this.projectileLayers.values()) layer.destroy();
    this.projectileLayers.clear();
    this.kelpTargets.clear();
    this.actors.clear(); this.effects = []; this.explosions = []; this.time = 0; this.healthKey = ''; this.hoverKey = '';
    this.hover.clear(); this.target.clear(); this.health.clear(); this.fog.removeChildren().forEach(child=>child.destroy()); this.fogKey = '';
  }

  setLevel(game: Game) {
    this.clearObjects();
    const texture = game.boss ? this.textures.bossBackground : game.config.environment === 'day' ? this.textures.yard : this.textures[game.config.environment];
    // Only the original playable camera is visible. The street is never sampled.
    const boardTexture = new Texture({ source: texture.source, frame: new Rectangle(this.scenerySourceX, 0, BOARD.width, BOARD.height) });
    this.sceneryTextures = [boardTexture];
    this.app.stage.addChild(new Sprite(boardTexture));
    for (const row of game.config.environment === 'day' ? game.config.rows : []) {
      const lawn = new Sprite(this.lawnTextures[row]);
      lawn.y = BOARD.top + row * 100; this.app.stage.addChild(lawn);
    }
    if (game.config.mode === 'bowling') { const stripe = new Sprite(this.textures.stripe); stripe.position.set(268, 77); this.app.stage.addChild(stripe); }
    this.app.stage.addChild(this.hover, this.world, this.health, this.fog, this.weather, this.target); this.pointer = null;
  }

  setPointer(pointer: { x: number; y: number } | null) { this.pointer = pointer; }

  private clipDuration(name: string) {
    return hasActorMotion(name) ? this.actorMotion.duration(name) : hasGiantMotion(name) ? this.giantMotion.duration(name) : this.clips[name].duration;
  }

  private animate(actor: Actor, clipName: string, loop = true, timeline = this.time, rate = 1, shootingTicks?: number, headless = false, catapultAmmo = 20, normalizedTime?:number,bodyBlend?:Zombie["bodyBlend"],blendLeft?:number) {
    if(actor.peaRig){actor.peaRig.root.destroy({children:true});actor.peaRig=undefined;}
    if (hasPlantMotion(clipName)) {
      if(actor.nativeRig){actor.nativeRig.root.destroy({children:true});actor.nativeRig=undefined;}
      if (!actor.rig) {
        actor.rig = this.plantMotion.create(clipName); actor.visual.addChild(actor.rig.root); actor.art.visible = false;
        actor.clip = clipName; actor.since = timeline - actor.root.uid * 17 % this.plantMotion.duration(clipName);
      }
      actor.rig.render((timeline - actor.since) * rate, shootingTicks);
      return;
    }
    if (actor.clip !== clipName) {
      actor.clip = clipName; actor.since = timeline; actor.frame = -1;
      // Spread idle plants across the cycle; do not synchronize every newly planted row.
      if (loop && ['peashooter', 'sunflower', 'wallnut', 'snowpea', 'potatomine', 'chomper', 'repeater', 'puffshroom', 'sunshroom', 'sunshroom-big', 'fumeshroom', 'hypnoshroom', 'scaredyshroom', 'iceshroom','doomshroom','lilypad','squash','threepeater','plantern','spikeweed','torchwood','tallnut','seashroom','cactus'].includes(clipName)) actor.since -= actor.root.uid * 17 % this.clipDuration(clipName);
    }
    // Keep the clip clock while offscreen; resume at the current pose when it enters view.
    if (!actor.root.visible) return;
    const elapsed = shootingTicks ?? (timeline - actor.since) * rate;
    if (hasGiantMotion(clipName)) {
      if (!actor.giantRig) {
        actor.giantRig = this.giantMotion.create(); actor.visual.addChild(actor.giantRig.root); actor.art.visible = false;
      }
      actor.giantRig.render(clipName, elapsed, loop, actor.nativeAligned);
      return;
    }
    if (hasActorMotion(clipName)) {
      if (actor.nativeRig && actor.nativeRig.family !== ACTOR_MOTION[clipName]) {
        actor.nativeRig.root.destroy({ children: true }); actor.nativeRig = undefined;
      }
      if (!actor.nativeRig) {
        actor.nativeRig = this.actorMotion.create(clipName); actor.visual.addChild(actor.nativeRig.root);
      }
      actor.nativeRig.root.visible = true; actor.art.visible = false;
      actor.nativeRig.render(clipName, elapsed, loop, headless, actor.nativeAligned, catapultAmmo,normalizedTime,bodyBlend,blendLeft);
      return;
    }
    if (actor.nativeRig) actor.nativeRig.root.visible = false;
    actor.art.visible = true;
    const clip = this.clips[clipName];
    // Bowling nuts rotate as rigid bodies; interpolate the angle at display rate.
    if (clipName === 'wallnut-roll' || clipName === 'explodenut') {
      actor.art.texture = clip.frames[0]; actor.art.anchor.set(.5);
      actor.art.position.set((.5 - clip.anchors[0][0]) * actor.art.texture.width,
        (.5 - clip.anchors[0][1]) * actor.art.texture.height);
      actor.art.rotation = elapsed / clip.duration * Math.PI * 2;
      return;
    }
    const position = loop ? elapsed % clip.duration : Math.min(elapsed, clip.duration - .001);
    const frame = animationFrame(clip.ends, position);
    if (actor.frame === frame) return;
    actor.frame = frame;
    actor.art.texture = clip.frames[frame];
    actor.art.anchor.set(clip.anchors[frame][0], clip.anchors[frame][1]);
  }

  // Capture moving actors before each fixed step; the final snapshot brackets the rendered frame.
  captureMovement() {
    for (const actor of this.actors.values()) if (actor.motion) {
      actor.previousX = actor.motion.x;
      actor.previousWalkTime = "walkTime" in actor.motion ? (actor.motion as Zombie).walkTime : undefined;
      actor.previousEatTime = "eatTime" in actor.motion ? (actor.motion as Zombie).eatTime : undefined;
      actor.previousBlendLeft=(actor.motion as Zombie).bodyBlend?.left;
      actor.previousBlendFrom=(actor.motion as Zombie).bodyBlend;
      if (actor.motion.y !== undefined) actor.previousY = actor.motion.y;
    }
  }

  private move(actor: Actor, motion: { x: number; y?: number }, y: number, alpha: number) {
    if (!actor.motion) { actor.previousX = motion.x; actor.previousY = y; }
    actor.motion = motion;
    actor.root.position.set(actor.previousX + (motion.x - actor.previousX) * alpha,
      motion.y === undefined ? y : actor.previousY + (y - actor.previousY) * alpha);
  }

  private actor(key: string, zIndex: number) {
    let actor = this.actors.get(key);
    if (!actor) {
      actor = key.startsWith('b') ? this.projectilePool.pop() : undefined;
      if (actor) {
        actor.clip = ''; actor.frame = -1; actor.since = this.time; actor.motion = undefined;
        actor.root.visible = true; actor.art.visible=true;if(actor.fireRig)actor.fireRig.root.visible=false;actor.art.scale.set(1); actor.art.tint = 0xffffff;
      } else {
        const root = new Container(), visual = new Container(), art = new Sprite();
        root.addChild(visual); visual.addChild(art);
        actor = { root, visual, stretch: key.startsWith('ice') || key.startsWith('fire-') || /^f\d/.test(key), art, clip: '', since: this.time, frame: -1, seen: this.stamp, previousX: 0, previousY: 0 };
      }
      this.sizeActor(actor);
      actor.root.zIndex = zIndex;
      if (key.startsWith('b')) {
        // Shots share one ordering layer per lane; spawning does not re-sort all rigs.
        let layer = this.projectileLayers.get(zIndex);
        if (!layer) { layer = new Container(); layer.zIndex = zIndex; this.world.addChild(layer); this.projectileLayers.set(zIndex, layer); }
        layer.addChild(actor.root);
      } else this.world.addChild(actor.root);
      this.actors.set(key, actor);
    }
    actor.seen = this.stamp;
    return actor;
  }

  event(event: GameEvent) {
    if(event.kind==='grave-clear'&&this.graveDirtFrames.length){
      const debris=new GraveDebris(this.graveDirtFrames,'clear',powieRandom(event.tick^Math.trunc(event.x*31+event.y*131)));
      debris.root.position.set(event.x,event.y);debris.root.zIndex=event.row*100+14;this.world.addChild(debris.root);
      debris.root.scale.set(this.viewport.artScaleX,this.viewport.artScaleY);
      this.effects.push({node:debris.root,debris,born:event.tick,duration:debris.duration,proportional:true});
    }
    if (event.kind === 'fire') {
      const actor = this.actor(`fire-${this.stamp}`, event.row * 100 + 35);
      actor.root.position.set(0, event.y); this.animate(actor, 'jalapeno-fire', false);
      this.actors.delete(`fire-${this.stamp}`);
      this.effects.push({ node: actor.root, actor, born: this.time, duration: this.clips['jalapeno-fire'].duration });
    }
    if (event.kind === 'vase') {
      const shards = new Graphics();
      for (let i=0;i<7;i++) shards.poly([i*9-30,-10, i*9-24,-24-(i%3)*5, i*9-18,-7]).fill(i%2 ? 0xb38e60 : 0x785231);
      shards.position.set(event.x,event.y); shards.zIndex=700; shards.scale.set(this.viewport.artScaleX, this.viewport.artScaleY); this.world.addChild(shards);
      this.effects.push({ node:shards, proportional: true, born:this.time, duration:25 });
    }
    if (event.kind === 'swallow' || event.kind==='explode'&&event.zombieId!==undefined) {
      const key = `z${event.zombieId}`; const actor = this.actors.get(key);
      if (actor) { actor.root.destroy({ children: true }); this.actors.delete(key); }
    }
    if (event.kind === 'whack') {
      const hammer = new Sprite(this.textures.hammer); hammer.anchor.set(.75, .85);
      hammer.position.set(event.x, event.y); hammer.zIndex = 1000;
      hammer.scale.set(this.viewport.artScaleX, this.viewport.artScaleY); this.world.addChild(hammer); this.effects.push({ node: hammer, proportional: true, born: this.time, duration: 18 });
    }
    if (event.kind === 'freeze') {
      const frost = new Graphics().rect(0,80,800,510).fill({color:0xc9f5ff,alpha:.55});
      frost.zIndex=900; this.world.addChild(frost); this.effects.push({node:frost,born:this.time,duration:45});
    }
    if (event.kind === 'hypnotize') {
      const glow = new Graphics().circle(0, 0, 40).stroke({ color: 0xdc79ff, width: 5 });
      glow.position.set(event.x, event.y); glow.zIndex = 800;
      this.world.addChild(glow); this.effects.push({ node: glow, born: this.time, duration: 40 });
    }
    if (event.kind === 'sun' || event.kind === 'coin') {
      const label = new Text({ text: `+${event.value}`, style: { fontFamily: 'Arial', fontWeight: 'bold', fontSize: 25,
        fill: 0xfffbc2, stroke: { color: 0x496225, width: 3 } } });
      label.anchor.set(.5); label.position.set(event.x, event.y - 10); label.zIndex = 999;
      label.scale.set(this.viewport.artScaleX, this.viewport.artScaleY); this.world.addChild(label); this.effects.push({ node: label, proportional: true, born: this.time, duration: 70 });
    }
    if (event.kind === 'fume') {
      const actor = this.actor(`f${this.stamp}-${this.effects.length}`, event.row * 100 + 30);
      actor.root.position.set(event.x, event.y); this.animate(actor, 'fume-cloud', false);
      this.actors.delete(`f${this.stamp}-${this.effects.length}`);
      this.effects.push({ node: actor.root, actor, born: this.time, duration: this.clips['fume-cloud'].duration });
    }
    if (event.kind === 'explode') {
      this.explosions.push(event);
      if(event.effect==='powie'&&this.textures.powieCloud&&this.textures.powieWord){
        const born=event.tick??this.time,powie=new Powie(this.textures.powieCloud,this.textures.powieWord,powieRandom(Math.trunc(born)^Math.trunc(event.x*31+event.y*131)));
        powie.root.position.set(event.x,event.y);powie.root.zIndex=800;this.world.addChild(powie.root);
        this.effects.push({node:powie.root,powie,born,duration:200});return;
      }
      const burst = new Graphics().circle(0, 0, 110).fill({ color: 0xffcf3a, alpha: .8 }).circle(0, 0, 75).fill(0xfff3b0);
      burst.position.set(event.x, event.y); burst.zIndex = 800; this.world.addChild(burst);
      this.effects.push({ node: burst, born: this.time, duration: 35 });
    }
  }

  render(game: Game, elapsed = 0, alpha = 1) {
    if (game.phase === 'playing') this.time = game.ticks + alpha;
    else if (game.phase === 'won' || game.phase === 'lost') this.time += elapsed / 10;
    this.stamp++;
    const aiming = game.phase === 'playing' && this.pointer !== null;
    const column = aiming ? Math.floor((this.pointer!.x - BOARD.left) / BOARD.cellWidth) : -1;
    const row = aiming ? game.rowAt(this.pointer!.y, this.pointer!.x) : -1;
    const digTarget = aiming && game.digging ? game.digTarget(column, row) : undefined;
    if(game.boss)this.bossArt?.render(game,alpha);
    for (const ice of game.iceTrails) {
      const actor = this.actor(`ice${ice.row}`, ice.row * 100 + 1);
      actor.art.texture = this.textures.iceTrail; actor.art.width = 800 - ice.x; actor.art.height = 70;
      actor.root.position.set(ice.x, game.rowY(ice.row) - 55); actor.root.alpha = Math.min(1, ice.remaining / 200);
    }
    for (const vase of game.vases) {
      const actor = this.actor(`vase${vase.id}`, vase.row*100+15);
      actor.art.texture = this.vaseFrames[Number(vase.green)]; actor.art.anchor.set(.5,1);
      actor.root.position.set(cellX(vase.column),game.rowY(vase.row));
    }
    for (const drop of game.seedDrops) {
      const actor = this.actor(`drop${drop.id}`, 650);
      if (actor.clip !== 'drop') {
        actor.clip='drop'; const card=new Sprite(this.textures.packet);card.width=48;card.height=68;card.anchor.set(.5);
        actor.visual.addChildAt(card,0);actor.art.texture=this.textures[drop.kind];actor.art.anchor.set(.5);
        const ratio=Math.min(38/actor.art.width,48/actor.art.height);actor.art.scale.set(ratio);
      }
      actor.root.position.set(cellX(drop.column),game.rowY(drop.row)-40);
      actor.root.alpha=drop.id===game.selectedDrop ? .5 : drop.remaining<300 ? .5+Math.abs(Math.sin(this.time/10))*.5 : 1;
      actor.art.tint=drop.id===game.selectedDrop?0xd3ff7b:0xffffff;
    }
    if(game.rake){
      const rake=game.rake,actor=this.actor('rake',rake.row*100+6);
      const frame=rake.age<0?0:Math.min(7,Math.floor(rake.age/5));
      if(actor.clip!==`rake-${frame}`){actor.clip=`rake-${frame}`;actor.art.texture=this.rakeFrames[frame];actor.art.anchor.set(.5,1);}
      actor.root.position.set(cellX(rake.column),game.rowY(rake.row));
    }
    for (const grave of game.graves) {
      const actor = this.actor(`g${grave.id}`, grave.row * 100 + 5);
      if (actor.clip !== 'grave') { actor.clip = 'grave'; actor.art.texture = this.textures.grave; actor.art.anchor.set(.5, 1); }
      actor.root.position.set(cellX(grave.column), game.rowY(grave.row));
    }
    for (const crater of game.craters) {
      const actor=this.actor(`c${crater.id}`,crater.row*100+4);
      if(actor.clip!=='crater') {actor.clip='crater';actor.art.texture=this.textures.crater;actor.art.anchor.set(.5,.7);}
      actor.root.position.set(cellX(crater.column),game.rowY(crater.row));
      actor.root.alpha=crater.remaining<9000?.6:1;
    }
    for(const p of game.squishedPlants){
      const actor=this.actor(`flat${p.id}`,p.row*100+6),frame=squishedFrame(p.kind);
      if(actor.clip!=='squished'){
        let texture=this.squishedTextures.get(p.kind);
        if(!texture){
          const rig=hasPlantMotion(p.kind)?this.plantMotion.create(p.kind):this.actorMotion.create(p.kind);
          if(hasPlantMotion(p.kind))(rig as PlantRig).renderCached(p.kind==='sunflower'?.15:0);
          else (rig as ActorRig).renderCached(p.kind);
          rig.root.position.set(0);rig.root.scale.set(1);
          if(p.kind==='coffeebean'||p.kind==='potatomine'){rig.root.position.set(12);rig.root.scale.set(p.kind==='coffeebean'?.8:.85);}
          // A wrapper preserves the reanim's own root scale during extraction.
          const root=new Container();root.addChild(rig.root);
          try{texture=this.app.renderer.generateTexture({target:root,frame:new Rectangle(frame.x,frame.y,frame.width,frame.height),resolution:1,antialias:false});}
          finally{root.destroy({children:true});}
          this.squishedTextures.set(p.kind,texture);
        }
        actor.clip='squished';actor.art.texture=texture;actor.art.anchor.set(0);actor.art.position.set(frame.x,frame.y*.25);actor.art.scale.set(1,.25);
      }
      actor.root.position.set(...squishedPosition(game,p));actor.art.tint=p.imitated?0xbfbfbf:0xffffff;
    }
    const kelpTargets = this.kelpTargets; kelpTargets.clear();
    for (const plant of game.plants) if (plant.kelp) kelpTargets.set(plant.kelp.target, plant.kelp);
    for (const plant of game.plants) {
      if(plant.kind==='gravebuster'&&plant.gravebuster?.phase!=='landing'&&this.graveRockFrames.length){
        const debris=this.actor(`gravel${plant.id}`,plant.row*100+14);
        if(!debris.debris){debris.debris=new GraveDebris(this.graveRockFrames,'chew',powieRandom(plant.id));debris.visual.addChild(debris.debris.root);debris.art.visible=false;}
        debris.root.position.set(cellX(plant.column),game.gridY(plant.column,plant.row)+40);debris.debris.update(400-plant.actionIn);
      }
      const sleeping = game.sleeping(plant);
      const squash=plant.kind==='squash'?plant.squash:undefined;
      const key = `p${plant.id}`; const actor = this.actor(key, plant.row * 100 + (['lilypad','flowerpot'].includes(plant.kind) ? 7 : plant.kind==='pumpkin'?18:plant.kind==='coffeebean'?19:10));
      actor.nativeAligned=true;
      const clip = plant.kind==='imitater'&&plant.actionIn<119?'imitater-morph':plant.kind==='cobcannon'?(plant.shotAt>=plant.born&&game.ticks-plant.shotAt<350?'cobcannon-attack':plant.actionIn>0&&plant.actionIn<=125?'cobcannon-charge':plant.actionIn>0?'cobcannon-unarmed':'cobcannon'):['gloomshroom','cattail'].includes(plant.kind)&&plant.burstIn?`${plant.kind}-attack`:['goldmagnet','spikerock'].includes(plant.kind)&&game.ticks-plant.shotAt<100?`${plant.kind}-attack`:hasPlantMotion(plant.kind) ? plant.kind : plant.kind==='umbrella'&&game.ticks-plant.shotAt<65?'umbrella-block':plant.kind==='magnetshroom' && game.ticks-plant.shotAt<50 ? `${plant.kind}-attack` : plant.kind==='pumpkin'&&plant.health<1334?'pumpkin-cracked2':plant.kind==='pumpkin'&&plant.health<2667?'pumpkin-cracked1':plant.kind==='garlic'&&plant.health<134?'garlic-cracked2':plant.kind==='garlic'&&plant.health<267?'garlic-cracked1': plant.kind === 'cactus' && plant.tall ? 'cactus-tall' : plant.kind === 'blover' && game.ticks-plant.born>50 ? 'blover-loop' : plant.kind === 'tallnut' && plant.health<2667 ? 'tallnut-cracked2' : plant.kind === 'tallnut' && plant.health<5334 ? 'tallnut-cracked1' : plant.kind === 'tanglekelp' && plant.kelp ? 'tanglekelp-grab' : plant.kind === 'squash' && plant.squash && plant.squash.remaining <= 60 ? 'squash-attack' : plant.kind === 'scaredyshroom' && plant.scared ? 'scaredyshroom-scared' : plant.kind === 'sunshroom' && game.ticks - plant.born >= 12000 ? 'sunshroom-big'
        : plant.kind === 'fumeshroom' && game.ticks - plant.shotAt < 35 ? 'fumeshroom-attack'
        : plant.kind === 'chomper' ? plant.chomp!.phase === 'digest' ? 'chomper-digest' : plant.chomp!.phase === 'ready' ? 'chomper' : 'chomper-bite'
        : plant.kind === 'potatomine' && plant.actionIn > 0 ? 'potatomine-unarmed' : plant.kind === 'wallnut' && plant.health < 1334 ? 'wallnut-cracked2'
        : plant.kind === 'wallnut' && plant.health < 2667 ? 'wallnut-cracked1' : plant.kind;
      const grave=plant.kind==='gravebuster'?plant.gravebuster:undefined;
      const renderedClip=plant.kind==='gravebuster'?(grave?.phase==='landing'?'gravebuster-land':'gravebuster-eating'):squash?squashClip(squash,cellX(plant.column)):clip;
      const oneShot=!!squash||['gloomshroom-attack','cattail-attack','cobcannon-attack','cobcannon-charge','imitater-morph'].includes(clip);
      const actionDuration=clip==='gloomshroom-attack'?200:clip==='cattail-attack'?50:clip==='cobcannon-attack'?350:clip==='cobcannon-charge'?125:119;
      if(isPeaKind(plant.kind)){
        if(!actor.peaRig){
          actor.nativeRig?.root.destroy({children:true});actor.nativeRig=undefined;actor.rig?.root.destroy({children:true});actor.rig=undefined;
          actor.peaRig=hasPlantMotion(plant.kind)?this.plantMotion.createPea(plant.kind,this.peaArt):this.actorMotion.createPea(plant.kind,this.peaArt);
          actor.visual.addChild(actor.peaRig.root);actor.art.visible=false;actor.clip=plant.kind;
        }
        actor.peaRig.render(plant.peaMotion);
      }
      else if(plant.kind==='gravebuster')this.animate(actor,renderedClip,grave?.phase!=='landing',this.time,1,grave?.phase==='landing'?grave.ticks*grave.rate/10:grave?.ticks??400-plant.actionIn);
      else this.animate(actor, renderedClip, !oneShot && plant.kind !== 'cherrybomb' && clip !== 'chomper-bite' && clip !== 'umbrella-block', sleeping ? 0 : this.time, squash?1:oneShot ? this.clipDuration(clip)/actionDuration : clip === 'chomper-bite' ? this.clipDuration(clip) / 70 : clip==='umbrella-block'?this.clipDuration(clip)/65:1, squash?squashTicks(squash)+(game.phase==='playing'?alpha:0):(plant.kind==='wintermelon' && plant.winterLaunchIn!==undefined || ['cabbagepult','kernelpult','melonpult'].includes(plant.kind)) && !sleeping ? game.ticks+(game.phase==='playing'?alpha:0)-plant.shotAt : undefined);
      this.positionPlant(actor,game,plant.kind,plant.column,plant.row,plant);
      actor.root.tint = plant === digTarget ? 0xffd36b : 0xffffff;
      (actor.peaRig?.root??actor.nativeRig?.root ?? actor.rig?.root ?? actor.art).tint=sleeping?0xa3a1be:plant.imitated?0xbfbfbf:0xffffff;
      if (sleeping) {
        const sleep=this.actor(`sleep${plant.id}`,plant.row*100+15);
        if(sleep.clip!=='sleep'){sleep.clip='sleep';const label=new Text({text:'Zzz',style:{fontSize:16,fill:0xc6d9ff}});sleep.root.addChild(label);}
        sleep.root.position.set(cellX(plant.column)+15,game.rowY(plant.row,cellX(plant.column))-70);
      }
      if (squash && squash.remaining <= 60) {
        this.positionSquash(actor,game,plant);
      }
    }
    for (const zombie of game.zombies) {
      const key = `z${zombie.id}`; const actor = this.actor(key, zombie.row * 100 + 20);
      const swimming = game.waterRow(zombie.row) && zombie.x < 780 && zombie.x > 90;
      const type = zombie.kind === 'snorkel' ? 'snorkel' : swimming ? `ducky${zombie.armor>0?(zombie.kind==='bucket'?3:2):1}` : zombie.kind === 'ducky' ? 'zombie' : zombie.kind === 'dancer' || zombie.kind === 'backup' ? zombie.kind : zombie.kind === 'football' ? zombie.armor > 0 ? 'football' : 'football-bare' : zombie.kind === 'newspaper' ? zombie.shield > 0 ? 'newspaper' : 'newspaper-mad'
        : zombie.kind === 'door' && zombie.shield > 0 ? 'door' : zombie.kind === 'pole' ? 'pole' : (zombie.kind === 'cone' || zombie.kind === 'bucket') && zombie.armor > 0 ? zombie.kind : zombie.kind === 'flag' ? 'flag' : 'zombie';
      let clip = zombie.kind==='yeti'?`yeti-${headless(zombie)?'headless-':''}${zombie.eating?'eat':'walk'}`:zombie.giant?`gargantuar-${zombie.giant.thrown&&zombie.giant.phase!=='throw'?'bare-':''}${zombie.giant.phase}`:zombie.catapult?`catapult-${zombie.catapult.phase==='reload'?'idle':zombie.catapult.phase}`:zombie.kind==='imp'?`imp-${zombie.flight?'thrown':zombie.landingIn?'land':zombie.eating?'eat':'walk'}`:zombie.kind==='digger'?`digger-${zombie.underground?'dig':zombie.emergingIn?'rise':zombie.eating?'eat':'walk'}`
        :zombie.kind==='pogo'?`pogo-${zombie.pogo?'bounce':zombie.eating?'eat':'walk'}`
        :zombie.kind==='bungee'?`bungee-${zombie.bungee?.phase==='down'?'drop':'idle'}`
        :zombie.kind==='ladder'?`ladder-${zombie.ladderIn?'place':zombie.shield<=0?'bare':zombie.eating?'eat':'walk'}`
        : zombie.kind === 'zomboni' ? zombie.health<450 ? 'zomboni-critical' : zombie.health<900 ? 'zomboni-damaged' : 'zomboni-walk'
        : zombie.kind === 'bobsled' ? `bobsled-${zombie.eating?'eat':'walk'}`
        : zombie.kind === 'dolphin' ? zombie.vaultIn>0 ? 'dolphin-jump' : zombie.eating ? 'dolphin-eat' : swimming ? zombie.dolphin ? 'dolphin-ride' : 'dolphin-swim' : 'dolphin-walk'
        : zombie.kind === 'jack' ? zombie.jackOpening ? 'jack-open' : headless(zombie) ? 'jack-headless' : `jack-${zombie.eating?'eat':'walk'}`
        : zombie.kind === 'balloon' ? zombie.flying ? 'balloon-fly' : zombie.popIn ? 'balloon-pop' : `balloon-${zombie.eating?'eat':'walk'}`
        : zombie.kind === 'snorkel' ? game.submerged(zombie) ? 'snorkel-swim' : `snorkel-${zombie.eating?'eat':'walk'}`
        : zombie.kind === 'dancer' && (zombie.dancePhase==='point'||zombie.dancePhase==='hold') ? 'dancer-summon'
        : swimming ? `${type}-${zombie.eating?'eat':'walk'}` : headless(zombie) ? (zombie.kind === 'dancer' || zombie.kind === 'backup' ? `${zombie.kind}-headless` : zombie.kind === 'football' ? 'football-headless' : zombie.kind === 'newspaper' ? 'newspaper-headless' : zombie.kind === 'pole' ? 'pole-headless' : 'zombie-headless')
        : zombie.rageIn > 0 ? 'newspaper-gasp' : zombie.vaultIn > 52 ? 'pole-jump' : zombie.vaultIn > 0 ? 'pole-land'
        : zombie.hasPole ? 'pole-run' : `${type}-${zombie.eating ? 'eat' : 'walk'}`;
      if(hasGroundWalk(zombie)&&!game.waterRow(zombie.row))clip=ordinaryBodyClip(zombie);
      const walking = zombie.kind !== 'zomboni' && zombie.kind !== 'catapult' && !zombie.sled && (clip.endsWith('-walk') || clip.endsWith('-walk2') || clip.endsWith('-headless') || clip === 'pole-run');
      const rate = zombie.giant&&zombie.giant.phase!=='walk'?this.clipDuration(clip)/(zombie.giant.phase==='smash'?134:138):zombie.catapult?.phase==='shoot'?this.clipDuration(clip)/129:zombie.catapult?.phase==='walk'?(zombie.catapult.animTime===undefined?.55:.6):zombie.catapult?.phase==='reload'?1.2:clip === 'newspaper-gasp' ? this.clipDuration(clip) / 150 : walking ? this.clipDuration(clip) / walkingCycleTicks(zombie) : 1;
      const catapultTicks=zombie.catapult?.phase==='shoot'&&zombie.catapult.animTime!==undefined&&game.nativeGroundY(zombie)!==undefined?zombie.catapult.animTime*310:undefined;

      this.move(actor, zombie, game.rowY(zombie.row,zombie.x) + 1, alpha);
      this.positionZombie(actor,game,zombie);
      if(zombie.flight){const f=zombie.flight;actor.root.y-=Math.sin((1-f.remaining/f.duration)*Math.PI)*110+f.remaining/f.duration*88;}
      if(zombie.pogo&&!zombie.pogoState)actor.root.y-=Math.abs(Math.sin(zombie.animationTime/80*Math.PI))*45;
      if(zombie.bungee){const b=zombie.bungee;actor.root.y-=b.phase==='down'?b.remaining*8:b.phase==='up'?(100-b.remaining)*8:0;const target=this.actor(`target${zombie.id}`,zombie.row*100+8);target.art.texture=this.textures.bungeeTarget;target.art.anchor.set(.5);target.root.position.set(zombie.x,game.rowY(zombie.row,zombie.x)-15);const rope=this.actor(`rope${zombie.id}`,zombie.row*100+19);rope.art.texture=this.textures.bungeeCord;rope.art.anchor.set(.5,1);rope.art.width=5;rope.art.height=Math.max(1,actor.root.y-80);rope.root.position.set(zombie.x,actor.root.y-80);}
      if (zombie.kind === 'dolphin' && zombie.vaultIn>0) actor.root.y-=Math.sin(zombie.vaultIn/120*Math.PI)*55;
      if (zombie.sled && !zombie.sledLeader) {
        const sled=this.actor(`sled${zombie.id}`,zombie.row*100+23);sled.art.texture=this.textures.sled;sled.art.anchor.set(.2,1);
        sled.root.position.set(actor.root.x,game.rowY(zombie.row,zombie.x)+10);sled.art.width=245;sled.art.height=80;
      }
      actor.root.scale.x = (zombie.hypnotized || zombie.backwards ? -1 : 1) * (zombie.mini ? .5 : 1);
      actor.root.alpha = zombie.riseIn > 50 ? 0 : 1;
      actor.root.scale.y = (zombie.riseIn > 0 ? Math.max(.01, 1 - zombie.riseIn / 50) : 1) * (zombie.mini ? .5 : 1);
      // Conservative actor extent includes giant arms, flags and bungee attachments.
      actor.root.visible = actor.root.x > -220 && actor.root.x < BOARD.width + 220 && actor.root.y > -220 && actor.root.y < BOARD.height + 220;
      const ordinaryBody=hasGroundWalk(zombie)&&!game.waterRow(zombie.row);
      const ordinaryBodyTime=ordinaryBody&&zombie.eating&&clip.endsWith('-eat')?eatAnimationTime(zombie,alpha,actor.previousEatTime)
        :ordinaryBody&&zombie.walkTime!==undefined&&(clip.endsWith('-walk')||clip.endsWith('-walk2')||clip==='zombie-headless')?groundWalkTime(zombie,alpha,actor.previousWalkTime):undefined;
      const bodyBlend=ordinaryBody?(zombie.bodyBlend??(actor.previousBlendLeft===1?actor.previousBlendFrom:undefined)):undefined;
      const bodyBlendLeft=zombie.bodyBlend?zombie.bodyBlend.left+(1-alpha)*(actor.previousBlendFrom===zombie.bodyBlend?(actor.previousBlendLeft??zombie.bodyBlend.left)-zombie.bodyBlend.left:1):bodyBlend?1-alpha:0;
      this.animate(actor, clip, !zombie.popIn && !zombie.jackOpening && zombie.vaultIn === 0 && zombie.rageIn === 0 && (!zombie.giant||zombie.giant.phase==='walk') && zombie.catapult?.phase!=='shoot' && !(zombie.pogo&&zombie.pogoState) && !zombie.flight && !zombie.landingIn, zombie.animationTime + alpha * game.zombieAnimationFactor(zombie), rate, zombie.pogo&&zombie.pogoState?zombie.pogoState.animTime*100:catapultTicks, headless(zombie), zombie.catapult?.ammo,ordinaryBodyTime,bodyBlend,bodyBlendLeft);
      if (this.showZombieHealth) {
        if (!actor.healthBar) { actor.healthBar = new ZombieHealthBar(); actor.visual.addChild(actor.healthBar.root); }
        actor.healthBar.root.visible = true;
        actor.healthBar.root.y = actor.nativeAligned ? game.zombieBodyTop(zombie)-actor.root.y-10 : actor.nativeRig ? actor.nativeRig.healthTop(clip) : actor.giantRig ? -170 : -actor.art.height * actor.art.anchor.y - 10;
        actor.healthBar.update(zombie);
      } else if (actor.healthBar) actor.healthBar.root.visible = false;
      const kelp = kelpTargets.get(zombie.id);
      if (kelp && kelp.remaining <= 50) { actor.root.y += 50 - kelp.remaining; actor.root.alpha = (kelp.remaining - 1) / 50; }
      if(zombie.underground)actor.root.alpha=.55;
      (actor.nativeRig?.root ?? actor.giantRig?.root ?? actor.art).tint = zombie.butterIn ? 0xffdc63 : game.ticks - zombie.hitAt < 8 ? 0xe4ff9b : zombie.hypnotized ? 0xd28cff : zombie.chillIn > 0 ? 0x87c7ff : 0xffffff;
      this.updateIceTrap(actor,game,zombie);
    }
    for(const l of game.ladders){const actor=this.actor(`ladder${l.column}-${l.row}`,l.row*100+24);actor.art.texture=this.textures.ladder;actor.art.anchor.set(.5,1);actor.art.width=65;actor.art.height=115;actor.root.position.set(cellX(l.column)+20,game.rowY(l.row,cellX(l.column)));}
    for (const pea of game.peas) {
      if(pea.cannon&&pea.age<206)continue;
      const key = `b${pea.id}`; const actor = this.actor(key, pea.row * 100 + 30);
      const kind = pea.lob ? pea.lob.kind : pea.star?'star': pea.spike ? 'spike' : pea.puff ? 'puff' : pea.ice ? 'ice' : pea.fire ? 'fire' : 'pea';
      if (kind === 'fire') {
        if(!actor.fireRig){actor.fireRig=new ActorRig('firepea',{definition:fireParts as unknown as ActorDefinition,textures:this.firePeaParts,file:''});actor.visual.addChild(actor.fireRig.root);}
        actor.fireRig.root.visible=true;actor.art.visible=false;actor.clip=kind;
        actor.frame=firePeaShotFrame(pea,game.ticks);actor.fireRig.render('fire',fireAnimationTime(pea,game.ticks),false,false,true);
        actor.fireRig.root.position.set((pea.vx??0)<0?41:-39,-39);actor.fireRig.root.scale.x=(pea.vx??0)<0?-1:1;
      } else if (actor.clip !== kind) { actor.clip = kind; actor.art.texture = pea.cannon?this.textures.cannon:pea.lob?this.textures[pea.lob.kind]:pea.star?this.textures.star:pea.spike ? this.textures.spike : pea.puff ? this.textures.puff : pea.ice ? this.textures.ice : this.textures.pea; actor.art.anchor.set(.5); actor.art.width = pea.cannon?48:(pea.lob?.kind==='melon'||pea.lob?.kind==='wintermelon')?38:pea.lob?25:pea.star?28:pea.spike?26:actor.art.texture.width; actor.art.height = pea.cannon?85:(pea.lob?.kind==='melon'||pea.lob?.kind==='wintermelon')?38:pea.lob?25:pea.star?28:pea.spike?8:actor.art.texture.height; actor.art.tint=0xffffff; }
      if(pea.homing!==undefined)actor.art.rotation=Math.atan2(pea.vy??0,pea.vx??1);
      this.move(actor, pea, pea.y!==undefined?pea.y:pea.originY!==undefined?pea.originY-(pea.high?72:0):game.rowY(pea.row) - (pea.high ? 115 : 43), alpha);
      if(pea.lob?.flight){
        const scale=lobDrawScale(pea.lob.kind);
        actor.art.width=actor.art.texture.width*scale;actor.art.height=actor.art.texture.height*scale;
        actor.root.x+=actor.art.texture.width/2;actor.root.y+=actor.art.texture.height/2;
      }
    }
    for (const nut of game.rollers) {
      const actor = this.actor(`r${nut.id}`, nut.row * 100 + 28);
      actor.root.zIndex = nut.row * 100 + 28;
      this.animate(actor, nut.kind === 'wallnut' ? 'wallnut-roll' : 'explodenut');
      this.move(actor, nut, nut.y, alpha);
    }
    for(const coin of game.coins){
      const actor=this.actor(`coin${coin.id}`,700);actor.art.texture=coin.value===1000?this.textures.coinDiamond:coin.value===50?this.textures.coinGold:this.textures.coinSilver;
      actor.art.anchor.set(.5);actor.art.width=30;actor.art.height=30;this.move(actor,coin,coin.y,alpha);
      actor.root.alpha=coin.expiresIn<150?.45+Math.abs(Math.sin(game.ticks/10))*.55:1;
    }
    for (const sun of game.suns) {
      const key = `s${sun.id}`; const actor = this.actor(key, 700);
      this.animate(actor, 'sun'); actor.root.scale.set(sun.value === 15 ? .4 : .8);
      this.move(actor, sun, sun.y, alpha);
      actor.root.alpha = sun.expiresIn < 150 ? .45 + Math.abs(Math.sin(game.ticks / 10)) * .55 : 1;
    }
    for (const mower of game.mowers) {
      if (mower.state === 'spent') continue;
      const key = `m${mower.row}`; const actor = this.actor(key, mower.row * 100 + 25);
      if (actor.clip !== 'mower') { actor.clip = 'mower'; actor.art.texture = game.config.environment==='roof'?this.textures.roofCleaner:game.waterRow(mower.row) && (!game.campaign || game.campaign.poolCleaner) ? this.textures.poolCleaner : this.textures.mower; actor.art.anchor.set(.5, 1); }
      this.move(actor, mower, game.rowY(mower.row) + 5, alpha);
    }
    let hoverKey = '';
    if (aiming && game.cannonTarget !== null) {
      const {x, y} = this.pointer!;
      hoverKey = `cannon:${x}:${y}`;
      if (hoverKey !== this.hoverKey) {
        this.hover.clear(); this.target.clear().circle(x,y,18).stroke({color:0xffef85,width:2});
        this.target.moveTo(x-26,y).lineTo(x-8,y).moveTo(x+8,y).lineTo(x+26,y)
          .moveTo(x,y-26).lineTo(x,y-8).moveTo(x,y+8).lineTo(x,y+26).stroke({color:0xffef85,width:2});
      }
    } else if (aiming && (game.selected || game.digging) && column >= 0 && column < BOARD.columns && game.config.rows.includes(row)) {
      const allowed = game.digging ? !!digTarget : game.canPlant(game.selected!,column,row);
      const color = allowed ? 0xfcf4bb : 0xe46647;
      hoverKey = `${column}:${row}:${color}:${digTarget?.id}`;
      if (hoverKey !== this.hoverKey) {
        this.hover.clear().rect(BOARD.left + column*80+2, BOARD.top+row*game.cellHeight+game.slope(cellX(column))+(game.config.environment==='roof'?-10:0)+2,76,game.cellHeight-4).fill({color,alpha:.2});
        this.target.clear();
        if (digTarget) this.target.ellipse(cellX(digTarget.column)+(digTarget.kind==='cobcannon'?40:0),game.rowY(row,cellX(digTarget.column)),digTarget.kind==='cobcannon'?75:36,10).stroke({color:0xffd36b,width:2});
      }
      if (game.selected) {
        const kind = game.selected === 'imitater' ? game.imitaterTarget! : game.selected;
        const preview = this.actor(`preview-${kind}`, 1000);
        preview.nativeAligned=true;
        // One static pose reuses the battle's loaded rigs; it does not animate or load new assets.
        if (!preview.clip) this.animate(preview,kind,true,0);
        this.positionPlant(preview,game,kind,column,row);
        preview.root.alpha = .45; preview.root.tint = allowed ? 0xffffff : 0xf59483;
      }
    }
    if (!hoverKey && this.hoverKey) { this.hover.clear(); this.target.clear(); }
    this.hoverKey = hoverKey;
    for (const [key, actor] of this.actors) if (actor.seen !== this.stamp) {
      if (key.startsWith('z')) {
        if (actor.healthBar) actor.healthBar.root.visible = false;
        const burned = this.explosions.some(e => Math.abs(e.x - actor.root.x) <= 115 && Math.abs(e.y + 35 - actor.root.y) <= 101);
        const special = ['yeti','dancer','backup','snorkel','zomboni','bobsled','dolphin','jack','balloon','digger','pogo','bungee','ladder','catapult','gargantuar','imp'].find(name=>actor.clip.startsWith(`${name}-`));
        const clip = special && ['yeti','zomboni','bobsled','dolphin','jack','balloon','digger','pogo','bungee','ladder','catapult','gargantuar','imp'].includes(special) ? `${special}${special==='gargantuar'&&actor.clip.includes('-bare-')?'-bare':''}-die` : actor.clip.startsWith('ducky') && !burned ? 'ducky-die' : special && (special!=='snorkel'||!burned) ? `${special}-${burned?'burn':'die'}` : `${actor.clip.startsWith('football-') && !burned ? 'football' : actor.clip.startsWith('newspaper-') ? 'newspaper' : actor.clip.startsWith('pole-') ? 'pole' : 'zombie'}-${burned ? 'burn' : 'die'}`;
        if(burned&&actor.iceTrap){actor.iceTrap.back.visible=false;actor.iceTrap.front.visible=false;}
        this.animate(actor, clip, false); (actor.nativeRig?.root ?? actor.giantRig?.root ?? actor.art).tint = 0xffffff;
        this.effects.push({ node: actor.root, actor, born: this.time, duration: this.clipDuration(clip) });
      } else if (key.startsWith('b') && this.projectilePool.length < 256) {
        actor.root.removeFromParent(); actor.motion = undefined; this.projectilePool.push(actor);
      } else actor.root.destroy({ children: true });
      this.actors.delete(key);
    }
    for(const [kind,texture]of this.squishedTextures)if(!game.squishedPlants.some(p=>p.kind===kind)){texture.destroy(true);this.squishedTextures.delete(kind);}
    this.explosions.length = 0;
    let healthKey = '';
    for (const plant of game.plants) if (plant.health < PLANTS[plant.kind].health) healthKey += `${plant.id}:${plant.health};`;
    if (healthKey !== this.healthKey) {
      this.healthKey = healthKey; this.health.clear();
      for (const plant of game.plants) if (plant.health < PLANTS[plant.kind].health) {
        this.health.rect(cellX(plant.column) - 20, game.rowY(plant.row,cellX(plant.column)) + 4, 40, 5).fill({ color: 0x2c3927, alpha: .7 });
        this.health.rect(cellX(plant.column) - 19, game.rowY(plant.row,cellX(plant.column)) + 5, 38 * plant.health / PLANTS[plant.kind].health, 3).fill(0xb7e458);
      }
    }
    if(game.config.environment==='fog'&&game.level!==40) {
      this.fog.visible = game.fogBlownIn === 0;
      const lamps=game.plants.filter(p=>p.kind==='plantern'&&p.health>0);
      const key='fog:'+lamps.map(p=>p.id).join(',');
      if(key!==this.fogKey) {
        this.fogKey=key;this.fog.removeChildren().forEach(child=>child.destroy());
        const left=game.scenario==='adventure'?(game.level===31?6:game.level>=37?4:5):5;
        for(let column=left;column<=9;column++)for(let row=0;row<=6;row++) {
          const lit=lamps.some(p=>{const dx=Math.abs(column-p.column),dy=Math.abs(row-p.row);return dx<=3&&dy<=2&&dx+dy!==5;});
          if(!lit){const cloud=new Sprite(this.fogFrames[(column*3+row)%8]);cloud.position.set(column*80-15,row*85+20);cloud.alpha=column===5?.78:1;this.fog.addChild(cloud);}
        }
      }
    }
    this.weather.clear();
    if(game.scenario==='adventure'&&game.level===40){
      this.fog.visible=false;
      for(let i=0;i<35;i++){const x=(i*139+game.ticks*1.2)%850,y=80+(i*73+game.ticks*6)%520;this.weather.moveTo(x,y).lineTo(x-8,y+22);}
      this.weather.stroke({color:0xa9c8de,alpha:.3,width:1});
      const flash = stormOpacity(game.stormFlash, game.stormIn, game.ticks);
      this.weather.rect(-this.viewport.x / this.viewport.scaleX,0,this.viewport.width / this.viewport.scaleX,600).fill({color:0x000000,alpha:flash.dark});
      this.weather.rect(-this.viewport.x / this.viewport.scaleX,0,this.viewport.width / this.viewport.scaleX,600).fill({color:0xffffff,alpha:flash.white});
    }
    this.updateEffects();
  }

  private updateEffects() {
    let remainingEffects = 0;
    for (const effect of this.effects) {
      const age = this.time - effect.born;
      if(effect.debris)effect.debris.update(age);
      else if(effect.powie)effect.powie.update(age);
      else if (effect.actor) this.animate(effect.actor, effect.actor.clip, false);
      else effect.node.alpha = 1 - age / effect.duration;
      if (age >= effect.duration) effect.node.destroy({ children: true });
      else this.effects[remainingEffects++] = effect;
    }
    this.effects.length = remainingEffects;
  }
}
