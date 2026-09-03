import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import QRCode from 'qrcode';

/**
 * QR code du modal d'installation, généré au lieu d'être déposé à la main.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN FICHIER GÉNÉRÉ PLUTÔT QU'UN PNG PRIS AILLEURS
 *
 * `public/images/rezo360-qr.png` existe déjà, utilisé par le flyer
 * (`scripts/generate-flyer-pro.mjs`) — mais rien dans ce dépôt ne prouve ce
 * qu'il encode réellement : ni script générateur, ni métadonnée. Le
 * réutiliser aurait fait courir le risque de propager une URL obsolète sans
 * pouvoir le vérifier.
 *
 * Ce script part au contraire de L'URL SEULE (une constante, ci-dessous) : le
 * SVG produit ne peut PAS diverger d'elle, par construction. Le jour où
 * l'adresse change, une ligne à modifier ici — pas un outil externe à
 * rouvrir.
 *
 * SVG plutôt que PNG : net à n'importe quelle taille d'affichage, et de
 * l'ordre de quelques kilo-octets contre plusieurs dizaines pour un PNG à
 * résolution équivalente.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const INSTALL_URL = 'https://rezo360.vercel.app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, '..', 'public', 'images', 'rezo360-install-qr.svg');

const svg = await QRCode.toString(INSTALL_URL, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 1,
  color: {
    dark: '#0f172a',
    light: '#ffffff',
  },
});

fs.writeFileSync(outputPath, svg, 'utf8');
console.log(`QR code généré (${INSTALL_URL}) → ${path.relative(path.join(__dirname, '..'), outputPath)}`);
