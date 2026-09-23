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
  return error.message.startsWith("Configuration d'environnement invalide") ? error.message : null;
}

export function renderBootFailure(container: HTMLElement | null, error: unknown): void {
  console.error('[démarrage]', error);

  const target = container ?? document.body;
  const detail = readableDetail(error);

  target.innerHTML = '';
  document.documentElement.style.backgroundColor = '#f6f8fc';
  document.body.style.margin = '0';
  document.body.style.backgroundColor = '#f6f8fc';
  target.setAttribute(
    'style',
    'box-sizing:border-box;display:flex;min-height:100dvh;align-items:center;justify-content:center;padding:1.25rem;' +
      'background:radial-gradient(circle at 50% 42%,#ffffff 0,#f6f8fc 58%,#eef2f8 100%);color:#17243a;' +
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  );

  const motion = document.createElement('style');
  motion.textContent = `
    @keyframes rezo-boot-orbit { to { transform: rotate(360deg); } }
    @keyframes rezo-boot-breathe {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(.94); opacity: .82; }
    }
    .rezo-boot-orbit {
      animation: rezo-boot-orbit 7s linear infinite;
      transform-box: fill-box;
      transform-origin: center;
    }
    .rezo-boot-core {
      animation: rezo-boot-breathe 2.4s ease-in-out infinite;
      transform-box: fill-box;
      transform-origin: center;
    }
    .rezo-boot-retry:hover { background: #e3eaff !important; }
    .rezo-boot-retry:focus-visible { outline: 3px solid rgb(36 81 209 / 25%); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .rezo-boot-orbit, .rezo-boot-core { animation: none; }
    }
  `;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.setAttribute(
    'style',
    'box-sizing:border-box;max-width:27rem;width:100%;border:1px solid #e3e8f1;border-radius:1.25rem;' +
      'background:rgb(255 255 255 / 94%);padding:1.25rem;box-shadow:0 18px 50px rgb(23 36 58 / 9%)',
  );

  const headingRow = document.createElement('div');
  headingRow.setAttribute('style', 'display:flex;align-items:center;gap:0.875rem');

  const illustration = document.createElement('div');
  illustration.setAttribute('aria-hidden', 'true');
  illustration.setAttribute(
    'style',
    'display:flex;width:3.75rem;height:3.75rem;flex:0 0 3.75rem;align-items:center;justify-content:center;' +
      'border-radius:1rem;background:#edf2ff;color:#2451d1',
  );
  illustration.innerHTML = `
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="16" stroke="#b9c8f8" stroke-width="1.5" stroke-dasharray="3 4" class="rezo-boot-orbit"/>
      <circle cx="22" cy="22" r="10" fill="#2451d1" class="rezo-boot-core"/>
      <path d="M18.5 22.2l2.25 2.25 4.9-5.15" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="35" cy="12" r="3" fill="#23a36d"/>
    </svg>`;

  const headingCopy = document.createElement('div');
  headingCopy.setAttribute('style', 'min-width:0');

  const eyebrow = document.createElement('p');
  eyebrow.textContent = 'Petit contretemps';
  eyebrow.setAttribute(
    'style',
    'margin:0 0 0.2rem;color:#2451d1;font-size:0.72rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase',
  );

  const title = document.createElement('h1');
  title.textContent = 'Le chargement s’est interrompu';
  title.setAttribute(
    'style',
    'margin:0;font-size:1.05rem;line-height:1.25;font-weight:800;letter-spacing:-0.015em',
  );

  headingCopy.append(eyebrow, title);
  headingRow.append(illustration, headingCopy);

  const intro = document.createElement('p');
  intro.textContent = detail
    ? 'Un réglage du déploiement manque. Aucune donnée n’est en cause.'
    : 'REZO360 n’a pas pu s’ouvrir correctement. Vos données restent en sécurité.';
  intro.setAttribute('style', 'margin:1rem 0 0;font-size:0.875rem;line-height:1.55;color:#647086');

  panel.append(headingRow, intro);

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'rezo-boot-retry';
  retry.textContent = 'Réessayer';
  retry.setAttribute(
    'style',
    'margin-top:1rem;min-height:2.75rem;border:1px solid #cbd6f6;border-radius:999px;padding:0.55rem 1rem;' +
      'background:#edf2ff;color:#1b44c8;font:inherit;font-size:0.875rem;font-weight:800;cursor:pointer',
  );
  retry.addEventListener('click', () => window.location.reload());

  if (detail !== null) {
    const details = document.createElement('details');
    details.setAttribute(
      'style',
      'margin-top:0.875rem;border-top:1px solid #edf0f5;padding-top:0.75rem;color:#647086;font-size:0.75rem',
    );

    const summary = document.createElement('summary');
    summary.textContent = 'Détail technique';
    summary.setAttribute('style', 'cursor:pointer;font-weight:700');

    const pre = document.createElement('pre');
    pre.textContent = detail;
    pre.setAttribute(
      'style',
      'margin:0.625rem 0 0;padding:0.75rem;border-radius:0.65rem;background:#f4f6fa;' +
        'font-family:ui-monospace,Menlo,monospace;font-size:0.75rem;line-height:1.5;' +
        'white-space:pre-wrap;overflow-x:auto;color:#25324a',
    );

    details.append(summary, pre);
    panel.append(details);
  }

  panel.append(retry);

  const hint = document.createElement('p');
  hint.textContent = 'Cela ne prend généralement qu’un instant.';
  hint.setAttribute(
    'style',
    'margin:0.75rem 0 0;text-align:center;color:#8a94a7;font-size:0.72rem;line-height:1.4',
  );
  panel.append(hint);

  target.append(motion, panel);
}
