import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateHeroSectionCapture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 700 });

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
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-image: 
              radial-gradient(ellipse 70% 40% at 50% 10%, rgba(37, 99, 235, 0.18), transparent),
              radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.06), transparent 60%);
          }
          
          .hero-container {
            max-width: 960px;
            width: 100%;
            text-align: center;
            padding: 40px 24px;
          }
          
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 9999px;
            background: rgba(37, 99, 235, 0.1);
            border: 1px solid rgba(56, 189, 248, 0.25);
            color: #38bdf8;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 24px;
          }
          
          h1 {
            font-size: 42px;
            font-weight: 800;
            line-height: 1.15;
            letter-spacing: -0.02em;
            color: #ffffff;
            margin-bottom: 16px;
          }
          
          .gradient-text {
            background: linear-gradient(to right, #38bdf8, #60a5fa, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          
          p.subtitle {
            font-size: 16px;
            color: #94a3b8;
            line-height: 1.6;
            max-width: 680px;
            margin: 0 auto 36px;
          }
          
          .cta-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
            flex-wrap: wrap;
          }
          
          .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 48px;
            padding: 0 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            background: linear-gradient(135deg, #2563eb, #0284c7);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 20px rgba(37, 99, 235, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3);
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          
          .btn-secondary {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 48px;
            padding: 0 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            color: #e2e8f0;
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(51, 65, 85, 0.8);
            backdrop-filter: blur(8px);
            text-decoration: none;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
          }
          
          .btn-app {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 48px;
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

          .icon-svg {
            width: 16px;
            height: 16px;
            stroke-width: 2.2;
          }
          
          .trust-ticker {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-top: 36px;
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
          }
          
          .trust-ticker span { display: flex; align-items: center; gap: 6px; }
        </style>
      </head>
      <body>
        <div class="hero-container">
          <div class="badge">
            <span>⚡ NOUVELLE VERSION REZO360 SAAS</span>
          </div>
          
          <h1>
            La plateforme tout-en-un des pros du terrain.<br/>
            <span class="gradient-text">Connectez tout votre réseau.</span>
          </h1>
          
          <p class="subtitle">
            La solution complète pour les entreprises techniques : interventions, plannings, signatures clients, gestion de matériel et outils métiers sur une interface unifiée.
          </p>
          
          <div class="cta-container">
            <a href="#" class="btn-primary">
              <span>Commencer gratuitement</span>
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </a>
            
            <a href="#" class="btn-secondary">
              <span>Explorer les outils métiers</span>
              <svg class="icon-svg" style="color: #94a3b8;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>
            </a>
            
            <a href="#" class="btn-app">
              <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>
              <span>Installer l'application terrain</span>
            </a>
          </div>
          
          <div class="trust-ticker">
            <span>⚡ Outils & calculs multi-métiers</span>
            <span>•</span>
            <span>📍 Suivi des interventions en direct</span>
            <span>•</span>
            <span>🛡️ Conforme RGPD & Cloud sécurisé</span>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'hero_cta_redesigned_final.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved final redesigned hero capture to:', outPath);
  await browser.close();
}

generateHeroSectionCapture().catch(console.error);
