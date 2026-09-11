import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { chromium } from '@playwright/test';

/**
 * Décline les icônes de l'application à partir d'un seul master.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE MASTER EST `public/icon-512.png`, ET C'EST LUI QU'ON REMPLACE
 *
 * Pour changer le logo, écrasez ce fichier — 512×512, coins DÉJÀ arrondis et
 * transparents — puis relancez ce script. Rien d'autre à toucher.
 *
 * Les scripts précédents partaient de `favicon.svg`. Le logo fourni étant une
 * image matricielle, le redessiner en vectoriel a été tenté puis abandonné :
 * comparé pixel à pixel à l'original, le tracé reconstruit s'en écartait de
 * 2,95 % — l'anneau n'est pas concentrique au carré, et ses extrémités sont
 * coupées en biais. Mieux vaut un matriciel fidèle qu'un vectoriel approximatif.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DEUX FAMILLES D'ICÔNES
 *
 * `any` garde les coins transparents : l'icône est affichée telle quelle, et sa
 * forme arrondie fait partie du dessin.
 *
 * `maskable` et l'icône iOS sont AU CONTRAIRE à fond perdu, coins carrés. Les
 * deux systèmes appliquent leur propre masque : leur donner une image déjà
 * arrondie produit un double arrondi, et des angles rognés ou vides. Le fond
 * bleu est donc étendu jusqu'aux bords, et c'est l'OS qui découpe.
 *
 * Le symbole occupe 67,5 % de la largeur, donc il tient dans la zone sûre des
 * icônes maskables (un cercle de 80 % du côté) sans réduction supplémentaire.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(path.resolve(__dirname, '..'), 'public');

/** Le bleu du logo, mesuré sur le master. Sert de fond aux icônes à fond perdu. */
const BLEU = '#0676FE';

const CIBLES = [
  { nom: 'icon-192.png', taille: 192, fondPerdu: false },
  { nom: 'favicon-32.png', taille: 32, fondPerdu: false },
  { nom: 'apple-touch-icon.png', taille: 180, fondPerdu: true },
  { nom: 'icon-maskable-512.png', taille: 512, fondPerdu: true },
];

const masterPath = path.join(publicDir, 'icon-512.png');
if (!fs.existsSync(masterPath)) {
  console.error(`Master introuvable : ${masterPath}`);
  process.exit(1);
}
const master = fs.readFileSync(masterPath).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');

for (const { nom, taille, fondPerdu } of CIBLES) {
  const dataUrl = await page.evaluate(
    async ({ master, taille, fondPerdu, BLEU }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${master}`;
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = taille;
      canvas.height = taille;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      if (fondPerdu) {
        // Le bleu passe SOUS le master : ses coins transparents se remplissent,
        // et l'icône devient un carré plein que l'OS masquera lui-même.
        ctx.fillStyle = BLEU;
        ctx.fillRect(0, 0, taille, taille);
      }
      ctx.drawImage(img, 0, 0, taille, taille);

      return canvas.toDataURL('image/png');
    },
    { master, taille, fondPerdu, BLEU },
  );

  const sortie = path.join(publicDir, nom);
  fs.writeFileSync(sortie, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const octets = fs.statSync(sortie).size;
  console.log(
    `${nom.padEnd(24)} ${String(taille).padStart(3)}px  ` +
      `${fondPerdu ? 'fond perdu' : 'coins transparents'}  ${octets} octets`,
  );
}

await browser.close();
console.log('Icônes générées depuis public/icon-512.png.');
