import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {compatibilityTexture} from '../tools/build-pwa';
const root=new URL('../public/assets/runtime/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('../docs/classic-texture-assets.json',import.meta.url),'utf8'));
function dimensions(body:Buffer){
 assert.equal(body.toString('ascii',0,4),'RIFF');assert.equal(body.toString('ascii',8,12),'WEBP');
 for(let offset=12;offset+8<body.length;){const tag=body.toString('ascii',offset,offset+4),size=body.readUInt32LE(offset+4),data=offset+8;
  if(tag==='VP8X')return [body.readUIntLE(data+4,3)+1,body.readUIntLE(data+7,3)+1];
  if(tag==='VP8L'){assert.equal(body[data],0x2f);const packed=body.readUInt32LE(data+1);return [(packed&0x3fff)+1,((packed>>>14)&0x3fff)+1];}
  if(tag==='VP8 ')return [body.readUInt16LE(data+6)&0x3fff,body.readUInt16LE(data+8)&0x3fff];
  offset=data+size+(size%2);
 }throw new Error('Missing WebP image');
}
test('original-size textures retain verified bytes and use a quarter of the former decoded pixels',()=>{
 let oldRGBA=0,newRGBA=0,oldBytes=0,newBytes=0;
 for(const [file,item] of Object.entries(manifest.outputs) as [string,any][]){
  const image=readFileSync(new URL(file,root)),old=readFileSync(new URL(file.replace('.classic.webp','.webp'),root));
  assert.equal(createHash('sha256').update(image).digest('hex'),item.sha256,file);assert.deepEqual(dimensions(image),item.size,file);assert.deepEqual(dimensions(old),item.oldSize);
  assert.deepEqual(item.oldSize,item.size.map((x:number)=>x*2));newRGBA+=item.size[0]*item.size[1]*4;oldRGBA+=item.oldSize[0]*item.oldSize[1]*4;newBytes+=image.length;oldBytes+=old.length;
 }
 assert.equal(newRGBA*4,oldRGBA);assert.equal(newRGBA,manifest.newDecodedRGBA);assert.equal(oldRGBA,manifest.oldDecodedRGBA);assert.ok(newBytes<oldBytes);assert.equal(newBytes,manifest.newEncodedBytes);
});
test('every native family and boss part retains the same logical rectangle and a classic texture',()=>{
 for(const folder of ['plant-motion','actor-motion','giant-motion'])for(const name of readdirSync(new URL(folder+'/',root)).filter(n=>n.endsWith('.json'))){
  const definition=JSON.parse(readFileSync(new URL(folder+'/'+name,root),'utf8')),item=manifest.outputs[folder+'/'+(definition.atlas??name.replace('.json',''))+'.classic.webp'];assert.ok(item,name);
  for(const [part,rect] of Object.entries(definition.frames) as [string,number[]][]){const [x,y,w,h]=rect;assert.ok(x>=0&&y>=0&&x+w<=item.size[0]&&y+h<=item.size[1],part);assert.match(item.framesRGBA256[part],/^[0-9a-f]{64}$/);}
 }
 const defs=JSON.parse(readFileSync(new URL('boss/tracks.json',root),'utf8'));
 for(const definition of Object.values(defs) as any[])for(const track of definition.tracks)for(const pose of track.poses)if(pose[8])assert.ok(manifest.outputs['boss/'+pose[8]+'.classic.webp'],pose[8]);
});
test('classic textures record original source hashes at the pinned source commit',()=>{
 assert.equal(manifest.commit,'325b2229a7225d73870bb69322eefcda3a45bf8d');assert.equal(manifest.resolution,1);
 const expected:Record<string,string>={};for(const name of ['actor-motion-assets','plant-motion-assets','giant-motion-assets','boss-assets','shop-plant-assets']){const d=JSON.parse(readFileSync(new URL('../docs/'+name+'.json',import.meta.url),'utf8'));Object.assign(expected,d.sources??d);}
 for(const [file,digest] of Object.entries(manifest.sources))assert.equal(digest,expected[file],file);
});
test('new offline bundles include classic textures while old URLs stay compatibility-only',()=>{
 for(const file of ['actor-motion/zombie.webp','plant-motion/peashooter.webp','giant-motion/gargantuar.webp','boss/ZOMBIE_BOSS_HEAD.webp'])assert.equal(compatibilityTexture('assets/runtime/'+file),true,file);
 for(const file of ['actor-motion/zombie.classic.webp','plant-motion/peashooter.classic.webp','giant-motion/gargantuar.classic.webp','boss/ZOMBIE_BOSS_HEAD.classic.webp','boss/background.webp','boss/tracks.json','original/pool.webp'])assert.equal(compatibilityTexture('assets/runtime/'+file),false,file);
});
