const RELOAD_GUARD_KEY = 'rezo360_chunk_reload_at';
const RELOAD_GUARD_MS = 30_000;

interface ChunkRecoveryOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  reload?: () => void;
  now?: () => number;
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
 * Recharge une seule fois lorsqu'un déploiement a remplacé un module différé.
 *
 * Vite émet `vite:preloadError` avant de transmettre l'erreur au routeur. Une
 * actualisation récupère alors l'index et les noms de fichiers du déploiement
 * courant. Le marqueur de session interdit une boucle si le réseau est coupé
 * ou si l'hébergeur répond toujours en erreur.
 */
export function installChunkLoadRecovery(options: ChunkRecoveryOptions = {}): () => void {
  const storage = options.storage ?? window.sessionStorage;
  const reload = options.reload ?? (() => window.location.reload());
  const now = options.now ?? Date.now;

  const handlePreloadError = (event: Event) => {
    let lastAttempt = 0;

    try {
      lastAttempt = Number(storage.getItem(RELOAD_GUARD_KEY)) || 0;
    } catch {
      // Un stockage privé ou saturé ne doit jamais empêcher la récupération.
    }

    if (now() - lastAttempt < RELOAD_GUARD_MS) return;

    // Sans cette instruction, Vite propage l'exception et affiche la frontière
    // d'erreur pendant que la page est déjà en train d'être actualisée.
    event.preventDefault();

    try {
      storage.setItem(RELOAD_GUARD_KEY, String(now()));
    } catch {
      // Le rechargement reste utile même si le garde-fou ne peut être persisté.
    }

    reload();
  };

  window.addEventListener('vite:preloadError', handlePreloadError);
  return () => window.removeEventListener('vite:preloadError', handlePreloadError);
}

/** Autorise une future récupération après que la nouvelle version a démarré. */
export function clearChunkLoadRecoveryGuard(
  storage: Pick<Storage, 'removeItem'> = window.sessionStorage,
): void {
  try {
    storage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // Rien à faire : l'absence de stockage ne doit pas affecter l'application.
  }
}
