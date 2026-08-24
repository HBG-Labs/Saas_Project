import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateHeroCtaProposals() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1100, height: 900 });

  const html = `
    <!DOCTYPE html>
    <html lang="fr" class="dark">
      <head>
        <meta charset="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body {
            background: #060913;
            color: #f8fafc;
            padding: 40px;
            display: flex;
            flex-direction: column;
            gap: 36px;
            min-height: 100vh;
            background-image: 
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37, 99, 235, 0.15), transparent),
              radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.05), transparent 70%);
          }
          
          .proposal-box {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(51, 65, 85, 0.6);
            border-radius: 20px;
            padding: 28px 32px;
            backdrop-filter: blur(12px);
          }
          
          .proposal-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #38bdf8;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .cta-row {
            display: flex;
            align-items: center;
            gap: 14px;
            flex-wrap: wrap;
          }
          
          /* ================= OPTION A : LINEAR / MODERN TECH (Sleek Rounded-xl + Glow) ================= */
          .btn-primary-a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 46px;
            padding: 0 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            background: linear-gradient(135deg, #2563eb 0%, #0284c7 100%);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 0 24px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3);
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .btn-primary-a:hover {
            transform: translateY(-1px);
            box-shadow: 0 0 32px rgba(37, 99, 235, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4);
          }
          
          .btn-secondary-a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 46px;
            padding: 0 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            color: #e2e8f0;
            background: rgba(30, 41, 59, 0.7);
            border: 1px solid rgba(71, 85, 105, 0.6);
            backdrop-filter: blur(8px);
            text-decoration: none;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
          }
          .btn-secondary-a:hover {
            background: rgba(51, 65, 85, 0.8);
            border-color: rgba(148, 163, 184, 0.5);
            color: #ffffff;
            transform: translateY(-1px);
          }
          
          .btn-app-a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 46px;
            padding: 0 18px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 600;
            color: #38bdf8;
            background: rgba(14, 165, 233, 0.08);
            border: 1px solid rgba(56, 189, 248, 0.25);
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .btn-app-a:hover {
            background: rgba(14, 165, 233, 0.16);
            border-color: rgba(56, 189, 248, 0.45);
            transform: translateY(-1px);
          }
          
          /* ================= OPTION B : COHESIVE DUAL + APP BADGE ================= */
          .btn-primary-b {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            height: 48px;
            padding: 0 26px;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            background: #2563eb;
            background-image: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.25), transparent 70%);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.5), inset 0 1px 0 rgba(255,255,255,0.2);
            cursor: pointer;
          }
          .btn-ghost-b {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 48px;
            padding: 0 22px;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 600;
            color: #cbd5e1;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            cursor: pointer;
          }
          .btn-ghost-b:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
          }
          
          /* ================= OPTION C : STRIPE ULTRA-CLEAN COHESION ================= */
          .btn-primary-c {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 44px;
            padding: 0 22px;
            border-radius: 10px;
            font-size: 13.5px;
            font-weight: 700;
            color: #ffffff;
            background: #1d4ed8;
            border: 1px solid rgba(96, 165, 250, 0.4);
            box-shadow: 0 4px 14px rgba(29, 78, 216, 0.35);
            cursor: pointer;
          }
          .btn-secondary-c {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            height: 44px;
            padding: 0 20px;
            border-radius: 10px;
            font-size: 13.5px;
            font-weight: 600;
            color: #e2e8f0;
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid #334155;
            cursor: pointer;
          }
          .btn-secondary-c:hover {
            border-color: #64748b;
            color: #ffffff;
          }

          .icon-svg {
            width: 16px;
            height: 16px;
            stroke-width: 2.2;
          }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 8px;">
          <h2 style="font-size: 20px; font-weight: 800; color: #ffffff;">Audit & Propositions de Design des Boutons d'Action</h2>
          <p style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Remplacement des formes pilules allongées par une géométrie moderne, équilibrée et hiérarchisée.</p>
        </div>

        <!-- PROPOSITION 1 : CONCEPT DESIGN TECH & ÉPURÉ (RECOMMANDÉ) -->
        <div class="proposal-box" style="border-color: #0284c7; box-shadow: 0 0 30px rgba(2, 132, 199, 0.15);">
          <div class="proposal-title">
            <span>✨ Option A (Recommandée) — Moderne & Équilibré (Raycast / Linear Style)</span>
          </div>
          <div class="cta-row">
            <button class="btn-primary-a">
              <span>Commencer gratuitement</span>
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </button>
            <button class="btn-secondary-a">
              <span>Explorer les outils métiers</span>
              <svg class="icon-svg" style="color: #94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </button>
            <button class="btn-app-a">
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>
              <span>Installer l'app terrain</span>
            </button>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 14px;">
            ✓ Rayon <code>rounded-xl (12px)</code> net et professionnel sans effet "saucisse".<br/>
            ✓ Bouton principal électrique avec lumière interne + deux boutons secondaires cohérents en verre dépoli et teinte cyan subtile.
          </p>
        </div>

        <!-- PROPOSITION 2 : DUAL STRUCTURE AVEC BADGE APPLI -->
        <div class="proposal-box">
          <div class="proposal-title" style="color: #60a5fa;">
            <span>Option B — Épuré & Haute Lisibilité (Vercel Style)</span>
          </div>
          <div class="cta-row">
            <button class="btn-primary-b">
              <span>Commencer gratuitement</span>
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </button>
            <button class="btn-ghost-b">
              <svg class="icon-svg" style="color: #60a5fa;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>
              <span>Installer l'application</span>
            </button>
            <button class="btn-ghost-b">
              <span>Outils métiers</span>
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </button>
          </div>
        </div>

        <!-- PROPOSITION 3 : COMPACT DENSE TECH -->
        <div class="proposal-box">
          <div class="proposal-title" style="color: #a78bfa;">
            <span>Option C — Compact & Sobre (Stripe Style)</span>
          </div>
          <div class="cta-row">
            <button class="btn-primary-c">
              <span>Commencer gratuitement</span>
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </button>
            <button class="btn-secondary-c">
              <span>Explorer les outils</span>
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </button>
            <button class="btn-secondary-c" style="border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>
              <span>Installer l'app</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'hero_cta_design_proposals.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved CTA design proposals to:', outPath);
  await browser.close();
}

generateHeroCtaProposals().catch(console.error);
