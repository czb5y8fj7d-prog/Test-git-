/* =====================================================================
   sw.js — service worker de LocalLM
   ---------------------------------------------------------------------
   Rôle : permettre l'usage hors ligne après le premier chargement.
   - Coquille de l'app (HTML/CSS/JS/icônes) : réseau d'abord, cache en secours.
   - Code des moteurs (CDN jsDelivr) : cache d'abord (versions épinglées).
   - Poids des modèles (Hugging Face) : NON interceptés ici. Les moteurs les
     stockent eux-mêmes (Cache API pour web-llm, cache interne pour wllama) ;
     les intercepter les stockerait en double et saturerait le stockage.
   Aucune donnée n'est envoyée nulle part : le SW ne fait que servir des
   fichiers déjà demandés par la page.
   ===================================================================== */

const VERSION = 'v2';                      // à incrémenter à chaque mise à jour
const SHELL = 'locallm-shell-' + VERSION;    // fichiers de l'app
const CDN = 'locallm-cdn-' + VERSION;        // code des moteurs
const CDN_HOSTS = ['cdn.jsdelivr.net', 'esm.run', 'unpkg.com', 'fastly.jsdelivr.net'];

const SHELL_FILES = [
  './', './index.html', './style.css', './app.js', './models.js', './manifest.json',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
];

/* Installation : pré-cache de la coquille (tolérant : un fichier manquant n'empêche pas l'install) */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map((f) => cache.add(f).catch(() => {})));
    await self.skipWaiting();
  })());
});

/* Activation : suppression des anciennes versions de NOS caches uniquement */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [SHELL, CDN];
    for (const k of await caches.keys()) {
      if (k.startsWith('locallm-') && !keep.includes(k)) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

/* Course entre une requête réseau et un délai */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

/* Réseau d'abord (4 s max), sinon cache : l'app reste fraîche mais fonctionne hors ligne */
async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req, { ignoreSearch: true }))
      || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    throw err;
  }
}

/* Cache d'abord : le code des moteurs ne change pas (version dans l'URL) */
async function cacheFirst(req) {
  const cache = await caches.open(CDN);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.status === 200) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  /* tout le reste (Hugging Face, etc.) passe directement au réseau */
});
