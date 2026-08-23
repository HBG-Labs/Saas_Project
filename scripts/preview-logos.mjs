import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

// Définitions des 3 nouveaux modèles vectoriels haute précision

// 1. Modèle 1 : Pure Minimalist High-Tech R (Clean, bold, silhouette parfaite, 0 artifact)
const logo1 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#1e3a8a" />
    </linearGradient>
    <linearGradient id="rGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </linearGradient>
    <filter id="shadow1" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.4" />
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="112" fill="url(#bg1)" />
  <rect width="508" height="508" x="2" y="2" rx="110" fill="none" stroke="#ffffff" stroke-opacity="0.15" stroke-width="2" />
  
  <!-- Forme R unifiée continue en EvenOdd (parfaitement proportionnée) -->
  <path
    fill-rule="evenodd"
    fill="url(#rGrad1)"
    filter="url(#shadow1)"
    d="M 128 116
       L 316 116
       L 384 184
       L 384 228
       L 332 280
       L 388 388
       L 308 388
       L 256 284
       L 204 284
       L 204 388
       L 128 388
       Z
       M 204 188
       L 300 188
       L 324 212
       L 324 220
       L 296 248
       L 204 248
       Z"
  />
</svg>
`;

// 2. Modèle 2 : Architectural 3D Faceté Parfait (Construit avec maillage géométrique continu sans chevauchement)
const logo2 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    
    <linearGradient id="stemFace" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>
    
    <linearGradient id="topBevel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>

    <linearGradient id="rightBevel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f1f5f9" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>

    <linearGradient id="bottomBevel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#94a3b8" />
      <stop offset="100%" stop-color="#64748b" />
    </linearGradient>

    <linearGradient id="legFace" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </linearGradient>

    <filter id="shadow2" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#020617" flood-opacity="0.5" />
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="112" fill="url(#bg2)" />
  <rect width="508" height="508" x="2" y="2" rx="110" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2" />
  
  <g filter="url(#shadow2)">
    <!-- Base R en silhouette blanche pure -->
    <path
      fill-rule="evenodd"
      fill="#ffffff"
      d="M 128 116
         L 320 116
         L 384 180
         L 384 224
         L 332 276
         L 388 388
         L 308 388
         L 256 280
         L 204 280
         L 204 388
         L 128 388
         Z
         M 204 180
         L 304 180
         L 324 200
         L 324 212
         L 296 240
         L 204 240
         Z"
    />

    <!-- Facettes d'ombrage 3D précises & élégantes -->
    <!-- Biseau extérieur haut-droit -->
    <polygon points="320,116 384,180 356,180 304,128" fill="url(#topBevel)" />
    <!-- Biseau extérieur flanc droit -->
    <polygon points="384,180 384,224 356,212 356,180" fill="url(#rightBevel)" />
    <!-- Biseau courbe retour -->
    <polygon points="384,224 332,276 308,252 356,212" fill="url(#bottomBevel)" opacity="0.35" />
    
    <!-- Ombrage intérieur de la boucle (Counter 3D) -->
    <polygon points="204,180 304,180 324,200 304,192 204,192" fill="#94a3b8" opacity="0.4" />
    <polygon points="324,200 324,212 316,212 324,200" fill="#64748b" opacity="0.3" />
    <polygon points="324,212 296,240 204,240 204,232 288,232 316,204" fill="#ffffff" opacity="0.6" />

    <!-- Ombre sous la jonction jambe -->
    <polygon points="256,280 204,280 204,272 264,272" fill="#94a3b8" opacity="0.5" />
    
    <!-- Biseau latéral jambe diagonale -->
    <polygon points="332,276 388,388 360,388 312,288" fill="url(#rightBevel)" opacity="0.45" />
  </g>
</svg>
`;

// 3. Modèle 3 : Dynamic Ribbon / Two-Piece Tech R (Structure high-tech ultra-moderne, zéro bavure)
const logo3 = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="50%" stop-color="#1e40af" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    
    <linearGradient id="piece1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>

    <linearGradient id="piece2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>

    <filter id="shadow3" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#020617" flood-opacity="0.45" />
    </filter>
  </defs>
  
  <rect width="512" height="512" rx="112" fill="url(#bg3)" />
  <rect width="508" height="508" x="2" y="2" rx="110" fill="none" stroke="#ffffff" stroke-opacity="0.15" stroke-width="2" />
  
  <g filter="url(#shadow3)">
    <!-- Montant vertical gauche sculpté avec biseau supérieur et inférieur -->
    <path
      fill="url(#piece1)"
      d="M 124 136
         L 196 136
         L 196 388
         L 124 388
         Z"
    />

    <!-- Boucle et Jambe dynamique formant un ruban continu haute précision -->
    <path
      fill-rule="evenodd"
      fill="url(#piece2)"
      d="M 216 136
         L 320 136
         L 384 200
         L 384 232
         L 336 280
         L 388 388
         L 308 388
         L 264 292
         L 216 292
         L 216 228
         L 308 228
         L 328 208
         L 300 180
         L 216 180
         Z"
    />
  </g>
</svg>
`;

async function renderComparison() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 600 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #0b0f19; color: #ffffff; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
          h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }
          p { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }
          .grid { display: flex; gap: 40px; justify-content: center; }
          .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 24px; padding: 24px; display: flex; flex-direction: column; align-items: center; width: 320px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .preview { width: 200px; height: 200px; margin-bottom: 20px; }
          .title { font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; }
          .desc { font-size: 12px; color: #64748b; text-align: center; line-height: 1.4; }
          .badge { margin-top: 12px; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        </style>
      </head>
      <body>
        <h1>Comparatif Vectoriel Professionnel REZO360</h1>
        <p>Génération vectorielle SVG pure, géométrie équilibrée, zéro distorsion</p>
        <div class="grid">
          <div class="card">
            <div class="preview">${logo1}</div>
            <div class="title">Option A : Tech Chamfered R</div>
            <div class="desc">Monogramme épuré, silhouette continue, équilibre parfait des masses, netteté absolue sur écran Retina & mobile.</div>
            <div class="badge">Recommandé Standard</div>
          </div>
          <div class="card">
            <div class="preview">${logo2}</div>
            <div class="title">Option B : 3D Architectural R</div>
            <div class="desc">Volume biseauté haute précision, facettes lumineuses géométriques continues sans aucun chevauchement.</div>
            <div class="badge">Premium 3D</div>
          </div>
          <div class="card">
            <div class="preview">${logo3}</div>
            <div class="title">Option C : Dynamic Split R</div>
            <div class="desc">Structure en deux pièces d'ingénierie (fût vertical + ruban dynamique), style SaaS moderne et percutant.</div>
            <div class="badge">High-Tech Ribbon</div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'logo_vector_comparison.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved preview to:', outPath);
  await browser.close();
}

renderComparison().catch(console.error);
