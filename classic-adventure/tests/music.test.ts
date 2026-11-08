import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GameMusic, battleMusic } from '../src/platform/music';
import { Game } from '../src/game/model';
import { SURVIVAL_SCENES } from '../src/game/config';
import tracks from '../src/platform/music-tracks.json';
import manifest from '../docs/music-assets.json';

function harness(){
 const audio={src:'',paused:true,currentTime:0,preload:'',volume:0,onended:null as null|(()=>void),plays:0,loads:0,
  getAttribute(){return this.src||null},removeAttribute(){this.src=''},load(){this.currentTime=0;this.loads++},pause(){this.paused=true},play(){this.paused=false;this.plays++;return Promise.resolve()}};
 let created=0;return {audio,music:new GameMusic('/',()=>{created++;return audio as unknown as HTMLAudioElement}),created:()=>created};
}
test('music streams only after interaction and reuses one element across pause and mute',async()=>{
 const {audio,music,created}=harness();music.setTrack('menu');assert.equal(created(),0);await music.activate();assert.equal(created(),1);assert.equal(audio.plays,1);assert.equal(audio.preload,'metadata');
 audio.currentTime=15;music.setPaused(true);assert.equal(audio.paused,true);music.setPaused(false);assert.equal(audio.currentTime,15);assert.equal(audio.loads,1);
 music.enabled=false;assert.equal(audio.paused,true);music.enabled=true;assert.equal(audio.plays,3);assert.equal(created(),1);
});
test('streaming music preserves original loop markers without a whole-track PCM allocation',async()=>{
 const {audio,music}=harness();music.setTrack('day');await music.activate();audio.paused=true;audio.onended!();assert.equal(audio.currentTime,tracks.day.loopStart);assert.equal(audio.paused,false);
});
test('scene changes while paused defer new music and null track releases the old source',async()=>{
 const {audio,music}=harness();music.setTrack('menu');await music.activate();music.setPaused(true);music.setTrack('night');assert.equal(audio.loads,1);assert.equal(audio.paused,true);music.setPaused(false);assert.ok(audio.src.endsWith('night.mp3'));assert.equal(audio.loads,2);music.setTrack(null);assert.equal(audio.src,'');assert.equal(audio.paused,true);
});
test('music follows the scene and Portable special-level choices',()=>{
  for(const scene of SURVIVAL_SCENES)assert.equal(battleMusic(new Game(9,1,'endless',scene)),scene);
  assert.equal(battleMusic(new Game(35,1)),'puzzle');
  assert.equal(battleMusic(new Game(40,1)),null);
  assert.equal(battleMusic(new Game(41,1)),'roof');
  assert.equal(battleMusic(new Game(45,1)),'minigame');
  for(const level of [5,15,25] as const)assert.equal(battleMusic(new Game(level,1)),'minigame');
  for(const level of [10,20] as const)assert.equal(battleMusic(new Game(level,1)),'conveyor');
});
test('all eleven committed tunes have reproducible hashes and valid loop markers',()=>{
  assert.equal(Object.keys(tracks).length,11);
  for(const [name,track] of Object.entries(tracks)){
    const metadata=manifest.tracks[name as keyof typeof manifest.tracks];
    const body=readFileSync(new URL('../public/assets/music/'+track.file,import.meta.url));
    assert.equal(createHash('sha256').update(body).digest('hex'),metadata.sha256);
    assert.ok(track.loopStart>=0&&track.loopStart<metadata.duration);
    assert.ok(metadata.duration>20);
  }
});

test('boss finale plays Brainiac Maniac while roof survival keeps roof music',()=>{assert.equal(battleMusic(new Game(50,1)),'boss');assert.equal(battleMusic(new Game(9,1,'endless','roof')),'roof');});
