import {advanceBodyBlend,ordinaryBodyClip,type OrdinaryBodyBlend,advanceEatingAnimation,groundWalkStep,hasGroundWalk} from './ground-walk';
import {fireResistant,impactSounds,type ImpactSound} from './impact';
import { campaignConfig, daveSeeds, type CampaignRules } from './campaign';
import { createBoss, stepBoss, damageBoss, bossVulnerable, type Boss } from './boss';
import { zombieBodyHealth, BOARD, UPGRADES, isUpgrade, type BasePlantKind, cellX, survivalConfig, isPool, isNight, MUSHROOMS, LEVELS, PLANTS, type SurvivalMode, type SurvivalScene, type LevelId, type PlantKind, type ZombieKind } from './config';
import { generateSurvivalWaves, isSurvivalFlagWave, survivalRoster } from './survival';
import { generateWaves, isFlagWave } from './waves';
import { RowPicker } from './row-picker';
import { walkingSpeed } from './zombie-motion';
import {lobFlight,lobCanCollide,type LobFlight} from './lob-flight';
import portable from './data/portable-adventure.json';
import {isPeaKind,createPeaMotion,beginPeaShot,beginThreepeaterShot,advanceFireAnimation,updatePeaShooting,advancePeaMotion,peaHeadOffset,type PeaMotion} from './pea-motion';

// ZombieInitialize hitbox sizes, expressed around the model's body center.
const LOB_NORMAL_BODY=[42,115] as const,LOB_GIANT_BODY=[125,154] as const,LOB_VEHICLE_BODY=[153,140] as const;
const LOB_FOOTBALL_BODY=[57,115] as const,LOB_SNORKEL_BODY=[62,115] as const,LOB_DIGGER_BODY=[28,115] as const;
const NATIVE_GROUND_ZOMBIES=new Set<ZombieKind>(['normal','cone','bucket','flag','door','newspaper','football','pole','jack','yeti','ladder','imp','gargantuar','catapult','zomboni']);

export type Phase = 'ready' | 'playing' | 'paused' | 'intermission' | 'won' | 'lost';
export interface Plant { id: number; kind: PlantKind; row: number; column: number; health: number; actionIn: number; born: number; shotAt: number; invulnerableIn?: number; awake?: boolean; burstIn?: number; imitated?: boolean; morphTarget?: PlantKind; winterLaunchIn?: number; rearIn?: number; productionEnding?: number; scared?: boolean; tall?: boolean; kelp?: { target: number; remaining: number }; squash?: { remaining: number; x: number; target: number; restIn?:number };
  peaMotion?:PeaMotion;
  threepeaterIn?:number;
  gravebuster?: { phase:'landing'|'eating'; rate:number; ticks:number };
  chomp?: { phase: 'ready' | 'bite' | 'digest' | 'recover'; remaining: number } }
export const headless = (zombie: Zombie) => !['zomboni','catapult','gargantuar','bungee'].includes(zombie.kind)
  && !(zombie.kind==='balloon'&&(zombie.flying||(zombie.popIn??0)>0)) && !zombie.sled && zombie.health < Math.trunc(zombieBodyHealth(zombie.kind,zombie.mini) / 3);
export interface Roller { id: number; kind: 'wallnut' | 'explodenut'; row: number; x: number; y: number; direction: number; hit: number[] }
export interface SquishedPlant { id:number; kind:PlantKind; row:number; column:number; remaining:number; imitated?:boolean }
export interface Packet { id: number; kind: PlantKind; x: number }
export interface Zombie { id: number; kind: ZombieKind; armor: number; row: number; x: number; health: number; speed: number; biteIn: number; eating: boolean; wave: number; hitAt: number; chillIn: number; hasPole: boolean; vaultIn: number; animationTime: number; walkTime?:number; walkVariant?:1|2; eatTime?:number; bodyBlend?:OrdinaryBodyBlend; shield: number; rageIn: number; riseIn: number; hypnotized?: boolean; mini?: boolean; yetiIn?: number; frozenIn?: number; summonIn?: number; dancePhase?: 'intro' | 'point' | 'hold' | 'dance'; danceIn?: number; leader?: number; slot?: number; flying?: boolean; popIn?: number; dolphin?: boolean; jackIn?: number; jackOpening?: boolean; sled?: number; sledLeader?: number; crashIn?: number; blownIn?: number; underground?: boolean; emergingIn?: number; backwards?: boolean; metalRemoved?: boolean; pogo?: boolean; pogoState?: { phase:'bounce'|'high'|'forward'|'fall'|'walk'; remaining:number; altitude:number; animTime:number }; butterIn?: number; ladderIn?: number; garlicIn?: number; garlicRow?: number; catapult?: { ammo: number; remaining: number; phase: 'walk' | 'shoot' | 'reload'; animTime?:number; lastAnimTime?:number }; giant?: { thrown: boolean; phase: 'walk' | 'smash' | 'throw'; remaining: number }; flight?: { remaining: number; duration: number; startX: number; endX: number }; landingIn?: number; bungee?: { phase: 'down' | 'wait' | 'up'; remaining: number; column: number; drop?: ZombieKind } }
export interface Pea { id: number; row: number; x: number; ice: boolean; puff: boolean; age: number; nativePea?:{rawX:number;shadowY:number;rawY?:number;vy?:number}; homing?: number; cannon?: {x:number;y:number;remaining:number}; longRange?: boolean; fire?: boolean; fireAt?:number; fireRate?:number; fireTime?:number; torch?: number; spike?: boolean; high?: boolean; vx?: number; vy?: number; y?: number; originY?: number; star?: boolean; lob?: { kind: 'cabbage' | 'kernel' | 'butter' | 'melon' | 'wintermelon' | 'basketball'; target: number; startX: number; endX: number; startY: number; endY: number; duration: number; flight?:LobFlight } }
export interface Vase { id: number; row: number; column: number; green: boolean; content: { type: 'seed'; kind: PlantKind } | { type: 'zombie'; kind: ZombieKind } }
export interface SeedDrop { id: number; kind: PlantKind; row: number; column: number; remaining: number; timesDropped: number }
export interface Sun { id: number; x: number; y: number; targetY: number; expiresIn: number; born: number; value: number }
export interface Coin { id: number; x: number; y: number; targetY: number; magnet?: number; born: number; expiresIn: number; value: number }
export interface Mower { row: number; x: number; state: 'ready' | 'moving' | 'spent' }
export type GameEvent = { kind: 'plant' | 'shoot' | 'pea-ignite' | 'pea-melt' | 'hit' | 'squish' | 'mower' | 'wave' | 'win' | 'lose' | 'flag' | 'whack' | 'hypnotize' | 'freeze' | 'blover' | 'vase' | 'thunder' | 'bungee' | 'coffee' | 'grave-chomp'; x: number; y: number; impact?:ImpactSound[] }
  | {kind:'grave-clear';x:number;y:number;row:number;tick:number}
  | { kind: 'explode'; x: number; y: number; zombieId?:number; effect?:'powie'; tick?:number }
  | { kind: 'fire'; x: number; y: number; row: number }
  | { kind: 'coin'; x: number; y: number; value: number }
  | { kind: 'sun'; x: number; y: number; value: number }
  | { kind: 'fume'; x: number; y: number; row: number }
  | { kind: 'swallow'; x: number; y: number; zombieId: number };

// Browser-independent, fixed 10 ms simulation. Rendering never changes this state.
export class Game {
  phase: Phase = 'ready';
  ticks = 0;
  sun: number;
  autoCollectSun = false;
  selected: PlantKind | null = null;
  plants: Plant[] = [];
  squishedPlants: SquishedPlant[] = [];
  rollers: Roller[] = [];
  conveyor: Packet[] = [];
  selectedPacket: number | null = null;
  digging = false;
  private conveyorIn = 400;
  private lastConveyorSeed: PlantKind | null = null;
  readonly needsSeedChoice: boolean;
  seeds: PlantKind[];
  zombies: Zombie[] = [];
  peas: Pea[] = [];
  suns: Sun[] = [];
  coins: Coin[] = [];
  money = 0;
  bankedMoney = 0;
  tutorial: 'off' | 'pea' | 'sunflower' | 'more-sun' | 'shovel' | 'shovel-done' = 'off';
  tutorialFinished = false;
  readonly davePicks: PlantKind[] = [];
  private firstCoinDropped = false;
  rake: {row:number;column:number;age:number;attracting:boolean}|null=null;
  mowers: Mower[];
  graves: { id: number; row: number; column: number }[] = [];
  private graveWaveIn = 0;
  craters: { id: number; row: number; column: number; remaining: number }[] = [];
  private poolFrozenIn = 0;
  iceTrails: { row: number; x: number; remaining: number }[] = [];
  fogBlownIn = 0;
  stormIn = 650;
  stormFlash: 1 | 2 | 3 = 1;
  ladders: { column: number; row: number }[] = [];
  vaseStage = 0;
  vases: Vase[] = [];
  seedDrops: SeedDrop[] = [];
  selectedDrop: number | null = null;
  cooldowns: Record<BasePlantKind, number> = { imitater:0, umbrella:0, marigold:0, melonpult:0, splitpea:0, starfruit:0, pumpkin:0, magnetshroom:0, cabbagepult:0, flowerpot:0, kernelpult:0, coffeebean:0, garlic:0, jalapeno: 0, spikeweed: 0, torchwood: 0, tallnut: 0, seashroom: 0, cactus: 0, blover: 0, tanglekelp: 0, peashooter: 0, sunflower: 0, cherrybomb: 0, wallnut: 0, potatomine: 0, snowpea: 0, explodenut: 0, chomper: 0, repeater: 0, puffshroom: 0, sunshroom: 0, fumeshroom: 0, gravebuster: 0, hypnoshroom: 0, scaredyshroom: 0, iceshroom: 0, doomshroom: 0, lilypad: 0, squash: 0, threepeater: 0, plantern: 0 };
  wintermelonCooldown = 0;
  upgradeCooldowns = { gatlingpea: 0, twinsunflower: 0, gloomshroom:0, cattail:0, goldmagnet:0, spikerock:0, cobcannon:0 };
  get seedCapacity() { return this.isSurvival ? 10 : this.campaign ? this.campaign.slots : 6; }
  get canStart() { return !this.needsSeedChoice || this.seeds.length >= (this.campaign ? this.seedCapacity : 6) && this.seeds.length <= this.seedCapacity && (!this.seeds.includes('imitater') || this.imitaterTarget!==null); }
  cooldown(kind: PlantKind) { return kind === 'wintermelon' ? this.wintermelonCooldown : isUpgrade(kind) ? this.upgradeCooldowns[kind] : this.cooldowns[kind]; }
  imitaterTarget: PlantKind | null = null;
  cannonTarget: number | null = null;
  plantCost(kind: PlantKind) {
    if (kind==='imitater' && this.imitaterTarget) return PLANTS[this.imitaterTarget].cost;
    return PLANTS[kind].cost + (this.scenario === 'endless' && isUpgrade(kind) ? this.plants.filter(p => p.kind === kind).length * 50 : 0);
  }
  wave = 0;
  kills = 0;
  planted = 0;
  collected = 0;
  events: GameEvent[] = [];
  private id = 0;
  private randomState: number;
  private started = false;
  private sunIn = 400;
  private sunsFallen = 0;
  private waveIn = 1800;
  private waveElapsed = 0;
  private waveThreshold = 0;
  flagWarningIn = 0;
  private whackSpawnIn = 0;
  private whackFinalSpawned = false;
  private rowPicker: RowPicker;
  readonly config;
  waves: ZombieKind[][];
  boss: Boss | null = null;
  survivalStage = 0;
  survivalEnemies: ZombieKind[] = [];

  constructor(readonly level: LevelId, seed: number, readonly scenario: 'adventure' | SurvivalMode = 'adventure', readonly survivalScene: SurvivalScene = 'day', readonly campaign: CampaignRules | null = null) {
    if (scenario === 'adventure' && level === 40) this.stormIn = 400;
    if (scenario === 'adventure' && level === 50) this.boss = createBoss();
    this.config = scenario !== 'adventure' ? survivalConfig(survivalScene, scenario) : campaign ? campaignConfig(level,campaign) : LEVELS[level];
    this.needsSeedChoice = scenario !== 'adventure' || this.config.mode === 'lawn' && (level > 7 || this.repeatAdventure);
    this.seeds = this.needsSeedChoice ? [] : [...this.config.seeds];
    this.sun = this.config.initialSun;
    this.randomState = seed >>> 0;
    if (scenario !== 'adventure') this.survivalEnemies = survivalRoster(0, () => this.random(), survivalScene, scenario);
    this.waves = scenario !== 'adventure' ? generateSurvivalWaves(0, this.survivalEnemies, () => this.random(), scenario) : generateWaves(level, () => this.random(), this.repeatAdventure, !!campaign && (campaign.run>2 || campaign.run>1 && level>=40), campaign?.sawYeti);
    if (this.repeatAdventure && this.needsSeedChoice) {
      let state = seed >>> 0;
      this.davePicks.push(...daveSeeds(level,this.config.seeds,this.waves.flat(),()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000;}));
      this.seeds.push(...this.davePicks);
    }
    if (scenario !== 'adventure' || this.repeatAdventure) this.started = true;
    this.rowPicker = new RowPicker(this.config.rows);
    if (this.config.mode === 'bowling') {
      this.conveyor.push({ id: ++this.id, kind: 'wallnut', x: 0 });
      this.started = true; this.waveIn = 200;
    }
    if (this.config.mode === 'conveyor') {
      this.started = true; this.conveyorIn = 1;
    }
    if (this.config.mode === 'whack') { this.started = true; this.waveIn = 200; this.addWhackGraves(9); }
    if (this.config.environment === 'night' && this.config.mode !== 'whack' && this.config.mode !== 'vase') {
      const columns = scenario !== 'adventure' ? [[4,1],[5,1],[6,2],[7,2],[8,3]] : portable.graveColumns[level - 1];
      for (const [column, count] of columns) {
        const rows = [...this.config.rows];
        for (let i = 0; i < count; i++) this.graves.push({ id: ++this.id, column, row: rows.splice(Math.floor(this.random() * rows.length), 1)[0] });
      }
    }
    if (this.config.mode === 'vase') { this.started = true; this.populateVases(); }
    if (this.config.environment === 'roof') for (let column=0;column<(level===41?5:level===42?4:3);column++) for (const row of this.config.rows) this.plants.push({id:++this.id,kind:'flowerpot',column,row,health:300,actionIn:0,born:0,shotAt:-100});
    for(const plant of this.plants)if(isPeaKind(plant.kind))plant.peaMotion=createPeaMotion(plant.kind,15+this.random()*5);
    this.mowers = this.config.mode === 'vase' || this.config.environment === 'roof' && !campaign?.roofCleaner ? [] : this.config.rows.map(row => ({ row, x: 20, state: 'ready' }));
  }

  applyPurchases(rules: CampaignRules) {
    Object.assign(this.campaign!,rules);
    this.config.seeds=campaignConfig(this.level,rules).seeds;
    if(this.config.environment==='roof'&&rules.roofCleaner&&this.mowers.length===0)this.mowers=this.config.rows.map(row=>({row,x:20,state:'ready'}));
  }
  placeRake() {
    if(!this.campaign?.rake || this.boss || this.config.mode==='whack')return;
    const rows=this.config.rows.filter(row=>row!==5&&!this.waterRow(row));
    this.rake={row:rows[Math.floor(this.random()*rows.length)],column:this.config.mode==='vase'?Math.min(...this.vases.map(v=>v.column))-1:7,age:-1,attracting:true};
  }
  snapshot() {
    const { config, rowPicker, ...state } = this;
    return structuredClone({ ...state, rowPicker: rowPicker.snapshot() });
  }
  static restore(snapshot: ReturnType<Game['snapshot']>) {
    const game = new Game(snapshot.level, 0, snapshot.scenario, snapshot.survivalScene, snapshot.campaign);
    Object.assign(game, structuredClone(snapshot));
    game.rowPicker = RowPicker.restore(snapshot.rowPicker);
    for(const plant of game.plants)if(isPeaKind(plant.kind)&&!plant.peaMotion){
      const motion=plant.peaMotion=createPeaMotion(plant.kind,17.5),age=Math.max(0,game.ticks-plant.born);
      motion.bodyTime=Math.fround((age*Math.fround(.01)*17.5/25)%1);
      for(const head of motion.heads){head.time=motion.bodyTime;head.looped=age>=143;}
      if(plant.kind==='threepeater'&&plant.threepeaterIn){
        beginThreepeaterShot(motion,game.config.rows.includes(plant.row+1),game.config.rows.includes(plant.row-1));motion.shooting=plant.threepeaterIn;
        for(const head of motion.heads)if(head.phase==='shoot'){head.time=Math.min(1,Math.fround(Math.max(0,game.ticks-plant.shotAt)*Math.fround(.01)*20/13));head.looped||=head.time===1;delete head.blend;}
      }
    }
    return game;
  }
  get repeatAdventure() { return this.scenario === 'adventure' && this.campaign !== null && this.campaign.run > 1; }
  get cellHeight() { return isPool(this.config.environment) || this.config.environment === 'roof' ? 85 : 100; }
  // Board::GridToPixelY is the plant's top-left, distinct from rowY's foot anchor.
  gridY(column:number,row:number) { return BOARD.top+row*this.cellHeight+(this.config.environment==='roof'?Math.max(0,5-column)*20-10:0); }
  // Verified zero-altitude families. Other phases retain their old bridge until
  // their altitude, clipping and phase transitions are mapped together.
  nativeGroundY(z:Zombie,x=z.x):number|undefined {
    if(!(NATIVE_GROUND_ZOMBIES.has(z.kind)||z.kind==='pogo'&&z.pogoState)||this.waterRow(z.row)||z.mini||z.flight||z.landingIn||z.riseIn||z.vaultIn||z.bungee||z.sled)return;
    // mPosX=modelX-30; GetPosYBasedOnRow samples terrain at mPosX+40.
    return this.gridY(8,z.row)+this.slope(x+10)-30-(z.kind==='pogo'?16:0);
  }
  rowY(row: number, x = 440) { return BOARD.top + row * this.cellHeight + (this.config.environment === 'roof' ? 58 + this.slope(x) : isPool(this.config.environment) ? 68 : 78); }
  slope(x: number) { return this.config.environment === 'roof' ? Math.max(0,440-x)*.25 : 0; }
  rowAt(y: number, x = 440) { return Math.floor((y - BOARD.top - this.slope(x) + (this.config.environment === 'roof' ? 10 : 0)) / this.cellHeight); }
  waterRow(row: number) { return isPool(this.config.environment) && (row === 2 || row === 3); }
  sleeping(plant: Plant) { return !this.boss && !plant.awake && !isNight(this.config.environment) && MUSHROOMS.includes(plant.kind); }
  flying(z: Zombie) { return z.kind === 'balloon' && (z.flying || (z.popIn !== undefined && z.popIn > 0)); }
  submerged(z: Zombie) { return !!z.flight || !!z.landingIn || !!z.underground || !!z.emergingIn || !!z.bungee && z.bungee.phase !== 'wait' || z.kind === 'snorkel' && this.waterRow(z.row) && z.x > 100 && z.x < 770 && !z.eating; }
  private plantOnGround(p:Plant) { return p.health>0&&!(p.kind==='squash'&&p.squash&&p.squash.remaining<=60); }
  private plantRectOverlap(p:Plant,left:number,width:number) {
    const plantLeft=cellX(p.column)-(p.kind==='pumpkin'||p.kind==='cobcannon'?40:30);
    const plantWidth=p.kind==='tallnut'?80:p.kind==='cobcannon'?140:60;
    return Math.min(left+width,plantLeft+plantWidth)-Math.max(left,plantLeft);
  }
  private checkBoardEdge(z:Zombie,rawX:number) {
    if((z.hypnotized||z.backwards)&&z.x-30>850)return;
    const edge=z.kind==='gargantuar'||z.kind==='pole'?-150
      :z.kind==='catapult'||z.kind==='football'||z.kind==='zomboni'?-175
      :z.kind==='dancer'||z.kind==='backup'||z.kind==='snorkel'?-130:-100;
    if(headless(z)) {
      if(rawX<=edge+70)this.damageZombie(z,1800,true);
    } else if(rawX<=edge&&this.phase==='playing') {
      this.phase='lost';this.events.push({kind:'lose',x:400,y:300});
    }
  }

  private canChewAt(z:Zombie,p:Plant) {
    if(this.nativeGroundY(z)===undefined){
      const distance=(z.x-cellX(p.column+(p.kind==='cobcannon'&&!z.backwards?1:0)))*(z.backwards?-1:1);
      return distance<35&&distance>-30;
    }
    // Zombie::FindPlantTarget requires at least twenty horizontal pixels.
    const offset=z.kind==='ladder'?10:z.kind==='pogo'&&!z.pogo?20:z.kind==='jack'||z.kind==='newspaper'||z.kind==='yeti'?20:50;
    const width=z.kind==='jack'||z.kind==='newspaper'||z.kind==='yeti'||z.kind==='ladder'||z.kind==='pogo'&&!z.pogo?50:20;
    const left=Math.trunc(z.x-30)+(z.backwards||z.hypnotized?120-offset-width:offset);
    return this.plantRectOverlap(p,left,width)>=20;
  }
  private projectileTarget(z: Zombie, range = 1) {
    // Original damage-range bits: ground=1, flying=2, submerged=4. Projectiles cannot hit off-ground phases.
    if(z.health<=0||z.hypnotized||z.vaultIn>0||z.riseIn>0||z.flight||z.underground||z.emergingIn||z.popIn||z.crashIn||z.sledLeader||z.bungee&&z.bungee.phase!=='wait')return false;
    if(this.flying(z))return !!(range&2);
    const underwater=z.kind==='snorkel'&&this.waterRow(z.row)&&z.x>100&&z.x<770&&!z.eating;
    return !!(range&(underwater?4:1));
  }

  private canBeChilled(z:Zombie) {
    return z.health>0&&z.kind!=='zomboni'&&!z.sled&&!z.hypnotized&&!z.underground&&!z.emergingIn&&!z.riseIn;
  }
  private canBeFrozen(z:Zombie) {
    return this.canBeChilled(z)&&!z.vaultIn&&!this.flying(z)&&!z.flight&&!z.landingIn&&!z.crashIn&&!z.jackOpening&&!z.pogo&&(!z.bungee||z.bungee.phase==='wait');
  }
  private applyChill(z:Zombie,duration=1000) {
    if(this.canBeChilled(z))z.chillIn=Math.max(z.chillIn,duration);
  }

  isMovingAtChilledSpeed(z:Zombie) {
    if(z.chillIn>0)return true;
    if(z.kind!=='dancer'&&z.kind!=='backup')return false;
    const leader=z.kind==='dancer'?z:this.zombies.find(other=>other.id===z.leader&&other.health>0);
    if(!leader)return false;
    return leader.chillIn>0||this.zombies.some(other=>other.health>0&&other.leader===leader.id&&other.chillIn>0);
  }

  zombieAnimationFactor(z:Zombie) {
    // ApplyAnimRate uses half speed; CHILLED_SPEED_FACTOR is for motion.
    if((z.frozenIn??0)>0||(z.butterIn??0)>0)return 0;
    return this.isMovingAtChilledSpeed(z)?.5:1;
  }

  private random() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 0x100000000;
  }

  get hasConveyor() { return this.config.mode === 'bowling' || this.config.mode === 'conveyor'; }

  get isSurvival() { return this.scenario !== 'adventure'; }
  get survivalGoal() { return this.scenario === 'survival-normal' ? 5 : this.scenario === 'survival-hard' ? 10 : null; }

  isFlagWave(wave: number) { return this.isSurvival ? isSurvivalFlagWave(wave) : isFlagWave(this.level, wave, this.repeatAdventure); }

  get survivalFlags() {
    // Board::GetSurvivalFlagsCompleted: a flag in progress is not yet a cleared flag.
    const pendingFlag = this.isFlagWave(this.wave - 1) && this.phase !== 'intermission' && this.phase !== 'won';
    return this.survivalStage * this.config.waveCount / 10 + Math.floor((this.wave - Number(pendingFlag)) / 10);
  }

  nextSurvivalStage() {
    if (this.scenario === 'adventure' || this.phase !== 'intermission') return;
    this.survivalStage++;
    this.survivalEnemies = survivalRoster(this.survivalStage, () => this.random(), this.survivalScene, this.scenario);
    this.waves = generateSurvivalWaves(this.survivalStage, this.survivalEnemies, () => this.random(), this.scenario);
    this.wave = 0; this.waveIn = 600; this.waveElapsed = 0; this.waveThreshold = 0; this.flagWarningIn = 0;
    this.rowPicker.beginSurvivalStage();
    this.cancelSelection();
    for (const plant of this.plants) if (plant.kind === 'marigold') delete plant.productionEnding;
    this.phase = 'ready';
  }

  chooseSeed(kind: PlantKind) {
    if (this.phase !== 'ready' || !this.needsSeedChoice || !this.config.seeds.includes(kind) || this.davePicks.includes(kind)) return;
    const index = this.seeds.indexOf(kind);
    if (index !== -1) this.seeds.splice(index, 1);
    else if (this.seeds.length < this.seedCapacity) this.seeds.push(kind);
  }
  replaceSeed(previous: PlantKind, next: PlantKind) {
    if (this.phase !== 'ready' || !this.needsSeedChoice || !this.config.seeds.includes(next)
      || this.davePicks.includes(previous) || this.seeds.includes(next)) return;
    const index = this.seeds.indexOf(previous);
    if (index !== -1) this.seeds[index] = next;
  }
  start() {
    if (!this.canStart) return;
    this.phase = 'playing';
    this.placeRake();
    if (this.campaign?.tutorial && !this.tutorialFinished && this.scenario === 'adventure') {
      if (this.level === 1) this.tutorial = 'pea';
      if (this.level === 2) { this.tutorial = 'sunflower'; this.waveIn=5000; }
    }
  }
  beginShovelLesson() {
    this.plants = [[5,1],[7,2],[6,3]].map(([column,row])=>({id:++this.id,kind:'peashooter',column,row,health:300,actionIn:0,born:0,shotAt:-100}));
    this.tutorial='shovel'; this.phase='playing';
  }
  pause() { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }

  select(kind: PlantKind) {
    if (this.phase !== 'playing' || this.hasConveyor || this.config.mode === 'vase' || !this.seeds.includes(kind)) return;
    this.digging = false; this.cannonTarget=null;
    this.selected = this.selected === kind ? null : kind;
  }

  selectPacket(id: number) {
    if (this.phase !== 'playing') return;
    const packet = this.conveyor.find(packet => packet.id === id);
    if (!packet) return;
    this.digging = false;
    this.selectedPacket = this.selectedPacket === id ? null : id;
    this.selected = this.selectedPacket === null ? null : packet.kind;
  }

  private releaseSeedDrop() {
    const drop = this.seedDrops.find(drop => drop.id === this.selectedDrop);
    if (drop) {
      // Coin::DroppedUsableSeed grants 300 ticks only on the first return to the ground.
      if (drop.timesDropped === 0) drop.remaining = Math.max(drop.remaining, 300);
      drop.timesDropped++;
    }
  }
  cancelSelection() { this.releaseSeedDrop(); this.selected = null; this.selectedPacket = null; this.selectedDrop = null; this.digging = false; this.cannonTarget=null; }
  toggleShovel() {
    if (this.phase !== 'playing' || this.scenario === 'adventure' && this.level < 5 && !this.repeatAdventure) return;
    this.releaseSeedDrop();
    this.cannonTarget=null;
    this.digging = !this.digging; this.selected = null; this.selectedPacket = null; this.selectedDrop = null;
  }
  digTarget(column: number, row: number) {
    const occupants = this.plants.filter(plant => (plant.column === column || plant.kind==='cobcannon'&&plant.column+1===column) && plant.row === row);
    return occupants.find(p => p.kind === 'pumpkin') || occupants.find(plant => !['lilypad','flowerpot'].includes(plant.kind)) || occupants[0];
  }
  dig(column: number, row: number) {
    if (this.phase !== 'playing' || !this.digging) return;
    const target = this.digTarget(column, row);
    if (target) this.ladders = this.ladders.filter(l => l.column !== column || l.row !== row);
    if (target?.kelp) { const caught = this.zombies.find(z => z.id === target.kelp!.target); if (caught) caught.health = 0; }
    this.plants = this.plants.filter(plant => plant !== target);
    this.digging = false;
    if (this.tutorial === 'shovel' && this.plants.length === 0) { this.tutorial = 'shovel-done'; this.phase='ready'; }
  }

  canPlant(kind: PlantKind, column: number, row: number) {
    return this.plantingIssue(kind, column, row) === null;
  }
  // Feedback and placement share the existing rules, including conveyor/vase exceptions.
  plantingIssue(kind: PlantKind, column: number, row: number): string | null {
    const card=kind;
    if (kind==='imitater') { if(this.imitaterTarget===null)return '先选择模仿的植物'; kind=this.imitaterTarget; }
    if (this.phase !== 'playing' || this.tutorial === 'shovel' || !this.seeds.includes(card)
      || !this.config.rows.includes(row) || !(column >= 0 && column < (this.boss ? 8 : BOARD.columns))) return '请选择可种植的草地';
    if (this.vases.some(v => v.column === column && v.row === row) || this.iceTrails.some(ice => ice.row === row && cellX(column) + 30 >= ice.x)) return '这里被罐子或冰道占用了';
    if (this.craters.some(c => c.column === column && c.row === row)) return '弹坑还没有恢复';
    const occupants = this.plants.filter(p => p.column === column && p.row === row);
    if ((kind === 'lilypad' || kind === 'tanglekelp' || kind === 'seashroom') && (!this.waterRow(row) || occupants.length > 0)) return '请种在空的水面上';
    if (this.waterRow(row) && kind !== 'lilypad' && kind !== 'tanglekelp' && kind !== 'seashroom' && (kind === 'potatomine' || kind === 'spikeweed' || kind==='spikerock' || !occupants.some(p => p.kind === 'lilypad' || p.kind==='cattail'))) return ['potatomine','spikeweed','spikerock'].includes(kind) ? '这种植物不能种在水上' : '先在这里放一片睡莲';
    if (this.config.environment === 'roof' && (['spikeweed','spikerock','lilypad','seashroom','tanglekelp','gravebuster'].includes(kind) || kind !== 'flowerpot' && !occupants.some(p => p.kind === 'flowerpot'))) return ['spikeweed','spikerock','lilypad','seashroom','tanglekelp','gravebuster'].includes(kind) ? '这种植物不能种在屋顶' : '先在这里放一个花盆';
    if (kind==='cattail' && occupants.some(p=>!['lilypad','pumpkin'].includes(p.kind))) return '香蒲需要没有其他植物的睡莲';
    if (kind==='cobcannon' && (column>=7 && this.boss || column>=8 || !this.plants.some(p=>p.kind==='kernelpult' && p.column===column+1 && p.row===row) || occupants.some(p=>p.kind==='pumpkin') || this.plants.some(p=>p.column===column+1 && p.row===row && p.kind==='pumpkin'))) return '需要左右相邻的两株玉米投手，且不能带南瓜';
    if (this.plants.some(p=>p.kind==='cobcannon'&&p.row===row&&(p.column===column||p.column+1===column))) return '这两格已被玉米加农炮占用';
    const repair = this.campaign?.firstAid && ['wallnut','tallnut','pumpkin'].includes(kind) && occupants.some(p=>p.kind===kind && p.health < PLANTS[kind].health*2/3);
    const occupied = repair ? false : isUpgrade(kind) ? !occupants.some(p => p.kind === UPGRADES[kind])
      : kind === 'coffeebean' ? !occupants.some(p => this.sleeping(p)) || occupants.some(p => p.kind === 'coffeebean')
      : kind === 'pumpkin' ? occupants.some(p => p.kind === 'pumpkin')
      : kind === 'flowerpot' ? occupants.length > 0
      : occupants.some(p => kind === 'lilypad' || !['lilypad','flowerpot','pumpkin'].includes(p.kind));
    const grave = this.graves.some(grave => grave.column === column && grave.row === row);
    if (kind === 'gravebuster' ? !grave : grave) return kind === 'gravebuster' ? '墓碑吞噬者需要种在墓碑上' : '先清除这里的墓碑';
    if (this.config.mode === 'bowling') return column < 3 && this.conveyor.some(packet => packet.id === this.selectedPacket && packet.kind === kind) ? null : '请在红线左侧滚出坚果';
    if (this.config.mode === 'conveyor' && !this.conveyor.some(packet => packet.id === this.selectedPacket && packet.kind === kind)) return '先选择传送带上的卡片';
    if (this.config.mode === 'vase' && !this.seedDrops.some(drop => drop.id === this.selectedDrop && drop.kind === kind)) return '先选择掉落的卡片';
    if (this.config.mode !== 'conveyor' && this.config.mode !== 'vase') {
      if (!(this.sun >= this.plantCost(card))) return '阳光不足';
      if (this.cooldown(card) !== 0) return '这张卡片还在冷却';
    }
    if (occupied) return isUpgrade(kind) ? `需要种在${PLANTS[UPGRADES[kind]].name}上` : kind === 'coffeebean' ? '咖啡豆需要种在睡着的蘑菇上' : '这里已经有植物了';
    return null;
  }

  plant(column: number, row: number) {
    const kind = this.selected;
    if (!kind || !this.canPlant(kind, column, row)) return false;
    if (this.config.mode === 'bowling') {
      const packet = this.conveyor.splice(this.conveyor.findIndex(packet => packet.id === this.selectedPacket), 1)[0];
      this.rollers.push({ id: ++this.id, kind: packet.kind as Roller['kind'], row, x: cellX(column), y: this.rowY(row), direction: 0, hit: [] });
      this.selectedPacket = null;
    } else {
      if (this.config.mode === 'vase') {
        this.seedDrops = this.seedDrops.filter(drop => drop.id !== this.selectedDrop); this.selectedDrop = null;
      } else if (this.config.mode === 'conveyor') {
        this.conveyor.splice(this.conveyor.findIndex(packet => packet.id === this.selectedPacket), 1);
        this.selectedPacket = null;
      } else {
        this.sun -= this.plantCost(kind);
        if (kind === 'wintermelon') this.wintermelonCooldown = PLANTS[kind].cooldown;
        else if (isUpgrade(kind)) this.upgradeCooldowns[kind] = PLANTS[kind].cooldown;
        else this.cooldowns[kind] = PLANTS[kind==='imitater'?this.imitaterTarget!:kind].cooldown;
      }
      const plantedKind=kind==='imitater'?this.imitaterTarget!:kind;
      if (this.campaign?.firstAid && ['wallnut','tallnut','pumpkin'].includes(plantedKind)) this.plants=this.plants.filter(p=>p.column!==column||p.row!==row||p.kind!==plantedKind);
      const basePlant = isUpgrade(kind) ? this.plants.find(p=>p.column===column&&p.row===row&&p.kind===UPGRADES[kind]) : undefined;
      if (kind==='cobcannon') this.plants=this.plants.filter(p=>p.column!==column+1||p.row!==row||p.kind!=='kernelpult');
      if (isUpgrade(kind)) this.plants = this.plants.filter(p => p.column !== column || p.row !== row || p.kind !== UPGRADES[kind]);
      this.plants.push({ id: ++this.id, kind, column, row, health: PLANTS[kind].health,
        actionIn: kind==='imitater'?319:kind==='cobcannon'?625: kind === 'sunflower' || kind === 'twinsunflower' || kind === 'sunshroom' || kind === 'marigold' ? 300 + Math.floor(this.random() * 951) : kind === 'jalapeno' || kind === 'cherrybomb' || kind === 'iceshroom' || kind === 'doomshroom' ? 100 : kind === 'potatomine' ? 1500 : kind === 'gravebuster' ? 400 : kind === 'coffeebean' ? 100
          : kind === 'gatlingpea' || kind === 'peashooter' || kind === 'snowpea' || kind === 'repeater' || kind === 'puffshroom' || kind === 'fumeshroom' || kind === 'scaredyshroom' || kind === 'threepeater' || kind === 'seashroom' || kind === 'cactus' || kind === 'splitpea' || kind === 'starfruit' || kind === 'cabbagepult' || kind === 'kernelpult' || kind === 'melonpult' || kind === 'wintermelon' ? Math.floor(this.random() * 151) : 50,
        born: this.ticks, shotAt: -100, ...(isPeaKind(kind)?{peaMotion:createPeaMotion(kind,15+this.random()*5)}:{}), ...(kind==='gravebuster'?{gravebuster:{phase:'landing' as const,rate:10+this.random()*5,ticks:0}}:{}), ...(kind==='flowerpot'||kind==='lilypad'?{invulnerableIn:100}:{}), ...(basePlant?.awake!==undefined?{awake:basePlant.awake}:{}), ...(kind==='imitater'?{morphTarget:this.imitaterTarget!}:{}), ...(kind === 'chomper' ? { chomp: { phase: 'ready' as const, remaining: 0 } } : {}) });
    }
    this.selected = null;
    this.started = true;
    this.planted++;
    if (this.tutorial === 'pea' && this.plants.length >= 2) { this.tutorial='off'; this.tutorialFinished=true; this.waveIn=99; }
    if ((this.tutorial==='sunflower'||this.tutorial==='more-sun') && this.plants.filter(p=>p.kind==='sunflower').length>=3) { if (this.tutorial==='sunflower' && this.wave===0) this.waveIn=999; this.tutorial='off'; this.tutorialFinished=true; }
    this.events.push({ kind: 'plant', x: cellX(column), y: this.rowY(row) });
    if(kind==='gravebuster')this.events.push({kind:'grave-chomp',x:cellX(column),y:this.gridY(column,row)+40});
    return true;
  }

  collectSun(id: number) {
    if (this.phase !== 'playing') return;
    const index = this.suns.findIndex(sun => sun.id === id);
    if (index === -1) return;
    const [sun] = this.suns.splice(index, 1);
    this.sun += sun.value;
    this.collected += sun.value;
    this.events.push({ kind: 'sun', x: sun.x, y: sun.y, value: sun.value });
  }

  private addSun(x: number, y: number, targetY: number, value: number) {
    this.suns.push({ id: ++this.id, x, y, targetY, expiresIn: 1200, born: this.ticks, value });
  }

  private spawnWave() {
    // Board::SpawnZombieWave explicitly substitutes four normals if no usable ice exists.
    const wave = this.waves[this.wave].flatMap(kind => kind === 'bobsled' && !this.iceTrails.some(ice => ice.x < 700) ? ['normal','normal','normal','normal'] as ZombieKind[] : [kind]);
    for (const kind of wave) {
      const allowedRows = this.config.rows.filter(row => kind === 'bobsled' ? this.iceTrails.some(ice => ice.row === row && ice.x < 700)
        : kind === 'ducky' || kind === 'snorkel' || kind === 'dolphin' ? this.waterRow(row)
        : this.waterRow(row) ? kind === 'balloon' || this.wave >= 5 && ['normal','cone','bucket','flag'].includes(kind)
        : kind !== 'dancer' || isPool(this.config.environment) || row > 0 && row < 4);
      const row = this.rowPicker.pick(this.wave, this.random(), allowedRows);
      // Adapt original mPosX to this port's body anchor (+30 px); flag overrides to board width.
      const spawnX = 810 + Math.floor(this.random() * 40) + (this.isFlagWave(this.wave) ? 40 : 0);
      if (this.level === 45 && this.scenario === 'adventure' && kind !== 'bungee') { this.dropFromSky(kind, row, this.wave); continue; }
      const zombie = this.spawnZombie(kind, row, kind === 'flag' ? 830 : spawnX, this.wave);
      if (kind === 'bobsled') {
        zombie.armor = 300; zombie.sled = zombie.id;
        for (let i = 1; i < 4; i++) {
          const member = this.spawnZombie('bobsled', row, zombie.x + i * 45, this.wave);
          member.sled = zombie.id; member.sledLeader = zombie.id;
        }
      }
    }
    this.wave++;
    if (this.wave === this.config.waveCount && this.config.environment !== 'day') this.graveWaveIn = 200;
    this.waveElapsed = 0;
    const beforeFlag = this.config.mode !== 'bowling' && this.isFlagWave(this.wave);
    this.waveThreshold = beforeFlag ? 0 : this.zombies.filter(z => !z.hypnotized && z.wave === this.wave - 1 && !headless(z))
      .reduce((sum, z) => sum + z.health + z.armor + z.shield, 0) * (.5 + this.random() * .15);
    this.waveIn = beforeFlag ? 4500 : 2500 + Math.floor(this.random() * 600);
    this.events.push({ kind: 'wave', x: 400, y: 280 });
  }

  private spawnZombie(kind: ZombieKind, row: number, x: number, wave: number) {
    if(this.rake?.attracting&&x>=780&&!['bungee','snorkel','dolphin','ducky'].includes(kind)){row=this.rake.row;this.rake.attracting=false;}
    if(kind==='yeti'&&this.campaign)this.campaign.sawYeti=true;
    const zombie: Zombie = { id: ++this.id, kind, armor: kind === 'digger' ? 100 : kind === 'football' ? 1400 : kind === 'cone' ? 370 : kind === 'bucket' ? 1100 : 0,
      shield: kind === 'ladder' ? 500 : kind === 'newspaper' ? 150 : kind === 'door' ? 1100 : 0, rageIn: 0, riseIn: 0, row, x,
      ...(kind==='yeti'?{yetiIn:1500+Math.floor(this.random()*501)}:{}),
      health: zombieBodyHealth(kind), speed: kind==='yeti'?.4:kind === 'pogo' ? .45 : kind === 'ladder' ? .79 + this.random() * .02 : kind === 'digger' ? .66 + this.random()*.02 : kind === 'dolphin' ? .89 + this.random() * .02 : kind === 'bobsled' ? .6 : ['pole','football','snorkel','jack'].includes(kind) ? .66 + this.random() * .02 : kind === 'dancer' || kind === 'backup' || kind === 'flag' ? .45 : .23 + this.random() * .14,
      biteIn: 4, eating: false, wave, hitAt: -100, chillIn: 0, hasPole: kind === 'pole', vaultIn: 0, animationTime: 0 };
    if(hasGroundWalk(zombie)&&!this.waterRow(row))this.startOrdinaryWalk(zombie);
    if (this.scenario === 'adventure' && this.level === 25) { zombie.mini = true; zombie.health = Math.trunc(zombie.health / 4); zombie.armor = Math.trunc(zombie.armor / 4); zombie.shield = Math.trunc(zombie.shield / 4); }
    if (kind === 'dancer') { zombie.summonIn = 0; zombie.dancePhase = 'intro'; zombie.danceIn = 300 + Math.floor(this.random() * 12); }
    if (kind === 'digger') zombie.underground = true;
    if (kind === 'pogo') {zombie.pogo = true;if(!this.waterRow(row)&&!zombie.mini)zombie.pogoState={phase:'bounce',remaining:1+Math.floor(this.random()*80),altitude:0,animTime:1};}
    if (kind === 'catapult') zombie.catapult = { ammo: 20, remaining: 0, phase: 'walk' };
    if (kind === 'gargantuar') zombie.giant = { thrown: false, remaining: 0, phase: 'walk' };
    if (kind === 'bungee') { const targets=this.plants.filter(p=>!this.zombies.some(z=>z.bungee?.column===p.column&&z.row===p.row)); const target=targets[Math.floor(this.random()*targets.length)]; const column=target?target.column:4+Math.floor(this.random()*5); zombie.row=target?target.row:row; zombie.x=cellX(column); zombie.bungee={phase:'down',remaining:375,column}; this.events.push({kind:'bungee',x:zombie.x,y:this.rowY(zombie.row,zombie.x)}); }
    if (kind === 'dolphin') zombie.dolphin = true;
    if (kind === 'balloon') zombie.flying = true;
    if (kind === 'jack') {
      const distance = (450 + Math.floor(this.random() * 300)) / (this.random() < .05 ? 3 : 1);
      zombie.jackIn = this.config.mode === 'vase' ? 10 : Math.trunc(distance / zombie.speed) * 2;
    }
    this.zombies.push(zombie); return zombie;
  }

  private populateVases() {
    const recipe = portable.vaseStages[this.vaseStage];
    const cells = this.config.rows.flatMap(row => Array.from({ length: 9 - recipe.firstColumn }, (_, i) => ({ row, column: i + recipe.firstColumn })));
    for (const content of recipe.contents) for (let i = 0; i < content.count; i++) {
      const cell = cells.splice(Math.floor(this.random() * cells.length), 1)[0];
      this.vases.push({ id: ++this.id, ...cell, green: false, content: content.type === 'seed' ? { type: 'seed', kind: content.kind as PlantKind } : { type: 'zombie', kind: content.kind as ZombieKind } });
    }
    const seeds = this.vases.filter(v => v.content.type === 'seed');
    for (let i = 0; i < recipe.green; i++) seeds.splice(Math.floor(this.random() * seeds.length), 1)[0].green = true;
    this.wave = this.vaseStage + 1;
  }

  openVase(column: number, row: number) {
    if (this.phase !== 'playing' || this.config.mode !== 'vase' || this.selected) return;
    const vase = this.vases.find(v => v.column === column && v.row === row);
    if (vase) this.breakVase(vase);
    this.digging = false;
  }

  private breakVase(vase: Vase) {
    this.vases = this.vases.filter(v => v !== vase);
    if (vase.content.type === 'seed') this.seedDrops.push({ id: ++this.id, kind: vase.content.kind, row: vase.row, column: vase.column, remaining: 1500, timesDropped: 0 });
    else this.spawnZombie(vase.content.kind, vase.row, cellX(vase.column), this.vaseStage);
    this.events.push({ kind: 'vase', x: cellX(vase.column), y: this.rowY(vase.row) - 40 });
  }

  selectDrop(id: number) {
    if (this.phase !== 'playing') return;
    const drop = this.seedDrops.find(d => d.id === id);
    if (!drop) return;
    if (this.selectedDrop !== id) this.releaseSeedDrop();
    this.selectedDrop = id; this.selected = drop.kind; this.digging = false;
  }

  nextVaseStage() {
    if (this.config.mode !== 'vase' || this.phase !== 'intermission') return;
    this.vaseStage++; this.plants = []; this.squishedPlants = []; this.zombies = []; this.peas = []; this.seedDrops = []; this.suns = [];
    this.cancelSelection(); this.populateVases(); this.phase = 'ready';
  }

  step() {
    if (this.phase !== 'playing' || this.tutorial==='shovel') return;
    this.ticks++;
    // Plant::UpdateAbilities removes squished plants only after 500 becomes -1.
    for(const p of this.squishedPlants)p.remaining--;
    this.squishedPlants=this.squishedPlants.filter(p=>p.remaining>=0);
    if (this.campaign?.tutorial && !this.tutorialFinished && this.level>=3 && this.level<=7 && this.level!==5 && this.wave>=5 && this.cooldown('sunflower')===0 && this.sun>=50 && this.plants.filter(p=>p.kind==='sunflower').length<3) this.tutorial='more-sun';
    if (this.level === 40 && this.scenario === 'adventure') {
      this.stormIn--;
      if ((this.stormIn === 300 && this.stormFlash !== 3) || (this.stormIn === 150 && this.stormFlash !== 2)) this.events.push({ kind: 'thunder', x: 400, y: 300 });
      if (this.stormIn === 0) {
        const max = this.random() < .5 ? 750 : 400;
        this.stormIn = 450 + Math.floor(this.random() * (max - 299));
        this.stormFlash = (1 + Math.floor(this.random() * 3)) as 1 | 2 | 3;
      }
    }
    for (const ice of this.iceTrails) ice.remaining--;
    this.iceTrails = this.iceTrails.filter(ice => ice.remaining > 0);
    if (this.fogBlownIn > 0) this.fogBlownIn--;
    for (const drop of this.seedDrops) drop.remaining--;
    this.seedDrops = this.seedDrops.filter(drop => drop.id === this.selectedDrop || drop.remaining > 0);
    for (const crater of this.craters) crater.remaining--;
    this.craters = this.craters.filter(c => c.remaining > 0);
    if (this.poolFrozenIn > 0) this.poolFrozenIn--;
    for (const kind of this.seeds) if (this.cooldown(kind) > 0) {
      if (kind === 'wintermelon') this.wintermelonCooldown--; else if (isUpgrade(kind)) this.upgradeCooldowns[kind]--; else this.cooldowns[kind]--;
    }
    if (!this.started) return;

    if (this.hasConveyor && this.ticks % 4 === 0) {
      this.conveyor.forEach((packet, index) => { packet.x = Math.max(index * 50, packet.x - 1); });
    }
    if (this.hasConveyor && --this.conveyorIn === 0) {
      const count = this.conveyor.length;
      this.conveyorIn = Math.trunc((count > 8 ? 1000 : count > 6 ? 500 : count > 4 ? 425 : 400) * (this.boss ? .875 : 1));
      if (count < 10) this.conveyor.push({ id: ++this.id, kind: this.nextConveyorSeed(),
        x: count === 0 ? 500 : Math.max(500, this.conveyor[count - 1].x + 50) });
    }

    if(this.rake) {
      const rake=this.rake;
      const target=()=>this.zombies.find(z=>z.row===rake.row&&!z.hypnotized&&!headless(z)&&!this.flying(z)&&!this.submerged(z)&&!z.sled&&Math.abs(z.x-cellX(rake.column))<40);
      if(rake.age<0&&target())rake.age=0;
      else if(rake.age>=0){rake.age++;if(rake.age===28){const z=target();if(z)this.damageZombie(z,1800);}if(rake.age===200)this.rake=null;}
    }
    // Match Board::UpdateGameObjects ordering: plants, zombies, projectiles, suns, mowers.
    for (const plant of this.plants) {
      if(plant.invulnerableIn&&plant.invulnerableIn>0)plant.invulnerableIn--;
      if (this.updateShopPlant(plant)) continue;
      if(plant.kind==='marigold'&&this.wave===this.config.waveCount&&plant.productionEnding===undefined)plant.productionEnding=this.ticks+6000;
      if (plant.kind === 'tanglekelp') { this.updateKelp(plant); continue; }
      if(plant.kind==='torchwood'&&this.plantOnGround(plant)){
        // Plant abilities run before zombies and projectiles. A snow pea melts
        // once per tree column; a later tree may ignite it, even in reverse.
        for(const pea of this.peas)if(!pea.puff&&!pea.spike&&!pea.star&&!pea.lob&&!pea.cannon&&pea.homing===undefined&&!pea.fire&&pea.row===plant.row&&pea.torch!==plant.column&&this.torchOverlap(plant,Math.trunc(pea.x-14))>=10){
          pea.torch=plant.column;
          if(pea.ice){pea.ice=false;this.events.push({kind:'pea-melt',x:pea.x,y:pea.originY??this.rowY(pea.row)-43});}
          else{pea.fire=true;pea.fireAt=this.ticks;pea.fireTime=0;pea.fireRate=Math.fround(50+this.random()*30);this.events.push({kind:'pea-ignite',x:pea.x,y:pea.originY??this.rowY(pea.row)-43});}
        }
        continue;
      }
      if (plant.health <= 0 || this.sleeping(plant) || ['wallnut','tallnut','torchwood','hypnoshroom','lilypad','flowerpot','pumpkin','garlic','plantern','umbrella'].includes(plant.kind)) continue;
      if(plant.kind==='threepeater'){
        // UpdateShooting precedes acquisition. Once committed, target loss does
        // not cancel the volley; counter35 emits at1,34 updates later.
        const motion=plant.peaMotion??(plant.peaMotion=createPeaMotion('threepeater',17.5));
        const fire=updatePeaShooting(motion,'threepeater');if(fire)this.fireThreepeater(plant,fire);
        if(--plant.actionIn<=0){
          plant.actionIn=150-Math.floor(this.random()*15);
          if(this.config.rows.some(row=>Math.abs(row-plant.row)<=1&&this.peaTarget({...plant,row}))){beginThreepeaterShot(motion,this.config.rows.includes(plant.row+1),this.config.rows.includes(plant.row-1));plant.shotAt=this.ticks;}
        }
        plant.threepeaterIn=motion.shooting;advancePeaMotion(motion,'threepeater');
        continue;
      }
      if(isPeaKind(plant.kind)){
        const motion=plant.peaMotion??(plant.peaMotion=createPeaMotion(plant.kind,17.5)),fire=updatePeaShooting(motion,plant.kind);
        if(fire&1)this.firePea(plant,true);if(fire&2)this.fireRear(plant,true);
        if(--plant.actionIn<=0){plant.actionIn=150-Math.floor(this.random()*15);if(this.peaTarget(plant,plant.kind==='splitpea'))beginPeaShot(motion,plant.kind,plant.kind==='splitpea');}
        if(plant.actionIn===25){
          if((plant.kind==='repeater'||plant.kind==='splitpea')&&this.peaTarget(plant))beginPeaShot(motion,plant.kind);
          if(plant.kind==='splitpea'&&this.peaTarget(plant,true))beginPeaShot(motion,plant.kind,true);
        }
        advancePeaMotion(motion,plant.kind);continue;
      }
      if (plant.kind === 'magnetshroom') { this.updateMagnet(plant); continue; }
      if (plant.kind === 'coffeebean') { if (--plant.actionIn===0) { const mushroom=this.plants.find(p=>p.column===plant.column&&p.row===plant.row&&this.sleeping(p)); if(mushroom)mushroom.awake=true;plant.health=0;this.events.push({kind:'coffee',x:cellX(plant.column),y:this.rowY(plant.row,cellX(plant.column))}); } continue; }
      if (plant.kind === 'spikeweed') {
        if (--plant.actionIn <= 0) {
          const targets = this.zombies.filter(z => !z.hypnotized && !this.flying(z) && !z.underground && z.health > 0 && z.row === plant.row && z.vaultIn === 0 && Math.abs(z.x - cellX(plant.column)) < 45);
          if (targets.length) { for (const z of targets) this.damageZombie(z, 20, true); plant.shotAt = this.ticks; plant.actionIn = 100; }
        }
        continue;
      }
      if (plant.kind === 'squash') { this.updateSquash(plant); continue; }
      if (plant.kind === 'scaredyshroom') {
        // Portable tests a 120-pixel circle against nearby enemy bodies (adjacent rows too).
        plant.scared = this.zombies.some(z => !z.hypnotized && z.health > 0 && !headless(z)
          && Math.abs(z.row - plant.row) <= 1 && Math.hypot(Math.max(0, Math.abs(z.x - cellX(plant.column)) - 20), Math.max(0, Math.abs(z.row - plant.row) * this.cellHeight - 50)) <= 120);
        if (plant.scared) { plant.actionIn = 150; continue; }
      }
      if (plant.kind === 'sunshroom' && this.ticks - plant.born >= 12000 && this.ticks - plant.born < 12092) continue;
      if (plant.kind === 'gravebuster') {
        const motion=plant.gravebuster;
        // UpdateAbilities observes the previous UpdateReanim's completed land loop.
        if(motion?.phase==='landing') {
          if(motion.ticks*motion.rate<700){motion.ticks++;continue;}
          motion.phase='eating';motion.rate=12;motion.ticks=1;plant.actionIn=400;
          continue;
        }
        if(motion)motion.ticks++;
        if (--plant.actionIn === 0) {
          this.graves = this.graves.filter(g => g.row !== plant.row || g.column !== plant.column); plant.health = 0;
          this.events.push({kind:'grave-clear',x:cellX(plant.column),y:this.gridY(plant.column,plant.row)+40,row:plant.row,tick:this.ticks});
        }
        continue;
      }
      if (plant.kind === 'chomper') { this.updateChomper(plant); continue; }
      if (plant.kind === 'potatomine') {
        if (plant.actionIn > 0) { plant.actionIn--; continue; }
        if (this.zombies.some(z => !z.hypnotized && !this.flying(z) && z.health > 0 && z.vaultIn === 0 && z.riseIn === 0 && z.row === plant.row && Math.abs(z.x - cellX(plant.column)) < 35)) {
          this.doSpecial(plant);
        }
        continue;
      }
      if (plant.winterLaunchIn && --plant.winterLaunchIn === 1) this.fireLob(plant);
      --plant.actionIn;
      if (plant.actionIn > 0) continue;
      if (plant.kind === 'blover') {
        if (this.ticks - plant.born <= 50) {
          for (const z of this.zombies) if (z.flying) z.blownIn = 100;
          this.fogBlownIn = 4000; plant.actionIn = 100;
          this.events.push({ kind: 'blover', x: cellX(plant.column), y: this.rowY(plant.row, cellX(plant.column)) });
        } else plant.health = 0;
        continue;
      }
      if (['jalapeno','iceshroom','doomshroom'].includes(plant.kind)) { this.doSpecial(plant); continue; }
      if (plant.kind === 'starfruit') { this.fireStars(plant);plant.actionIn=150-Math.floor(this.random()*15);continue; }
      if (plant.kind === 'wintermelon') { this.fireLob(plant, true); plant.actionIn=300-Math.floor(this.random()*15); continue; }
      if (plant.kind === 'cabbagepult' || plant.kind === 'kernelpult' || plant.kind === 'melonpult') { this.fireLob(plant);plant.actionIn=300-Math.floor(this.random()*15);continue; }
      if (plant.kind === 'marigold') {
        if (plant.productionEnding !== undefined && this.ticks >= plant.productionEnding) continue;
        const x=cellX(plant.column), y=this.rowY(plant.row,x);
        this.coins.push({id:++this.id,x:x+12,y:y-55,targetY:y-10,born:this.ticks,expiresIn:1500,value:this.random()<.1?50:10});
        plant.actionIn=2500-150+Math.floor(this.random()*151);plant.shotAt=this.ticks;
        continue;
      }
      if (plant.kind === 'cherrybomb') {
        this.doSpecial(plant);
      } else if (plant.kind === 'sunflower' || plant.kind === 'twinsunflower' || plant.kind === 'sunshroom') {
        this.addSun(cellX(plant.column) + 12, this.rowY(plant.row, cellX(plant.column)) - 55, this.rowY(plant.row, cellX(plant.column)) - 15, plant.kind === 'sunshroom' && this.ticks - plant.born < 12000 ? 15 : 25);
        if (plant.kind === 'twinsunflower') this.addSun(cellX(plant.column) - 12, this.rowY(plant.row, cellX(plant.column)) - 55, this.rowY(plant.row, cellX(plant.column)) - 15, 25);
        plant.actionIn = PLANTS.sunflower.interval - 150 + Math.floor(this.random() * 151);
      } else {
        plant.actionIn = PLANTS.peashooter.interval - Math.floor(this.random() * 15);
        this.firePea(plant);
      }
    }

    // Opposing zombies only exist after hypnosis. Avoid an all-pairs search otherwise.
    let hasHypnotized = this.zombies.some(zombie => zombie.hypnotized);
    for (const zombie of this.zombies) {
      if (zombie.health <= 0) continue;
      if (zombie.blownIn !== undefined && zombie.blownIn > 0) {
        zombie.x += 6; zombie.animationTime++;
        if (--zombie.blownIn === 0) zombie.health = 0;
        continue;
      }
      if (this.plants.some(p => p.kelp?.target === zombie.id)) { zombie.eating = false; continue; }
      // UpdatePlaying advances all three clocks before checking immobilization.
      if (zombie.frozenIn !== undefined && zombie.frozenIn > 0) zombie.frozenIn--;
      if (zombie.chillIn > 0) zombie.chillIn--;
      if (zombie.butterIn !== undefined && zombie.butterIn > 0) zombie.butterIn--;
      if ((zombie.frozenIn??0)>0 || (zombie.butterIn??0)>0) {advanceBodyBlend(zombie);continue;}
      const edgeX=Math.trunc(zombie.x-30),rising=zombie.riseIn>0;
      const wasEating=zombie.eating,bodyTime=wasEating?zombie.eatTime??0:zombie.walkTime??0;
      const bodyBlend=zombie.bodyBlend;

      try {
        if(zombie.kind==='pogo'&&zombie.pogo&&headless(zombie))this.breakPogo(zombie);
        if(zombie.pogoState?.phase==='fall'){zombie.pogoState.altitude=Math.max(0,zombie.pogoState.altitude-1);if(zombie.pogoState.altitude===0)zombie.pogoState.phase='walk';}
        const speedFactor = this.isMovingAtChilledSpeed(zombie) ? .4 : 1;
        zombie.animationTime += this.zombieAnimationFactor(zombie);
        if (zombie.riseIn > 0) { zombie.riseIn--; zombie.eating = false; continue; }
        if (zombie.flight) {
          const f=zombie.flight; f.remaining--; zombie.x=f.startX+(f.endX-f.startX)*(1-f.remaining/f.duration);
          if(f.remaining===0){zombie.flight=undefined;zombie.landingIn=21;}
          continue;
        }
        if(zombie.landingIn){zombie.landingIn--;continue;}
        if(zombie.catapult){this.updateCatapult(zombie);continue;}
        if(zombie.giant){this.updateGiant(zombie,speedFactor);continue;}
        if (zombie.bungee) { this.updateBungee(zombie); continue; }
        if (zombie.underground) { zombie.x-=zombie.speed*speedFactor; if(zombie.x<45){zombie.underground=false;zombie.emergingIn=230;zombie.backwards=true;zombie.speed=.12;}continue; }
        if (zombie.emergingIn) { zombie.emergingIn--;continue; }
        if (zombie.garlicIn) { if(--zombie.garlicIn===0){zombie.row=zombie.garlicRow!;zombie.eating=false;}continue; }
        if (zombie.ladderIn) {
          if(--zombie.ladderIn===0){
            const target=this.plants.find(p=>this.plantOnGround(p)&&p.row===zombie.row&&['wallnut','tallnut','pumpkin'].includes(p.kind)&&this.canChewAt(zombie,p)&&!this.ladders.some(l=>l.column===p.column&&l.row===p.row));
            if(target){this.ladders.push({column:target.column,row:zombie.row});zombie.shield=0;zombie.speed=.3;}
          }
          continue;
        }
        if (zombie.kind === 'zomboni') { this.updateZomboni(zombie); continue; }
        if (zombie.sled || zombie.crashIn) { this.updateSled(zombie); continue; }
        if (zombie.kind === 'jack' && !zombie.metalRemoved && (!headless(zombie)||zombie.jackOpening) && this.updateJack(zombie)) {
          // UpdateZombieJackInTheBox checks mHasHead only when starting the opening.
          if(headless(zombie)&&zombie.health>0&&this.random()<.2)zombie.health-=zombieBodyHealth(zombie.kind,zombie.mini)>=500?3:1;
          continue;
        }
        if (zombie.popIn !== undefined && zombie.popIn > 0) {
          if (--zombie.popIn === 0 && this.waterRow(zombie.row)) zombie.health = 0;
          continue;
        }
        if (zombie.flying) { zombie.eating = false; zombie.x -= zombie.speed * speedFactor; continue; }
        if (zombie.rageIn > 0 && !headless(zombie)) {
          zombie.rageIn -= Math.min(speedFactor, zombie.rageIn); zombie.eating = false;
          if (zombie.rageIn === 0) zombie.speed = .89 + this.random() * .02;
          continue;
        }
        if (zombie.kind==='yeti' && zombie.yetiIn!>0 && !zombie.hypnotized && !headless(zombie)) { zombie.yetiIn!--; if(zombie.yetiIn===0){zombie.backwards=true;zombie.speed=.8;} }
        // Zombie::UpdateDamageStates / UpdatePlaying: below 1/3 health a normal
        // zombie can no longer eat, loses health over time, and cannot enter the house.
        if (headless(zombie)) {
          zombie.vaultIn = 0; zombie.hasPole = false;
          // DropHead only hides head tracks. CheckIfPreyCaught returns before
          // StopEating, and ZombieNotWalking keeps an already chewing body still.
          if(hasGroundWalk(zombie)&&!this.waterRow(zombie.row)) {
            if(!zombie.eating)this.moveWalkingZombie(zombie,speedFactor);
          } else {
            zombie.eating = false;
            zombie.x += (zombie.hypnotized||zombie.backwards?1:-1)*walkingSpeed(zombie)*speedFactor;
          }
          if (this.random() < .2) zombie.health-=zombieBodyHealth(zombie.kind,zombie.mini)>=500?3:1;
          continue;
        }
        if (zombie.vaultIn > 0) {
          const progress = Math.min(speedFactor, zombie.vaultIn);
          zombie.vaultIn -= progress; zombie.x -= (zombie.kind === 'dolphin' ? 150 / 120 : 150 / 168) * progress;
          if (zombie.vaultIn === 0) zombie.speed = .23 + this.random() * .14;
          continue;
        }
        if (zombie.kind === 'dolphin' && zombie.dolphin && zombie.x < 780) {
          const barrier = this.plants.filter(p => this.plantOnGround(p) && p.row === zombie.row && p.kind !== 'tanglekelp' && zombie.x - cellX(p.column) < 95 && zombie.x > cellX(p.column))
            .sort((a,b) => Number(b.kind === 'tallnut') - Number(a.kind === 'tallnut'))[0];
          if (barrier) {
            zombie.dolphin = false; zombie.eating = false;
            if (barrier.kind === 'tallnut') { zombie.x = cellX(barrier.column) + 32; zombie.speed = .3; }
            else zombie.vaultIn = 120;
          } else { zombie.x -= .9 * speedFactor; continue; }
        }
        if (zombie.kind === 'dancer' && this.updateDancer(zombie)) continue;
        if (!zombie.hypnotized && zombie.hasPole) {
          const barrier = this.plants.find(p => this.plantOnGround(p) && p.row === zombie.row && p.kind !== 'spikeweed' && p.kind!=='spikerock'
            && !(p.kind === 'potatomine' && p.actionIn > 0) && zombie.x - cellX(p.column) < 95 && zombie.x - cellX(p.column) > 0);
          if (barrier) {
            zombie.hasPole = false; zombie.eating = false;
            if (barrier.kind === 'tallnut') { zombie.x = cellX(barrier.column) + 32; zombie.speed = .3; }
            else zombie.vaultIn = 168;
            continue;
          }
        }
        if (zombie.pogo && !headless(zombie)) {
          if(zombie.pogoState&&!this.waterRow(zombie.row)&&!zombie.mini){this.updatePogo(zombie);continue;}
          const tall=this.plants.find(p=>p.kind==='tallnut'&&p.health>0&&p.row===zombie.row&&zombie.x-cellX(p.column)>0&&zombie.x-cellX(p.column)<65);
          if(tall){zombie.pogo=false;zombie.speed=.3;}else{zombie.eating=false;zombie.x-=.45*speedFactor;continue;}
        }
        if(zombie.pogoState?.phase==='fall'){zombie.eating=false;zombie.x+=(zombie.hypnotized||zombie.backwards?1:-1)*walkingSpeed(zombie)*speedFactor;continue;}
        const rival = hasHypnotized ? this.zombies.find(other => other !== zombie && !!other.hypnotized !== !!zombie.hypnotized
          && other.health > 0 && !this.flying(other) && !headless(other) && other.row === zombie.row && other.riseIn === 0 && other.vaultIn === 0
          && (other.x - zombie.x) * (zombie.hypnotized || zombie.backwards ? 1 : -1) >= -30 && (other.x - zombie.x) * (zombie.hypnotized || zombie.backwards ? 1 : -1) < 40) : undefined;
        if (rival) {
          zombie.eating = true;
          if (--zombie.biteIn <= 0) { this.damageZombie(rival, 4, true); rival.hitAt = this.ticks; zombie.biteIn = zombie.chillIn > 0 ? 8 : 4; }
          continue;
        }
        // Same stable priority as the former sort: pumpkin, ordinary plant, base.
        let food: Plant | undefined, foodPriority = 3;
        if (!zombie.hypnotized) for (const plant of this.plants) {
          if (plant.kind === 'tanglekelp' || !this.plantOnGround(plant) || plant.row !== zombie.row) continue;
          if (!this.canChewAt(zombie,plant) || this.ladders.some(l => l.column === plant.column && l.row === plant.row)) continue;
          if((plant.kind==='spikeweed'||plant.kind==='spikerock')&&(this.nativeGroundY(zombie)===undefined||!this.plants.some(p=>p.kind==='flowerpot'&&p.column===plant.column&&p.row===plant.row&&this.plantOnGround(p))))continue;
          const priority = plant.kind === 'pumpkin' ? 0 : plant.kind === 'lilypad' || plant.kind === 'flowerpot' ? 2 : 1;
          if (priority < foodPriority) { food = plant; foodPriority = priority; if (priority === 0) break; }
        }
        zombie.eating = !!food;
        if (food) {
          delete zombie.walkTime;
          // EatPlant starts eating but cannot damage an awake explosive or a squash preparing its jump.
          if(food.kind==='cherrybomb'||food.kind==='jalapeno'
            ||(food.kind==='iceshroom'||food.kind==='doomshroom')&&!this.sleeping(food)
            ||food.kind==='squash'&&food.squash&&food.squash.remaining>60
            ||(food.kind==='flowerpot'||food.kind==='lilypad')&&(food.invulnerableIn??0)>0)continue;
          if(zombie.kind==='ladder'&&zombie.shield>0&&['wallnut','tallnut','pumpkin'].includes(food.kind)){zombie.ladderIn=100;zombie.eating=false;continue;}
          if (--zombie.biteIn <= 0) {
            if (food.kind === 'hypnoshroom' && !this.sleeping(food)) {
              food.health = 0; zombie.hypnotized = true; hasHypnotized = true; zombie.speed = .17; zombie.eating = false;
              if (zombie.kind === 'dancer') for (const follower of this.zombies) if (follower.leader === zombie.id) { follower.hypnotized = true; follower.speed = .17; }
              this.events.push({ kind: 'hypnotize', x: zombie.x, y: this.rowY(zombie.row) - 50 });
            } else food.health -= 4;
            if(food.kind==='garlic'){const rows=this.config.rows.filter(r=>Math.abs(r-zombie.row)===1&&!this.waterRow(r));zombie.garlicRow=rows[Math.floor(this.random()*rows.length)];zombie.garlicIn=100;}
            zombie.biteIn = zombie.chillIn > 0 ? 8 : 4;
          }
        } else {
          if(wasEating&&hasGroundWalk(zombie)&&!this.waterRow(zombie.row))this.startOrdinaryWalk(zombie);
          if(this.dancerMoving(zombie))this.moveWalkingZombie(zombie,speedFactor);
          zombie.biteIn = 4;
        }
      } finally {
        if(hasGroundWalk(zombie)&&!this.waterRow(zombie.row)&&zombie.health>0){
          if(!headless(zombie)&&wasEating!==zombie.eating)zombie.bodyBlend={left:20,from:{clip:ordinaryBodyClip(zombie,wasEating),time:bodyTime,...(bodyBlend?{blend:bodyBlend}:{})}};
          advanceBodyBlend(zombie);
          if(zombie.eating){delete zombie.walkTime;advanceEatingAnimation(zombie,this.isMovingAtChilledSpeed(zombie));}
          else delete zombie.eatTime;
        }
        if(!rising&&zombie.health>0)this.checkBoardEdge(zombie,edgeX);
      }
    }
    if(this.phase!=='playing')return;
    for (const plant of this.plants) if (plant.health <= 0 && plant.kelp) { const target = this.zombies.find(z => z.id === plant.kelp!.target); if (target) target.health = 0; }
    this.ladders=this.ladders.filter(l=>this.plants.some(p=>p.column===l.column&&p.row===l.row&&p.health>0));
    this.plants = this.plants.filter(plant => plant.health > 0);

    for (const pea of this.peas) {
      if(pea.cannon){this.updateCannonShot(pea);continue;}
      if(pea.homing!==undefined){this.updateHomingShot(pea);continue;}
      if(pea.lob){this.updateLob(pea);continue;}
      if(pea.star){this.updateStar(pea);continue;}
      const oldX = pea.x;
      if(pea.nativePea){pea.nativePea.rawX=Math.fround(pea.nativePea.rawX+Math.fround(pea.vx??3.33));pea.x=pea.nativePea.rawX+14;}
      else pea.x += pea.vx === undefined ? 3.33 : pea.vx; pea.age++;
      if(pea.nativePea?.rawY!==undefined){
        const motion=pea.nativePea;
        motion.rawY=Math.fround(motion.rawY!+motion.vy!);motion.vy=Math.fround(motion.vy!*Math.fround(.97));
        motion.shadowY=Math.fround(motion.shadowY+motion.vy);pea.originY=motion.rawY+14;
      }
      if(!pea.nativePea&&this.config.environment==='roof'&&pea.originY!==undefined&&pea.originY>this.rowY(pea.row,pea.x)-20){pea.x=1000;continue;}
      if (pea.puff && !pea.longRange && pea.age >= 75) { pea.x = 1000; continue; }
      let target: Zombie | undefined;
      const left = Math.min(oldX, pea.x), right = Math.max(oldX, pea.x);
      // Pea/snow image centers bridge to the native 28px image's top-left.
      // CheckForCollision samples the previous integer mX, not the new float X.
      const ordinaryPea=!pea.puff&&!pea.spike&&!pea.fire,sourcePea=ordinaryPea||!!pea.fire,sourceX=Math.trunc(oldX-14);
      // Straight peas defer collision when a tree's attack rectangle overlaps
      // their40px look-ahead by strictly more than10px. Curved/backward shots
      // can still convert, but do not receive this collision deferral.
      const impendingTorch=ordinaryPea&&(pea.vx??0)>=0&&pea.nativePea?.rawY===undefined&&this.plants.some(p=>p.kind==='torchwood'&&this.plantOnGround(p)&&p.row===pea.row&&p.column!==pea.torch&&this.torchOverlap(p,sourceX,40)>10);
      for (const zombie of this.zombies) {
        if(impendingTorch)break;
        if(!this.projectileTarget(zombie,pea.high?2:1)||zombie.row!==pea.row||!pea.fire&&pea.nativePea?.rawY!==undefined&&pea.nativePea.shadowY-pea.nativePea.rawY>90)continue;
        const bodyLeft=sourcePea?this.zombieBodyLeft(zombie):zombie.x-18;
        const overlaps=sourcePea?sourceX-(pea.fire?0:15)<=bodyLeft+this.zombieBodyWidth(zombie)&&sourceX+(pea.fire?30:40)>=bodyLeft:left<=zombie.x+18&&right>=zombie.x-18;
        if(overlaps&&(!target||(sourcePea?Math.trunc(zombie.x-30)<Math.trunc(target.x-30):zombie.x<target.x)))target=zombie;
      }
      if (target) {
        this.projectileImpact(pea,target);
        // Projectile::GetDamageFlags: backwards motion bypasses hand shields, not helmets.
        const bypassShield = (pea.vx ?? 0) < 0;
        const reachesBody = bypassShield || target.shield < 20;
        if (pea.high && target.flying) { target.flying = false; target.popIn = 50; }
        else if (pea.fire) {
          if(fireResistant(target))this.damageZombie(target,40,bypassShield);
          else {
            // IsZombieHitBySplash widens the prior integer projectile rect to
            // 100px. It is not a radius around the direct victim, even for a
            // backwards shot. Count only eligible bodies before damaging any.
            let count=0;
            const targets=this.zombies.filter(z=>{
              if(!this.projectileTarget(z)||z.row!==pea.row||fireResistant(z))return false;
              const bodyLeft=this.zombieBodyLeft(z);
              if(sourceX>bodyLeft+this.zombieBodyWidth(z)||sourceX+100<bodyLeft)return false;
              if(z!==target)count++;
              return true;
            });
            const splash=count*13>40?Math.max(1,Math.trunc(1600/(count*13*3))):13;
            for(const z of targets){const damage=z===target?40:splash;if(z.shield>0)this.damageZombie(z,Math.min(z.shield,damage));this.damageZombie(z,damage,true);z.hitAt=this.ticks;}
            target.chillIn=0;target.frozenIn=0;
          }
        } else this.damageZombie(target, 20, bypassShield);
        if (pea.ice && reachesBody) this.applyChill(target);
        target.hitAt = this.ticks;
        pea.x = 1000;
      }
      if(pea.fire&&pea.x<1000)advanceFireAnimation(pea,this.ticks);
      if(pea.nativePea){
        // UpdateNormalMotion checks the previous shadow plane after collision;
        // UpdateMotion then follows the new horizontal position on the roof.
        if(!target&&pea.nativePea.shadowY-(pea.originY!-14)<28){this.events.push({kind:'hit',x:pea.x,y:pea.originY!});pea.x=1000;}
        const base=this.gridY(8,pea.row),nextGround=Math.fround(base+Math.fround(this.slope(pea.nativePea.rawX))),oldGround=Math.fround(base+Math.fround(this.slope(oldX-14)));
        pea.nativePea.shadowY=Math.fround(pea.nativePea.shadowY+Math.fround(nextGround-oldGround));
      }
    }
    this.peas = this.peas.filter(pea => pea.x < 850 && pea.x > -60 && (pea.cannon!==undefined || pea.lob?.flight!==undefined || pea.y===undefined || pea.y>-80&&pea.y<650));

    for (const nut of this.rollers) {
      nut.x += 3.3;
      if (nut.direction !== 0) {
        nut.y += nut.direction * 2;
        if (nut.y <= this.rowY(0)) nut.direction = 1;
        if (nut.y >= this.rowY(4)) nut.direction = -1;
        nut.row = Math.round((nut.y - this.rowY(0)) / 100);
      }
      const target = this.zombies.find(z => !z.hypnotized && z.health > 0 && z.row === nut.row && Math.abs(nut.y - this.rowY(z.row)) <= 2
        && Math.abs(z.x - nut.x) < 40 && !nut.hit.includes(z.id));
      if (target) {
        nut.hit.push(target.id);
        if (nut.kind === 'explodenut') {
          for (const z of this.zombies) if (Math.abs(z.row - nut.row) <= 1 && Math.abs(z.x - nut.x) <= 90) this.damageZombie(z, 1800, true);
          this.events.push({ kind: 'explode', x: nut.x, y: nut.y - 38, effect:'powie',tick:this.ticks }); nut.x = 1000;
        } else {
          this.damageZombie(target, target.armor > 0 ? 900 : 1800); target.hitAt = this.ticks;
          nut.direction = nut.row === 0 ? 1 : nut.row === 4 ? -1 : nut.direction === 0 ? (this.random() < .5 ? -1 : 1) : -nut.direction;
          this.events.push({ kind: 'hit', x: nut.x, y: nut.y - 35 });
        }
      }
    }
    this.rollers = this.rollers.filter(nut => nut.x < 900);

    for (const sun of this.suns) {
      if (sun.y < sun.targetY) sun.y = Math.min(sun.targetY, sun.y + .65);
      else sun.expiresIn--;
    }
    this.suns = this.suns.filter(sun => sun.expiresIn > 0);

    for(const coin of [...this.coins]){
      if (coin.magnet!==undefined) {
        const plant=this.plants.find(p=>p.id===coin.magnet);
        if (plant) { const x=cellX(plant.column),y=this.rowY(plant.row)-40; coin.x+=(x-coin.x)*.04;coin.y+=(y-coin.y)*.04; if(Math.hypot(x-coin.x,y-coin.y)<20)this.collectCoin(coin.id); continue; }
        delete coin.magnet;
      }
      coin.y=Math.min(coin.targetY,coin.y+1.5);if(coin.y===coin.targetY)coin.expiresIn--;
    }
    this.coins=this.coins.filter(coin=>coin.expiresIn>0);
    for (const mower of this.mowers) {
      if (mower.state === 'ready' && this.zombies.some(zombie => !zombie.hypnotized && !this.flying(zombie) && !zombie.underground && !zombie.bungee && zombie.health > 0 && zombie.row === mower.row && zombie.x < 28)) {
        mower.state = 'moving';
        this.rowPicker.mowed(mower.row, this.wave);
        this.events.push({ kind: 'mower', x: mower.x, y: this.rowY(mower.row) });
      }
      if (mower.state === 'moving') {
        mower.x += 3.5;
        for (const zombie of this.zombies) if (!zombie.hypnotized && !this.flying(zombie) && !zombie.underground && !zombie.bungee && zombie.row === mower.row && Math.abs(zombie.x - mower.x) < 45) zombie.health = 0;
        if (mower.x > 890 || this.campaign && !this.campaign.poolCleaner && this.waterRow(mower.row) && mower.x>70) mower.state = 'spent';
      }
    }
    if (this.config.mode === 'whack') for (const zombie of this.zombies) if (zombie.health <= 0) {
      const hit = Math.floor(this.random() * 30000), factor = portable.zombies[zombie.kind].value;
      const max = this.sun > 500 ? 2800 : this.sun > 350 ? 3100 : this.sun > 200 ? 3700 : 5000;
      if (hit >= 2500 * factor && hit <= max * factor) for (let i = 0; i < 3; i++) this.addSun(zombie.x - i * 20, this.rowY(zombie.row) - 60, this.rowY(zombie.row) - 15, 25);
    }
    if(this.boss?.health===0)this.zombies=[]; // BossDie clears the remaining attackers.
    if (this.campaign && (this.repeatAdventure || this.level >= 11) && this.config.mode !== 'bowling') for (const z of this.zombies) if (!z.hypnotized && z.health<=0) {
      if(z.kind==='yeti'){for(let i=0;i<4;i++)this.coins.push({id:++this.id,x:z.x-i*14,y:this.rowY(z.row)-60,targetY:this.rowY(z.row)-15,born:this.ticks,expiresIn:1500,value:1000});continue;}
      const hit = this.level===11 && !this.repeatAdventure && !this.firstCoinDropped && this.wave>5 ? 1000 : Math.floor(this.random()*30000);
      const factor=portable.zombies[z.kind].value;
      if (hit < 2500*factor) {
        this.coins.push({id:++this.id,x:z.x,y:this.rowY(z.row)-60,targetY:this.rowY(z.row)-15,born:this.ticks,expiresIn:1500,value:hit<14*factor && this.campaign.slots>6?1000:hit<250*factor?50:10});
        this.firstCoinDropped=true;
      }
    }
    this.kills += this.zombies.filter(zombie => !zombie.hypnotized && zombie.health <= 0).length;
    this.zombies = this.zombies.filter(zombie => zombie.health > 0 && !((zombie.hypnotized || zombie.backwards) && zombie.x-30 > 850 && !(zombie.frozenIn??0) && !(zombie.butterIn??0) && !zombie.riseIn && !this.plants.some(p=>p.kelp?.target===zombie.id)));


    if (this.config.mode === 'lawn' && !isNight(this.config.environment) && --this.sunIn <= 0) {
      const row = this.config.rows[Math.floor(this.random() * this.config.rows.length)];
      this.addSun(100 + this.random() * 549, 70, this.rowY(row) - 30, 25);
      this.sunsFallen++;
      this.sunIn = Math.min(950, 425 + this.sunsFallen * 10) + Math.floor(this.random() * 275);
    }
    if (this.autoCollectSun) for (const sun of [...this.suns]) if (sun.y >= sun.targetY) this.collectSun(sun.id);

    if (this.boss) { this.updateBoss(); return; }
    if (this.config.mode === 'vase') {
      if (this.vases.length === 0 && !this.zombies.some(z => !z.hypnotized)) {
        this.cancelSelection(); this.phase = this.vaseStage === 2 ? 'won' : 'intermission';
        if (this.phase === 'won') this.events.push({ kind: 'win', x: 400, y: 300 });
      }
      return;
    }

    if (this.graveWaveIn > 0 && --this.graveWaveIn === 0) {
      if(this.config.environment==='roof')for(let i=0;i<(this.survivalGoal!==null?3:this.level<43?2:3);i++)this.dropFromSky(this.random()<.5?'normal':'cone',this.config.rows[Math.floor(this.random()*5)],this.wave-1);
      if (isPool(this.config.environment) && this.poolFrozenIn === 0) {
        const cells = [2,3].flatMap(row => [5,6,7,8].map(column => ({row,column})));
        const count = this.isSurvival ? 3 : this.level <= 22 ? 2 : 3;
        for (let i=0;i<count;i++) {
          const cell = cells.splice(Math.floor(this.random()*cells.length),1)[0];
          const z = this.spawnZombie(this.random()<.5?'normal':'cone',cell.row,cellX(cell.column)-35,this.wave-1); z.riseIn=50;
        }
      }
      for (const grave of this.graves) {
        const kind = portable.zombies.cone.allowedLevels[this.level - 1] && this.random() < .5 ? 'cone' : 'normal';
        const zombie = this.spawnZombie(kind, grave.row, cellX(grave.column) - 35, this.wave - 1);
        zombie.riseIn = 150;
      }
    }
    if (this.config.mode === 'whack') {
      this.updateWhack();
      if (this.whackFinalSpawned && this.zombies.length === 0) { this.phase = 'won'; this.events.push({ kind: 'win', x: 400, y: 300 }); }
      return;
    }
    if (this.tutorial==='pea') return;
    if (this.wave < this.config.waveCount) {
      this.waveElapsed++;
      const remaining = this.zombies.filter(zombie => !zombie.hypnotized && zombie.wave === this.wave - 1 && !headless(zombie)).reduce((sum, zombie) => sum + zombie.health + zombie.armor + zombie.shield, 0);
      if (this.flagWarningIn > 0) {
        if (--this.flagWarningIn === 0) this.spawnWave();
        return;
      }
      if (this.wave > 0 && this.waveElapsed > 400 && this.waveIn > 200 && remaining <= this.waveThreshold) this.waveIn = 200;
      this.waveIn--;
      if (this.waveIn === 5 && this.isFlagWave(this.wave)) {
        this.flagWarningIn = 750;
        this.events.push({ kind: 'flag', x: 400, y: 280 });
      } else if (this.waveIn === 0) this.spawnWave();
    } else if (!this.zombies.some(z => !z.hypnotized) && this.graveWaveIn === 0) {
      if (this.isSurvival && (this.survivalGoal === null || (this.survivalStage + 1) * this.config.waveCount / 10 < this.survivalGoal)) {
        this.cancelSelection(); this.phase = 'intermission';
      } else {
        this.phase = 'won';
        this.events.push({ kind: 'win', x: 400, y: 300 });
      }
    }
  }

  chooseImitater(kind: PlantKind, replacing?: PlantKind) {
    if (this.phase!=='ready' || !this.config.seeds.includes('imitater') || isUpgrade(kind) || kind==='imitater' || kind==='explodenut' || !this.config.seeds.includes(kind)) return;
    this.imitaterTarget=kind;
    if (replacing !== undefined) this.replaceSeed(replacing, 'imitater');
    else if (!this.seeds.includes('imitater')) this.chooseSeed('imitater');
  }
  aimCannon(column: number,row: number) {
    const plant=this.plants.find(p=>p.kind==='cobcannon'&&p.row===row&&(p.column===column||p.column+1===column));
    if (this.phase!=='playing'||!plant||plant.actionIn>0)return false;
    this.cancelSelection();this.cannonTarget=plant.id;return true;
  }
  fireCannon(x: number,y: number) {
    const plant=this.plants.find(p=>p.id===this.cannonTarget);
    if (this.phase!=='playing'||!plant||plant.actionIn>0)return;
    plant.actionIn=3475;plant.shotAt=this.ticks;this.cannonTarget=null;
    this.peas.push({id:++this.id,row:plant.row,x:cellX(plant.column)+40,y:this.rowY(plant.row)-65,age:0,ice:false,puff:false,cannon:{x,y,remaining:380}});
  }
  private updateCannonShot(pea: Pea) {
    const shot=pea.cannon!;pea.age++;shot.remaining--;
    if(pea.age<206)return;
    if(pea.age<294) { pea.y!-=8; }
    else { pea.x=shot.x;pea.y=shot.y-shot.remaining*8; }
    if(shot.remaining===0) {
      for(const z of this.zombies)if(!z.hypnotized&&!this.flying(z)&&!z.underground&&Math.abs(this.rowY(z.row,z.x)-shot.y)<115&&Math.abs(z.x-shot.x)<115)this.damageZombie(z,1800,true);
      if(this.boss && Math.abs(700-shot.x)<115 && Math.abs(this.rowY(this.boss.row)-shot.y)<115)damageBoss(this.boss,1800,this.ticks);
      this.events.push({kind:'explode',x:shot.x,y:shot.y});pea.x=1000;
    }
  }
  private cattailTarget(plant: Plant) {
    return this.zombies.filter(z=>this.projectileTarget(z,11)&&!headless(z)&&z.x<825)
      .sort((a,b)=>Number(!!this.flying(b))-Number(!!this.flying(a)) || Math.hypot(a.x-cellX(plant.column),(a.row-plant.row)*this.cellHeight)-Math.hypot(b.x-cellX(plant.column),(b.row-plant.row)*this.cellHeight))[0];
  }
  private cattailFire(plant: Plant) {
    const target=this.cattailTarget(plant);if(!target)return;
    this.peas.push({id:++this.id,row:plant.row,x:cellX(plant.column),y:this.rowY(plant.row)-65,vx:2,vy:0,age:0,ice:false,puff:false,spike:true,homing:target.id});
    this.events.push({kind:'shoot',x:cellX(plant.column),y:this.rowY(plant.row)-65});
  }
  private updateHomingShot(pea: Pea) {
    pea.age++;
    const target=this.zombies.find(z=>z.id===pea.homing&&this.projectileTarget(z,11));
    if(!target){pea.x+=pea.vx??2;pea.y!+=pea.vy??0;return;}
    const x=target.x,y=this.rowY(target.row,target.x)-(this.flying(target)?95:45),dx=x-pea.x,dy=y-pea.y!,d=Math.hypot(dx,dy);
    // Projectile::UpdateNormalMotion: age-weighted steering, normalized to two pixels per tick.
    const steer=d>0?.001*pea.age/d:0,vx=(pea.vx??2)+dx*steer,vy=(pea.vy??0)+dy*steer,speed=Math.hypot(vx,vy);
    pea.vx=speed>0?vx/speed*2:0;pea.vy=speed>0?vy/speed*2:0;pea.x+=pea.vx;pea.y!+=pea.vy;
    if(d<15){this.projectileImpact(pea,target);if(target.flying){target.flying=false;target.popIn=50;}this.damageZombie(target,20);pea.x=1000;}
  }
  private updateShopPlant(plant: Plant) {
    if(plant.kind==='imitater') {
      if(--plant.actionIn===0) { plant.kind=plant.morphTarget!;delete plant.morphTarget;plant.imitated=true;plant.born=this.ticks;plant.health=PLANTS[plant.kind].health;plant.actionIn=plant.kind==='potatomine'?1500:['cherrybomb','jalapeno','iceshroom','doomshroom','coffeebean'].includes(plant.kind)?100:plant.kind==='gravebuster'?400:['sunflower','sunshroom','marigold'].includes(plant.kind)?300+Math.floor(this.random()*951):50;if(isPeaKind(plant.kind)){plant.peaMotion=createPeaMotion(plant.kind,15+this.random()*5);plant.actionIn=Math.floor(this.random()*151);delete plant.rearIn;}if(plant.kind==='gravebuster'){plant.gravebuster={phase:'landing',rate:10+this.random()*5,ticks:0};this.events.push({kind:'grave-chomp',x:cellX(plant.column),y:this.gridY(plant.column,plant.row)+40});}if(plant.kind==='chomper')plant.chomp={phase:'ready',remaining:0};if(plant.kind==='flowerpot'||plant.kind==='lilypad')plant.invulnerableIn=100; }
      return true;
    }
    if(plant.kind==='cobcannon'){if(plant.actionIn>0)plant.actionIn--;return true;}
    if(!['gloomshroom','cattail','goldmagnet','spikerock'].includes(plant.kind))return false;
    if(plant.health<=0||this.sleeping(plant))return true;
    const x=cellX(plant.column);
    if(plant.kind==='goldmagnet') {
      if(plant.actionIn>0){plant.actionIn--;return true;}
      const coins=this.coins.filter(c=>c.magnet===undefined&&c.y===c.targetY).slice(0,5);
      if(coins.length){for(const coin of coins)coin.magnet=plant.id;plant.shotAt=this.ticks;plant.actionIn=200+Math.floor(this.random()*101);}
      return true;
    }
    if(plant.kind==='spikerock') {
      const targets=this.zombies.filter(z=>!z.hypnotized&&!this.flying(z)&&!this.submerged(z)&&z.health>0&&z.row===plant.row&&Math.abs(z.x-x)<45);
      if(plant.actionIn>0)plant.actionIn--;
      if((plant.actionIn===70||plant.actionIn===32))for(const z of targets){const vehicle=z.kind==='zomboni'||z.kind==='catapult';this.damageZombie(z,vehicle?1800:20,true);if(vehicle)plant.health-=50;}
      if(plant.actionIn===0&&targets.length){plant.actionIn=100;plant.shotAt=this.ticks;}
      return true;
    }
    if(plant.burstIn){plant.burstIn--;if(plant.kind==='gloomshroom'&&[126,98,70,42].includes(plant.burstIn))for(const z of this.zombies)if(!z.hypnotized&&!this.flying(z)&&!z.underground&&!z.flight&&!z.landingIn&&z.health>0&&Math.abs(z.row-plant.row)<=1&&Math.abs(z.x-x)<120)this.damageZombie(z,20,true);if(plant.kind==='cattail'&&[19,1].includes(plant.burstIn))this.cattailFire(plant);}
    if(plant.actionIn>0)plant.actionIn--;
    if(plant.actionIn===0&&!plant.burstIn) {
      const target=plant.kind==='cattail'?this.cattailTarget(plant):this.zombies.find(z=>!z.hypnotized&&!this.flying(z)&&!this.submerged(z)&&z.health>0&&Math.abs(z.row-plant.row)<=1&&Math.abs(z.x-x)<120);
      if(target){plant.burstIn=plant.kind==='gloomshroom'?200:50;plant.actionIn=PLANTS[plant.kind].interval;plant.shotAt=this.ticks;}
    }
    return true;
  }

  private updateBoss() {
    const boss = this.boss!;
    const rows = [0,1,2,3].filter(row=>this.plants.some(p=>p.row>=row&&p.row<=row+1&&p.column>=5));
    for (const action of stepBoss(boss,()=>this.random(),rows,!this.zombies.some(z=>z.bungee&&z.bungee.phase!=='up'))) {
      if(action.kind==='spawn')this.spawnZombie(action.zombie,action.row,630,0);
      else if(action.kind==='bungee')for(let i=0;i<3;i++){
        const column=action.column+i, targets=this.plants.filter(p=>p.column===column);
        const row=targets.length?targets[Math.floor(this.random()*targets.length)].row:Math.floor(this.random()*5);
        const z=this.spawnZombie('bungee',row,cellX(column),0);z.row=row;z.x=cellX(column);z.bungee={phase:'down',remaining:100,column};
      } else if(action.kind==='crush') {
        for(const p of this.plants)if(p.row>=action.row&&p.row<=action.row+1&&p.column>=action.column&&p.column<action.column+action.columns)this.squishPlant(p);
        this.events.push({kind:'hit',x:cellX(action.column),y:this.rowY(action.row)});
      } else if(action.kind==='won') { this.phase='won';this.zombies=[];this.peas=[];this.events.push({kind:'win',x:400,y:300}); }
    }
    if(boss.ball && boss.ball.age>100){
      const ball=boss.ball;
      for(const p of this.plants)if(p.row===ball.row&&Math.abs(cellX(p.column)-ball.x)<=35&&p.kind!=='spikeweed'&&p.kind!=='spikerock')this.squishPlant(p);
    }
    this.plants=this.plants.filter(p=>p.health>0);
  }

  private nextConveyorSeed(): PlantKind {
    if (this.config.mode === 'bowling') return this.random() < .85 ? 'wallnut' : 'explodenut';
    // Challenge::UpdateConveyor: reduce repeats and cards piling up on the belt.
    const choices = (this.boss ? portable.conveyorFifty : this.level === 45 ? portable.conveyorFortyFive : this.level === 40 ? portable.conveyorForty : this.level === 30 ? portable.conveyorThirty : this.level === 25 ? portable.conveyorTwentyFive : this.level === 20 ? portable.conveyorTwenty : portable.conveyorTen).map(({ kind, weight }) => {
      const count = this.conveyor.filter(packet => packet.kind === kind).length;
      const total = count + this.plants.filter(p => p.kind === kind).length;
      // Challenge.cpp:1621–1636 applies to every conveyor, including 2–10, 3–5 and 3–10.
      if (kind === 'gravebuster' && this.graves.length <= total) return { kind: kind as PlantKind, weight: 0 };
      if (kind === 'flowerpot' || kind === 'lilypad') {
        weight = Math.round(weight + (1 - weight) * Math.min(1, total / (kind === 'flowerpot' ? 35 : 18)));
      }
      if (this.boss && ['melonpult','kernelpult','cabbagepult'].includes(kind)) {
        const empty = this.plants.filter(p=>p.kind==='flowerpot'&&!this.plants.some(top=>top!==p&&top.column===p.column&&top.row===p.row)).length;
        if(empty<=5)weight=Math.trunc(weight/(empty<=2?5:3));
      }
      if (this.boss?.phase==='rv' && kind==='flowerpot')weight=500;
      return { kind: kind as PlantKind, weight: count >= 4 ? 1 : count >= 3 ? 5 : kind === this.lastConveyorSeed ? Math.trunc(weight / 2) : weight };
    });
    let pick = Math.floor(this.random() * choices.reduce((sum, choice) => sum + choice.weight, 0));
    let index = 0;
    while (pick >= choices[index].weight) pick -= choices[index++].weight;
    this.lastConveyorSeed = choices[index].kind;
    return this.lastConveyorSeed;
  }

  whack(x: number, y: number) {
    if (this.phase !== 'playing' || this.config.mode !== 'whack' || this.selected || this.digging) return;
    // Hammer circle against the port's body rectangle, topmost row drawn last.
    const target = this.zombies.filter(z => z.health > 0 && !headless(z)
      && Math.hypot(Math.max(0, Math.abs(x - z.x) - 24), Math.max(0, Math.abs(y - 20 - (this.rowY(z.row) - 60)) - 55)) <= 45)
      .sort((a, b) => b.row - a.row || b.id - a.id)[0];
    this.events.push({ kind: 'whack', x, y });
    if (target) {
      if (target.armor > 0) target.armor = Math.max(0, target.armor - 900);
      else target.health = 0;
      target.hitAt = this.ticks;
    }
  }

  private addWhackGraves(count: number) {
    const places = this.config.rows.flatMap(row => Array.from({ length: 6 }, (_, i) => ({ row, column: i + 3 })))
      .filter(p => !this.graves.some(g => g.row === p.row && g.column === p.column));
    for (let i = 0; i < count && places.length; i++) {
      const weights = places.map(p => this.plants.some(plant => plant.row === p.row && plant.column === p.column) ? 1 : 100000);
      let pick = this.random() * weights.reduce((sum, weight) => sum + weight, 0), index = 0;
      while (pick >= weights[index]) pick -= weights[index++];
      const place = places.splice(index, 1)[0];
      this.plants = this.plants.filter(p => p.row !== place.row || p.column !== place.column);
      this.graves.push({ id: ++this.id, ...place });
    }
  }

  private updateWhack() {
    // Challenge::WhackAZombieSpawning: 200-tick intro, 2000-tick rounds,
    // then a delayed final group. Ordinary adventure wave lists are unused.
    if (this.whackFinalSpawned) return;
    this.waveIn--;
    if (this.waveIn === 100 && this.wave > 0) this.addWhackGraves(Math.max(1, 5 - this.graves.length));
    if (this.waveIn === 5 && this.wave === this.config.waveCount - 1) this.events.push({ kind: 'flag', x: 400, y: 280 });
    if (this.waveIn === 0) {
      this.waveIn = 2000; this.wave++;
      this.whackSpawnIn = this.wave === this.config.waveCount ? 300 : 1;
      this.events.push({ kind: 'wave', x: 400, y: 280 });
    } else if (this.waveIn < 300) return;
    if (--this.whackSpawnIn !== 0) return;
    const phase = Math.max(0, Math.min(5, Math.floor((this.wave - 1) * 6 / 12)));
    const doubles = [0, 30, 10, 10, 15, 18], triples = [0, 0, 0, 0, 10, 13];
    const pails = [0, 0, 0, 10, 15, 15], cones = [0, 0, 30, 30, 30, 30];
    const groupRoll = Math.floor(this.random() * 100), typeRoll = Math.floor(this.random() * 100);
    const final = this.wave === this.config.waveCount;
    const count = final ? 20 : groupRoll < triples[phase] ? 3 : groupRoll < triples[phase] + doubles[phase] ? 2 : 1;
    const kind: ZombieKind = typeRoll < pails[phase] && count < 3 ? 'bucket' : typeRoll < pails[phase] + cones[phase] ? 'cone' : 'normal';
    const graves = this.graves.filter(g => !this.plants.some(p => p.kind === 'gravebuster' && p.row === g.row && p.column === g.column));
    const maxSpeed = final ? 2 : Math.round(1 + 2 * ((this.wave - 1) / 11) ** 2);
    for (let i = 0; i < count && graves.length; i++) {
      const grave = graves.splice(Math.floor(this.random() * graves.length), 1)[0];
      const zombie = this.spawnZombie(final ? this.random() < .5 ? 'cone' : 'bucket' : kind, grave.row, cellX(grave.column) - 35, this.wave - 1);
      zombie.riseIn = 50; zombie.speed = .5 + this.random() * (maxSpeed - .5);
    }
    const min = Math.round(100 - (this.wave - 1) * 70 / 11), max = Math.round(200 - (this.wave - 1) * 140 / 11);
    this.whackSpawnIn = min + Math.floor(this.random() * (max - min + 1));
    if (final) { this.whackFinalSpawned = true; this.waveIn = 0; this.whackSpawnIn = 0; }
  }

  private updateZomboni(z: Zombie) {
    if (z.health <= 200) { z.health = 0; return; }
    const rawX=Math.trunc(z.x-30);
    z.speed = .05 + .2 * Math.max(0, Math.min(1, (z.x - 30 - 300) / 400));
    z.x -= z.speed; z.eating = false;
    const x = Math.max(25, z.x + 88);
    if (x < 800) {
      const ice = this.iceTrails.find(ice => ice.row === z.row);
      if (ice) { ice.x = Math.min(ice.x, x); ice.remaining = 3000; }
      else this.iceTrails.push({ row: z.row, x, remaining: 3000 });
    }
    // Tire contacts retain their separate path; ordinary pressure shares CheckSquish.
    for (const plant of this.plants) if ((plant.kind==='spikeweed'||plant.kind==='spikerock') && this.plantOnGround(plant) && plant.row === z.row && Math.abs(cellX(plant.column) - z.x) < 55) {
      if(plant.kind==='spikerock'){plant.health-=50;z.health=0;break;}
      plant.health = 0;
      if (plant.kind === 'spikeweed') { z.health = 0; this.events.push({ kind: 'hit', x: z.x, y: this.rowY(z.row) }); break; }
    }
    if(z.health>0)this.crushVehicle(z,rawX);
  }

  private crashSled(id: number) {
    for (const z of this.zombies) if (z.sled === id) { z.sled = undefined; z.sledLeader = undefined; z.armor = 0; z.crashIn = 150; z.speed = .23 + this.random() * .14; }
  }

  private updateSled(z: Zombie) {
    if (z.crashIn) { z.crashIn--; return; }
    const leader = z.sledLeader ? this.zombies.find(other => other.id === z.sledLeader && other.health > 0) : z;
    const ice = this.iceTrails.find(trail => trail.row === z.row);
    if (!leader || !ice || leader.x < ice.x || leader.armor === 0) { this.crashSled(z.sled!); return; }
    z.x -= .6; ice.remaining = Math.max(ice.remaining, 500);
    for (const plant of this.plants) if (this.plantOnGround(plant) && plant.row === z.row && Math.abs(cellX(plant.column) - z.x) < 45) {
      if(plant.kind==='spikerock'){plant.health-=50;this.crashSled(z.sled!);break;}
      this.squishPlant(plant);
      if (plant.kind === 'spikeweed') { this.crashSled(z.sled!); break; }
    }
  }

  private updateJack(z: Zombie) {
    if (--z.jackIn! > 0) return !!z.jackOpening;
    if (!z.jackOpening) { z.jackOpening = true; z.jackIn = 110; z.eating = false; return true; }
    for (const plant of this.plants) if (!z.hypnotized && Math.hypot(cellX(plant.column) - z.x, this.rowY(plant.row, cellX(plant.column)) - this.rowY(z.row)) < 90) plant.health = 0;
    for (const other of this.zombies) if (!!other.hypnotized !== !!z.hypnotized && Math.abs(other.row - z.row) <= 1 && Math.abs(other.x - z.x) < 115) this.damageZombie(other, 1800, true);
    if (this.config.mode === 'vase') for (const vase of [...this.vases]) if (Math.abs(vase.column - Math.floor((z.x - BOARD.left) / 80)) <= 1 && Math.abs(vase.row - z.row) <= 1) this.breakVase(vase);
    z.health = 0; this.events.push({ kind: 'explode', x: z.x, y: this.rowY(z.row) - 35, zombieId:z.id }); return true;
  }

  private updateKelp(plant: Plant) {
    if (!plant.kelp) {
      const target = this.zombies.find(z => !z.hypnotized && !this.flying(z) && z.vaultIn === 0 && !headless(z) && z.health > 0 && z.row === plant.row
        && z.x > 90 && z.x < 780 && z.riseIn === 0 && Math.abs(z.x - cellX(plant.column)) < 60
        && !this.plants.some(p => p.kelp?.target === z.id));
      if (target) plant.kelp = { target: target.id, remaining: 100 };
    } else if (--plant.kelp.remaining === 0 || plant.health <= 0) {
      const target = this.zombies.find(z => z.id === plant.kelp!.target);
      if (target) target.health = 0;
      plant.health = 0;
    }
  }

  private updateSquash(plant: Plant) {
    const target = () => {
      let closest:Zombie|undefined,distance=Infinity;
      const attackLeft=cellX(plant.column)-20;
      for(const z of this.zombies)if(this.projectileTarget(z,13)&&!headless(z)&&z.row===plant.row&&!z.dolphin&&!z.sled
        &&!this.plants.some(p=>p.kelp?.target===z.id)){
        let range:number;
        if(this.nativeGroundY(z)!==undefined){
          const left=this.lobBodyLeft(z),right=left+this.lobBodySize(z)[0];
          if(z.kind==='pole'&&z.hasPole&&left>=attackLeft)continue;
          range=Math.max(attackLeft,left)-Math.min(attackLeft+45,right);
          if(range>(z.eating?110:70))continue;
          const rear=attackLeft-(z.kind==='pole'||z.kind==='imp'||z.kind==='football'||this.config.mode==='vase'?60:0);
          if(!z.backwards&&right<rear)continue;
        }else{
          range=Math.abs(z.x-cellX(plant.column));
          if(range>=(z.eating?140:100))continue;
        }
        if(z.id===plant.squash?.target)return z;
        if(range<distance){closest=z;distance=range;}
      }
      return closest;
    };
    if (!plant.squash) { const z=target(); if(z) plant.squash={remaining:185,x:Math.trunc(this.targetLeadX(z,0)-40)+40,target:z.id}; return; }
    if(plant.squash.remaining===0){plant.squash.restIn=(plant.squash.restIn??100)-1;if(plant.squash.restIn<=0)plant.health=0;return;}
    plant.squash.remaining--;
    if (plant.squash.remaining===60) { const z=target(); if(z){plant.squash.x=Math.trunc(this.targetLeadX(z,30)-40)+40;plant.squash.target=z.id;} }
    if (plant.squash.remaining===5) {
      // Source mTargetX/mX are integers; the model retains a center anchor.
      const left=Math.trunc(plant.squash.x-40)+20;
      for (const z of this.zombies) if(this.projectileTarget(z,13)&&z.row===plant.row){
        const bodyLeft=this.lobBodyLeft(z);
        const overlap=Math.min(left+45,bodyLeft+this.lobBodySize(z)[0])-Math.max(left,bodyLeft);
        const hit=this.nativeGroundY(z)===undefined?Math.abs(z.x-plant.squash.x)<65:overlap>(z.kind==='football'?-20:0);
        if(hit)this.damageZombie(z,1800,true);
      }
      this.events.push({kind:'hit',x:plant.squash.x,y:this.rowY(plant.row, cellX(plant.column))});
    }
    if(plant.squash.remaining===0){if(this.waterRow(plant.row))plant.health=0;else plant.squash.restIn=100;}
  }
  private updateDancer(z: Zombie) {
    if (z.eating) return false;
    const positions = [{row:z.row-1,x:z.x},{row:z.row+1,x:z.x},{row:z.row,x:z.x-100},{row:z.row,x:z.x+100}];
    const missing = positions.map((p,slot)=>({...p,slot})).filter(p=>this.config.rows.includes(p.row)&&!this.waterRow(p.row)&&!this.zombies.some(other=>other.leader===z.id&&other.slot===p.slot&&other.health>0));
    if(z.dancePhase==='intro') {
      if(--z.danceIn! === 0){z.dancePhase='point';z.danceIn=38;}
      return false;
    }
    if(z.dancePhase==='point') {
      if(--z.danceIn! === 0){
        for(const p of missing){const follower=this.spawnZombie('backup',p.row,p.x,z.wave);follower.riseIn=150;follower.leader=z.id;follower.slot=p.slot;follower.hypnotized=z.hypnotized;}
        z.dancePhase='hold';z.danceIn=200;
      }
      return true;
    }
    if(z.dancePhase==='hold'){if(--z.danceIn! === 0)z.dancePhase='dance';return true;}
    if(missing.length){
      if(z.summonIn===0)z.summonIn=100;
      else if(z.summonIn!>1)z.summonIn! --;
      else if(Math.floor(this.ticks/20)%23===12&&z.x<730){z.dancePhase='point';z.danceIn=38;z.summonIn=0;return true;}
    }
    return false;
  }
  private startOrdinaryWalk(z:Zombie){
    const f=Math.fround;
    z.speed=f(f(.23)+f(f(this.random())*f(f(.37)-f(.23))));
    z.walkVariant=this.random()<.5?2:1;
    z.walkTime=0;
  }
  private moveWalkingZombie(z:Zombie,speedFactor:number){
    const direction=z.hypnotized||z.backwards?1:-1;
    if(hasGroundWalk(z)&&!this.waterRow(z.row))z.x=Math.fround(Math.fround(z.x-30)+direction*groundWalkStep(z,this.isMovingAtChilledSpeed(z)))+30;
    else z.x+=direction*walkingSpeed(z)*speedFactor;
  }
  private dancerMoving(z: Zombie) {
    if(z.kind!=='dancer'&&z.kind!=='backup')return true;
    if(z.dancePhase==='intro')return true;
    if(Math.floor(this.ticks/20)%23>11)return false;
    const leader=z.kind==='dancer'?z:this.zombies.find(other=>other.id===z.leader);
    return !this.zombies.some(other=>other.health>0&&(other===leader||leader&&other.leader===leader.id)&&(other.eating||(other.frozenIn??0)>0||(other.butterIn??0)>0));
  }

  private damageZombie(zombie: Zombie, damage: number, bypassShield = false) {
    if (!bypassShield && zombie.shield > 0) {
      const absorbed = Math.min(zombie.shield, damage);
      zombie.shield -= absorbed; damage -= absorbed;
      if (zombie.kind === 'ladder' && zombie.shield === 0) { zombie.ladderIn = 0; zombie.speed = .3; }
      if (zombie.kind === 'newspaper' && zombie.shield === 0) { zombie.rageIn = 150; zombie.eating = false; }
    }
    const absorbed = Math.min(zombie.armor, damage);
    zombie.armor -= absorbed;
    zombie.health -= damage - absorbed;
    if(zombie.kind==='pogo'&&zombie.pogo&&zombie.health>0&&headless(zombie))this.breakPogo(zombie);
  }

  private breakPogo(z:Zombie) {
    if(!z.pogo)return;
    z.pogo=false;z.shield=0;z.speed=z.pogoState?.45:.3;
    if(z.pogoState){z.pogoState.phase='fall';z.pogoState.remaining=0;z.pogoState.animTime=0;}
  }
  private pogoTarget(z:Zombie) {
    const left=Math.trunc(z.x-30)+(z.backwards||z.hypnotized?80:10);
    return this.plants.find(p=>{
      if(p.row!==z.row||!this.plantOnGround(p)||p.kind==='tanglekelp'||this.plantRectOverlap(p,left,30)<20)return false;
      if((p.kind==='spikeweed'||p.kind==='spikerock')&&!this.plants.some(base=>base.kind==='flowerpot'&&base.row===p.row&&base.column===p.column&&base.health>0))return false;
      const main=this.plants.find(other=>other.column===p.column&&other.row===p.row&&this.plantOnGround(other)&&!['flowerpot','lilypad','pumpkin','coffeebean'].includes(other.kind));
      return !main||main===p;
    });
  }
  private updatePogo(z:Zombie) {
    const state=z.pogoState!;
    if(state.remaining>0)state.remaining--;
    const t=Math.fround(1-state.remaining/80),bounce=Math.fround(1-Math.abs(Math.fround(2*t-1))),height=state.phase==='high'?50:state.phase==='forward'?90:40;
    state.altitude=Math.fround(9+Math.fround(height*Math.fround(Math.fround(2*bounce)-Math.fround(bounce*bounce))));
    if(state.remaining===7)state.animTime=0;
    if(state.phase==='forward'&&state.remaining===70&&this.pogoTarget(z)?.kind==='tallnut'){
      this.breakPogo(z);z.x+=(z.backwards||z.hypnotized?1:-1)*walkingSpeed(z)*(z.chillIn>0?.4:1);return;
    }
    if(state.remaining===0){
      const target=this.pogoTarget(z);
      if(!target){state.phase='bounce';z.speed=.45;}
      else if(state.phase==='high'){state.phase='forward';z.speed=(Math.trunc(z.x-30)-(cellX(target.column)-40)+60)/80;}
      else {state.phase='high';z.speed=0;}
      state.remaining=80;
    }
    z.eating=false;z.x+=(z.backwards||z.hypnotized?1:-1)*z.speed*(z.chillIn>0?.4:1);
    state.animTime=Math.min(1,Math.fround(state.animTime+Math.fround(Math.fround(Math.fround(.01)*(z.chillIn>0?20:40))/11)));
  }

  private peaTarget(plant:Plant,rear=false){
    // GetPlantAttackRect + GetRectOverlap use horizontal body edges, including
    // zero-overlap contact. The source has no separate screen-edge cutoff.
    const left=rear?0:cellX(plant.column)+20,right=rear?cellX(plant.column)-24:left+BOARD.width;
    return this.zombies.some(z=>{
      if(z.row!==plant.row||!this.projectileTarget(z))return false;
      const bodyLeft=this.zombieBodyLeft(z);
      return bodyLeft<=right&&bodyLeft+this.zombieBodyWidth(z)>=left;
    });
  }
  private torchOverlap(plant:Plant,sourceX:number,ahead=0){
    // Torchwood:mX+50,width30; pea:mX-15,width55. GetRectOverlap
    // compares horizontal edges; row and grounded-state checks are separate.
    const left=cellX(plant.column)+10,peaLeft=sourceX-15+ahead;
    return Math.min(left+30,peaLeft+55)-Math.max(left,peaLeft);
  }
  private emitNativePea(plant:Plant,rear=false){
    if(!isPeaKind(plant.kind))return;
    const motion=plant.peaMotion??(plant.peaMotion=createPeaMotion(plant.kind,17.5)),[headX,headY]=peaHeadOffset(plant.kind,motion);
    const rawX=cellX(plant.column)-40+headX+(rear?-64:plant.kind==='gatlingpea'?34:24),pot=this.plants.some(p=>p.kind==='flowerpot'&&p.row===plant.row&&p.column===plant.column&&p.health>0);
    const rawY=this.gridY(plant.column,plant.row)+headY-33-(pot?5:0),column=Math.max(0,Math.min(8,Math.trunc((rawX-40)/80)));
    this.peas.push({id:++this.id,row:plant.row,x:rawX+14,originY:rawY+14,ice:plant.kind==='snowpea',puff:false,age:0,...(rear?{vx:-3.33}:{}),nativePea:{rawX,shadowY:this.gridY(column,plant.row)+67-(this.config.environment==='roof'&&rawX<480?12:0)}});
    plant.shotAt=this.ticks;this.events.push({kind:'shoot',x:rawX+14,y:rawY+14});
  }
  private fireThreepeater(plant:Plant,mask=7){
    const rawX=cellX(plant.column)+5,pot=this.plants.some(p=>p.kind==='flowerpot'&&p.row===plant.row&&p.column===plant.column&&p.health>0);
    const rawY=this.gridY(plant.column,plant.row)+10-(pot?5:0),column=Math.max(0,Math.min(8,Math.trunc((rawX-40)/80)));
    // Native head order is below, center, above. All three start at the plant,
    // with a fixed destination row and a decaying vertical speed for side shots.
    for(const [index,row]of [plant.row+1,plant.row,plant.row-1].entries())if((mask&(1<<index))&&this.config.rows.includes(row)){
      const direction=Math.sign(row-plant.row);
      this.peas.push({id:++this.id,row,x:rawX+14,originY:rawY+14,ice:false,puff:false,age:0,nativePea:{rawX,shadowY:this.gridY(column,row)+67-direction*80-(this.config.environment==='roof'&&rawX<480?12:0),...(direction?{rawY,vy:direction*3}:{})}});
      this.events.push({kind:'shoot',x:rawX+14,y:rawY+14});
    }
  }
  private firePea(plant: Plant, force = false) {
    if(isPeaKind(plant.kind)){if(force||this.peaTarget(plant))this.emitNativePea(plant);return;}
    const x = cellX(plant.column);
    const range = plant.kind === 'puffshroom' || plant.kind === 'seashroom' ? 250 : plant.kind === 'fumeshroom' ? 360 : 825 - x;
    if (plant.kind === 'cactus') plant.tall = this.zombies.some(z => this.projectileTarget(z,2) && z.row === plant.row && z.x > x - 10 && z.x < 825);
    const targets = this.zombies.filter(z => this.projectileTarget(z,plant.tall?2:1) && z.row === plant.row && z.x > x - 10 && z.x < x + range);
    if (targets.length || force) {
      if (plant.kind === 'fumeshroom') {
        for (const zombie of targets) if (zombie.vaultIn === 0 && zombie.riseIn === 0) { this.damageZombie(zombie, 20, true); zombie.hitAt = this.ticks; }
        this.events.push({ kind: 'fume', x: x + 25, y: this.rowY(plant.row, cellX(plant.column)) - 45, row: plant.row });
      } else {
        this.peas.push({ id: ++this.id, row: plant.row, x: x + 27, ice: false, puff: ['puffshroom','scaredyshroom','seashroom'].includes(plant.kind), longRange: plant.kind === 'scaredyshroom', spike: plant.kind === 'cactus', high: plant.tall, age: 0, originY:this.rowY(plant.row,cellX(plant.column))-43 });
        this.events.push({ kind: 'shoot', x: x + 27, y: this.rowY(plant.row, cellX(plant.column)) - 43 });
      }
      plant.shotAt = this.ticks;
    }
  }

  private updateChomper(plant: Plant) {
    const state = plant.chomp!;
    const target = () => this.zombies.filter(z => !z.hypnotized && !this.flying(z) && !z.flight && !z.landingIn && !z.underground && (!z.bungee||z.bungee.phase==='wait') && z.health > 0 && z.riseIn === 0 && z.row === plant.row
      && z.x - cellX(plant.column) >= -10 && z.x - cellX(plant.column) <= 100).sort((a, b) => a.x - b.x)[0];
    if (state.phase === 'ready') {
      if (target()) { state.phase = 'bite'; state.remaining = 70; }
    } else if (--state.remaining === 0) {
      if (state.phase === 'bite') {
        const zombie = target();
        if (zombie && ['zomboni','catapult','gargantuar'].includes(zombie.kind)) { this.damageZombie(zombie, 40, true); state.phase = 'recover'; state.remaining = 30; }
        else if (zombie && !zombie.hasPole && zombie.vaultIn === 0) {
          zombie.health = 0;
          this.events.push({ kind: 'swallow', zombieId: zombie.id, x: cellX(plant.column), y: this.rowY(plant.row, cellX(plant.column)) });
          state.phase = 'digest'; state.remaining = 4000;
        } else { state.phase = 'recover'; state.remaining = 30; }
      } else { state.phase = 'ready'; }
    }
  }

  drainEvents() { return this.events.splice(0); }
  collectCoin(id: number) {
    if(this.phase!=='playing')return;
    const index=this.coins.findIndex(coin=>coin.id===id);
    if(index===-1)return;
    const [coin]=this.coins.splice(index,1);this.money+=coin.value;
    this.events.push({kind:'coin',x:coin.x,y:coin.y,value:coin.value});
  }
  private doSpecial(plant:Plant) {
    if(plant.kind==='potatomine'){
      for (const z of this.zombies) if (!z.hypnotized && !this.flying(z) && z.vaultIn === 0 && z.riseIn === 0 && z.row === plant.row && Math.abs(z.x - cellX(plant.column)) <= 60) this.damageZombie(z, 1800, true);
      plant.health = 0;
      this.events.push({ kind: 'explode', x: cellX(plant.column), y: this.rowY(plant.row, cellX(plant.column)) - 35 });
      return;
    }
    if (plant.kind === 'jalapeno') {
      if (this.boss) { damageBoss(this.boss,1800,this.ticks);this.boss.frozenIn=0;this.boss.chillIn=0;if(this.boss.ball?.kind==='ice'&&this.boss.ball.row===plant.row)this.boss.ball=null; }
      this.ladders=this.ladders.filter(l=>l.row!==plant.row);
      for (const z of this.zombies) if (!z.hypnotized && z.row === plant.row) { this.damageZombie(z, 1800, true); z.chillIn = 0; z.frozenIn = 0; }
      for (const ice of this.iceTrails) if (ice.row === plant.row) ice.remaining = 20;
      plant.health = 0;
      this.events.push({ kind: 'fire', x: 0, y: this.rowY(plant.row, cellX(plant.column)), row: plant.row }); return;
    }
    if (plant.kind === 'iceshroom') {
      if (this.boss) { if(this.boss.ball?.kind==='fire')this.boss.ball=null;if(bossVulnerable(this.boss)){damageBoss(this.boss,20,this.ticks);this.boss.frozenIn=this.boss.chillIn>0?300+Math.floor(this.random()*101):400+Math.floor(this.random()*201);this.boss.chillIn=2000;} }
      for (const z of this.zombies) {
        const cold = z.chillIn > 0 || (z.frozenIn??0)>0;
        this.applyChill(z,2000);
        // HitIceTrap applies chill first; ineligible phases return before RNG,
        // the ice-trap timer and its20 points of damage.
        if(!this.canBeFrozen(z))continue;
        z.frozenIn = this.waterRow(z.row) ? 300 : cold ? 300 + Math.floor(this.random()*101) : 400 + Math.floor(this.random()*201);
        this.damageZombie(z,20,true);
      }
      this.poolFrozenIn = 300; plant.health = 0;
      this.events.push({kind:'freeze',x:400,y:300}); return;
    }
    if (plant.kind === 'doomshroom') {
      const x = cellX(plant.column), y = this.rowY(plant.row, cellX(plant.column));
      for (const z of this.zombies) if (!z.hypnotized && Math.abs(z.row-plant.row)<=3 && Math.hypot(z.x-x, this.rowY(z.row)-y)<=250) this.damageZombie(z,1800,true);
      for (const p of this.plants) if (p.column === plant.column && p.row === plant.row) p.health = 0;
      this.craters.push({id:++this.id,column:plant.column,row:plant.row,remaining:18000});
      this.events.push({kind:'explode',x,y:y-35}); return;
    }
    if (plant.kind === 'cherrybomb') {
      this.ladders=this.ladders.filter(l=>Math.abs(l.row-plant.row)>1||Math.abs(l.column-plant.column)>1);
      for (const zombie of this.zombies) {
        if (!zombie.hypnotized && Math.abs(zombie.row - plant.row) <= 1 && Math.abs(zombie.x - cellX(plant.column)) <= 115) this.damageZombie(zombie, 1800, true);
      }
      plant.health = 0;
      this.events.push({ kind: 'explode', x: cellX(plant.column), y: this.gridY(plant.column,plant.row)+40,effect:'powie',tick:this.ticks });
    }
  }

  private findUmbrella(column: number,row: number) {
    return this.plants.find(p=>p.kind==='umbrella'&&p.health>0&&Math.abs(p.column-column)<=1&&Math.abs(p.row-row)<=1);
  }
  private topCatapultPlant(column:number,row:number) {
    let top:Plant|undefined,priority=4;
    for(const p of this.plants)if(this.plantOnGround(p)&&p.column===column&&p.row===row){
      const rank=p.kind==='coffeebean'?0:p.kind==='flowerpot'||p.kind==='lilypad'?3:p.kind==='pumpkin'?2:1;
      if(rank<priority){top=p;priority=rank;}
    }
    return top;
  }
  private nativeCatapultTarget(z:Zombie) {
    let leftmost:Plant|undefined;
    for(const p of this.plants)if(this.plantOnGround(p)&&p.row===z.row&&Math.trunc(z.x-30)>=cellX(p.column)+60
      &&p.kind!=='spikeweed'&&p.kind!=='spikerock'&&(!leftmost||p.column<leftmost.column))leftmost=p;
    return leftmost?this.topCatapultPlant(leftmost.column,leftmost.row):undefined;
  }
  private squishPlant(p:Plant) {
    if(!this.plantOnGround(p))return;
    if(!this.sleeping(p)&&(['cherrybomb','jalapeno','doomshroom','iceshroom'].includes(p.kind)||p.kind==='potatomine'&&p.actionIn<=0)){this.doSpecial(p);return;}
    if(p.kind==='squash'&&p.squash)return;
    p.health=0;
    this.squishedPlants.push({id:p.id,kind:p.kind,row:p.row,column:p.column,remaining:500,...(p.imitated?{imitated:true}:{})});
    this.events.push({kind:'squish',x:cellX(p.column),y:this.gridY(p.column,p.row)});
    this.ladders=this.ladders.filter(l=>l.column!==p.column||l.row!==p.row);
  }
  private crushVehicle(z:Zombie,rawX:number) {
    // CheckSquish selects the first eligible overlapping plant, then the whole cell.
    const left=rawX+(z.backwards||z.hypnotized?-23:10);
    const target=this.plants.find(p=>this.plantOnGround(p)&&p.row===z.row&&this.plantRectOverlap(p,left,133)>=20
      &&!['tanglekelp','spikeweed','spikerock','cherrybomb','jalapeno','blover','squash'].includes(p.kind)
      &&(!['iceshroom','doomshroom'].includes(p.kind)||this.sleeping(p)));
    if(!target)return;
    for(const p of this.plants)if(this.plantOnGround(p)&&p.column===target.column&&p.row===target.row&&p.kind!=='spikeweed'&&p.kind!=='spikerock'){
      this.squishPlant(p);
    }
  }
  private advanceCatapultAnimation(z:Zombie) {
    const state=z.catapult!;
    if(state.phase==='shoot'&&state.animTime!==undefined){
      state.lastAnimTime=state.animTime;
      const delta=Math.fround(Math.fround(Math.fround(.01)*(z.chillIn>0?12:24))/32);
      state.animTime=Math.min(1,Math.fround(state.animTime+delta));
    }
  }
  // Zombie::FindCatapultTarget / UpdateZombieCatapult: leftmost plant, 20 balls,
  // 300-tick firing cycles; 32-pose anim_shoot at 24 fps releases at 0.545.
  private updateCatapult(z: Zombie) {
    const state=z.catapult!;
    const rawX=Math.trunc(z.x-30);
    const nativeY=this.nativeGroundY(z),native=nativeY!==undefined;
    const animated=native&&state.animTime!==undefined;
    if(animated&&state.remaining>0)state.remaining--;
    const target=()=>native?this.nativeCatapultTarget(z):this.plants.filter(p=>this.plantOnGround(p)&&p.row===z.row&&cellX(p.column)<z.x-100)
      .sort((a,b)=>a.column-b.column||Number(a.kind==='flowerpot')-Number(b.kind==='flowerpot')||Number(a.kind==='pumpkin')-Number(b.kind==='pumpkin'))[0];
    if(state.phase==='walk'){
      z.eating=false;
      if((native?z.x-30<=650:z.x<=650)&&state.ammo>0&&target()){state.phase='shoot';state.remaining=300;if(native){state.animTime=0;state.lastAnimTime=0;}}
      else {z.x-=z.speed*(native&&z.chillIn>0?.4:1);if(!native)for(const p of this.plants)if(this.plantOnGround(p)&&p.row===z.row&&Math.abs(cellX(p.column)-z.x)<40)this.squishPlant(p);}
      if(native){this.crushVehicle(z,rawX);this.advanceCatapultAnimation(z);}
      return;
    }
    if(!animated)state.remaining=Math.max(0,state.remaining-1);
    if(state.phase==='shoot'&&(animated?(state.lastAnimTime??0)>0&&Math.fround(.545)>=(state.lastAnimTime??0)&&Math.fround(.545)<state.animTime!:state.remaining===230)){
      const p=target();
      if(native){
        // AddProjectile truncates its origin; velocity uses the original floats.
        const originX=z.x-30+113,originY=nativeY-44,x=Math.trunc(originX),startY=Math.trunc(originY);
        const targetX=p?cellX(p.column)-40:Math.trunc(z.x-30-300),targetY=p?this.gridY(p.column,p.row):0;
        const endX=x-Math.max(40,originX-targetX-20),endY=startY+targetY-originY;
        this.peas.push({id:++this.id,row:z.row,x,y:startY,age:0,ice:false,puff:false,lob:{kind:'basketball',target:p?.id??-1,startX:x,endX,startY,endY,duration:120,flight:lobFlight(x,startY,endX,endY)}});
      }else if(p){const x=z.x+65,endX=cellX(p.column),startY=this.rowY(z.row,x)-110,endY=this.rowY(z.row,endX)-45;this.peas.push({id:++this.id,row:z.row,x,y:startY,age:0,ice:false,puff:false,lob:{kind:'basketball',target:p.id,startX:x,endX,startY,endY,duration:120,flight:lobFlight(x,startY,endX,endY)}});}
    }
    if(state.phase==='shoot'&&(animated?state.animTime!>=1:state.remaining===171)){
      state.ammo--;state.phase=animated&&state.ammo===0?'walk':'reload';
      if(state.phase==='walk')z.x-=z.speed*(z.chillIn>0?.4:1);
    }
    if(state.remaining===0&&state.phase==='reload'){
      state.phase=state.ammo>0&&target()?'shoot':'walk';
      if(state.phase==='shoot'){state.remaining=300;if(native){state.animTime=0;state.lastAnimTime=0;}}
      else if(animated)z.x-=z.speed*(z.chillIn>0?.4:1);
    }
    if(native){this.crushVehicle(z,rawX);this.advanceCatapultAnimation(z);}
  }
  // Giant smash/throw use 33/34-pose source clips at 24 fps. The Web port uses
  // a deterministic arc for the thrown imp; roof landing distance follows source.
  private updateGiant(z: Zombie,speedFactor: number) {
    const state=z.giant!;
    const food=()=>this.plants.find(p=>this.plantOnGround(p)&&p.row===z.row&&z.x-cellX(p.column)<55&&z.x-cellX(p.column)>-30);
    if(state.phase==='walk'){
      z.eating=false;
      if(!state.thrown&&z.health<1500&&z.x>400){state.phase='throw';state.remaining=138;}
      else if(food()){state.phase='smash';state.remaining=134;}
      else z.x-=walkingSpeed(z)*speedFactor;
      return;
    }
    const before=state.remaining;state.remaining=Math.max(0,state.remaining-speedFactor);
    if(state.phase==='smash'&&before>48&&state.remaining<=48){
      const p=food();if(p)for(const victim of this.plants)if(this.plantOnGround(victim)&&victim.column===p.column&&victim.row===p.row){if(victim.kind==='spikerock')victim.health-=50;else this.squishPlant(victim);}
      this.events.push({kind:'hit',x:z.x,y:this.rowY(z.row,z.x)});
    }
    if(state.phase==='throw'&&before>36&&state.remaining<=36){
      state.thrown=true;
      let distance=z.x-360-(this.config.environment==='roof'?180:0);
      distance=Math.max(this.config.environment==='roof'?-140:40,distance);
      if(distance>140)distance-=this.random()*100;
      const imp=this.spawnZombie('imp',z.row,z.x-133,z.wave);
      const duration=Math.max(30,Math.round(Math.abs(distance)/3));
      imp.flight={startX:imp.x,endX:imp.x-distance,duration,remaining:duration};
    }
    if(state.remaining===0)state.phase='walk';
  }

  private fireRear(plant: Plant,force=false) {
    if(plant.kind==='splitpea'){if(force||this.peaTarget(plant,true))this.emitNativePea(plant,true);return;}
    const x=cellX(plant.column);
    if(!this.zombies.some(z=>this.projectileTarget(z)&&z.row===plant.row&&z.x<x))return;
    this.peas.push({id:++this.id,row:plant.row,x:x-25,vx:-3.33,ice:false,puff:false,age:0,originY:this.rowY(plant.row,x)-43});plant.shotAt=this.ticks;
    this.events.push({kind:'shoot',x,y:this.rowY(plant.row,x)-43});
  }
  private fireStars(plant: Plant) {
    if(!this.zombies.some(z=>this.projectileTarget(z)&&z.x<825))return;
    for(const [vx,vy] of [[-3.33,0],[0,-3.33],[0,3.33],[2.35,-2.35],[2.35,2.35]])this.peas.push({id:++this.id,row:plant.row,x:cellX(plant.column),y:this.rowY(plant.row,cellX(plant.column))-35,vx,vy,star:true,ice:false,puff:false,age:0});
    plant.shotAt=this.ticks;this.events.push({kind:'shoot',x:cellX(plant.column),y:this.rowY(plant.row,cellX(plant.column))});
  }
  private updateStar(pea: Pea) {
    pea.x+=pea.vx!;pea.y!+=pea.vy!;pea.age++;
    // Projectile::CheckForCollision removes stars before collision checks outside y=40..600.
    if(pea.y!<40||pea.y!>600){pea.x=1000;return;}
    const target=this.zombies.find(z=>this.projectileTarget(z)&&!(pea.age<25&&pea.vx!>=0&&z.kind==='digger')&&Math.abs(z.x-pea.x)<22&&Math.abs(this.rowY(z.row,z.x)-43-pea.y!)<32);
    if(target){this.projectileImpact(pea,target);this.damageZombie(target,20,pea.vx!<0);target.hitAt=this.ticks;pea.x=1000;}
  }
  private fireLob(plant: Plant, prepareWinter = false) {
    const x=cellX(plant.column);let target:Zombie|undefined,bestLeft=Infinity;
    // Plant::FindTargetZombie: default attack rect starts at mX+60,
    // spans BOARD_WIDTH, includes edge contact and weights by integer body left.
    for(const z of this.zombies){
      if(!this.projectileTarget(z,13)||z.row!==plant.row)continue;
      const native=this.nativeGroundY(z)!==undefined,left=native?this.lobBodyLeft(z):z.x;
      if(native?left+this.lobBodySize(z)[0]<x+20||left>x+20+BOARD.width:z.x<=x-10||z.x>=825)continue;
      if(left<bestLeft){target=z;bestLeft=left;}
    }
    if(!target && !(this.boss && bossVulnerable(this.boss)))return;
    if (prepareWinter) { plant.winterLaunchIn=36; plant.shotAt=this.ticks; return; }
    const kind=plant.kind==='wintermelon'?'wintermelon':plant.kind==='melonpult'?'melon':plant.kind==='cabbagepult'?'cabbage':this.random()<.25?'butter':'kernel';
    // Plant::Fire uses grid coordinates and a fixed -5 pot adjustment, without water bobbing.
    const originX=x-40+(kind==='cabbage'?5:kind==='kernel'?19:kind==='butter'?12:25);
    const startY=this.gridY(plant.column,plant.row)
      +(kind==='cabbage'?-12:kind==='kernel'?-37:kind==='butter'?-56:-46)
      -(this.plants.some(p=>p.kind==='flowerpot'&&p.column===plant.column&&p.row===plant.row&&p.health>0)?5:0);
    const offset=target&&(target.kind==='pogo'&&target.pogo||target.kind==='dolphin'&&target.dolphin)?60:target?.kind==='snorkel'&&this.submerged(target)?40:0;
    const duration=120,endX=target?Math.max(originX+40,this.targetLeadX(target,50)-30-offset):700;
    const endY=target?this.zombieBodyTop(target):this.boss?this.gridY(8,plant.row):startY;
    this.peas.push({id:++this.id,row:plant.row,x:originX,y:startY,age:0,ice:false,puff:false,lob:{kind,target:target ? target.id : -1,startX:originX,endX,startY,endY,duration,flight:lobFlight(originX,startY,endX,endY)}});
    if (plant.kind !== 'wintermelon') plant.shotAt=this.ticks;
    this.events.push({kind:'shoot',x,y:this.rowY(plant.row,x)-60});
  }
  private targetLeadX(z:Zombie,time:number) {
    // ZombieTargetLeadX uses mVelX, not the animation's mean walking displacement.
    const stopped=z.eating||(z.frozenIn??0)>0||(z.butterIn??0)>0||z.rageIn>0||z.jackOpening||z.bungee
      ||(z.landingIn??0)>0||(z.ladderIn??0)>0||z.giant&&z.giant.phase!=='walk'||z.catapult&&z.catapult.phase!=='walk'
      ||z.dancePhase==='point'||z.dancePhase==='hold'||!this.dancerMoving(z);
    const speed=stopped?0:z.speed*(z.chillIn>0?.4:1)*(z.backwards?-1:1);
    const center=this.nativeGroundY(z)===undefined?z.x:this.lobBodyLeft(z)+Math.trunc(this.lobBodySize(z)[0]/2);
    return center-speed*time;
  }
  private lobBodySize(z:Zombie):readonly [number,number] {
    return z.kind==='gargantuar'?LOB_GIANT_BODY:z.kind==='catapult'||z.kind==='zomboni'?LOB_VEHICLE_BODY
      :z.kind==='football'?LOB_FOOTBALL_BODY:z.kind==='snorkel'?LOB_SNORKEL_BODY:z.kind==='digger'?LOB_DIGGER_BODY:LOB_NORMAL_BODY;
  }
  zombieBodyTop(z:Zombie) {
    const y=this.nativeGroundY(z);
    return y===undefined?this.rowY(z.row,z.x)-this.lobBodySize(z)[1]:Math.trunc(Math.trunc(y)-(z.pogoState?.altitude??0))+(z.kind==='gargantuar'?-38:z.kind==='catapult'||z.kind==='zomboni'?-13:z.kind==='pogo'&&!z.pogo?17:0);
  }
  private lobBodyLeft(z:Zombie) {
    const [width]=this.lobBodySize(z);
    if(this.nativeGroundY(z)===undefined)return z.x-width/2;
    return this.zombieBodyLeft(z);
  }
  private zombieBodyWidth(z:Zombie) {
    return z.sled&&!z.crashIn?275:z.kind==='bungee'?110:this.lobBodySize(z)[0];
  }
  private zombieBodyLeft(z:Zombie) {
    // ZombieInitialize/GetZombieRect retain unscaled horizontal rectangles for
    // mini zombies too. Water clipping and altitude affect Y, not these edges.
    const offset=z.sled&&!z.crashIn?-50:z.kind==='bungee'?-20:z.kind==='gargantuar'?-17:z.kind==='catapult'||z.kind==='zomboni'?0
      :z.kind==='football'||z.kind==='digger'?50:z.kind==='snorkel'?12:z.kind==='dolphin'&&!z.dolphin?20:36;
    return Math.trunc(z.x-30)+(z.backwards||z.hypnotized?(z.kind==='gargantuar'?180:120)-offset-this.zombieBodyWidth(z):offset);
  }
  private updateLob(pea: Pea) {
    const shot=pea.lob!,t=++pea.age/shot.duration,f=shot.flight;
    // UpdateLobMotion calls GetProjectileRect before UpdateMotion commits mX/mY.
    const collisionX=f?Math.trunc(pea.x):pea.x;
    let target:Zombie|undefined;
    let hitGround=false;
    if(f){
      const oldX=pea.x;f.vz+=.115;pea.x+=f.vx;f.z+=f.vz;
      const collide=lobCanCollide(shot.kind,pea.age,f,this.waterRow(pea.row)),collisionZ=f.z;hitGround=f.z>80;
      const slope=this.slope(pea.x)-this.slope(oldX);f.planeY+=slope;f.z-=slope;pea.y=f.planeY+f.z;
      if(!collide)return;
      const melon=shot.kind==='melon'||shot.kind==='wintermelon',left=collisionX+(melon?20:0),right=left+(melon?60:40);
      if(shot.kind!=='basketball')for(const z of this.zombies){
        if(!this.projectileTarget(z,13)||this.submerged(z)&&collisionZ<=45||z.row!==pea.row)continue;
        const [width]=this.lobBodySize(z);
        const bodyLeft=this.lobBodyLeft(z);
        // Board::GetRectOverlap is one-dimensional; lob height was gated above.
        if(left<=bodyLeft+width&&right>=bodyLeft
          &&(!target||z.x<target.x))target=z;
      }
      if(shot.kind!=='basketball'&&!target&&!hitGround&&!(shot.target===-1&&this.boss&&Math.abs(pea.x-700)<65))return;
    }else {
      // Only shots already present in pre-ballistic saves finish their old trajectory.
      pea.x=shot.startX+(shot.endX-shot.startX)*t;pea.y=shot.startY+(shot.endY-shot.startY)*t-Math.sin(t*Math.PI)*150;
    }
    if(!f&&t<1){
      // UpdateLobMotion permits launch-area collisions during the first 20 ticks.
      if(pea.age>20||shot.kind==='basketball')return;
      for(const z of this.zombies)if(this.projectileTarget(z,13)&&!this.submerged(z)&&z.row===pea.row
        &&Math.abs(z.x-pea.x)<=41&&pea.y+20>=this.rowY(z.row,z.x)-115&&pea.y-20<=this.rowY(z.row,z.x)
        &&(!target||z.x<target.x))target=z;
      if(!target)return;
    }
    if(shot.kind==='basketball'){
      const cell=this.plants.find(p=>{
        if(!this.plantOnGround(p))return false;
        if(!f)return p.id===shot.target;
        if(p.row!==pea.row)return false;
        return this.plantRectOverlap(p,collisionX,40)>8;
      });
      const victim=f&&cell?this.topCatapultPlant(cell.column,cell.row):cell;
      if(f&&!victim&&!hitGround)return;
      if(victim){const umbrella=this.findUmbrella(victim.column,victim.row);if(umbrella)umbrella.shotAt=this.ticks;else victim.health-=75;}
      pea.x=1000;return;
    }
    if(shot.target===-1 && this.boss){if(bossVulnerable(this.boss))this.projectileImpact(pea);if(shot.kind==='wintermelon'&&bossVulnerable(this.boss))this.boss.chillIn=Math.max(this.boss.chillIn,1000);damageBoss(this.boss,shot.kind==='melon'||shot.kind==='wintermelon'?80:shot.kind==='kernel'?20:40,this.ticks);pea.x=1000;return;}
    // Lobbed projectiles collide at the landing point, not solely with their original aim target.
    if(!f&&!target)for(const z of this.zombies)if(this.projectileTarget(z,13)&&z.row===pea.row&&Math.abs(z.x-pea.x)<65&&(!target||z.x<target.x))target=z;
    this.projectileImpact(pea,target);
    if(shot.kind==='melon'||shot.kind==='wintermelon'){
        const nearby=this.zombies.filter(z=>this.projectileTarget(z,13)&&Math.abs(z.row-pea.row)<=1&&(f?
          collisionX+20<=this.lobBodyLeft(z)+this.lobBodySize(z)[0]&&collisionX+80>=this.lobBodyLeft(z):Math.abs(z.x-pea.x)<=80));
        const count=nearby.length-(target?1:0);
        const splash=count*26>560?Math.max(1,Math.trunc(80*560/(count*26*3))):26;
        for(const z of nearby){const damage=z===target?80:splash;if(z.shield>0)this.damageZombie(z,Math.min(z.shield,damage));this.damageZombie(z,damage,true);z.hitAt=this.ticks;
          // Portable CanBeChilled: ice machines and riding sled teams resist chill; catapults do not.
          if (shot.kind==='wintermelon') this.applyChill(z);
        }
    }else if(target){this.damageZombie(target,shot.kind==='kernel'?20:40,true);target.hitAt=this.ticks;if(shot.kind==='butter'&&this.canBeFrozen(target)&&!headless(target)&&!this.plants.some(p=>p.kelp?.target===target.id)){target.butterIn=400;if(target.pogoState)target.pogoState.altitude=0;}}
    pea.x=1000;
  }
  private projectileImpact(pea:Pea,target?:Zombie){this.events.push({kind:'hit',x:pea.x,y:pea.y??this.rowY(pea.row)-43,impact:impactSounds(pea,target)});}
  private updateMagnet(plant: Plant) {
    if(plant.actionIn>0){plant.actionIn--;return;}
    const candidates=this.zombies.filter(z=>!z.hypnotized&&!headless(z)&&z.health>0&&Math.abs(z.row-plant.row)<=2&&Math.hypot(z.x-cellX(plant.column),(z.row-plant.row)*this.cellHeight)<(z.eating?320:270)&&
      ((['bucket','football'].includes(z.kind)&&z.armor>0)||(['door','ladder'].includes(z.kind)&&z.shield>0)||z.pogo||z.kind==='digger'&&!z.metalRemoved||z.kind==='jack'&&!z.metalRemoved&&!z.jackOpening)).sort((a,b)=>Math.abs(a.x-cellX(plant.column))-Math.abs(b.x-cellX(plant.column)));
    const z=candidates[0];
    if(z){if(['bucket','football'].includes(z.kind))z.armor=0;else if(['door','ladder'].includes(z.kind)){z.shield=0;z.ladderIn=0;z.speed=.3;}else if(z.kind==='pogo')this.breakPogo(z);else if(z.kind==='digger'&&z.underground){z.underground=false;z.emergingIn=330;z.backwards=false;z.speed=.3;}z.metalRemoved=true;plant.actionIn=1500;plant.shotAt=this.ticks;return;}
    const ladder=this.ladders.find(l=>Math.abs(l.row-plant.row)<=2&&Math.hypot((l.column-plant.column)*80,(l.row-plant.row)*this.cellHeight)<270);
    if(ladder){this.ladders=this.ladders.filter(l=>l!==ladder);plant.actionIn=1500;plant.shotAt=this.ticks;}
  }
  private dropFromSky(kind: ZombieKind,row: number,wave: number) {
    const column=4+Math.floor(this.random()*5);
    const z=this.spawnZombie('bungee',row,cellX(column),wave);
    z.row=row;z.x=cellX(column);z.bungee={phase:'down',remaining:375,column,drop:kind};
  }
  private updateBungee(z: Zombie) {
    const state=z.bungee!;
    if(--state.remaining>0)return;
    if(state.phase==='down'){
      const umbrella=this.findUmbrella(state.column,z.row);
      if(umbrella){umbrella.shotAt=this.ticks;state.phase='up';state.remaining=100;return;}
      if(state.drop){this.spawnZombie(state.drop,z.row,z.x,z.wave);state.phase='up';state.remaining=100;}
      else{state.phase='wait';state.remaining=300;}
    }else if(state.phase==='wait'){
      const occupants=this.plants.filter(p=>this.plantOnGround(p)&&p.column===state.column&&p.row===z.row);
      const victim=occupants.find(p=>p.kind!=='pumpkin'&&p.kind!=='flowerpot'&&p.kind!=='lilypad')||occupants.find(p=>p.kind==='pumpkin')||occupants[0];
      if(victim)victim.health=0;
      state.phase='up';state.remaining=100;
    }else this.zombies=this.zombies.filter(other=>other!==z);
  }

}
