import type { Game } from '../game/model';
import tracks from './music-tracks.json';

export type MusicTrack = keyof typeof tracks;
export function battleMusic(game: Game): MusicTrack | null {
  if (game.boss) return 'boss';
  if (game.scenario === 'adventure' && game.level === 40) return null;
  if (game.config.mode === 'vase') return 'puzzle';
  if (game.scenario==='adventure' && game.level===45 || game.config.mode === 'bowling' || game.config.mode === 'whack' || game.level === 25 && game.scenario === 'adventure') return 'minigame';
  if (game.config.mode === 'conveyor') return 'conveyor';
  return game.config.environment;
}

// One streaming element; do not decode a whole soundtrack into a large PCM buffer.
export class GameMusic {
  private audio: HTMLAudioElement | null=null;
  private track: MusicTrack | null=null;
  private activated=false;
  private paused=false;
  private isEnabled=true;
  constructor(private base:string,private createAudio=()=>{const audio=new Audio();audio.hidden=true;audio.dataset.gameMusic='true';document.body.append(audio);return audio}){}
  get enabled(){return this.isEnabled}
  set enabled(value:boolean){this.isEnabled=value;this.sync()}
  async activate(){
    if(!this.audio){this.audio=this.createAudio();this.audio.preload='metadata';this.audio.volume=.5;this.audio.onended=()=>{if(!this.track)return;this.audio!.currentTime=tracks[this.track].loopStart;this.sync()};}
    this.activated=true;this.sync();
  }
  setTrack(track:MusicTrack|null){if(this.track===track)return;this.track=track;this.sync()}
  setPaused(paused:boolean){this.paused=paused;this.sync()}
  private sync(){
    if(!this.activated||!this.audio)return;
    const audio=this.audio;
    if(!this.track){audio.pause();audio.removeAttribute('src');audio.load();return;}
    if(this.paused||!this.enabled){audio.pause();return;}
    const file=this.base+'assets/music/'+tracks[this.track].file;
    if(audio.getAttribute('src')!==file){audio.pause();audio.src=file;audio.load();}
    if(audio.paused)void audio.play().catch(()=>{});
  }
}
