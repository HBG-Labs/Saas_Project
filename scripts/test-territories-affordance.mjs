import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function testTerritoryScrollAffordance() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 900, height: 500 });

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
          
          .row-comparisons { display: flex; gap: 32px; justify-content: center; width: 100%; max-width: 840px; }
          
          .mock-screen {
            width: 375px;
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
          
          .scroll-wrapper {
            position: relative;
            width: 100%;
            overflow: hidden;
          }
          
          .chips-row {
            display: flex;
            align-items: center;
            gap: 6px;
            overflow-x: auto;
            white-space: nowrap;
            padding-bottom: 4px;
            scrollbar-width: none;
          }
          .chips-row::-webkit-scrollbar { display: none; }
          
          .chip-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 6px 11px;
            border-radius: 10px;
            font-size: 11.5px;
            font-weight: 600;
            color: #94a3b8;
            background: #111827;
            border: 1px solid #1e293b;
            flex-shrink: 0;
          }
          .chip-pill.active {
            background: #2563eb;
            color: #ffffff;
            border-color: #3b82f6;
            box-shadow: 0 2px 8px rgba(37,99,235,0.4);
          }
          
          .edge-fade-right {
            position: absolute;
            right: 0;
            top: 0;
            bottom: 4px;
            width: 32px;
            background: linear-gradient(to left, #0d1322, transparent);
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 2px;
          }
          .edge-chevron {
            font-size: 10px;
            color: #60a5fa;
            opacity: 0.8;
          }
          
          .explanation { font-size: 11.5px; color: #94a3b8; line-height: 1.5; background: rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 10px; }
          .explanation strong { color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1>Territoires : Clarté du Défilement & Libellés Concis</h1>
          <p class="subtitle">Libellés courts et indicateur visuel de défilement horizontal</p>
        </div>
        
        <div class="row-comparisons">
          <!-- AVANT : Noms ultra longs -> Seulement 1.5 pastille visible -->
          <div class="mock-screen">
            <div class="title-tag tag-bad">❌ Avant</div>
            <div style="font-size: 13px; font-weight: 800;">Jours Fériés</div>
            
            <div class="scroll-wrapper">
              <div class="chips-row">
                <div class="chip-pill active"><span>🇫🇷</span><span>France Métropolitaine</span></div>
                <div class="chip-pill"><span>🇬🇵</span><span>Guadeloupe (971)</span></div>
                <div class="chip-pill"><span>🇲🇶</span><span>MQ...</span></div>
              </div>
            </div>
            
            <div class="explanation">
              ⚠️ <strong>Problème :</strong> « France Métropolitaine » est trop long. Seulement 1,5 pastille est visible et la coupure est nette.
            </div>
          </div>
          
          <!-- APRÈS : Libellés courts + Fondu défilement -->
          <div class="mock-screen">
            <div class="title-tag tag-good">✅ Solution</div>
            <div style="font-size: 13px; font-weight: 800;">Jours Fériés</div>
            
            <div class="scroll-wrapper">
              <div class="chips-row" style="padding-right: 24px;">
                <div class="chip-pill active"><span>🇫🇷</span><span>Métropole</span></div>
                <div class="chip-pill"><span>🇬🇵</span><span>Guadeloupe</span></div>
                <div class="chip-pill"><span>🇲🇶</span><span>Martinique</span></div>
                <div class="chip-pill"><span>🇬🇫</span><span>Guyane</span></div>
                <div class="chip-pill"><span>🇷🇪</span><span>Réunion</span></div>
                <div class="chip-pill"><span>🇾🇹</span><span>Mayotte</span></div>
                <div class="chip-pill"><span>🇫🇷</span><span>Alsace</span></div>
              </div>
              <div class="edge-fade-right">
                <span class="edge-chevron">›</span>
              </div>
            </div>
            
            <div class="explanation">
              ✨ <strong>Résultat :</strong> 
              1. Libellés courts (<em>Métropole, Guadeloupe, Martinique...</em>) permettant de voir <strong>3 à 4 territoires d'un coup</strong>.<br>
              2. <strong>Effet de fondu doux avec micro-indicateur (›)</strong> sur le bord droit signalant immédiatement le défilement !
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'territories_scroll_affordance.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved territories affordance test to:', outPath);
  await browser.close();
}

testTerritoryScrollAffordance().catch(console.error);
