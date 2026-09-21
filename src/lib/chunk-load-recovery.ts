const RELOAD_GUARD_KEY = 'rezo360_chunk_reload_at';
const STYLESHEET_RELOAD_GUARD_KEY = 'rezo360_stylesheet_reload_at';
const RELOAD_GUARD_MS = 30_000;
const APP_CACHE_PREFIX = 'rezo360-pwa-';

let recoveryInProgress = false;

interface ChunkRecoveryOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  reload?: () => void;
  now?: () => number;
  prepareReload?: () => Promise<void> | void;
}

/** Reconnaît les formulations utilisées par les navigateurs et les bundlers. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('failed to load module script') ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk')
  );
}

/**
 * Retire l'ancien shell PWA avant l'actualisation.
 *
 * Une page HTML conservée par un service worker peut référencer des chunks que
 * le nouveau déploiement ne sert plus. Recharger sans vider ce cache reproduit
 * alors exactement la même panne. La mise à jour du worker et la suppression
 * des seuls caches REZO360 rendent le prochain chargement réellement neuf.
 */
async function prepareBrowserReload(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations.map((registration) => registration.update().catch(() => undefined)),
          ),
        ),
    );
  }

  if ('caches' in globalThis) {
    tasks.push(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)).map((key) => caches.delete(key)),
          ),
        ),
    );
  }

  await Promise.all(tasks);
}

/**
 * Tente une récupération complète et non bouclante d'un module obsolète.
 *
 * Le booléen indique si une actualisation est déjà en cours ou vient d'être
 * programmée. Le garde-fou persistant empêche une boucle si la panne vient du
 * réseau ou du serveur plutôt que du cache local.
 */
function scheduleAppShellRecovery(guardKey: string, options: ChunkRecoveryOptions = {}): boolean {
  if (recoveryInProgress) return true;

  const storage = options.storage ?? window.sessionStorage;
  const reload = options.reload ?? (() => window.location.reload());
  const now = options.now ?? Date.now;
  const prepareReload = options.prepareReload ?? prepareBrowserReload;
  let lastAttempt = 0;

  try {
    lastAttempt = Number(storage.getItem(guardKey)) || 0;
  } catch {
    // Un stockage privé ou saturé ne doit jamais empêcher la récupération.
  }

  if (now() - lastAttempt < RELOAD_GUARD_MS) return false;

  try {
    storage.setItem(guardKey, String(now()));
  } catch {
    // Le rechargement reste utile même si le garde-fou ne peut être persisté.
  }

  recoveryInProgress = true;
  void Promise.resolve()
    .then(() => prepareReload())
    .catch(() => undefined)
    .finally(() => {
      recoveryInProgress = false;
      reload();
    });

  return true;
}

export function recoverChunkLoadError(error: unknown, options: ChunkRecoveryOptions = {}): boolean {
  if (!isChunkLoadError(error)) return false;
  return scheduleAppShellRecovery(RELOAD_GUARD_KEY, options);
}

/** Recharge une fois si la feuille principale a été perdue pendant un déploiement. */
export function recoverStylesheetLoad(options: ChunkRecoveryOptions = {}): boolean {
  return scheduleAppShellRecovery(STYLESHEET_RELOAD_GUARD_KEY, options);
}

/**
 * Recharge une seule fois lorsqu'un déploiement a remplacé un module différé.
 *
 * Vite émet `vite:preloadError` avant de transmettre l'erreur au routeur. Une
 * actualisation récupère alors l'index et les noms de fichiers du déploiement
 * courant. Le marqueur de session interdit une boucle si le réseau est coupé
 * ou si l'hébergeur répond toujours en erreur.
 */
export function installChunkLoadRecovery(options: ChunkRecoveryOptions = {}): () => void {
  const handlePreloadError = (event: Event) => {
    const error = 'payload' in event ? (event as Event & { payload?: unknown }).payload : event;
    if (recoverChunkLoadError(error, options)) {
      // Sans cette instruction, Vite propage l'exception et affiche la frontière
      // d'erreur pendant que la page est déjà en train d'être actualisée.
      event.preventDefault();
    }
  };

  window.addEventListener('vite:preloadError', handlePreloadError);
  return () => window.removeEventListener('vite:preloadError', handlePreloadError);
}

/**
 * Surveille les feuilles déjà déclarées dans `index.html`.
 *
 * Une feuille peut échouer avant que React ne monte sans provoquer d'exception
 * JavaScript : l'application fonctionne alors, mais avec le style HTML brut du
 * navigateur. L'événement `error` couvre l'échec direct ; le contrôle à
 * `load` couvre celui survenu avant l'installation de cet écouteur.
 */
export function installStylesheetLoadRecovery(options: ChunkRecoveryOptions = {}): () => void {
  const stylesheets = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  );
  if (stylesheets.length === 0) return () => undefined;

  const recover = () => {
    recoverStylesheetLoad(options);
  };
  const checkLoadedStylesheets = () => {
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim();
    if (primaryColor === '') recover();
  };

  stylesheets.forEach((stylesheet) => stylesheet.addEventListener('error', recover));
  window.addEventListener('load', checkLoadedStylesheets);
  if (document.readyState === 'complete') queueMicrotask(checkLoadedStylesheets);
  // Certains WebView Android signalent l'échec de la feuille avant l'exécution
  // du module principal, puis ne rejouent ni `error` ni `load` pour l'écouteur
  // installé ici. Ce contrôle différé ferme ce dernier angle mort sans prendre
  // une feuille simplement encore en cours de téléchargement pour un échec.
  const fallbackTimer = window.setTimeout(checkLoadedStylesheets, 5_000);

  return () => {
    window.clearTimeout(fallbackTimer);
    stylesheets.forEach((stylesheet) => stylesheet.removeEventListener('error', recover));
    window.removeEventListener('load', checkLoadedStylesheets);
  };
}

/** Autorise une future récupération après que la nouvelle version a démarré. */
export function clearChunkLoadRecoveryGuard(
  storage: Pick<Storage, 'removeItem'> = window.sessionStorage,
): void {
  try {
    storage.removeItem(RELOAD_GUARD_KEY);
    storage.removeItem(STYLESHEET_RELOAD_GUARD_KEY);
  } catch {
    // Rien à faire : l'absence de stockage ne doit pas affecter l'application.
  }
}
