/* Parts Inventory — offline support.
   App files: network first (so a new version you upload to GitHub shows up as soon as you are online),
   falling back to the saved copy when offline. Google/Drive/Apps Script requests are never touched. */
const CACHE = 'pi-cache-v3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res=>{
      if(res && res.status===200){ const copy = res.clone(); caches.open(CACHE).then(c=>c.put(req, copy)); }
      return res;
    }).catch(()=>caches.match(req).then(hit=>hit || (req.mode==='navigate' ? caches.match('index.html') || caches.match('./') : Response.error())))
  );
});
