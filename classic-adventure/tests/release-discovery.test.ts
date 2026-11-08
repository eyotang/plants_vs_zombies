import test from'node:test';import assert from'node:assert/strict';
import{fetchLatestWorker}from'../src/platform/release-discovery';
const release='0123456789abcdef',worker=`sw-${release}.js`;
test('latest release uses a scoped network-only cache-busted request and validates its worker',async()=>{
 const original=globalThis.fetch;let url='',options:RequestInit|undefined;
 globalThis.fetch=async(input,init)=>{url=String(input);options=init;return new Response(JSON.stringify({release,worker}));};
 try{assert.equal(await fetchLatestWorker(new URL('https://example.test/garden/')),worker);const request=new URL(url);assert.equal(request.origin,'https://example.test');assert.equal(request.pathname,'/garden/release.json');assert.ok(request.searchParams.has('__pvz_check'));assert.equal(options?.cache,'no-store');assert.ok(options?.signal);}finally{globalThis.fetch=original;}
});
test('unavailable,malformed,mismatched and external worker releases never register',async()=>{
 const original=globalThis.fetch;
 try{for(const payload of[{release,worker:'https://other.test/sw.js'},{release,worker:'../sw-0123456789abcdef.js'},{release:'fedcba9876543210',worker},{release,worker:'sw.js'},null]){globalThis.fetch=async()=>new Response(JSON.stringify(payload));await assert.rejects(fetchLatestWorker(new URL('https://example.test/garden/')));}globalThis.fetch=async()=>new Response('unavailable',{status:503});await assert.rejects(fetchLatestWorker(new URL('https://example.test/garden/')));globalThis.fetch=async()=>new Response('<html>login</html>');await assert.rejects(fetchLatestWorker(new URL('https://example.test/garden/')));}finally{globalThis.fetch=original;}
});
test('a stalled discovery has a bounded15second deadline and clears its timer',async()=>{
 const originalFetch=globalThis.fetch,originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;let deadline=0,expire:(()=>void)|undefined,cleared=false;
 globalThis.setTimeout=((fn:()=>void,ms:number)=>{expire=fn;deadline=ms;return 123;})as unknown as typeof setTimeout;globalThis.clearTimeout=(()=>{cleared=true;})as typeof clearTimeout;
 globalThis.fetch=async(_input,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('aborted'))));
 try{const pending=fetchLatestWorker(new URL('https://example.test/garden/'));assert.equal(deadline,15000);expire!();await assert.rejects(pending);assert.equal(cleared,true);}finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
});
