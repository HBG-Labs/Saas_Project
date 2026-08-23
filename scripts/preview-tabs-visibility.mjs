import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateMobileTabsVisualComparison() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 900, height: 600 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #070b14; color: #ffffff; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
          
          .header-box { text-align: center; max-width: 800px; }
          h1 { font-size: 22px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
          p.subtitle { color: #94a3b8; font-size: 13px; }
          
          .row-comparisons { display: flex; gap: 32px; justify-content: center; width: 100%; max-width: 820px; }
          
          .mock-screen {
            width: 360px;
            background: #0d1322;
            border: 2px solid #1e293b;
            border-radius: 24px;
            padding: 18px 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: 0 12px 35px -10px rgba(0,0,0,0.6);
          }
          
          .title-tag { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 8px; width: fit-content; }
          .tag-bad { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
          .tag-good { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
          
          .tab-bar-bad {
            display: flex;
            align-items: center;
            gap: 8px;
            overflow-x: hidden;
            border-bottom: 1px solid #1e293b;
            padding-bottom: 10px;
            position: relative;
          }
          .tab-bar-good {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            border-bottom: 1px solid #1e293b;
            padding-bottom: 10px;
          }
          
          .tab-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            background: #111827;
            border: 1px solid #1e293b;
            white-space: nowrap;
          }
          .tab-pill.active {
            background: #2563eb;
            color: #ffffff;
            border-color: #3b82f6;
            box-shadow: 0 2px 8px rgba(37,99,235,0.4);
          }
          
          .tab-pill-flex {
            flex: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 8px 10px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            background: #111827;
            border: 1px solid #1e293b;
            white-space: nowrap;
          }
          .tab-pill-flex.active {
            background: #2563eb;
            color: #ffffff;
            border-color: #3b82f6;
            box-shadow: 0 2px 8px rgba(37,99,235,0.4);
          }
          
          .explanation { font-size: 11.5px; color: #94a3b8; line-height: 1.5; background: rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 10px; }
          .explanation strong { color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1>Résolution de la visibilité des boutons sur mobile</h1>
          <p class="subtitle">Comment l'utilisateur voit immédiatement toutes les options sans avoir à deviner</p>
        </div>
        
        <div class="row-comparisons">
          <!-- AVANT : Textes trop longs -> le 3e bouton sort de l'écran sans qu'on le sache -->
          <div class="mock-screen">
            <div class="title-tag tag-bad">❌ Avant (Libellés longs)</div>
            <div style="font-size: 14px; font-weight: 800;">Missions</div>
            
            <div class="tab-bar-bad">
              <div class="tab-pill active"><span>📋</span><span>Missions & Chantiers</span></div>
              <div class="tab-pill"><span>📑</span><span>Contrôle & Rapports</span></div>
              <!-- Le 3e est coupé ! -->
            </div>
            
            <div class="explanation">
              ⚠️ <strong>Problème :</strong> Le texte est trop long, donc le bouton <em>« Dossiers clôturés »</em> est hors-écran à droite et invisible. L'utilisateur ne sait pas qu'il existe !
            </div>
          </div>
          
          <!-- APRÈS : Libellés adaptatifs -> Les 3 boutons tiennent 100% à l'écran -->
          <div class="mock-screen">
            <div class="title-tag tag-good">✅ Solution (Libellés adaptatifs)</div>
            <div style="font-size: 14px; font-weight: 800;">Missions</div>
            
            <div class="tab-bar-good">
              <div class="tab-pill-flex active"><span>📋</span><span>Missions</span></div>
              <div class="tab-pill-flex"><span>📑</span><span>Rapports</span></div>
              <div class="tab-pill-flex"><span>🗄️</span><span>Archives</span></div>
            </div>
            
            <div class="explanation">
              ✨ <strong>Résultat :</strong> Sur mobile, les libellés sont concis (<em>Missions</em>, <em>Rapports</em>, <em>Archives</em>) et s'affichent <strong>tous les trois en même temps à 100%</strong> sur l'écran. Zéro bouton caché !
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'mobile_tabs_visibility_fix.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved visual comparison to:', outPath);
  await browser.close();
}

generateMobileTabsVisualComparison().catch(console.error);
