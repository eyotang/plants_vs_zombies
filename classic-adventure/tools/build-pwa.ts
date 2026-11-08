import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import type { Plugin } from 'vite';
import actorMotion from '../src/rendering/actor-motion-index.json';

const nativeClips = new Set(Object.keys(actorMotion));
// Serve old URLs to open clients, but new offline installs only need original-size textures.
export function compatibilityTexture(path:string) {
  if(!path.endsWith('.webp')||path.endsWith('.classic.webp'))return false;
  return /^assets\/runtime\/(?:actor-motion|plant-motion|giant-motion)\//.test(path)
    || path.startsWith('assets/runtime/boss/')&&path!=='assets/runtime/boss/background.webp';
}
function replacedAnimationPage(path: string): boolean {
  return path.startsWith('assets/runtime/clips/') && (
    nativeClips.has(path.slice(path.lastIndexOf('/') + 1).replace(/-\d+\.webp$/, '')) ||
    /\/(?:gargantuar-.+|peashooter|sunflower|threepeater|gatlingpea|twinsunflower|wintermelon|(?:cabbagepult|kernelpult|melonpult)(?:-attack)?)-\d+\.webp$/.test(path)
  );
}

// Same build-time shell/content revision split as KR, scoped to this game's assets.
export function pwa(): Plugin {
  let out: string;
  const startup = new Set<string>();
  return {
    name: 'pvz-pwa', apply: 'build',
    configResolved(config) { out = resolve(config.root, config.build.outDir); },
    generateBundle(_options, bundle) {
      const visit = (name: string) => {
        if (startup.has(name)) return;
        startup.add(name);
        const item = bundle[name];
        if (item.type === 'chunk') for (const dependency of item.imports) visit(dependency);
      };
      for (const item of Object.values(bundle)) if (item.type === 'chunk' && item.isEntry) visit(item.fileName);
    },
    async closeBundle() {
      const source = await readFile(new URL('./pwa-worker.js', import.meta.url), 'utf8');
      const files = (await readdir(out, { recursive: true, withFileTypes: true }))
        .filter(e => e.isFile()).map(e => relative(out, resolve(e.parentPath, e.name)).replaceAll('\\', '/'))
        .filter(p => p === 'index.html' || p === 'manifest.webmanifest' || p.startsWith('icons/') && p !== 'icons/icon-master.png'
          || /^assets\/[^/]+\.(js|css)$/.test(p) || p.startsWith('assets/runtime/') || (/^assets\/(original|music)\/[^/]+\.(mp3|ogg)$/.test(p)))
        // Retain old URLs on the server without downloading unused baked pages in new installs.
        .filter(p => !replacedAnimationPage(p) && !compatibilityTexture(p) && p !== 'assets/runtime/animations.json').sort();
      const assets: Record<string, { revision: string; size: number }> = {};
      for (const path of files) { const body = await readFile(resolve(out, path)); assets[path] = { revision: createHash('sha256').update(body).digest('hex'), size: body.length }; }
      const shell = files.filter(p => p === 'index.html' || p === 'manifest.webmanifest' || p.startsWith('icons/') || p.endsWith('.css') || startup.has(p));
      const release = createHash('sha256').update(source).update(JSON.stringify(assets)).digest('hex').slice(0, 16);
      const workerName = `sw-${release}.js`;
      const indexPath = resolve(out, 'index.html');
      const html = (await readFile(indexPath, 'utf8')).replace('</head>', `<meta name="pvz-worker" content="${workerName}"></head>`);
      await writeFile(indexPath, html);
      assets['index.html'] = { revision: createHash('sha256').update(html).digest('hex'), size: Buffer.byteLength(html) };
      const worker = `const RELEASE=${JSON.stringify(release)},ASSETS=${JSON.stringify(assets)},SHELL=${JSON.stringify(shell)};\n${source}`;
      await writeFile(resolve(out, workerName), worker);
      // Existing installations still check this URL. New pages use the independent hashed URL.
      await writeFile(resolve(out, 'sw.js'), worker);
      // Deliberately excluded from ASSETS: even a cached old shell must reach the server.
      await writeFile(resolve(out, 'release.json'), JSON.stringify({ release, worker: workerName }));
      console.log(`PWA ${release}: ${shell.length} startup files, ${files.length} offline files`);
    },
  };
}
