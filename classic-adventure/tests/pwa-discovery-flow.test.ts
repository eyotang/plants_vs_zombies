import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const old='https://example.test/garden/sw-1111111111111111.js', latest='https://example.test/garden/sw-2222222222222222.js';
const source=ts.transpileModule(readFileSync(new URL('../src/platform/pwa.ts',import.meta.url),'utf8').replace("import { fetchLatestWorker } from './release-discovery';",'').replaceAll('import.meta.env.PROD','true').replaceAll('import.meta.env.BASE_URL',"'./'"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/export /g,'');
function fixture(discover:()=>Promise<string>,existing=true){
 const nodes=new Map<string,any>(),events=new Map<string,()=>void>(),workerEvents=new Map<string,()=>void>();
 const node=(id:string):any=>{if(!nodes.has(id))nodes.set(id,{hidden:true,disabled:true,textContent:'',append(){},addEventListener(){},setAttribute(){},querySelector:(selector:string)=>node(selector),showModal(){},close(){}});return nodes.get(id);};
 const reg:any={scope:'https://example.test/garden/',active:{scriptURL:old,postMessage(){}},waiting:null,installing:null,addEventListener:(name:string,fn:()=>void)=>workerEvents.set(name,fn)};
 const calls:string[]=[];let reloads=0,activated=0;
 const context:any={URL,WeakSet,Date,Promise,MessageChannel:class{port1={close(){},set onmessage(fn:any){queueMicrotask(()=>fn({data:{type:'done',bytes:0,total:1,count:0,files:1,release:'1111111111111111'}}));}};port2={};},location:{href:'https://example.test/garden/',reload:()=>reloads++},document:{body:node('body'),createElement:(tag:string)=>node(tag),querySelector:()=>({content:'sw-1111111111111111.js'}),addEventListener:(name:string,fn:()=>void)=>events.set(name,fn)},window:{addEventListener:(name:string,fn:()=>void)=>events.set(name,fn)},navigator:{serviceWorker:{controller:{},getRegistration:async()=>existing?reg:undefined,ready:Promise.resolve(reg),addEventListener(){},register:async(url:string)=>{calls.push(url);reg.installing={scriptURL:url,state:'installing',addEventListener:(name:string,fn:()=>void)=>workerEvents.set('worker-'+name,fn)};return reg;}}},fetchLatestWorker:discover};
 runInNewContext(source,context);
 return{context,reg,calls,nodes,events,reloads:()=>reloads,activated:()=>activated,install(){reg.installing.state='installed';reg.installing.postMessage=()=>activated++;reg.waiting=reg.installing;reg.installing=null;workerEvents.get('worker-statechange')!();}};
}
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
test('cached old shell discovers new worker without downgrade, blocking scene, or automatic reload',async()=>{
 let finish!:(value:string)=>void,checks=0;
 const f=fixture(()=>{checks++;return new Promise(resolve=>finish=resolve);});
 await f.context.registerPwa();assert.equal(checks,1);assert.equal(f.calls.length,0,'reuse the existing exact-scope registration');
 f.events.get('online')!();f.events.get('pageshow')!();f.events.get('visibilitychange')!();assert.equal(checks,1,'foreground events share the pending request');
 finish('sw-2222222222222222.js');await settle();assert.deepEqual(f.calls,[latest]);assert.equal(f.reloads(),0);
 f.install();assert.equal(f.nodes.get('aside').hidden,false);assert.equal(f.activated(),0,'discovery never activates a waiting worker');
 f.nodes.get('#update-now').onclick();assert.equal(f.activated(),1);
 f.events.get('pageshow')!();await settle();assert.equal(checks,1,'no rapid foreground polling');
});
test('offline discovery keeps the installed game and explicit check reports a recoverable failure',async()=>{
 const f=fixture(async()=>{throw new Error('offline');});await f.context.registerPwa();await settle();
 assert.equal(f.calls.length,0);assert.equal(f.reloads(),0);
 await f.nodes.get('#pwa-update').onclick();assert.match(f.nodes.get('#pwa-release').textContent,/游戏仍可继续/);
});
test('a missing obsolete first-install worker does not prevent independent release discovery',async()=>{
 const f=fixture(async()=>'sw-2222222222222222.js',false);const original=f.context.navigator.serviceWorker.register;
 f.context.navigator.serviceWorker.register=async(url:string)=>{if(url===old)throw new Error('404 obsolete worker');return original(url);};
 await f.context.registerPwa();await settle();assert.deepEqual(f.calls,[latest]);
});
