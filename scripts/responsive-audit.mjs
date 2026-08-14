/**
 * Audit de débordement horizontal, sur appareils réels simulés.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE SCRIPT
 *
 * On ne peut pas déduire la responsivité de la lecture des classes. Une largeur
 * fixe, un mot insécable, une grille rigide : rien de tout cela ne se voit dans
 * le code, tout se voit dans le rendu. Ce script ouvre chaque écran aux
 * largeurs réelles des téléphones vendus, et signale TOUT élément plus large
 * que sa fenêtre.
 *
 * Il vérifie aussi les cibles tactiles : un bouton de moins de 40 px de côté
 * est raté une fois sur trois par un pouce, ganté ou non.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/responsive-audit.mjs            (serveur déjà lancé)
 *   node scripts/responsive-audit.mjs --url=…    (autre origine)
 */

import { readFileSync } from 'node:fs';

import { chromium } from '@playwright/test';

const BASE = process.argv.find((arg) => arg.startsWith('--url='))?.slice(6) ?? 'http://localhost:5173';

/*
  Les écrans de travail sont derrière une session.

  Sans connexion, `/missions` ou `/devis` renvoient la page publique : on
  auditerait quatorze fois la même vitrine en croyant couvrir l'application.
  On se connecte donc réellement, avec un compte de seed, avant de mesurer.
*/
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [
        line.slice(0, at).trim(),
        line
          .slice(at + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ];
    }),
);

const LOGIN = {
  email: process.env['AUDIT_EMAIL'] ?? 'owner.a@nexoratech.local',
  password: process.env['AUDIT_PASSWORD'] ?? env['SEED_TEST_PASSWORD'] ?? '',
};

async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/adresse e-?mail/i).fill(LOGIN.email);
  await page.locator('input[type="password"]').first().fill(LOGIN.password);
  await page.getByRole('button', { name: /se connecter|connexion/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

/** Largeurs réelles, pas des paliers théoriques. */
const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'Galaxy A / petit Android', width: 360, height: 800 },
  { name: 'iPhone 15 Pro', width: 393, height: 852 },
  { name: 'iPad mini portrait', width: 768, height: 1024 },
];

const ROUTES = [
  ['Accueil', '/'],
  ['Tarifs', '/pricing'],
  ['Outils', '/tools'],
  ['Tableau de bord', '/dashboard'],
  ['Missions', '/missions'],
  ['Nouvelle mission', '/missions/nouvelle'],
  ['Dossiers clos', '/dossiers-clos'],
  ['Contrôle', '/controle'],
  ['Comptes rendus', '/comptes-rendus'],
  ['Clients', '/clients'],
  ['Équipes', '/equipes'],
  ['Parc matériel', '/equipements'],
  ['Devis', '/devis'],
  ['Bloc-notes', '/bloc-notes'],
  ['Analyses', '/analytics'],
  ['Organisation', '/organisation'],
  ['Membres', '/organisation/membres'],
  ['Facturation', '/organisation/facturation'],
  ['Journal', '/journal'],
  ['Profil', '/profile'],
  ['Paramètres', '/settings'],
  ['Historique', '/history'],
];

/**
 * Renvoie les éléments qui dépassent la largeur de la fenêtre.
 *
 * On remonte au plus petit ancêtre fautif plutôt que de signaler chaque
 * descendant : un tableau trop large produirait sinon cent lignes de rapport
 * pour un seul défaut.
 */
const OVERFLOW_PROBE = (viewportWidth) => {
  const guilty = [];
  const seen = new Set();

  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    // Un conteneur qui défile a le droit d'être plus large que la fenêtre :
    // c'est son contenu qui défile, pas la page.
    if (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'clip') {
      continue;
    }

    // Et un enfant rogné par un ancêtre ne déborde de rien : il est tronqué.
    // Sans cette remontée, chaque `truncate` du projet remonterait en faute.
    let clipped = false;
    for (let parent = el.parentElement; parent !== null; parent = parent.parentElement) {
      const parentOverflow = getComputedStyle(parent).overflowX;
      if (parentOverflow === 'hidden' || parentOverflow === 'clip' || parentOverflow === 'auto' || parentOverflow === 'scroll') {
        clipped = true;
        break;
      }
    }
    if (clipped) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const overflowRight = Math.round(rect.right - viewportWidth);
    const overflowLeft = Math.round(-rect.left);
    const worst = Math.max(overflowRight, overflowLeft);
    if (worst < 2) continue;

    // `position: fixed` centré par transform peut dépasser de 1-2 px : ignoré
    // par le seuil ci-dessus. Au-delà, c'est un vrai débordement.
    let ancestorAlreadyReported = false;
    for (let parent = el.parentElement; parent !== null; parent = parent.parentElement) {
      if (seen.has(parent)) {
        ancestorAlreadyReported = true;
        break;
      }
    }
    if (ancestorAlreadyReported) continue;

    seen.add(el);
    guilty.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') ?? '').slice(0, 110),
      text: (el.textContent ?? '').trim().slice(0, 46),
      over: worst,
      width: Math.round(rect.width),
    });
  }

  return {
    guilty: guilty.slice(0, 8),
    documentScrolls: document.documentElement.scrollWidth > viewportWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
  };
};

/** Commandes trop petites pour un pouce. */
const TOUCH_PROBE = () => {
  const small = [];
  for (const el of document.querySelectorAll('button, a[href], [role="button"], select, input[type="checkbox"]')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    // Un lien à l'intérieur d'un paragraphe est du texte, pas une commande.
    if (el.tagName === 'A' && el.closest('p') !== null) continue;
    // Les éléments réservés aux lecteurs d'écran n'ont pas de cible tactile :
    // le lien d'évitement ne devient visible qu'au focus clavier.
    if (style.clipPath === 'inset(50%)' || el.className.toString().includes('sr-only')) continue;
    if (Math.min(rect.width, rect.height) >= 40) continue;

    small.push({
      tag: el.tagName.toLowerCase(),
      label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 34),
      size: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
    });
  }
  return small.slice(0, 6);
};

const browser = await chromium.launch();
let overflowCount = 0;
let touchCount = 0;

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: viewport.width < 700,
    hasTouch: viewport.width < 700,
  });
  const page = await context.newPage();

  let session = 'VISITEUR — écrans applicatifs NON couverts';
  try {
    await signIn(page);
    session = 'connecté';
  } catch (error) {
    session += ` (${error instanceof Error ? error.message.split('\n')[0] : 'échec'})`;
  }

  console.log(`\n━━━ ${viewport.name} — ${viewport.width}px — ${session} ━━━`);

  for (const [label, route] of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 20_000 });
    } catch {
      console.log(`  ?? ${label.padEnd(18)} inaccessible`);
      continue;
    }
    await page.waitForTimeout(400);

    const result = await page.evaluate(OVERFLOW_PROBE, viewport.width);
    const touch = viewport.width < 700 ? await page.evaluate(TOUCH_PROBE) : [];

    const problems = result.guilty.length + touch.length;
    if (problems === 0 && !result.documentScrolls) {
      console.log(`  OK ${label}`);
      continue;
    }

    console.log(`  !! ${label}  (document ${result.scrollWidth}px)`);
    for (const item of result.guilty) {
      overflowCount += 1;
      console.log(`       déborde de ${item.over}px  <${item.tag}> w=${item.width}  « ${item.text} »`);
      console.log(`         ${item.cls}`);
    }
    for (const item of touch) {
      touchCount += 1;
      console.log(`       cible ${item.size}  <${item.tag}> « ${item.label} »`);
    }
  }

  await context.close();
}

await browser.close();
console.log(`\n${overflowCount} débordement(s), ${touchCount} cible(s) sous 40px.`);
process.exit(overflowCount > 0 ? 1 : 0);
