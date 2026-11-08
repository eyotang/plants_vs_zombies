import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'vite';
import {pwa} from '../tools/build-pwa';
import {createHash} from 'node:crypto';

test('each actual built entry has an independent worker URL and the legacy alias stays compatible',async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'pvz-pwa-build-')));
 try {
  await mkdir(join(root,'src'));await mkdir(join(root,'dist'));await writeFile(join(root,'index.html'),'<html><head><script type="module" src="/src/main.js"></script></head><body></body></html>');
  const workers:string[]=[];
  await mkdir(join(root,'public/assets/runtime'),{recursive:true});
  for(const [version,art] of [[1,1],[2,1],[2,2]]){
   await writeFile(join(root,'src/main.js'),`document.title='release ${version}';`);
   await writeFile(join(root,'public/assets/runtime/fixture.json'),JSON.stringify({art}));
   await build({root,configFile:false,logLevel:'silent',plugins:[pwa()],build:{outDir:'dist'}});
   const html=await readFile(join(root,'dist/index.html'),'utf8');
   const entry=html.match(/src="([^"]+\.js)"/)![1];const name=html.match(/name="pvz-worker" content="([^"]+)"/)![1];
   const body=await readFile(join(root,'dist',name),'utf8');
   assert.equal(body,await readFile(join(root,'dist/sw.js'),'utf8'));
   assert.ok(body.includes(entry.replace(/^\//,'')),'worker includes the matching entry in its shell');workers.push(name);
   const assets=JSON.parse(body.slice(body.indexOf('ASSETS=')+7,body.indexOf(',SHELL=')));
   const manifest=JSON.parse(await readFile(join(root,'dist/release.json'),'utf8'));
   assert.deepEqual(manifest,{release:name.slice(3,-3),worker:name});
   assert.equal(assets['release.json'],undefined,'release discovery must never be cached with an old shell');
   assert.equal(assets['index.html'].revision,createHash('sha256').update(html).digest('hex'),'offline shell hash includes the final worker metadata');
  }
  assert.notEqual(workers[0],workers[1],'a new entry must not reuse a stale edge-cache key');
  assert.notEqual(workers[1],workers[2],'an art-only update must also receive an independent worker URL');
 } finally {await rm(root,{recursive:true,force:true});}
});
