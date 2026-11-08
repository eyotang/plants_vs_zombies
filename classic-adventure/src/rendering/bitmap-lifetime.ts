import type {Texture,TextureSource} from 'pixi.js';
const owned=new WeakSet<TextureSource>();
// Only Assets-loaded images call this: their bitmap lives until the shared source
// is destroyed, not until any one atlas view or GPU upload is released.
export function releaseBitmapOnDestroy(texture:Texture) {
 const source=texture.source,bitmap=source.resource;
 if(typeof ImageBitmap==='undefined'||!(bitmap instanceof ImageBitmap)||owned.has(source))return;
 owned.add(source);source.once('destroy',()=>bitmap.close());
}
