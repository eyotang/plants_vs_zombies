// This URL stays outside the offline asset cache so an old shell can discover a new release.
export async function fetchLatestWorker(base: URL): Promise<string> {
  const url = new URL('release.json', base);
  url.searchParams.set('__pvz_check', String(Date.now()));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`Release HTTP ${response.status}`);
    const value = await response.json();
    const match = typeof value?.worker === 'string' && /^sw-([a-f0-9]{16})\.js$/.exec(value.worker);
    if (!match || value.release !== match[1]) throw new Error('Invalid release');
    return value.worker;
  } finally { clearTimeout(timer); }
}
