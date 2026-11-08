import {Assets,Rectangle,Texture} from 'pixi.js';
import {loadGraphics} from '../platform/load-queue';
import {releaseBitmapOnDestroy} from './bitmap-lifetime';
type AtlasDefinition={frames:Record<string,[number,number,number,number]>};
// Keep metadata/image parallel; a failed pair must not leave a late image orphaned.
export async function loadMotionAtlas<D extends AtlasDefinition>(base:string,upload:(texture:Texture)=>Promise<void>,metadataFile=base+'.json'){
 return loadGraphics(async()=>{
 const src=base+'.classic.webp';
 const [metadata,image]=await Promise.allSettled([
  fetch(metadataFile).then(response=>{if(!response.ok)throw new Error(`Atlas metadata: HTTP ${response.status}`);return response.json() as Promise<D>;}),
  Assets.load<Texture>({src,data:{resolution:1}}),
 ]);
 if(image.status==='fulfilled')releaseBitmapOnDestroy(image.value);
 if(metadata.status==='rejected'||image.status==='rejected'){
  if(image.status==='fulfilled')await Assets.unload(src);
  throw metadata.status==='rejected'?metadata.reason:(image as PromiseRejectedResult).reason;
 }
 const textures:Record<string,Texture>={};
 try{
  for(const [key,rect] of Object.entries(metadata.value.frames))textures[key]=new Texture({source:image.value.source,frame:new Rectangle(...rect)});
  await upload(image.value);
  return {definition:metadata.value,textures,file:src};
 }catch(error){
  for(const texture of Object.values(textures))texture.destroy();
  await Assets.unload(src);throw error;
 }
 });
}
