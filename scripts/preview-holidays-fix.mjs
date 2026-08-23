import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateHolidaysPreview() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // Mobile iPhone 393 x 852
  await page.setViewportSize({ width: 393, height: 650 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #070b14; color: #ffffff; padding: 16px; display: flex; flex-direction: column; align-items: center; }
          
          .card-main {
            background: #0d1322;
            border: 1px solid #1e293b;
            border-radius: 16px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            max-width: 360px;
          }
          
          .top-row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
          }
          .title-area { display: flex; flex-direction: column; gap: 2px; }
          .title { font-size: 13.5px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 6px; }
          .subtitle { font-size: 11px; color: #94a3b8; }
          .badge-count {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
            font-size: 10px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 8px;
            white-space: nowrap;
            flex-shrink: 0;
            font-family: monospace;
          }
          
          .dropdown-box {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 10px;
            padding: 7px 12px;
            width: fit-content;
          }
          .dropdown-label { font-size: 11px; color: #94a3b8; font-weight: 600; white-space: nowrap; }
          .dropdown-val { font-size: 12px; color: #f8fafc; font-weight: 700; background: transparent; border: none; }
          
          /* Chips row */
          .chips-row {
            display: flex;
            align-items: center;
            gap: 6px;
            overflow-x: auto;
            white-space: nowrap;
            padding-bottom: 4px;
            margin: 0 -14px;
            padding-left: 14px;
            padding-right: 14px;
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
            box-shadow: 0 2px 6px rgba(37,99,235,0.3);
          }
          
          .grid-holidays {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
            max-width: 360px;
            margin-top: 10px;
          }
          .holiday-card {
            background: #0d1322;
            border: 1px solid #1e293b;
            border-radius: 10px;
            padding: 8px 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
          }
          .h-name { font-size: 11px; font-weight: 700; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .h-date { font-size: 9.5px; color: #64748b; font-family: monospace; }
          .h-tag { font-size: 8.5px; padding: 2px 5px; border-radius: 4px; background: rgba(244,63,94,0.1); color: #fb7185; border: 1px solid rgba(244,63,94,0.2); font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card-main">
          <div class="top-row">
            <div class="title-area">
              <div class="title">
                <span>Calendrier des Jours Fériés Légaux</span>
                <span>🇫🇷</span>
              </div>
              <div class="subtitle">Calcul automatique des jours ouvrés et majorations</div>
            </div>
            <div class="badge-count">11 Fériés (2026)</div>
          </div>
          
          <div class="dropdown-box">
            <span style="font-size: 13px;">🌐</span>
            <span class="dropdown-label">Territoire :</span>
            <span class="dropdown-val">🇫🇷 France Métropolitaine ▼</span>
          </div>
          
          <div class="chips-row">
            <div class="chip-pill active"><span>🇫🇷</span><span>France Métropolitaine</span></div>
            <div class="chip-pill"><span>🇬🇵</span><span>Guadeloupe (971)</span></div>
            <div class="chip-pill"><span>🇲🇶</span><span>Martinique (972)</span></div>
            <div class="chip-pill"><span>🇬🇫</span><span>Guyane (973)</span></div>
            <div class="chip-pill"><span>🇷🇪</span><span>La Réunion (974)</span></div>
            <div class="chip-pill"><span>🇾🇹</span><span>Mayotte (976)</span></div>
          </div>
        </div>
        
        <div class="grid-holidays">
          <div class="holiday-card">
            <div style="min-width: 0; flex: 1;">
              <div class="h-name">Jour de l'An</div>
              <div class="h-date">01/01/2026</div>
            </div>
            <span class="h-tag">Férié</span>
          </div>
          <div class="holiday-card">
            <div style="min-width: 0; flex: 1;">
              <div class="h-name">Lundi de Pâques</div>
              <div class="h-date">06/04/2026</div>
            </div>
            <span class="h-tag">Férié</span>
          </div>
          <div class="holiday-card">
            <div style="min-width: 0; flex: 1;">
              <div class="h-name">Fête du Travail</div>
              <div class="h-date">01/05/2026</div>
            </div>
            <span class="h-tag">Férié</span>
          </div>
          <div class="holiday-card">
            <div style="min-width: 0; flex: 1;">
              <div class="h-name">Victoire 1945</div>
              <div class="h-date">08/05/2026</div>
            </div>
            <span class="h-tag">Férié</span>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'holidays_mobile_fix.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved holidays fix preview to:', outPath);
  await browser.close();
}

generateHolidaysPreview().catch(console.error);
