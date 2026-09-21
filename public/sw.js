// REZO360 — Service Worker PWA (Offline & Fast Boot)
//
// v1 -> v2 : la bibliothèque d'avatars a été entièrement remplacée (50 SVG à
// la place de 12 JPG). La stratégie « cache d'abord » ci-dessous ne revalide
// jamais une entrée existante : sans changement de nom, un appareil ayant
// déjà mis en cache l'ancienne bibliothèque aurait continué de la servir
// indéfiniment. `activate` supprime tout compartiment dont le nom ne
// correspond pas à celui-ci.
// v4 force l'abandon du shell v3 : celui-ci a pu conserver un index pointant
// vers des chunks supprimés au déploiement suivant.
// v5 force un nouveau téléchargement de la feuille principale : certains
// appareils ont conservé une réponse CSS défectueuse sous son ancienne URL
// pourtant déclarée immuable.
// v6 ne met plus les bundles CSS/JS en Cache Storage. Leur nom contient déjà
// une empreinte de contenu et le navigateur sait les mettre en cache : une
// seconde couche « cache d'abord » empêchait précisément leur récupération
// lorsqu'une réponse incomplète avait été enregistrée sur Android.
// v7 accompagne le garde-fou d'amorçage : un appareil qui détenait encore un
// ancien index vide son shell dès l'activation et récupère le bundle courant.
const CACHE_NAME = 'rezo360-pwa-v7';

const STATIC_ASSETS = ['/', '/favicon-32.png', '/icon-192.png', '/site.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Ignore les requêtes non-GET ou externes aux APIs
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Les API et ressources tierces conservent leur comportement réseau natif.
  if (url.origin !== self.location.origin) return;

  // Pour les requêtes de navigation (HTML) : Network First avec repli Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const typeRecu = networkResponse.headers.get('content-type') ?? '';
          if (networkResponse.ok && typeRecu.includes('text/html')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches
            .open(CACHE_NAME)
            .then((cache) => cache.match('/') || cache.match(event.request));
        }),
    );
    return;
  }

  // Vite donne aux CSS et JS un nom empreinté (`index-ABC123.css`). Ils sont
  // donc immuables par URL et n'ont besoin que du cache HTTP du navigateur.
  // Surtout, les laisser hors du service worker permet au récupérateur intégré
  // à `index.html` de contourner une copie locale défectueuse avec une requête
  // versionnée, sans retomber dans le même Cache Storage.
  if (url.pathname.startsWith('/assets/') && url.pathname.match(/\.(css|js)$/)) {
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
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(event.request))
      .then((cachedResponse) => {
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

          // Cache uniquement les médias et polices. Les bundles CSS/JS sont
          // volontairement exclus plus haut.
          if (!replSPA && url.pathname.match(/\.(svg|png|jpg|jpeg|webp|woff2?)$/)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        });
      }),
  );
});
