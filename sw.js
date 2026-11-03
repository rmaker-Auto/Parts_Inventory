/* Parts Inventory — offline support (v4).
   - The app page and its files are saved on the device the first time they load online.
   - Online: the newest version is fetched (waits at most 4 s on a slow/bad connection), then saved again.
   - Offline (or very slow): the saved copy opens instantly, so the app works with no internet.
   Google / Drive / Apps Script requests (other origins) are never touched. */
const CACHE = 'pi-cache-v4';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // one by one: a single missing file must not stop the others from being saved
    await Promise.all(SHELL.map(async u => {
      try {
        const r = await fetch(new Request(u, { cache: 'reload' }));
        if (r && r.ok) await c.put(u, r);
      } catch (err) { /* ignore */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function timedFetch(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

async function pageHandler(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await timedFetch(req, 4000);
    if (res && res.ok && res.type === 'basic') {
      cache.put('index.html', res.clone()).catch(() => {});
      cache.put('./', res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const hit = (await cache.match('index.html', { ignoreSearch: true }))
             || (await cache.match('./', { ignoreSearch: true }))
             || (await caches.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    return new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:24px;background:#0f1621;color:#fff"><h3>অফলাইন</h3><p>অ্যাপটি এই ডিভাইসে এখনো সেভ হয়নি। একবার ইন্টারনেট চালু করে অ্যাপটি খুলুন।</p></body>',
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function assetHandler(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await timedFetch(req, 4000);
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') e.respondWith(pageHandler(req));
  else e.respondWith(assetHandler(req));
});
