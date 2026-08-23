import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

// Master SVG 1 : L'Architectural R Parfait (Inspiré fidèlement du Concept 2, grand format, proportions équilibrées, blanc pur éclatant)
const masterLogo1 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Fond Dégradé Saphir Royal Vibrant -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="45%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>

    <!-- Éclairage Zénithal Subtil -->
    <linearGradient id="topGlow" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0" />
    </linearGradient>

    <!-- Blanc Pur avec dégradé subtil de profondeur -->
    <linearGradient id="rWhite" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </linearGradient>

    <!-- Ombrage doux biseauté -->
    <linearGradient id="rBevel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>

    <!-- Ombre portée douce -->
    <filter id="masterShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#020617" flood-opacity="0.55" />
    </filter>
  </defs>

  <!-- Squircle Base -->
  <rect width="512" height="512" rx="118" fill="url(#bgGrad)" />
  <rect width="512" height="512" rx="118" fill="url(#topGlow)" />
  <rect width="508" height="508" x="2" y="2" rx="116" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" />

  <!-- Monogramme R Architectural (Proportions héroïques, grand format 360x360) -->
  <g filter="url(#masterShadow)">
    
    <!-- 1. Pied Inférieur Gauche Sculpté -->
    <path
      fill="url(#rWhite)"
      d="M 112 416
         L 112 336
         L 186 262
         L 186 416
         Z"
    />

    <!-- 2. Boucle & Fût Supérieur & Jambe Diagonale (Harmonie & Poids Parfaits) -->
    <path
      fill-rule="evenodd"
      fill="url(#rWhite)"
      d="M 148 96
         L 336 96
         L 416 176
         L 416 230
         L 354 292
         L 416 416
         L 326 416
         L 268 300
         L 194 300
         L 112 382
         L 112 132
         Z
         M 186 168
         L 316 168
         L 350 202
         L 350 214
         L 314 250
         L 186 250
         Z"
    />

    <!-- Biseau d'éclat subtil 45° sur l'arête droite (Optionnel, pur vecteur) -->
    <polygon
      points="336,96 416,176 384,176 316,108"
      fill="#ffffff"
      opacity="0.8"
    />
    <polygon
      points="416,176 416,230 384,212 384,176"
      fill="url(#rBevel)"
      opacity="0.3"
    />
    <polygon
      points="416,230 354,292 328,266 384,212"
      fill="url(#rBevel)"
      opacity="0.5"
    />
    <polygon
      points="354,292 416,416 384,416 328,304"
      fill="url(#rBevel)"
      opacity="0.35"
    />
  </g>
</svg>
`;

// Master SVG 2 : R Architectural Blanc Pur Minimaliste (Sans biseau intérieur, netteté 100% vectorielle)
const masterLogo2 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>

    <linearGradient id="topGlow2" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0" />
    </linearGradient>

    <linearGradient id="rWhite2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>

    <filter id="masterShadow2" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#020617" flood-opacity="0.55" />
    </filter>
  </defs>

  <rect width="512" height="512" rx="118" fill="url(#bgGrad2)" />
  <rect width="512" height="512" rx="118" fill="url(#topGlow2)" />
  <rect width="508" height="508" x="2" y="2" rx="116" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" />

  <g filter="url(#masterShadow2)">
    <!-- 1. Pied Inférieur Gauche -->
    <path
      fill="url(#rWhite2)"
      d="M 112 416
         L 112 336
         L 186 262
         L 186 416
         Z"
    />

    <!-- 2. Boucle & Jambe (Blanc Pur, Silhouette Impeccable) -->
    <path
      fill-rule="evenodd"
      fill="url(#rWhite2)"
      d="M 148 96
         L 336 96
         L 416 176
         L 416 230
         L 354 292
         L 416 416
         L 326 416
         L 268 300
         L 194 300
         L 112 382
         L 112 132
         Z
         M 186 168
         L 316 168
         L 350 202
         L 350 214
         L 314 250
         L 186 250
         Z"
    />
  </g>
</svg>
`;

// Master SVG 3 : Monolithe Unifié Continu (Sans fente, monolithique, chanfreins 45°)
const masterLogo3 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>

    <linearGradient id="topGlow3" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0" />
    </linearGradient>

    <linearGradient id="rWhite3" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>

    <filter id="masterShadow3" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#020617" flood-opacity="0.55" />
    </filter>
  </defs>

  <rect width="512" height="512" rx="118" fill="url(#bgGrad3)" />
  <rect width="512" height="512" rx="118" fill="url(#topGlow3)" />
  <rect width="508" height="508" x="2" y="2" rx="116" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" />

  <g filter="url(#masterShadow3)">
    <path
      fill-rule="evenodd"
      fill="url(#rWhite3)"
      d="M 148 96
         L 336 96
         L 416 176
         L 416 230
         L 354 292
         L 416 416
         L 326 416
         L 268 300
         L 194 300
         L 194 416
         L 112 416
         L 112 132
         Z
         M 194 168
         L 316 168
         L 350 202
         L 350 214
         L 314 250
         L 194 250
         Z"
    />
  </g>
</svg>
`;

async function renderMaster() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 700 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #080c16; color: #ffffff; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
          h1 { font-size: 28px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
          p { color: #94a3b8; font-size: 15px; margin-bottom: 32px; }
          .grid { display: flex; gap: 32px; justify-content: center; }
          .card { background: #111827; border: 1px solid #1f2937; border-radius: 24px; padding: 24px; display: flex; flex-direction: column; align-items: center; width: 360px; box-shadow: 0 20px 45px rgba(0,0,0,0.6); }
          .preview { width: 230px; height: 230px; margin-bottom: 20px; }
          .title { font-size: 17px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; text-align: center; }
          .desc { font-size: 12px; color: #64748b; text-align: center; line-height: 1.5; }
          .badge { margin-top: 14px; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; background: rgba(59, 130, 246, 0.18); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35); }
        </style>
      </head>
      <body>
        <h1>Nouvelle Génération Logo REZO360 (Vecteur Pur & Grand Format)</h1>
        <p>Proportions grand format (occupation 70% de l'icône), silhouette puissante, zéro artifact</p>
        <div class="grid">
          <div class="card">
            <div class="preview">${masterLogo1}</div>
            <div class="title">Modèle A : Architectural R (Subtil Biseau)</div>
            <div class="desc">R grand format avec la fente 45° exacte du Concept 2 et un biseau discret sur les arêtes d'ombre.</div>
            <div class="badge">Recommandé #1 (Fidèle Concept 2)</div>
          </div>
          <div class="card">
            <div class="preview">${masterLogo2}</div>
            <div class="title">Modèle B : Architectural R (Blanc Pur Épuré)</div>
            <div class="desc">Même découpe dynamique 45°, traité en blanc pur avec ombre portée douce. Netteté absolue à toutes tailles.</div>
            <div class="badge">Pureté & Contraste Maximal</div>
          </div>
          <div class="card">
            <div class="preview">${masterLogo3}</div>
            <div class="title">Modèle C : Monolithe Continu Chanfreiné</div>
            <div class="desc">Fût vertical d'un seul bloc, angles supérieurs et inférieurs chanfreinés à 45°. Solidité et simplicité.</div>
            <div class="badge">Corporate Monolithe</div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'master_logo_comparison.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved preview to:', outPath);
  await browser.close();
}

renderMaster().catch(console.error);
