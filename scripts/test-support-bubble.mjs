import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function testSupportBubbleDraggable() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 500 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #070b14; color: #ffffff; padding: 24px; min-height: 100vh; position: relative; }
          
          .header-box { text-align: center; margin-bottom: 24px; }
          h1 { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
          p.subtitle { color: #94a3b8; font-size: 13px; }
          
          .demo-board {
            width: 100%;
            height: 340px;
            background: #0d1322;
            border: 2px dashed #1e293b;
            border-radius: 20px;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .mock-content { text-align: center; color: #64748b; font-size: 13px; font-weight: 600; }
          
          /* Bulle compacte & déplaçable */
          .support-bubble {
            position: absolute;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #2563eb;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(37,99,235,0.4), 0 0 0 1px rgba(255,255,255,0.15) inset;
            cursor: grab;
            user-select: none;
            touch-action: none;
            transition: box-shadow 0.2s, transform 0.15s;
          }
          .support-bubble:active {
            cursor: grabbing;
            transform: scale(1.08);
            box-shadow: 0 8px 24px rgba(37,99,235,0.6);
          }
          
          .badge-online {
            position: absolute;
            top: -2px;
            right: -2px;
            width: 11px;
            height: 11px;
            border-radius: 50%;
            background: #10b981;
            border: 2px solid #0d1322;
          }
          
          .badge-online-ping {
            position: absolute;
            top: -2px;
            right: -2px;
            width: 11px;
            height: 11px;
            border-radius: 50%;
            background: #34d399;
            opacity: 0.75;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          
          @keyframes ping {
            75%, 100% { transform: scale(2); opacity: 0; }
          }
          
          .drag-hint {
            position: absolute;
            background: rgba(30,41,59,0.85);
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(8px);
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 11px;
            color: #cbd5e1;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1>Bulle de Support Compacte & Déplaçable</h1>
          <p class="subtitle">Taille réduite (40px) + Déplacement fluide au doigt ou à la souris sur tout l'écran</p>
        </div>
        
        <div class="demo-board" id="board">
          <div class="mock-content">
            ✦ Espace de travail — Vous pouvez glisser/déposer la bulle d'aide où vous voulez
          </div>
          
          <div class="drag-hint" style="bottom: 80px; right: 80px;">
            <span>👆 Glissez-déposez n'importe où</span>
          </div>
          
          <!-- Bulle en bas à droite -->
          <div class="support-bubble" id="bubble" style="bottom: 24px; right: 24px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <path d="M12 17h.01"></path>
            </svg>
            <div class="badge-online-ping"></div>
            <div class="badge-online"></div>
          </div>
        </div>
        
        <script>
          const bubble = document.getElementById('bubble');
          const board = document.getElementById('board');
          let isDragging = false;
          let startX, startY, origX, origY;
          
          bubble.addEventListener('pointerdown', (e) => {
            isDragging = true;
            bubble.setPointerCapture(e.pointerId);
            startX = e.clientX;
            startY = e.clientY;
            const rect = bubble.getBoundingClientRect();
            const boardRect = board.getBoundingClientRect();
            origX = rect.left - boardRect.left;
            origY = rect.top - boardRect.top;
            bubble.style.bottom = 'auto';
            bubble.style.right = 'auto';
            bubble.style.left = origX + 'px';
            bubble.style.top = origY + 'px';
          });
          
          bubble.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newX = origX + dx;
            let newY = origY + dy;
            const boardRect = board.getBoundingClientRect();
            newX = Math.max(10, Math.min(newX, boardRect.width - 50));
            newY = Math.max(10, Math.min(newY, boardRect.height - 50));
            bubble.style.left = newX + 'px';
            bubble.style.top = newY + 'px';
          });
          
          bubble.addEventListener('pointerup', () => {
            isDragging = false;
          });
        </script>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'support_bubble_compact_draggable.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved draggable support bubble preview to:', outPath);
  await browser.close();
}

testSupportBubbleDraggable().catch(console.error);
