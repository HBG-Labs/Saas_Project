import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generatePlanningTabsComparison() {
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
          
          .tab-bar-bad {
            display: flex;
            align-items: center;
            gap: 6px;
            overflow-x: hidden;
            background: #111827;
            padding: 4px;
            border-radius: 14px;
            border: 1px solid #1e293b;
          }
          
          .tab-bar-good {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 4px;
            background: #111827;
            padding: 4px;
            border-radius: 14px;
            border: 1px solid #1e293b;
          }
          
          .tab-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            white-space: nowrap;
          }
          .tab-pill.active {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(37,99,235,0.4);
          }
          
          .tab-pill-flex {
            flex: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 6px 6px;
            border-radius: 10px;
            font-size: 11.5px;
            font-weight: 700;
            color: #94a3b8;
            white-space: nowrap;
          }
          .tab-pill-flex.active {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(37,99,235,0.4);
          }
          
          .explanation { font-size: 11.5px; color: #94a3b8; line-height: 1.5; background: rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 10px; }
          .explanation strong { color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1>Planning : Optimisation des 4 volets sur Mobile</h1>
          <p class="subtitle">Visibilité immédiate des 4 onglets : Agenda, Congés, Récurrent, Fériés</p>
        </div>
        
        <div class="row-comparisons">
          <!-- AVANT : Textes longs -> Seulement 1.5 onglet visible -->
          <div class="mock-screen">
            <div class="title-tag tag-bad">❌ Avant (Libellés longs)</div>
            <div style="font-size: 14px; font-weight: 800;">Planning & Congés</div>
            
            <div class="tab-bar-bad">
              <div class="tab-pill active"><span>📅</span><span>Calendrier & Agenda</span></div>
              <div class="tab-pill"><span>🌴</span><span>Congés & Absences</span></div>
              <!-- Récurrent et Fériés coupés ! -->
            </div>
            
            <div class="explanation">
              ⚠️ <strong>Problème :</strong> Les intitulés longs prennent toute la place. Les onglets <em>« Tâches Récurrentes »</em> et <em>« Jours Fériés »</em> sont totalement invisibles à droite.
            </div>
          </div>
          
          <!-- APRÈS : Libellés adaptatifs -> Les 4 onglets tiennent simultanément -->
          <div class="mock-screen">
            <div class="title-tag tag-good">✅ Solution (4 boutons visibles)</div>
            <div style="font-size: 14px; font-weight: 800;">Planning & Congés</div>
            
            <div class="tab-bar-good">
              <div class="tab-pill-flex active"><span>📅</span><span>Agenda</span></div>
              <div class="tab-pill-flex"><span>🌴</span><span>Congés</span></div>
              <div class="tab-pill-flex"><span>🔄</span><span>Récurrent</span></div>
              <div class="tab-pill-flex"><span>🇫🇷</span><span>Fériés</span></div>
            </div>
            
            <div class="explanation">
              ✨ <strong>Résultat :</strong> Grâce aux libellés adaptatifs (<em>Agenda</em>, <em>Congés</em>, <em>Récurrent</em>, <em>Fériés</em> sur mobile / noms complets sur PC), <strong>les 4 boutons sont 100% visibles en même temps</strong> !
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'planning_4_tabs_mobile_fix.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved planning 4 tabs preview to:', outPath);
  await browser.close();
}

generatePlanningTabsComparison().catch(console.error);
