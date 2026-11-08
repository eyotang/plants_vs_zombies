import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import metadata from '../docs/combat-audio.json';import {soundFiles} from '../src/platform/audio-plan';import {Game} from '../src/game/model';
test('five classic combat clips have traceable hashes and add less than 32 KiB',()=>{
 assert.equal(metadata.commit,'325b2229a7225d73870bb69322eefcda3a45bf8d');assert.equal(metadata.files.length,5);
 let bytes=0;for(const file of metadata.files){const data=readFileSync(new URL('../public/assets/original/'+file.file,import.meta.url));assert.equal(data.length,file.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);bytes+=data.length;}
 assert.ok(bytes<32768);
 const files=soundFiles(new Game(1,1));assert.deepEqual([files.shoot,files.shoot2,files.hit,files.hit2,files.hit3],metadata.files.map(f=>f.file));
 assert.deepEqual(metadata.variants.shoot,['throw','throw','throw','throw2']);assert.deepEqual(metadata.variants.hit,['splat','splat2','splat3']);
});
