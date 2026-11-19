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
function worker(revision='a',online=true,body='asset',responseStatus: number | (() => number)=200,now=Date.now,contentType?:string | ((url:URL)=>string|undefined)){
 const callbacks=new Map<string,(event:any)=>void>();let requests=0,activated=0,matches=0,keyReads=0;
 const priorities: (RequestPriority | undefined)[] = [];
 const self={location:{href:'https://example.test/pvz/sw.js'},clients:{claim:async()=>{}},skipWaiting:async()=>{activated++;},addEventListener:(type:string,fn:(event:any)=>void)=>callbacks.set(type,fn)};
 const ASSETS={'index.html':{revision,size:5},'assets/game.js':{revision,size:10},'assets/hd/actors.png':{revision:'same-art',size:20},'assets/original/plant_water.mp3':{revision:'same-audio',size:10}};
 const caches={open:async(name:string)=>{if(!saved.has(name))saved.set(name,new Map());const map=saved.get(name)!;return{match:async(key:string)=>{matches++;return map.get(key)?.clone();},keys:async()=>{keyReads++;return [...map.keys()].map(url=>new Request(url));},put:async(key:string,response:Response)=>{map.set(key,response);}};}};
 runInNewContext(source,{self,caches,URL,Response,AbortController,setTimeout,clearTimeout,Date:{now},ASSETS,SHELL:['index.html','assets/game.js'],RELEASE:revision,fetch:async(url:URL,init?:RequestInit)=>{requests++;priorities.push(init?.priority);if(!online)throw new Error('offline');const type=typeof contentType==='function'?contentType(url):contentType;return new Response(body,{status:typeof responseStatus==='function'?responseStatus():responseStatus,headers:type?{'Content-Type':type}:undefined});}});
 return {
  requests:()=>requests,activated:()=>activated,matches:()=>matches,keyReads:()=>keyReads,priorities,
  install:async()=>{let pending:Promise<unknown>;callbacks.get('install')!({waitUntil:(p:Promise<unknown>)=>pending=p});await pending!;},
  fetch:async(url:string,mode='cors',range?:string)=>{let response:Promise<Response>|undefined;callbacks.get('fetch')!({request:{url,mode,method:'GET',headers:new Headers(range?{Range:range}:{})},waitUntil:(p:Promise<unknown>)=>p,respondWith:(p:Promise<Response>)=>response=p});return response;},
  message:async(action:string)=>{let pending:Promise<unknown>;const messages:any[]=[];callbacks.get('message')!({data:action,ports:[{postMessage:(m:unknown)=>messages.push(m)}],waitUntil:(p:Promise<unknown>)=>pending=p});await pending!;return messages;},
 };
}
test('initial offline caching yields network priority to the live game', async () => {
 saved.clear();
 const first = worker();
 await first.install();
 assert.deepEqual(first.priorities, ['low', 'low']);
 await first.fetch('https://example.test/pvz/assets/hd/actors.png');
 assert.equal(first.priorities.at(-1), 'auto');
});
test('PWA caches shell, downloads art and audio, and can restart without a network',async()=>{
 saved.clear();const first=worker();await first.install();assert.equal(first.requests(),2);
 assert.equal((await first.message('STATUS')).at(-1).count,2);
 assert.equal((await first.message('DOWNLOAD')).at(-1).count,4);
 const offline=worker('a',false);assert.equal(await (await offline.fetch('https://example.test/pvz/','navigate'))!.text(),'asset');
 assert.equal(await (await offline.fetch('https://example.test/pvz/assets/hd/actors.png'))!.text(),'asset');
 assert.equal(await (await offline.fetch('https://example.test/pvz/assets/original/plant_water.mp3'))!.text(),'asset');assert.equal(offline.requests(),1,'navigation checks the network before its offline fallback');
 assert.equal(await offline.fetch('https://example.test/kr3/'),undefined);assert.equal(await offline.fetch('https://another.test/pvz/','navigate'),undefined);
});
test('offline status reads one cache index and counts only current content revisions', async () => {
 saved.clear();
 const first = worker('a');
 await first.message('DOWNLOAD');
 const next = worker('b');
 const before = next.matches();
 const complete = (await next.message('STATUS')).at(-1);
 assert.equal(next.matches(), before);
 assert.equal(next.keyReads(), 1);
 assert.deepEqual([complete.count, complete.files, complete.bytes, complete.total], [2, 4, 30, 45]);
});

test('resuming a download opens only missing responses and preserves totals', async () => {
 saved.clear();
 const installed = worker('a');
 await installed.message('DOWNLOAD');
 const update = worker('b');
 const final = (await update.message('DOWNLOAD')).at(-1);
 assert.equal(update.keyReads(), 1);
 assert.equal(update.matches(), 2);
 assert.equal(update.requests(), 2);
 assert.deepEqual([final.count, final.files, final.bytes, final.total], [4, 4, 45, 45]);
 const again = (await update.message('DOWNLOAD')).at(-1);
 assert.equal(update.matches(), 2);
 assert.equal(update.requests(), 2);
 assert.equal(again.count, 4);
});

test('download reports the complete byte and file totals even when progress updates are throttled', async () => {
 saved.clear();
 const messages = await worker('a', true, 'asset', 200, () => 0).message('DOWNLOAD');
 const progress = messages.filter(message => message.type === 'progress');
 const final = messages.at(-1);
 assert.equal(progress.length, 1);
 assert.deepEqual(
  [final.type, final.count, final.files, final.bytes, final.total],
  ['done', 4, 4, 45, 45],
 );
});
test('cached audio supports browser byte ranges without a network', async () => {
 saved.clear();
 const first = worker('a', true, '0123456789');
 await first.message('DOWNLOAD');
 const offline = worker('a', false);
 const url = 'https://example.test/pvz/assets/original/plant_water.mp3';
 for (const [range, bounds, body] of [
  ['bytes=0-1', 'bytes 0-1/10', '01'],
  ['bytes=7-', 'bytes 7-9/10', '789'],
  ['bytes=-2', 'bytes 8-9/10', '89'],
 ]) {
  const response = (await offline.fetch(url, 'cors', range))!;
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), bounds);
  assert.equal(await response.text(), body);
 }
 const unavailable = (await offline.fetch(url, 'cors', 'bytes=10-'))!;
 assert.equal(unavailable.status, 416);
 assert.equal(unavailable.headers.get('Content-Range'), 'bytes */10');
 assert.equal(offline.requests(), 0);
});
test('cold online audio forwards the Range request and never caches the partial response', async()=>{
 const callbacks=new Map<string,(event:any)=>void>();
 const self={location:{href:'https://example.test/pvz/sw.js'},addEventListener:(type:string,fn:(event:any)=>void)=>callbacks.set(type,fn)};
 const url='https://example.test/pvz/assets/music/day.mp3';
 const request=new Request(url,{headers:{Range:'bytes=0-1'}});
 const expected=new Response('01',{status:206,headers:{'Content-Range':'bytes 0-1/10'}});
 runInNewContext(source,{self,URL,ASSETS:{'assets/music/day.mp3':{revision:'a',size:10}},SHELL:[],RELEASE:'a',
  caches:{open:async()=>({match:async()=>undefined,put:async()=>assert.fail('partial response entered offline cache')})},
  fetch:async(input:Request)=>{assert.equal(input,request);return expected;},
 });
 let pending:Promise<Response>|undefined;
 callbacks.get('fetch')!({request,respondWith:(response:Promise<Response>)=>{pending=response;}});
 assert.equal(await pending,expected);
 assert.equal(await expected.text(),'01');
});
test('an origin without Range support still returns a playable probe on a cold cache', async()=>{
 saved.clear();
 const app=worker('a',true,'0123456789');
 const resource=await app.fetch('https://example.test/pvz/assets/original/plant_water.mp3','cors','bytes=0-1');
 assert.equal(resource?.status,206);
 assert.equal(resource.headers.get('Content-Range'),'bytes 0-1/10');
 assert.equal(await resource.text(),'01');
 assert.equal((await app.message('STATUS')).at(-1).count,0);
});
test('a known-length audio response streams the requested slice before the origin finishes', {timeout:1000}, async()=>{
 for(const [range,expected,bounds] of [['bytes=0-1','01','bytes 0-1/10'],['bytes=3-5','345','bytes 3-5/10']]){
  const callbacks=new Map<string,(event:any)=>void>();
  const self={location:{href:'https://example.test/pvz/sw.js'},addEventListener:(type:string,fn:(event:any)=>void)=>callbacks.set(type,fn)};
  const request=new Request('https://example.test/pvz/assets/music/day.mp3',{headers:{Range:range}});
  let pulled=0,cancelled=false;
  const sourceBody=new ReadableStream({
   pull(controller){
    if(pulled===2)return new Promise<void>(()=>{});
    controller.enqueue(new TextEncoder().encode(pulled++===0?'0123':'4567'));
   },
   cancel(){cancelled=true;},
  });
  runInNewContext(source,{self,URL,Response,ReadableStream,ASSETS:{'assets/music/day.mp3':{revision:'a',size:10}},SHELL:[],RELEASE:'a',
   caches:{open:async()=>({match:async()=>undefined})},
   fetch:async()=>new Response(sourceBody,{headers:{'Content-Length':'10','Content-Type':'audio/mpeg'}}),
  });
  let pending!:Promise<Response>;
  callbacks.get('fetch')!({request,respondWith:(response:Promise<Response>)=>{pending=response;}});
  const response=await pending;
  assert.equal(response.status,206);
  assert.equal(response.headers.get('Content-Range'),bounds);
  assert.equal(await response.text(),expected);
  assert.equal(cancelled,true);
 }
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

test('simultaneous requests for the same uncached asset share a single download', async () => {
 saved.clear();
 const app = worker();
 const url = 'https://example.test/pvz/assets/game.js';
 const responses = await Promise.all([app.fetch(url), app.fetch(url)]);
 assert.deepEqual(await Promise.all(responses.map(response => response!.text())), ['asset', 'asset']);
 assert.equal(app.requests(), 1);
});

test('a failed shared download is retried and the successful response is cached', async () => {
 saved.clear();
 let status = 503;
 const app = worker('a', true, 'asset', () => status);
 const url = 'https://example.test/pvz/assets/game.js';
 const failed = await Promise.allSettled([app.fetch(url), app.fetch(url)]);
 assert.deepEqual(failed.map(result => result.status), ['rejected', 'rejected']);
 assert.equal(app.requests(), 1);
 status = 200;
 assert.equal(await (await app.fetch(url))!.text(), 'asset');
 assert.equal(await (await app.fetch(url))!.text(), 'asset');
 assert.equal(app.requests(), 2);
});

test('a publish race cannot cache the new HTML shell under an earlier release', async () => {
 saved.clear();
 const next = '<meta name="pvz-worker" content="sw-b.js">';
 const stale = worker('a', true, next, 200, Date.now, url=>url.pathname.endsWith('/index.html')?'text/html; charset=utf-8':undefined);
 await assert.rejects(stale.install(), /shell does not belong to release a/);
 const old = '<meta name="pvz-worker" content="sw-a.js">';
 const cache = [...saved.values()][0];
 assert.ok(!cache.has('https://example.test/pvz/index.html?__pvz_revision=a'));
 cache.set('https://example.test/pvz/index.html?__pvz_revision=a',new Response(old,{headers:{'Content-Type':'text/html'}}));
 await assert.doesNotReject(worker('a',true).install());
 assert.equal(await (await worker('a',false).fetch('https://example.test/pvz/','navigate'))!.text(),old);
});

test('HTML fallback never replaces an asset and an older bad cache entry is recoverable', async () => {
 saved.clear();
 const url = 'https://example.test/pvz/assets/game.js';
 const html = '<html>New release</html>';
 const fallback = worker('a',true,html,200,Date.now,'text/html');
 await assert.rejects(fallback.fetch(url),/expected an asset, received HTML/);
 assert.equal((await fallback.message('STATUS')).at(-1).count,0);
 [...saved.values()][0].set(url+'?__pvz_revision=a',new Response(html,{headers:{'Content-Type':'text/html'}}));
 const next = worker('a',true,'export {};',200,Date.now,'text/javascript');
 assert.equal(await (await next.fetch(url))!.text(),'export {};');
 assert.equal(await (await worker('a',false).fetch(url))!.text(),'export {};');
});

test('install reuses the HTTP cache for fingerprinted bundles and revalidates stable URLs',async()=>{
 const handlers=new Map<string,(event:any)=>void>();
 const self={location:{href:'https://example.test/sw.js'},addEventListener:(type:string,handler:any)=>handlers.set(type,handler)};
 const caches={open:async()=>({match:async()=>undefined,put:async()=>{}})};
 const shell=['index.html','manifest.webmanifest','assets/index-CioW3m0_.js','assets/index-LFTCN5sT.css','icons/icon-192.png'];
 const requests=new Map<string,RequestCache>();
 runInNewContext(source,{self,caches,URL,
  ASSETS:Object.fromEntries(shell.map(name=>[name,{revision:'a',size:1}])),SHELL:shell,RELEASE:'a',
  fetch:async(url:URL,options:RequestInit)=>{
   requests.set(url.pathname.slice(1),options.cache!);
   return new Response('asset');
  },
 });
 let completion!:Promise<unknown>;
 handlers.get('install')!({waitUntil:(promise:Promise<unknown>)=>{completion=promise;}});
 await completion;
 for(const path of shell)assert.equal(requests.get(path),path==='index.html'?'no-store':path.startsWith('assets/')?'force-cache':'no-cache',path);
});
