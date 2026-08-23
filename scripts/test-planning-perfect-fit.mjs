import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function testMobilePlanningTabs() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Test on standard 360px width (typical small Android or compact iPhone with margins)
  await page.setViewportSize({ width: 360, height: 260 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #070b14; color: #ffffff; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
          
          .tab-container {
            display: flex;
            align-items: center;
            gap: 4px;
            background: #0d1322;
            padding: 4px;
            border-radius: 14px;
            border: 1px solid #1e293b;
            width: 100%;
          }
          
          .tab-btn {
            flex: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 6px 4px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 700;
            color: #94a3b8;
            background: transparent;
            border: none;
            cursor: pointer;
            white-space: nowrap;
          }
          
          .tab-btn.active {
            background: #2563eb;
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(37,99,235,0.4);
          }
          
          .icon { width: 13px; height: 13px; flex-shrink: 0; }
        </style>
      </head>
      <body>
        <div style="font-size: 13px; font-weight: 800; color: #94a3b8;">Rendu Réel (Largeur 360px - Écran compact)</div>
        
        <div class="tab-container">
          <button class="tab-btn active">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="3" y1="10" y2="10"/></svg>
            <span>Agenda</span>
          </button>
          
          <button class="tab-btn">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m13 8 2-2 4 4-2 2"/><path d="M10 13c1 2 2 4 2 8"/><path d="M5.5 12.5C7.2 9.4 9.9 8.2 13 8c.6-3.1 3-5.2 6.5-5.5-.3 3.5-2.4 5.9-5.5 6.5-.2 3.1-1.4 5.8-4.5 7.5"/></svg>
            <span>Congés</span>
          </button>
          
          <button class="tab-btn">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>Tâches</span>
          </button>
          
          <button class="tab-btn">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
            <span>Fériés</span>
          </button>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'planning_tabs_perfect_fit.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved perfect fit test to:', outPath);
  await browser.close();
}

testMobilePlanningTabs().catch(console.error);
