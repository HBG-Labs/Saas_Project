import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateCustomizerPreview() {
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
          body { background: #070b14; color: #ffffff; padding: 24px; display: flex; align-items: center; justify-content: center; height: 100vh; }
          
          .preview-container {
            width: 820px;
            height: 520px;
            background: #0d1322;
            border: 1px solid #1e293b;
            border-radius: 20px;
            position: relative;
            overflow: hidden;
            display: flex;
          }
          
          .main-content {
            flex: 1;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          
          .mock-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 16px;
            border-bottom: 1px solid #1e293b;
          }
          
          .overlay-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(2px);
          }
          
          /* Panneau Customizer Radix */
          .customizer-drawer {
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 320px;
            background: #0f172a;
            border-left: 1px solid #334155;
            box-shadow: -10px 0 30px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            z-index: 10;
          }
          
          .drawer-header {
            padding: 16px;
            border-bottom: 1px solid #334155;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          
          .drawer-body {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          
          .section-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94a3b8;
            margin-bottom: 8px;
          }
          
          .preset-card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 10px;
            padding: 8px 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
            cursor: pointer;
          }
          .preset-card.active {
            border-color: #3b82f6;
            background: rgba(59,130,246,0.1);
          }
          
          .preset-name { font-size: 12px; font-weight: 700; color: #f8fafc; }
          .preset-desc { font-size: 10px; color: #94a3b8; }
          
          .color-palette { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
          .color-dot { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; }
          .color-dot.active { border-color: #ffffff; transform: scale(1.1); }
          
          .drawer-footer {
            padding: 14px 16px;
            border-top: 1px solid #334155;
            background: #0b1120;
          }
          .btn-reset {
            width: 100%;
            padding: 8px;
            border-radius: 8px;
            background: transparent;
            border: 1px solid #334155;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="preview-container">
          <div class="main-content">
            <div class="mock-nav">
              <span style="font-weight: 800; font-size: 16px;">REZO360</span>
              <span style="font-size: 12px; color: #60a5fa;">Thème personnalisé actif</span>
            </div>
            <div style="font-size: 13px; color: #64748b; margin-top: 40px; text-align: center;">
              ✦ Vous pouvez configurer l'ambiance, les teintes d'accentuation et la densité d'affichage
            </div>
          </div>
          
          <div class="overlay-backdrop"></div>
          
          <!-- Tiroir Radix -->
          <div class="customizer-drawer">
            <div class="drawer-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">✨</span>
                <div>
                  <div style="font-size: 13px; font-weight: 800; color: #ffffff;">Personnalisation</div>
                  <div style="font-size: 10px; color: #94a3b8;">Ambiance & teintes du cockpit</div>
                </div>
              </div>
              <span style="font-size: 14px; color: #94a3b8; cursor: pointer;">✕</span>
            </div>
            
            <div class="drawer-body">
              <div>
                <div class="section-title">Thème & Ambiance</div>
                
                <div class="preset-card active">
                  <div>
                    <div class="preset-name">Cobalt Moderne</div>
                    <div class="preset-desc">Bleu nuit profond et dynamique</div>
                  </div>
                  <div style="display: flex; gap: 3px;">
                    <div style="width: 10px; height: 10px; border-radius: 2px; background: #3b82f6;"></div>
                    <div style="width: 10px; height: 10px; border-radius: 2px; background: #070b14;"></div>
                  </div>
                </div>
                
                <div class="preset-card">
                  <div>
                    <div class="preset-name">Onyx Sombre</div>
                    <div class="preset-desc">Noir carbone et gris minéral</div>
                  </div>
                  <div style="display: flex; gap: 3px;">
                    <div style="width: 10px; height: 10px; border-radius: 2px; background: #94a3b8;"></div>
                    <div style="width: 10px; height: 10px; border-radius: 2px; background: #000000;"></div>
                  </div>
                </div>
                
                <div class="preset-card">
                  <div>
                    <div class="preset-name">Émeraude Pro</div>
                    <div class="preset-desc">Vert émeraude technique</div>
                  </div>
                  <div style="display: flex; gap: 3px;">
                    <div style="width: 10px; height: 10px; border-radius: 2px; background: #10b981;"></div>
                    <div style="width: 10px; height: 10px; border-radius: 2px; background: #042f2e;"></div>
                  </div>
                </div>
              </div>
              
              <div>
                <div class="section-title">Couleur d'accentuation</div>
                <div class="color-palette">
                  <div class="color-dot active" style="background: #3b82f6;"></div>
                  <div class="color-dot" style="background: #10b981;"></div>
                  <div class="color-dot" style="background: #8b5cf6;"></div>
                  <div class="color-dot" style="background: #f59e0b;"></div>
                  <div class="color-dot" style="background: #ef4444;"></div>
                </div>
              </div>
            </div>
            
            <div class="drawer-footer">
              <button class="btn-reset">↺ Réinitialiser</button>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'customizer_drawer_preview.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved customizer preview to:', outPath);
  await browser.close();
}

generateCustomizerPreview().catch(console.error);
