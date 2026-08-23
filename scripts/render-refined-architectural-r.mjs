import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

// ─── 1. MODÈLE 2A : EXACT CONCEPT 2 ARCHITECTURAL (BLANC PUR ULTRA-NET) ───
// Reproduit fidèlement la géométrie du Concept 2 :
// - Fût gauche avec découpe angulaire 45°
// - Fente dynamique à 45° entre le pied gauche et la boucle
// - Boucle supérieure hexagonale/chamfered
// - Jambe droite dynamique puissante
const logo2A = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg2A" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="60%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="whiteGrad2A" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>
    <filter id="shadow2A" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#020617" flood-opacity="0.5" />
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="115" fill="url(#bg2A)" />
  <rect width="508" height="508" x="2" y="2" rx="113" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" />
  
  <g filter="url(#shadow2A)">
    <!-- 1. Fût inférieur gauche (Pied dynamique) -->
    <path
      fill="url(#whiteGrad2A)"
      d="M 136 388
         L 136 324
         L 196 264
         L 196 388
         Z"
    />
    
    <!-- 2. Pièce supérieure : Fût haut + Boucle + Jambe avec fente 45° -->
    <path
      fill-rule="evenodd"
      fill="url(#whiteGrad2A)"
      d="M 136 124
         L 320 124
         L 388 192
         L 388 236
         L 336 288
         L 392 388
         L 312 388
         L 262 292
         L 204 292
         L 136 360
         L 136 124
         Z
         M 196 184
         L 300 184
         L 328 212
         L 328 220
         L 296 252
         L 196 252
         Z"
    />
  </g>
</svg>
`;

// ─── 2. MODÈLE 2B : EXACT CONCEPT 2 SCULPTÉ 3D BISEAUTÉ (FIDÈLE AU MOCKUP) ───
const logo2B = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg2B" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#09101f" />
    </linearGradient>

    <!-- Dégradés facettes 3D -->
    <linearGradient id="faceWhite" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </linearGradient>
    <linearGradient id="bevelLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>
    <linearGradient id="bevelDark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#94a3b8" />
      <stop offset="100%" stop-color="#64748b" />
    </linearGradient>
    <linearGradient id="bevelMid" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e2e8f0" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>

    <filter id="shadow2B" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#020617" flood-opacity="0.6" />
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="115" fill="url(#bg2B)" />
  <rect width="508" height="508" x="2" y="2" rx="113" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2" />
  
  <g filter="url(#shadow2B)">
    <!-- 1. PIED INFÉRIEUR GAUCHE (Sculpté 3D) -->
    <!-- Face frontale pied -->
    <polygon points="144,388 144,332 196,280 196,388" fill="url(#faceWhite)" />
    <!-- Biseau d'ombrage gauche -->
    <polygon points="136,388 144,388 144,332 136,340" fill="url(#bevelLight)" />
    <!-- Biseau d'ombrage supérieur 45° -->
    <polygon points="136,340 144,332 196,280 188,272" fill="url(#bevelDark)" opacity="0.6" />

    <!-- 2. CORPS SUPÉRIEUR R (Sculpté 3D) -->
    <!-- Base R pleine -->
    <path
      fill-rule="evenodd"
      fill="url(#faceWhite)"
      d="M 136 124
         L 320 124
         L 388 192
         L 388 236
         L 336 288
         L 392 388
         L 312 388
         L 262 292
         L 204 292
         L 144 352
         L 144 140
         L 136 140
         Z
         M 196 184
         L 300 184
         L 328 212
         L 328 220
         L 296 252
         L 196 252
         Z"
    />

    <!-- Facette biseautée haut-droit -->
    <polygon points="320,124 388,192 358,192 300,134" fill="url(#bevelLight)" />
    <!-- Facette biseautée flanc droit -->
    <polygon points="388,192 388,236 358,222 358,192" fill="url(#bevelMid)" />
    <!-- Facette retour boucle -->
    <polygon points="388,236 336,288 312,264 358,222" fill="url(#bevelDark)" opacity="0.7" />
    
    <!-- Facette biseautée jambe droite -->
    <polygon points="336,288 392,388 362,388 312,300" fill="url(#bevelMid)" />
    <!-- Biseau d'ombrage sous la jambe -->
    <polygon points="312,388 392,388 384,394 304,394" fill="url(#bevelDark)" opacity="0.8" />

    <!-- Éclairage intérieur de la boucle (Counter) -->
    <polygon points="196,184 300,184 328,212 304,204 196,204" fill="url(#bevelDark)" opacity="0.5" />
    <polygon points="328,212 328,220 318,220 328,212" fill="url(#bevelDark)" opacity="0.4" />
    <polygon points="328,220 296,252 196,252 196,244 286,244 316,214" fill="#ffffff" opacity="0.7" />

    <!-- Fente 45° ombre de découpe -->
    <polygon points="204,292 144,352 136,360 196,300" fill="url(#bevelDark)" opacity="0.7" />
  </g>
</svg>
`;

// ─── 3. MODÈLE 2C : GEOMETRIC MONOLITH (FÛT PLEIN, ÉPURÉ, CHANFREINS 45°) ───
const logo2C = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg2C" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="60%" stop-color="#1e40af" />
      <stop offset="100%" stop-color="#0b1329" />
    </linearGradient>
    <linearGradient id="whiteGrad2C" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <filter id="shadow2C" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#020617" flood-opacity="0.5" />
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="115" fill="url(#bg2C)" />
  <rect width="508" height="508" x="2" y="2" rx="113" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" />
  
  <!-- Silhouette monolithique pleine, chanfreinée à 45° sur les 4 sommets clés -->
  <path
    fill-rule="evenodd"
    fill="url(#whiteGrad2C)"
    filter="url(#shadow2C)"
    d="M 136 128
       L 316 128
       L 384 196
       L 384 236
       L 336 284
       L 392 384
       L 316 384
       L 268 288
       L 204 288
       L 204 384
       L 136 384
       Z
       M 204 188
       L 300 188
       L 328 216
       L 328 224
       L 296 248
       L 204 248
       Z"
  />
</svg>
`;

// ─── 4. MODÈLE 2D : ULTRA-SHARP CONTEMPORARY (AVEC CHANFREIN BAS GAUCHE & HAUT GAUCHE) ───
const logo2D = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg2D" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="whiteGrad2D" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>
    <filter id="shadow2D" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#020617" flood-opacity="0.5" />
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="115" fill="url(#bg2D)" />
  <rect width="508" height="508" x="2" y="2" rx="113" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" />
  
  <path
    fill-rule="evenodd"
    fill="url(#whiteGrad2D)"
    filter="url(#shadow2D)"
    d="M 164 124
       L 320 124
       L 388 192
       L 388 236
       L 336 288
       L 392 388
       L 316 388
       L 264 288
       L 204 288
       L 204 360
       L 176 388
       L 136 388
       L 136 152
       Z
       M 204 184
       L 300 184
       L 328 212
       L 328 220
       L 296 248
       L 204 248
       Z"
  />
</svg>
`;

async function renderRefinedComparison() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 620 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #080c16; color: #ffffff; padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
          h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
          p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
          .grid { display: flex; gap: 24px; justify-content: center; }
          .card { background: #111827; border: 1px solid #1f2937; border-radius: 20px; padding: 20px; display: flex; flex-direction: column; align-items: center; width: 310px; box-shadow: 0 16px 36px rgba(0,0,0,0.5); }
          .preview { width: 180px; height: 180px; margin-bottom: 16px; }
          .title { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; text-align: center; }
          .desc { font-size: 11px; color: #64748b; text-align: center; line-height: 1.4; }
          .badge { margin-top: 10px; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        </style>
      </head>
      <body>
        <h1>Nouvelle Génération Logo REZO360 (Concept 2 Vectoriel Pur)</h1>
        <p>4 Déclinaisons vectorielles ultra-nettes, zéro polygone bancal, géométrie équilibrée</p>
        <div class="grid">
          <div class="card">
            <div class="preview">${logo2A}</div>
            <div class="title">Modèle 1 : Architectural Dynamique (Blanc Pur)</div>
            <div class="desc">Fente 45° sculptée identique au Concept 2, silhouette vectorielle pleine et ultra-nette à toute échelle.</div>
            <div class="badge">Recommandé #1</div>
          </div>
          <div class="card">
            <div class="preview">${logo2B}</div>
            <div class="title">Modèle 2 : Architectural 3D Biseauté (Relief)</div>
            <div class="desc">Exact rendu facetté avec éclairage biseauté zénithal, sans aucun chevauchement de polygones.</div>
            <div class="badge">Relief Métallique</div>
          </div>
          <div class="card">
            <div class="preview">${logo2C}</div>
            <div class="title">Modèle 3 : Monolithe Géométrique Continu</div>
            <div class="desc">Fût plein, angles chanfreinés à 45°, boucle et jambe unifiées. Simplicité et solidité corporate.</div>
            <div class="badge">Corporate Robuste</div>
          </div>
          <div class="card">
            <div class="preview">${logo2D}</div>
            <div class="title">Modèle 4 : Tech Chamfered Angles</div>
            <div class="desc">Biseaux dynamiques sur le haut-gauche et le bas-gauche du fût pour un look tech racé.</div>
            <div class="badge">Moderne & Dynamique</div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'refined_logo_comparison.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved preview to:', outPath);
  await browser.close();
}

renderRefinedComparison().catch(console.error);
