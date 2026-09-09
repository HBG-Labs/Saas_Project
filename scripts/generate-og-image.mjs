import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

/**
 * Fabrique l'image d'aperçu partagée sur les réseaux sociaux.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE PLUTÔT QU'UNE IMAGE POSÉE À LA MAIN
 *
 * `og:image` est ce que Facebook, Instagram, Messenger, LinkedIn et WhatsApp
 * affichent quand quelqu'un partage un lien vers REZO360 — y compris les
 * partages organiques que produisent les campagnes publicitaires. Sur ces
 * plateformes, un lien sans visuel est un lien qui n'est pas cliqué.
 *
 * Elle doit donc rester à jour : accroche, couleurs, capture produit. Une image
 * exportée d'un outil de dessin dérive dès la première évolution de la marque,
 * et personne ne s'en aperçoit — l'aperçu ne se voit pas depuis le site.
 *
 * Ce script la reconstruit à partir des sources réelles du produit : les
 * couleurs de `index.css`, les polices de `@fontsource`, et la photographie
 * déjà employée sur la page d'accueil.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTRAINTES DE FORMAT, ET POURQUOI ELLES NE SE NÉGOCIENT PAS
 *
 *   • 1200 × 630 exactement. C'est le ratio 1.91:1 attendu ; toute autre
 *     proportion est recadrée par les plateformes, souvent au pire endroit.
 *   • Le texte reste à bonne distance des bords : les vignettes sont rognées
 *     différemment selon les applications.
 *   • Le poids doit rester modeste — certaines plateformes renoncent au-delà
 *     de quelques centaines de kilo-octets.
 *
 *   node scripts/generate-og-image.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(RACINE, 'public', 'og-image.jpg');

/** Reprises telles quelles de `src/styles/index.css`. */
const NUIT = '#0a1b43';
const CYAN = '#39cede';

function enBase64(relatif) {
  return fs.readFileSync(path.join(RACINE, relatif)).toString('base64');
}

const police = (relatif) =>
  fs.readFileSync(path.join(RACINE, 'node_modules', relatif)).toString('base64');

const archivo = police('@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2');
const plex = police(
  '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2',
);
const appareils = enBase64('public/images/devices-cropped.png');

const gabarit = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Archivo';
    src: url(data:font/woff2;base64,${archivo}) format('woff2-variations');
    font-weight: 100 900;
  }
  @font-face {
    font-family: 'IBM Plex Sans';
    src: url(data:font/woff2;base64,${plex}) format('woff2-variations');
    font-weight: 100 700;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: ${NUIT};
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    color: #fff; overflow: hidden; position: relative;
  }
  /* Halo diffus : évite l'aplat, sans rien coûter en lisibilité. */
  .halo {
    position: absolute; right: -140px; top: -160px;
    width: 720px; height: 720px; border-radius: 50%;
    background: radial-gradient(circle, rgba(37,99,235,.42) 0%, rgba(10,27,67,0) 68%);
  }
  .cadre {
    position: relative; height: 100%;
    display: grid; grid-template-columns: 1fr 400px;
    align-items: center; gap: 40px;
    padding: 68px 72px;
  }
  .marque {
    font-family: 'Archivo', sans-serif; font-weight: 800;
    font-size: 40px; letter-spacing: -.02em; margin-bottom: 34px;
  }
  .marque i { font-style: normal; color: ${CYAN}; }
  h1 {
    font-family: 'Archivo', sans-serif; font-weight: 800;
    font-size: 66px; line-height: 1.04; letter-spacing: -.028em;
    text-wrap: balance; margin-bottom: 26px;
  }
  p {
    font-size: 25px; line-height: 1.42; color: #b9c6da;
    max-width: 20ch;
  }
  .gages {
    display: flex; gap: 12px; margin-top: 34px; flex-wrap: wrap;
  }
  .gage {
    font-size: 19px; font-weight: 600; color: #dbe4f2;
    border: 1.5px solid rgba(255,255,255,.24);
    border-radius: 999px; padding: 9px 18px;
  }
  /*
    La capture est un recadrage rectangulaire, avec son propre fond clair. Sans
    arrondi ni liseré, ses angles vifs sur le marine la font lire comme une
    image collée par erreur plutôt que comme un élément composé.
  */
  .visuel { display: flex; align-items: center; justify-content: center; }
  .visuel .carte {
    border-radius: 20px; overflow: hidden;
    border: 1px solid rgba(255,255,255,.14);
    box-shadow: 0 26px 54px rgba(0,0,0,.5);
    line-height: 0;
  }
  .visuel img { width: 100%; height: auto; }
  /* Filet bas aux couleurs de la marque, comme sur le site. */
  .filet {
    position: absolute; left: 0; right: 0; bottom: 0; height: 9px;
    background: linear-gradient(90deg, #2563eb 0%, ${CYAN} 100%);
  }
</style>
</head>
<body>
  <div class="halo"></div>
  <div class="cadre">
    <div>
      <div class="marque">REZO<i>360</i></div>
      <h1>Pilotez votre activité de terrain en toute simplicité</h1>
      <p>Clients, interventions, planning et facturation au même endroit.</p>
      <div class="gages">
        <span class="gage">Tous les métiers de terrain</span>
        <span class="gage">Essai gratuit</span>
      </div>
    </div>
    <div class="visuel"><div class="carte"><img src="data:image/png;base64,${appareils}" alt="" /></div></div>
  </div>
  <div class="filet"></div>
</body>
</html>`;

const navigateur = await chromium.launch();
const page = await navigateur.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});

await page.setContent(gabarit, { waitUntil: 'load' });
// Les polices sont en ligne, mais leur décodage n'est pas instantané : sans
// cette attente, le rendu peut partir avec la police de repli.
await page.evaluate(() => document.fonts.ready);

await page.screenshot({ path: SORTIE, type: 'jpeg', quality: 90 });
await navigateur.close();

const octets = fs.statSync(SORTIE).size;
console.log(`og-image.jpg — 1200 x 630, ${(octets / 1024).toFixed(0)} Ko`);
