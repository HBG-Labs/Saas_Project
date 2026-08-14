/**
 * Écran de secours quand l'application ne démarre pas du tout.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * `src/config/env.ts` valide les variables d'environnement AU CHARGEMENT DU
 * MODULE, avant que React n'existe. C'est délibéré : une configuration
 * incomplète doit échouer tout de suite, pas se manifester trois écrans plus
 * loin sous la forme d'un `undefined` opaque.
 *
 * Mais l'exception remonte alors plus haut que l'`ErrorBoundary`, qui n'est pas
 * encore monté. Le visiteur obtient une page blanche, et le message n'existe
 * que dans la console — que personne n'ouvre. C'est exactement ce qui arrive au
 * premier déploiement quand une variable manque chez l'hébergeur : le build
 * réussit, le site se charge, et il ne s'affiche rien.
 *
 * On rend donc l'échec lisible sans rien présupposer : pas de React, pas de
 * Tailwind (la feuille de styles peut ne pas être chargée), pas de dépendance.
 * Du DOM et des styles en ligne.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Le message d'erreur est-il montrable au visiteur ?
 *
 * `parseEnv` produit un texte écrit pour un humain, qui nomme les variables
 * manquantes. Toute autre exception peut contenir une trace interne : on ne
 * l'affiche pas, on se contente d'un message générique et de la console.
 */
function readableDetail(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  return error.message.startsWith("Configuration d'environnement invalide")
    ? error.message
    : null;
}

export function renderBootFailure(container: HTMLElement | null, error: unknown): void {
  console.error('[démarrage]', error);

  const target = container ?? document.body;
  const detail = readableDetail(error);

  target.innerHTML = '';
  target.setAttribute(
    'style',
    'display:flex;min-height:100dvh;align-items:center;justify-content:center;padding:1.5rem;' +
      'background:#f8fafc;color:#0f172a;' +
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  );

  const panel = document.createElement('div');
  panel.setAttribute(
    'style',
    'max-width:34rem;width:100%;border:1px solid #e2e8f0;border-radius:0.75rem;' +
      'background:#ffffff;padding:1.5rem;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.05)',
  );

  const title = document.createElement('h1');
  title.textContent = 'L’application n’a pas pu démarrer';
  title.setAttribute('style', 'margin:0 0 0.5rem;font-size:1.125rem;font-weight:700');

  const intro = document.createElement('p');
  intro.textContent = detail
    ? 'Sa configuration est incomplète. Aucune donnée n’est en cause.'
    : 'Une erreur est survenue avant le premier affichage. Le détail figure dans la console du navigateur.';
  intro.setAttribute('style', 'margin:0;font-size:0.875rem;line-height:1.5;color:#475569');

  panel.append(title, intro);

  if (detail !== null) {
    const pre = document.createElement('pre');
    pre.textContent = detail;
    pre.setAttribute(
      'style',
      'margin:1rem 0 0;padding:0.75rem;border-radius:0.5rem;background:#f1f5f9;' +
        'font-family:ui-monospace,Menlo,monospace;font-size:0.75rem;line-height:1.5;' +
        'white-space:pre-wrap;overflow-x:auto;color:#0f172a',
    );

    const hint = document.createElement('p');
    hint.textContent =
      'Si vous administrez ce site : renseignez ces variables chez votre hébergeur, puis redéployez.';
    hint.setAttribute('style', 'margin:0.75rem 0 0;font-size:0.75rem;color:#94a3b8');

    panel.append(pre, hint);
  }

  target.append(panel);
}
