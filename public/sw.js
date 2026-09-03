// REZO360 — Service Worker PWA (Offline & Fast Boot)
//
// v1 -> v2 : la bibliothèque d'avatars a été entièrement remplacée (50 SVG à
// la place de 12 JPG). La stratégie « cache d'abord » ci-dessous ne revalide
// jamais une entrée existante : sans changement de nom, un appareil ayant
// déjà mis en cache l'ancienne bibliothèque aurait continué de la servir
// indéfiniment. `activate` supprime tout compartiment dont le nom ne
// correspond pas à celui-ci.
const CACHE_NAME = 'rezo360-pwa-v2';

const STATIC_ASSETS = [
  '/',
  '/favicon.svg',
  '/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Ignore les requêtes non-GET ou externes aux APIs
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Pour les requêtes de navigation (HTML) : Network First avec repli Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.open(CACHE_NAME).then((cache) => cache.match('/') || cache.match(event.request));
      })
    );
    return;
  }

  // ───────────────────────────────────────────────────────────────────────
  // `caches.match()` GLOBAL CHERCHE DANS TOUS LES COMPARTIMENTS DE L'ORIGINE,
  // PAS SEULEMENT CELUI DE LA VERSION ACTIVE.
  //
  // C'est la faille qui a laissé le défaut des avatars survivre au
  // changement de nom v1 → v2. `activate` supprime bien l'ancien
  // compartiment — mais tant que cette suppression n'est pas terminée
  // (navigation concurrente, worker qui tarde à s'activer), ou si elle
  // échoue pour une raison quelconque, une requête `fetch` peut encore
  // tomber sur une entrée du VIEUX compartiment via cette recherche globale,
  // alors même que le nouveau service worker est déjà actif et croit
  // travailler avec un cache neuf.
  //
  // La lecture est donc bornée explicitement à `CACHE_NAME` : un
  // compartiment orphelin, aussi longtemps qu'il traîne, ne peut plus jamais
  // être consulté ni compléter une réponse.
  // ───────────────────────────────────────────────────────────────────────
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(event.request)).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }

        // NE JAMAIS METTRE EN CACHE UNE PAGE HTML SOUS UNE URL D'ASSET.
        //
        // Un serveur SPA répond `200 text/html` — l'`index.html` de repli —
        // pour toute URL de fichier absente, y compris
        // `/avatars/avatar-99.svg`. Mesuré sur ce projet : statut 200,
        // `text/html`, 5078 octets.
        //
        // Le générateur d'avatars SUPPRIME les 50 fichiers avant de les
        // réécrire. Une requête tombant dans cette fenêtre reçoit donc du
        // HTML avec un statut 200 — que l'ancienne version de ce fichier
        // mettait en cache sans broncher, l'extension `.svg` suffisant à
        // déclencher la mise en cache.
        //
        // Sans ce contrôle, ce repli serait mis en cache SOUS L'URL DE
        // L'IMAGE, et resterait ensuite servi à la place du vrai fichier même
        // après correction du serveur — une image définitivement cassée, que
        // plus rien côté serveur ne pourrait réparer.
        const typeRecu = networkResponse.headers.get('content-type') ?? '';
        const replSPA = typeRecu.includes('text/html');

        // Cache uniquement les fichiers légers d'assets
        if (!replSPA && url.pathname.match(/\.(svg|png|jpg|jpeg|webp|woff2?|css|js)$/)) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkResponse;
      });
    })
  );
});
