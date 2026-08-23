import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

// Géométrie de précision chirurgicale (100% vectorielle) du Concept 2
const perfectLogo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Dégradé Fond Cobalt / Saphir Royal Électrique -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="45%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0b1736" />
    </linearGradient>

    <!-- Éclairage Zénithal Subtil -->
    <linearGradient id="topGlow" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0" />
    </linearGradient>

    <!-- Blanc Pur Brillant -->
    <linearGradient id="pureWhite" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>

    <!-- Facettes Biseautées Lumineuses (Haut / Gauche) -->
    <linearGradient id="facetHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>

    <!-- Facettes Biseautées d'Ombre (Droite / Bas) -->
    <linearGradient id="facetShadow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>

    <!-- Ombre Portée 3D Réaliste -->
    <filter id="rShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="20" flood-color="#020617" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Fond Squircle iOS / Android -->
  <rect width="512" height="512" rx="118" fill="url(#bgGrad)" />
  <rect width="512" height="512" rx="118" fill="url(#topGlow)" />
  <rect width="508" height="508" x="2" y="2" rx="116" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" />

  <g filter="url(#rShadow)">
    
    <!-- 1. CORPS PRINCIPAL HAUT DU R (Fût supérieur + Boucle hexagonale + Jambe) -->
    <path
      fill-rule="evenodd"
      fill="url(#pureWhite)"
      d="M 152 104
         L 332 104
         L 408 180
         L 408 232
         L 352 288
         L 410 404
         L 330 404
         L 280 300
         L 196 300
         L 196 364
         L 112 280
         L 112 144
         Z
         M 196 176
         L 316 176
         L 348 208
         L 348 218
         L 312 254
         L 196 254
         Z"
    />

    <!-- 2. PIED INFÉRIEUR GAUCHE SCULPTÉ (Aligné à 135°) -->
    <path
      fill="url(#pureWhite)"
      d="M 112 316
         L 196 400
         L 196 404
         L 112 404
         Z"
    />

    <!-- 3. BISEAUX GÉOMÉTRIQUES CISELÉS (Effet 3D identique Concept 2) -->
    <!-- Biseau supérieur haut-gauche -->
    <polygon points="112,144 152,104 176,128 136,168" fill="url(#facetHighlight)" opacity="0.8" />
    
    <!-- Biseau supérieur boucle -->
    <polygon points="332,104 408,180 380,180 316,116" fill="url(#facetHighlight)" />
    
    <!-- Biseau latéral flanc droit -->
    <polygon points="408,180 408,232 380,218 380,180" fill="url(#facetShadow)" opacity="0.45" />
    
    <!-- Biseau retour inférieur boucle -->
    <polygon points="408,232 352,288 330,266 380,218" fill="url(#facetShadow)" opacity="0.65" />
    
    <!-- Biseau jambe diagonale droite -->
    <polygon points="352,288 410,404 380,404 330,302" fill="url(#facetShadow)" opacity="0.45" />

    <!-- Biseau lumière intérieure boucle (Highlight bas intérieur) -->
    <polygon points="196,254 312,254 348,218 338,218 306,246 196,246" fill="#ffffff" opacity="0.9" />

    <!-- Biseau fente 45° fût gauche -->
    <polygon points="112,280 196,364 196,354 122,280" fill="url(#facetShadow)" opacity="0.6" />
    <polygon points="112,316 196,400 186,400 112,326" fill="url(#facetHighlight)" opacity="0.7" />

  </g>
</svg>
`;

async function renderPerfect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #060911; color: #ffffff; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
          h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
          p { color: #94a3b8; font-size: 14px; margin-bottom: 28px; }
          .card { background: #0e1626; border: 1px solid #1e293b; border-radius: 28px; padding: 32px; display: flex; flex-direction: column; align-items: center; width: 420px; box-shadow: 0 25px 50px rgba(0,0,0,0.6); }
          .preview { width: 280px; height: 280px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; text-align: center; }
          .desc { font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.5; }
          .badge { margin-top: 14px; font-size: 11px; font-weight: 700; padding: 4px 14px; border-radius: 20px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
        </style>
      </head>
      <body>
        <h1>Logo Officiel REZO360 - Concept 2 Ciselé Haute Fidélité</h1>
        <p>Vecteur SVG pur, biseaux 3D à géométrie continue, 0 distorsion</p>
        <div class="card">
          <div class="preview">${perfectLogo}</div>
          <div class="title">R Architectural Ciselé (Concept 2 Officiel)</div>
          <div class="desc">Découpe 135° dynamique, biseaux zénithaux, facettes lumineuses et fond saphir profond.</div>
          <div class="badge">Master Vectoriel Conforme</div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'perfect_concept2_preview.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved perfect preview to:', outPath);
  await browser.close();
}

renderPerfect().catch(console.error);
