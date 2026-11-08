import type { Game } from '../game/model';

export function soundFiles(game: Game) {
  const files = {
    plant: 'plant_water.mp3', sun: 'points.mp3', mower: 'lawnmower.mp3',
    shoot:'throw.mp3',shoot2:'throw2.mp3',hit:'splat.mp3',hit2:'splat2.mp3',hit3:'splat3.mp3',
    wave: 'finalwave.mp3', flag: 'hugewave.mp3', win: 'winmusic-web.mp3', lose: 'losemusic.mp3',
  } as Record<string, string>;
  const plants = new Set([...game.seeds, ...(game.imitaterTarget?[game.imitaterTarget]:[]), ...game.plants.map(plant => plant.kind), ...game.rollers.map(roller => roller.kind)]);
  const enemies=new Set([...game.waves.flat(),...game.zombies.map(z=>z.kind)]);
  const uncertain=!!game.boss||game.config.mode==='vase';
  if(uncertain||(['zomboni','catapult','gargantuar','bobsled']as const).some(kind=>enemies.has(kind))){files.squish='squish.mp3';files.squish2='squish2.mp3';}
  if(uncertain||enemies.has('bucket')){files.shield='shieldhit.mp3';files.shield2='shieldhit2.mp3';}
  if(uncertain||game.graves.length>0||enemies.has('cone')||enemies.has('football')||enemies.has('digger')){files.plastic='plastichit.mp3';files.plastic2='plastichit2.mp3';}
  const lobs=new Set(game.peas.flatMap(p=>p.lob?[p.lob.kind]:[]));
  if(plants.has('torchwood')||game.peas.some(p=>p.fire)){files.ignite='ignite.mp3';files.ignite2='ignite2.mp3';files['pea-ignite']='firepea.mp3';}
  if(plants.has('kernelpult')||lobs.has('kernel')||lobs.has('butter')){files.kernel='kernelpult.mp3';files.kernel2='kernelpult2.mp3';files.butter='butter.mp3';}
  if(plants.has('melonpult')||plants.has('wintermelon')||lobs.has('melon')||lobs.has('wintermelon')){files.melon='melonimpact.mp3';files.melon2='melonimpact2.mp3';}
  if (plants.has('cherrybomb') || plants.has('potatomine') || plants.has('doomshroom') || plants.has('explodenut')) files.explode = 'cherrybomb.mp3';
  if (plants.has('chomper')) files.swallow = 'chomp.mp3';
  if(plants.has('gravebuster'))files['grave-chomp']='gravebuster-chomp.mp3';
  if (plants.has('fumeshroom')) files.fume = 'fume.mp3';
  if (plants.has('hypnoshroom')) files.hypnotize = 'mindcontrolled.mp3';
  if (plants.has('iceshroom')) files.freeze = 'frozen.mp3';
  if (plants.has('blover')) files.blover = 'blover.mp3';
  if (plants.has('jalapeno')) files.fire = 'cherrybomb.mp3';
  if (game.boss || game.waves.flat().includes('jack') || game.config.mode === 'vase') files.explode = 'cherrybomb.mp3';
  if (game.config.mode === 'vase') files.vase = 'vase_breaking.mp3';
  if (game.config.mode === 'whack') files.whack = 'bonk.mp3';
  if(game.level===40&&game.scenario==='adventure')files.thunder='thunder.mp3';
  if(game.config.environment==='roof')files.bungee='bungee_scream.mp3';
  if(plants.has('marigold'))files.coin='points.mp3';
  if(plants.has('coffeebean'))files.coffee='coffee.mp3';
  return files;
}
