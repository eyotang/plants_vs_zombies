import test from 'node:test';import assert from 'node:assert/strict';import{ImageSource,Texture}from'pixi.js';import{releaseBitmapOnDestroy}from'../src/rendering/bitmap-lifetime';
class Bitmap{width=2048;height=2048;closes=0;close(){this.closes++;this.width=0;this.height=0;}}
function withBitmap(run:()=>void){const original=Object.getOwnPropertyDescriptor(globalThis,'ImageBitmap');Object.defineProperty(globalThis,'ImageBitmap',{value:Bitmap,configurable:true});try{run()}finally{if(original)Object.defineProperty(globalThis,'ImageBitmap',original);else Reflect.deleteProperty(globalThis,'ImageBitmap');}}
test('an owned atlas closes its decoded bitmap at shared source destruction, even if its source object is retained',()=>withBitmap(()=>{
 const bitmap=new Bitmap(),source=new ImageSource({resource:bitmap}),texture=new Texture({source}),observer=new Set([source]);releaseBitmapOnDestroy(texture);assert.equal(bitmap.closes,0);source.destroy();assert.ok(observer.has(source));assert.equal(source.options.resource,bitmap);assert.equal(bitmap.closes,1);assert.equal(bitmap.width*bitmap.height,0);
}));
test('destroying an atlas view or unloading the GPU keeps a live shared bitmap available',()=>withBitmap(()=>{
 const bitmap=new Bitmap(),source=new ImageSource({resource:bitmap}),owner=new Texture({source}),view=new Texture({source});releaseBitmapOnDestroy(owner);releaseBitmapOnDestroy(view);view.destroy();source.unload();assert.equal(bitmap.closes,0);assert.equal(bitmap.width,2048);owner.destroy(true);assert.equal(bitmap.closes,1);assert.equal(source.resource,null);
}));
test('all views share one close callback, including repeated registration and source destruction',()=>withBitmap(()=>{
 const bitmap=new Bitmap(),source=new ImageSource({resource:bitmap}),texture=new Texture({source});for(let i=0;i<20;i++)releaseBitmapOnDestroy(texture);source.destroy();source.destroy();assert.equal(bitmap.closes,1);
}));
test('fallback images and environments without ImageBitmap keep their existing ownership behavior',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'ImageBitmap');Reflect.deleteProperty(globalThis,'ImageBitmap');try{const bitmap=new Bitmap(),source=new ImageSource({resource:bitmap});releaseBitmapOnDestroy(new Texture({source}));source.destroy();assert.equal(bitmap.closes,0);}finally{if(original)Object.defineProperty(globalThis,'ImageBitmap',original);}
 withBitmap(()=>{const fallback={width:128,height:128,close(){throw Error('must not close a fallback image')}};const source=new ImageSource({resource:fallback});releaseBitmapOnDestroy(new Texture({source}));source.destroy();assert.equal(source.resource,null);});
});
