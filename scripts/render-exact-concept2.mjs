import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

// Version exacte avec fente 135° (Haut-Gauche vers Bas-Droite) conforme à l'image 1 de l'utilisateur

const logoExact1 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Dégradé Fond Saphir Royal Électrique -->
    <linearGradient id="exBg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0c1a3a" />
    </linearGradient>

    <!-- Éclairage Zénithal Doux -->
    <linearGradient id="exGlow1" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0" />
    </linearGradient>

    <!-- Blanc Pur avec relief lumineux -->
    <linearGradient id="exWhite1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </linearGradient>

    <!-- Facettes Biseautées Lumineuses -->
    <linearGradient id="bevelLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>
    <linearGradient id="bevelDark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>

    <!-- Ombre portée portée sous le R -->
    <filter id="exShadow1" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#020617" flood-opacity="0.55" />
    </filter>
  </defs>

  <!-- Fond Squircle -->
  <rect width="512" height="512" rx="118" fill="url(#exBg1)" />
  <rect width="512" height="512" rx="118" fill="url(#exGlow1)" />
  <rect width="508" height="508" x="2" y="2" rx="116" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" />

  <g filter="url(#exShadow1)">
    <!-- 1. CORPS PRINCIPAL HAUT : Fût supérieur + Boucle + Fente 135° -->
    <path
      fill-rule="evenodd"
      fill="url(#exWhite1)"
      d="M 152 108
         L 326 108
         L 400 182
         L 400 232
         L 344 288
         L 402 404
         L 324 404
         L 274 304
         L 196 304
         L 196 360
         L 112 276
         L 112 148
         Z
         M 196 178
         L 310 178
         L 340 208
         L 340 218
         L 306 252
         L 196 252
         Z"
    />

    <!-- 2. PIED INFÉRIEUR GAUCHE SCULPTÉ (Aligné à 135°) -->
    <path
      fill="url(#exWhite1)"
      d="M 112 312
         L 196 396
         L 196 404
         L 112 404
         Z"
    />

    <!-- 3. BISEAUX 3D HAUTE PRÉCISION (Exact Image 1) -->
    <!-- Biseau supérieur boucle -->
    <polygon points="326,108 400,182 372,182 310,120" fill="url(#bevelLight)" />
    <!-- Biseau latéral droit -->
    <polygon points="400,182 400,232 372,218 372,182" fill="url(#bevelDark)" opacity="0.4" />
    <!-- Biseau retour boucle -->
    <polygon points="400,232 344,288 322,266 372,218" fill="url(#bevelDark)" opacity="0.6" />
    <!-- Biseau jambe diagonale -->
    <polygon points="344,288 402,404 374,404 322,300" fill="url(#bevelDark)" opacity="0.45" />

    <!-- Biseau zénithal fût gauche -->
    <polygon points="112,148 152,108 174,130 134,170" fill="url(#bevelLight)" opacity="0.7" />
  </g>
</svg>
`;

// Version 2 : Même géométrie exacte en Blanc Pur 100% Flat & Ultra-Sharp
const logoExact2 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="exBg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0c1a3a" />
    </linearGradient>

    <linearGradient id="exGlow2" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0" />
    </linearGradient>

    <linearGradient id="exWhite2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>

    <filter id="exShadow2" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#020617" flood-opacity="0.55" />
    </filter>
  </defs>

  <rect width="512" height="512" rx="118" fill="url(#exBg2)" />
  <rect width="512" height="512" rx="118" fill="url(#exGlow2)" />
  <rect width="508" height="508" x="2" y="2" rx="116" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2" />

  <g filter="url(#exShadow2)">
    <!-- 1. CORPS PRINCIPAL HAUT -->
    <path
      fill-rule="evenodd"
      fill="url(#exWhite2)"
      d="M 152 108
         L 326 108
         L 400 182
         L 400 232
         L 344 288
         L 402 404
         L 324 404
         L 274 304
         L 196 304
         L 196 360
         L 112 276
         L 112 148
         Z
         M 196 178
         L 310 178
         L 340 208
         L 340 218
         L 306 252
         L 196 252
         Z"
    />

    <!-- 2. PIED INFÉRIEUR GAUCHE -->
    <path
      fill="url(#exWhite2)"
      d="M 112 312
         L 196 396
         L 196 404
         L 112 404
         Z"
    />
  </g>
</svg>
`;

async function renderExact() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1000, height: 560 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #060911; color: #ffffff; padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
          h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
          p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
          .grid { display: flex; gap: 32px; justify-content: center; }
          .card { background: #0e1626; border: 1px solid #1e293b; border-radius: 24px; padding: 24px; display: flex; flex-direction: column; align-items: center; width: 380px; box-shadow: 0 20px 45px rgba(0,0,0,0.6); }
          .preview { width: 240px; height: 240px; margin-bottom: 18px; }
          .title { font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; text-align: center; }
          .desc { font-size: 12px; color: #64748b; text-align: center; line-height: 1.4; }
          .badge { margin-top: 12px; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; background: rgba(59, 130, 246, 0.18); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35); }
        </style>
      </head>
      <body>
        <h1>Reproduction Vectorielle Exacte du Concept 2</h1>
        <p>Orientation 135° exacte, biseaux ciselés, géométrie vectorielle mathématique pure</p>
        <div class="grid">
          <div class="card">
            <div class="preview">${logoExact1}</div>
            <div class="title">Option 1 : Ciselé 3D avec Biseaux Lumineux</div>
            <div class="desc">Reproduction fidèle du visuel de référence avec les facettes d'ombrage lumineuses sur les arêtes 45°.</div>
            <div class="badge">Identique Référence 3D</div>
          </div>
          <div class="card">
            <div class="preview">${logoExact2}</div>
            <div class="title">Option 2 : Blanc Pur Minimaliste (Flat Sharp)</div>
            <div class="desc">Même géométrie sculptée, en silhouette blanche pure avec ombre portée douce. Netteté vectorielle maximale.</div>
            <div class="badge">Pureté & Contraste</div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'exact_concept2_comparison.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved exact preview to:', outPath);
  await browser.close();
}

renderExact().catch(console.error);
