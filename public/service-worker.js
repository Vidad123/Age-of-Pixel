const CACHE='age-of-pixel-pwa-v1';
const CORE=['./','./index.html','./login.html','./register.html','./offline.html','./manifest.webmanifest','./assets/css/auth.css','./assets/css/dashboard.css','./assets/css/game.css','./assets/js/app.js','./assets/js/auth.js','./assets/js/guard.js','./assets/js/options.js','./assets/js/dashboard.js','./assets/js/game.js','./assets/img/crest.png','./assets/img/wordmark.png','./assets/img/app-icon-192.png','./assets/img/app-icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==location.origin||url.pathname.includes('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response}).catch(()=>caches.match(request).then(hit=>hit||caches.match('./offline.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response})));
});
