// RELEASE, ASSETS and SHELL are supplied by the build plugin.
const ROOT = new URL('./', self.location.href);
const CACHE = 'pvz-web:pwa:files-v1:' + ROOT.pathname;
const files = Object.keys(ASSETS);
const paths = new Map(files.map(path => [new URL(path, ROOT).pathname, path]));
const total = files.reduce((sum, path) => sum + ASSETS[path].size, 0);
const key = path => { const url = new URL(path, ROOT); url.searchParams.set('__pvz_revision', ASSETS[path].revision); return url.href; };
const cacheReady = caches.open(CACHE);
const inFlight = new Map();
function isHtml(response) {
  const contentType = response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  return contentType === 'text/html';
}
async function checkHtml(path, response) {
  if (path !== 'index.html') throw new Error(`${path}: expected an asset, received HTML`);
  const shell = await response.clone().text();
  if (!shell.includes(`<meta name="pvz-worker" content="sw-${RELEASE}.js">`))
    throw new Error(`${path}: shell does not belong to release ${RELEASE}`);
}
async function cachedFile(path, background, priority = 'auto') {
  const cache = await cacheReady, revisionKey = key(path), stored = await cache.match(revisionKey);
  if (stored) {
    if (!isHtml(stored)) return stored;
    try { await checkHtml(path, stored); return stored; }
    catch { /* A valid response replaces the unusable cache entry. */ }
  }
  let pending = inFlight.get(path);
  if (!pending) {
    pending = (async () => {
      // The entry and its imports already passed through the browser HTTP cache
      // before a cold install. Vite changes their names when their content changes.
      const immutable = /^assets\/[^/]+-[\w-]{8}\.(?:js|css)$/.test(path);
      // A reused Last-Modified value can revalidate an older shell for a new release.
      const cacheMode = path === 'index.html' ? 'no-store' : immutable ? 'force-cache' : 'no-cache';
      const response = await fetch(new URL(path, ROOT), { cache: cacheMode, priority });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      if (isHtml(response)) await checkHtml(path, response);
      const write = cache.put(revisionKey, response.clone());
      const clear = () => inFlight.delete(path);
      void write.then(clear, clear);
      return { response, write };
    })();
    inFlight.set(path, pending);
    void pending.catch(() => inFlight.delete(path));
  }
  const { response, write } = await pending;
  if (background) background(write); else await write;
  return response.clone();
}
// Installing the offline shell can overlap the player's first visit to the lawn.
self.addEventListener('install', event => event.waitUntil(Promise.all(SHELL.map(path => cachedFile(path, null, 'low')))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function navigation(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(request, { cache: 'no-store', signal: controller.signal });
    if (response.ok) return response;
  } catch {} finally { clearTimeout(timer); }
  // Keep the installed shell paired with its own assets for offline use.
  return cachedFile('index.html', null);
}
function sliceAudioStream(body, start, end) {
  const reader = body.getReader();
  let position = 0;
  return new ReadableStream({
    async pull(controller) {
      while (position <= end) {
        const result = await reader.read();
        if (result.done) throw new Error('Audio range ended before the expected length');
        const offset = position;
        position += result.value.byteLength;
        if (position <= start) continue;
        controller.enqueue(result.value.subarray(Math.max(0, start - offset), end + 1 - offset));
        if (position > end) {
          controller.close();
          void reader.cancel().catch(() => {});
        }
        return;
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

async function audioRange(path, range, request) {
  const cache = await cacheReady;
  let response = await cache.match(key(path));
  if (!response || isHtml(response)) {
    // Preserve the browser's Range request on a cold cache so online music
    // can stream immediately. Partial responses never enter the offline cache.
    response = await fetch(request);
    if (response.status !== 200) return response;
    if (isHtml(response)) await checkHtml(path, response);
  }
  // WorkBuddy and some static preview servers ignore Range. If the length is
  // known, slice the response stream and stop reading once the range is sent.
  const length = response.headers.get('Content-Length');
  const encoding = response.headers.get('Content-Encoding');
  const knownLength = response.body && length !== null && /^\d+$/.test(length) &&
    Number.isSafeInteger(Number(length)) && (!encoding || encoding === 'identity');
  const audio = knownLength ? null : await response.blob();
  const size = audio?.size ?? Number(length);
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
  const headers = { 'Accept-Ranges': 'bytes' };
  if (start >= size || end < start) {
    if (!audio) void response.body.cancel().catch(() => {});
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  }
  const body = audio ? audio.slice(start, end + 1)
    : start === 0 && end === size - 1 ? response.body : sliceAudioStream(response.body, start, end);
  return new Response(body, {
    status: 206,
    headers: {
      ...headers,
      'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
    },
  });
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== ROOT.origin) return;
  if (url.pathname === new URL('release.json', ROOT).pathname) return;
  if (event.request.mode === 'navigate' && (url.pathname === ROOT.pathname || url.pathname === new URL('index.html', ROOT).pathname)) {
    event.respondWith(navigation(event.request));
    return;
  }
  const path = paths.get(url.pathname);
  const range = event.request.headers?.get('Range');
  if (path && range && /\.(mp3|ogg|wav)$/.test(path)) {
    const bytes = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (bytes && (bytes[1] || bytes[2])) event.respondWith(audioRange(path, bytes, event.request));
    return;
  }
  if (path) event.respondWith(cachedFile(path, write => event.waitUntil(write)));
});
self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE') { event.waitUntil(self.skipWaiting()); return; }
  const port = event.ports[0];
  if (event.data !== 'DOWNLOAD' && event.data !== 'STATUS') return;
  event.waitUntil((async () => {
    try {
      const cache = await cacheReady;
      let bytes = 0, count = 0;
      const downloading = event.data === 'DOWNLOAD';
      const stored = downloading ? new Set() : undefined;
      // Most visitors have only a small part of the optional pack in this cache.
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        const path = paths.get(url.pathname);
        if (!path || url.origin !== ROOT.origin || url.search !== '?__pvz_revision=' + ASSETS[path].revision) continue;
        stored?.add(path);
        bytes += ASSETS[path].size;
        count++;
      }
      const missing = stored ? files.filter(path => !stored.has(path)) : [];
      let lastProgress = -Infinity;
      for (let start = 0; start < missing.length; start += 4) {
        const results = await Promise.allSettled(missing.slice(start, start + 4).map(async path => {
          await cachedFile(path, null);
          bytes += ASSETS[path].size;
          count++;
          const now = Date.now();
          if (now - lastProgress >= 100) {
            lastProgress = now;
            port.postMessage({ type: 'progress', bytes, total, count, files: files.length, release: RELEASE });
          }
        }));
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
      }
      port.postMessage({ type: 'done', bytes, total, count, files: files.length, release: RELEASE });
    } catch (error) { port.postMessage({ type: 'error', message: String(error) }); }
  })());
});
