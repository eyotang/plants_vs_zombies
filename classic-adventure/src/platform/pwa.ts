import { fetchLatestWorker } from './release-discovery';
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
type Status = { type: string; bytes: number; total: number; count: number; files: number; release: string; message?: string };
let registration: ServiceWorkerRegistration;
let installPrompt: InstallPrompt | undefined;
let reloadRequested = false;
const scope = new URL(import.meta.env.BASE_URL, location.href);
let desiredWorker = new URL(document.querySelector<HTMLMetaElement>('meta[name="pvz-worker"]')?.content ?? 'sw.js', scope).href;
const observedRegistrations = new WeakSet<ServiceWorkerRegistration>();
const observedWorkers = new WeakSet<ServiceWorker>();
let checking: Promise<void> | undefined;
let lastCheck = -Infinity;
const waitingUpdate = () => registration?.waiting?.scriptURL === desiredWorker;
let message = import.meta.env.PROD ? '正在准备离线服务…' : '开发预览不启用缓存；请使用生产预览测试安装和离线。';
const dialog = document.createElement('dialog');
dialog.className = 'pwa-panel';
dialog.innerHTML = `<img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="豌豆射手应用图标"/><h2>把庭院带到桌面</h2><p>安装后可从桌面直接打开。iPhone 请使用浏览器分享菜单中的“添加到主屏幕”。</p><button id="pwa-install" disabled>使用浏览器的安装菜单</button><p>首次离线游玩前，下载全部高清素材和音效。存档仍保留在当前浏览器。</p><p id="pwa-status" role="status"></p><progress id="pwa-progress" value="0" max="1"></progress><button id="pwa-download" disabled>下载离线资源</button><button id="pwa-update" disabled>检查更新</button><p id="pwa-release" role="status"></p><button id="pwa-close">返回</button>`;
document.body.append(dialog);
// A waiting release is offered above the game; activation remains an explicit click.
const updateNotice = document.createElement('aside');
updateNotice.className = 'update-notice'; updateNotice.hidden = true;
updateNotice.setAttribute('aria-label', '游戏更新');
updateNotice.innerHTML = '<div><strong>庭院有新消息！</strong><span>新版已就绪 · 点击后重新加载游戏</span></div><button class="wood-button" id="update-now">立即更新</button><button class="wood-button" id="update-later">稍后</button>';
document.body.append(updateNotice);
function offerUpdate() {
  button('pwa-update').textContent = '更新并重新加载';
  release.textContent = '新版已准备好，点击更新后重新加载。';
  updateNotice.hidden = false;
}
function activateUpdate() {
  if (!waitingUpdate()) { location.reload(); return; }
  reloadRequested = true; registration.waiting!.postMessage('ACTIVATE');
}
updateNotice.querySelector<HTMLButtonElement>('#update-now')!.onclick = activateUpdate;
updateNotice.querySelector<HTMLButtonElement>('#update-later')!.onclick = () => { updateNotice.hidden = true; };
// Fullscreen only paints descendants of the fullscreen element.
document.addEventListener('fullscreenchange', () => {
  (document.fullscreenElement ?? document.body).append(updateNotice, dialog);
});

const button = (id: string) => dialog.querySelector<HTMLButtonElement>(`#${id}`)!;
const status = dialog.querySelector<HTMLElement>('#pwa-status')!;
const release = dialog.querySelector<HTMLElement>('#pwa-release')!;
const progress = dialog.querySelector<HTMLProgressElement>('#pwa-progress')!;
const showStatus = (text: string) => { message = text; status.textContent = text; };
const size = (n: number) => `${(n / 1048576).toFixed(1)} MiB`;
function renderStatus(value: Status) {
  progress.max = value.total; progress.value = value.bytes;
  showStatus(value.count === value.files ? `离线资源已就绪 · ${size(value.bytes)}` : `已缓存 ${value.count}/${value.files} 项 · ${size(value.bytes)} / ${size(value.total)}`);
  release.textContent = `当前版本 ${value.release}${waitingUpdate() ? ' · 新版本已就绪' : ''}`;
}
function request(action: 'DOWNLOAD' | 'STATUS') {
  return new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }: MessageEvent<Status>) => {
      if (data.type === 'error') { channel.port1.close(); reject(new Error(data.message)); return; }
      renderStatus(data);
      if (data.type === 'done') { channel.port1.close(); resolve(); }
    };
    registration.active!.postMessage(action, [channel.port2]);
  });
}
button('pwa-close').onclick = () => dialog.close();
dialog.addEventListener('keydown', event => event.stopPropagation());
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event as InstallPrompt; button('pwa-install').disabled = false; button('pwa-install').textContent = '安装到桌面'; });
window.addEventListener('appinstalled', () => { installPrompt = undefined; button('pwa-install').disabled = true; button('pwa-install').textContent = '已安装到桌面'; });
button('pwa-install').onclick = async () => { await installPrompt!.prompt(); await installPrompt!.userChoice; installPrompt = undefined; button('pwa-install').disabled = true; };
button('pwa-download').onclick = async () => {
  button('pwa-download').disabled = true;
  try { await request('DOWNLOAD'); } catch (error) { showStatus(`离线资源下载失败：${String(error)}`); }
  finally { button('pwa-download').disabled = false; }
};
button('pwa-update').onclick = async () => {
  try {
    if (waitingUpdate()) { activateUpdate(); return; }
    release.textContent = '正在检查更新…';
    await checkRelease(true);
    if (waitingUpdate()) offerUpdate();
    else release.textContent = registration?.installing ? '正在准备新版，准备好后会提示。' : '当前已是最新版本。';
  } catch { release.textContent = '暂时无法检查更新，游戏仍可继续。'; }
};
function observe(worker: ServiceWorker) {
  if (observedWorkers.has(worker)) return;
  observedWorkers.add(worker);
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller && waitingUpdate()) offerUpdate();
  });
}
function useRegistration(value: ServiceWorkerRegistration) {
  registration = value;
  if (value.installing) observe(value.installing);
  if (!observedRegistrations.has(value)) {
    observedRegistrations.add(value);
    value.addEventListener('updatefound', () => { if (value.installing) observe(value.installing); });
  }
  button('pwa-update').disabled = false;
  if (waitingUpdate()) offerUpdate();
}
function checkRelease(force = false): Promise<void> {
  if (checking) return checking;
  if (!force && Date.now() - lastCheck < 60000) return Promise.resolve();
  lastCheck = Date.now();
  checking = (async () => {
    const worker = new URL(await fetchLatestWorker(scope), scope).href;
    desiredWorker = worker;
    if (!waitingUpdate()) {
      updateNotice.hidden = true;
      button('pwa-update').textContent = '检查更新';
    }
    if (![registration?.active, registration?.waiting, registration?.installing].some(value => value?.scriptURL === worker)) {
      useRegistration(await navigator.serviceWorker.register(worker, { scope: scope.href, updateViaCache: 'none' }));
    }
    if (waitingUpdate()) offerUpdate();
  })().finally(() => { checking = undefined; });
  return checking;
}
export async function registerPwa() {
  if (!import.meta.env.PROD) return;
  try {
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadRequested) location.reload(); });
    const existing = await navigator.serviceWorker.getRegistration(scope.href);
    if (existing?.scope === scope.href) useRegistration(existing);
    else useRegistration(await navigator.serviceWorker.register(desiredWorker, { scope: scope.href, updateViaCache: 'none' }));
  } catch (error) { showStatus(`离线服务启动失败：${String(error)}`); }
  // Discovery runs independently of cached navigation and never delays the game scene.
  const backgroundCheck = () => { void checkRelease().catch(() => {}); };
  window.addEventListener('online', backgroundCheck);
  window.addEventListener('pageshow', backgroundCheck);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) backgroundCheck(); });
  backgroundCheck();
  try {
    await navigator.serviceWorker.ready;
    button('pwa-download').disabled = false; button('pwa-update').disabled = false;
    if (waitingUpdate()) offerUpdate();
    if (registration?.active) await request('STATUS');
  } catch (error) { showStatus(`离线服务启动失败：${String(error)}`); }
}
export function showPwa() { status.textContent = message; dialog.showModal(); if (registration?.active) void request('STATUS').catch(error => showStatus(String(error))); }
