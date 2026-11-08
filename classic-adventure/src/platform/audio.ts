import type { Game, GameEvent } from '../game/model';
import { soundFiles } from './audio-plan';
import type {ImpactSound} from '../game/impact';
const VARIANTS:Partial<Record<GameEvent['kind']|ImpactSound,readonly string[]>>={'pea-ignite':['pea-ignite'],'pea-melt':['shoot','shoot','shoot','shoot2'],shoot:['shoot','shoot','shoot','shoot2'],hit:['hit','hit2','hit3'],squish:['squish','squish2'],shield:['shield','shield2'],plastic:['plastic','plastic2'],ignite:['ignite','ignite','ignite','ignite2'],kernel:['kernel','kernel2'],butter:['butter'],melon:['melon','melon2']};

export class GameAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, {controller:AbortController;promise:Promise<void>}>();
  private output: GainNode | null = null;
  private combatOutput: GainNode | null = null;
  private pauseOutput:GainNode|null=null;
  private isPaused=false;
  setPaused(value:boolean){this.isPaused=value;if(this.pauseOutput)this.pauseOutput.gain.value=value?0:1;}
  constructor(private base=import.meta.env.BASE_URL){}
  private isMuted = false;
  private sources=new Set<AudioBufferSourceNode>();
  private get voices(){return this.sources.size;}
  private epoch=0;
  private lastPlayed=new Map<string,number>();
  get muted() { return this.isMuted; }
  set muted(value: boolean) {
    this.isMuted = value;
    if (this.output) this.output.gain.value = value ? 0 : 1;
  }

  private retain(keys:string[]) {
    const wanted=new Set(keys);
    for(const [key,request] of this.loading)if(!wanted.has(key)){request.controller.abort();this.loading.delete(key);}
    for(const key of this.buffers.keys())if(!wanted.has(key))this.buffers.delete(key);
    for(const key of this.lastPlayed.keys())if(!wanted.has(key))this.lastPlayed.delete(key);
  }

  async release() {
    this.epoch++;this.retain([]);
    for(const source of this.sources){source.onended=null;source.stop();source.disconnect();}
    this.sources.clear();
    // Queue suspension even while an earlier resume is still pending.
    await this.context?.suspend();
  }

  async unlock(game: Game) {
    const epoch=++this.epoch,files=soundFiles(game);
    this.retain(Object.keys(files));
    this.context ??= new AudioContext();
    if (!this.output) {
      this.output = this.context.createGain();
      this.output.gain.value = this.muted ? 0 : 1;
      this.output.connect(this.context.destination);
      this.combatOutput=this.context.createGain();this.combatOutput.gain.value=.3;this.combatOutput.connect(this.output);
    }
    await this.context.resume();
    if(epoch!==this.epoch)return;
    await Promise.all(Object.entries(files).map(([key, file]) => {
      if (!this.loading.has(key)) {
        const controller=new AbortController();
        // Defer work until its identity is registered, including synchronous failures.
        const promise=Promise.resolve().then(async () => {
          try {
            if(controller.signal.aborted)return;
            const response=await fetch(`${this.base}assets/original/${file}`,{signal:controller.signal});
            if(!response.ok)throw new Error(`Sound ${file}: HTTP ${response.status}`);
            const data=await response.arrayBuffer();if(controller.signal.aborted)return;
            const buffer=await this.context!.decodeAudioData(data);
            if(!controller.signal.aborted&&this.loading.get(key)?.controller===controller)this.buffers.set(key,buffer);
          } catch(error) {
            if(controller.signal.aborted)return;
            if(this.loading.get(key)?.controller===controller)this.loading.delete(key);throw error;
          }
        });
        this.loading.set(key,{controller,promise});
      }
      return this.loading.get(key)!.promise;
    }));
  }

  play(kind: GameEvent['kind']|ImpactSound,impact?:readonly ImpactSound[]) {
    if(kind==='hit'&&impact){for(const sound of impact)this.play(sound);return;}
    const variants=VARIANTS[kind],combat=variants!==undefined;
    if (!this.context || this.muted || this.voices>=(combat?10:12)) return;
    const now=this.context.currentTime;if(now-(this.lastPlayed.get(kind)??-Infinity)<(combat?.05:.02))return;
    const key=variants?variants[Math.floor(Math.random()*variants.length)]:kind;
    let buffer=this.buffers.get(key);
    if(!buffer&&variants)for(const fallback of variants){buffer=this.buffers.get(fallback);if(buffer)break;}
    if(!buffer)return;
    this.lastPlayed.set(kind,now);
    const source = this.context.createBufferSource(); source.buffer=buffer;
    this.sources.add(source);source.onended = () => {source.disconnect();this.sources.delete(source);};
    if(kind==='grave-chomp'){
      // Native Foley flag4: mute on pause, while the non-looping sample keeps time.
      if(!this.pauseOutput){this.pauseOutput=this.context.createGain();this.pauseOutput.connect(this.output!);}
      this.pauseOutput.gain.value=this.isPaused?0:1;source.connect(this.pauseOutput);
    }else source.connect(variants?this.combatOutput!:this.output!);
    source.start();
  }
}
