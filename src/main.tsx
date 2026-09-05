import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { renderBootFailure } from '@/app/boot-failure';
import { clearChunkLoadRecoveryGuard, installChunkLoadRecovery } from '@/lib/chunk-load-recovery';
import '@/styles/index.css';

// Installé avant les imports différés de `boot` : il couvre aussi une version
// devenue obsolète avant que React et le routeur aient pu démarrer.
installChunkLoadRecovery();

/**
 * Amorçage.
 *
 * Tout est enveloppé dans un `try` — y compris les imports, qui sont donc
 * dynamiques. `src/config/env.ts` lève au chargement du module si une variable
 * manque, et cette exception survient AVANT que React ne monte : ni
 * `ErrorBoundary` ni `ErrorFallback` ne peuvent l'attraper. Sans ce filet, une
 * variable oubliée chez l'hébergeur donne une page blanche muette.
 *
 * Les imports statiques auraient été évalués avant d'entrer dans le `try` : le
 * `await import()` est ce qui rend la protection effective.
 */
async function boot(): Promise<void> {
  const container = document.getElementById('root');

  if (container === null) {
    renderBootFailure(null, new Error('Élément #root introuvable : vérifiez index.html.'));
    return;
  }

  try {
    const [{ App }, { applyStoredTheme }, { purgeDemoStorage }, { migrateStorageKeys }] =
      await Promise.all([
      import('@/app/App'),
      import('@/features/theme/theme-script'),
      import('@/lib/purge-demo-storage'),
      import('@/lib/migrate-storage-keys'),
      // Enregistre tous les outils présents dans src/tools/ (auto-découverte).
      // Doit précéder le premier rendu : le catalogue lit le registry.
      import('@/tools'),
    ]);

    // AVANT TOUT LE RESTE : les préférences écrites sous l'ancien nom de marque
    // sont recopiées sous le nouveau. Ce qui suit les lit — les laisser passer
    // après reviendrait à lire des clés encore vides.
    migrateStorageKeys();

    // Le thème est déjà posé par le script en ligne de `index.html`, avant même
    // le premier octet de JavaScript. Cet appel reste comme filet : il couvre le
    // cas où ce script aurait été bloqué, et il est idempotent.
    applyStoredTheme();

    // Retire les données de démonstration laissées par les versions précédentes.
    purgeDemoStorage();

    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    // Un rendu resté stable confirme que les modules du nouveau déploiement
    // sont accessibles. Une future mise à jour pourra alors récupérer à son tour.
    window.setTimeout(clearChunkLoadRecoveryGuard, 15_000);

    // Enregistrement du Service Worker PWA pour l'installation mobile & hors-ligne
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('[REZO360 PWA] Échec enregistrement Service Worker:', err);
        });
      });
    } else if ('serviceWorker' in navigator) {
      // En mode développement également pour les tests PWA
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  } catch (error) {
    renderBootFailure(container, error);
  }
}

void boot();
