import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../tools/pwa-worker.js',import.meta.url),'utf8');
test('release discovery bypasses the worker even if a manifest was accidentally listed as an asset',()=>{
 const callbacks=new Map<string,(event:any)=>void>();
 const self={location:{href:'https://example.test/garden/sw-old.js'},addEventListener:(type:string,fn:(event:any)=>void)=>callbacks.set(type,fn)};
 runInNewContext(source,{self,URL,caches:{open:async()=>({})},ASSETS:{'release.json':{revision:'old',size:5}},SHELL:[],RELEASE:'old'});
 let intercepted=false;
 callbacks.get('fetch')!({request:{url:'https://example.test/garden/release.json?__pvz_check=123',method:'GET'},respondWith:()=>{intercepted=true;}});
 assert.equal(intercepted,false);
});
test('PVZ1 root worker leaves PVZ2 navigation and assets to its independent app',()=>{
 const callbacks=new Map<string,(event:any)=>void>();
 const self={location:{href:'https://example.test/sw.js'},addEventListener:(type:string,fn:(event:any)=>void)=>callbacks.set(type,fn)};
 runInNewContext(source,{self,URL,caches:{open:async()=>({})},ASSETS:{'index.html':{revision:'a',size:5},'assets/game.js':{revision:'a',size:10}},SHELL:['index.html'],RELEASE:'a'});
 for(const [path,mode] of [['pvz2/','navigate'],['pvz2/index.html','navigate'],['pvz2/assets/egypt/lawn.webp','cors'],['pvz2/assets/index.js','cors']]){
  let intercepted=false;
  callbacks.get('fetch')!({request:{url:`https://example.test/${path}`,mode,method:'GET'},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false,path);
 }
});
const saved=new Map<string,Map<string,Response>>();
function worker(revision='a',online=true,body='asset',responseStatus=200){
 const callbacks=new Map<string,(event:any)=>void>();let requests=0,activated=0;
 const self={location:{href:'https://example.test/pvz/sw.js'},clients:{claim:async()=>{}},skipWaiting:async()=>{activated++;},addEventListener:(type:string,fn:(event:any)=>void)=>callbacks.set(type,fn)};
 const ASSETS={'index.html':{revision,size:5},'assets/game.js':{revision,size:10},'assets/hd/actors.png':{revision:'same-art',size:20},'assets/original/plant_water.mp3':{revision:'same-audio',size:10}};
 const caches={open:async(name:string)=>{if(!saved.has(name))saved.set(name,new Map());const map=saved.get(name)!;return{match:async(key:string)=>map.get(key)?.clone(),put:async(key:string,response:Response)=>{map.set(key,response);}};}};
 runInNewContext(source,{self,caches,URL,AbortController,setTimeout,clearTimeout,ASSETS,SHELL:['index.html','assets/game.js'],RELEASE:revision,fetch:async()=>{requests++;if(!online)throw new Error('offline');return new Response(body,{status:responseStatus});}});
 return {
  requests:()=>requests,activated:()=>activated,
  install:async()=>{let pending:Promise<unknown>;callbacks.get('install')!({waitUntil:(p:Promise<unknown>)=>pending=p});await pending!;},
  fetch:async(url:string,mode='cors')=>{let response:Promise<Response>|undefined;callbacks.get('fetch')!({request:{url,mode,method:'GET'},waitUntil:(p:Promise<unknown>)=>p,respondWith:(p:Promise<Response>)=>response=p});return response;},
  message:async(action:string)=>{let pending:Promise<unknown>;const messages:any[]=[];callbacks.get('message')!({data:action,ports:[{postMessage:(m:unknown)=>messages.push(m)}],waitUntil:(p:Promise<unknown>)=>pending=p});await pending!;return messages;},
 };
}
test('PWA caches shell, downloads art and audio, and can restart without a network',async()=>{
 saved.clear();const first=worker();await first.install();assert.equal(first.requests(),2);
 assert.equal((await first.message('STATUS')).at(-1).count,2);
 assert.equal((await first.message('DOWNLOAD')).at(-1).count,4);
 const offline=worker('a',false);assert.equal(await (await offline.fetch('https://example.test/pvz/','navigate'))!.text(),'asset');
 assert.equal(await (await offline.fetch('https://example.test/pvz/assets/hd/actors.png'))!.text(),'asset');
 assert.equal(await (await offline.fetch('https://example.test/pvz/assets/original/plant_water.mp3'))!.text(),'asset');assert.equal(offline.requests(),1,'navigation checks the network before its offline fallback');
 assert.equal(await offline.fetch('https://example.test/kr3/'),undefined);assert.equal(await offline.fetch('https://another.test/pvz/','navigate'),undefined);
});
test('online navigation discovers the new page without corrupting the old offline shell',async()=>{
 saved.clear();const old=worker();await old.install();
 const online=worker('a',true,'new-index');
 assert.equal(await (await online.fetch('https://example.test/pvz/?sharecode=example','navigate'))!.text(),'new-index');
 assert.equal(online.requests(),1,'a cached index must not hide a newly deployed page');
 const offline=worker('a',false);
 assert.equal(await (await offline.fetch('https://example.test/pvz/index.html','navigate'))!.text(),'asset');
 assert.equal(offline.requests(),1,'direct index navigation has the same offline fallback');
 const unavailable=worker('a',true,'server error',503);
 assert.equal(await (await unavailable.fetch('https://example.test/pvz/','navigate'))!.text(),'asset','HTTP failures preserve a playable cached shell');
});
test('a stalled mobile navigation falls back after three seconds and releases its timer',async()=>{
 const callbacks=new Map<string,(event:any)=>void>();let expire:(()=>void)|undefined,delay=0,cleared=false,response!:Promise<Response>;
 const self={location:{href:'https://example.test/sw-version.js'},addEventListener:(type:string,fn:(event:any)=>void)=>callbacks.set(type,fn)};
 runInNewContext(source,{self,URL,AbortController,ASSETS:{'index.html':{revision:'a',size:5}},SHELL:[],RELEASE:'a',
  caches:{open:async()=>({match:async()=>new Response('cached shell')})},
  setTimeout:(fn:()=>void,ms:number)=>{expire=fn;delay=ms;return 1;},clearTimeout:()=>{cleared=true;},
  fetch:(_request:unknown,{signal}:{signal:AbortSignal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))),
 });
 callbacks.get('fetch')!({request:{url:'https://example.test/',mode:'navigate',method:'GET'},respondWith:(p:Promise<Response>)=>response=p});
 assert.equal(delay,3000);expire!();assert.equal(await (await response).text(),'cached shell');assert.equal(cleared,true);
});
test('PWA reuses unchanged art on update and activates only on explicit command',async()=>{
 saved.clear();const old=worker();await old.install();await old.message('DOWNLOAD');const update=worker('b');await update.install();assert.equal(update.activated(),0);await update.message('DOWNLOAD');assert.equal(update.requests(),2);await update.message('ACTIVATE');assert.equal(update.activated(),1);
});
test('failed offline download reports error without pretending cache is complete',async()=>{
 saved.clear();const failed=worker('c',false);const result=await failed.message('DOWNLOAD');assert.equal(result.at(-1).type,'error');assert.equal((await failed.message('STATUS')).at(-1).count,0);
});
test('install manifest and HTML icons have their declared dimensions and relative app scope',()=>{
 const root=new URL('../public/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root),'utf8'));
 assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const b=readFileSync(new URL(icon.src,root));assert.equal(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`,icon.sizes);}
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');for(const path of ['icons/icon-16.png','icons/icon-32.png','icons/apple-touch-icon.png','icons/favicon.ico','manifest.webmanifest'])assert.ok(html.includes(path));
});
test('foreground resource response is not blocked by the offline-cache write', {timeout:1000}, async()=>{
 const callbacks=new Map<string,(event:any)=>void>();let finish!:()=>void,background!:Promise<unknown>,response!:Promise<Response>;
 const pending=new Promise<void>(resolve=>finish=resolve);let written=false;
 const self={location:{href:'https://example.test/sw.js'},addEventListener:(type:string,fn:(event:any)=>void)=>callbacks.set(type,fn)};
 const caches={open:async()=>({match:async()=>undefined,put:async()=>{await pending;written=true;}})};
 runInNewContext(source,{self,caches,URL,ASSETS:{'art.webp':{revision:'a',size:3}},SHELL:[],RELEASE:'a',fetch:async()=>new Response('art')});
 callbacks.get('fetch')!({request:{url:'https://example.test/art.webp',mode:'cors',method:'GET'},respondWith:(p:Promise<Response>)=>response=p,waitUntil:(p:Promise<unknown>)=>background=p});
 try { assert.equal(await (await response).text(),'art');assert.equal(written,false); }
 finally { finish(); }
 await background;assert.equal(written,true);
});
