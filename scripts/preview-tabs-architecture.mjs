import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateArchitecturePreview() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 1100 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #070b14; color: #ffffff; padding: 28px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; gap: 28px; }
          
          .header-box { text-align: center; max-width: 800px; }
          h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
          p.subtitle { color: #94a3b8; font-size: 14px; }
          
          .grid-2col { display: grid; grid-template-columns: 340px 1fr; gap: 24px; width: 100%; max-width: 1140px; }
          
          /* Mockup Sidebar Compacte */
          .sidebar-card {
            background: #0d1322;
            border: 1px solid #1e293b;
            border-radius: 20px;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: 0 12px 35px -10px rgba(0,0,0,0.6);
          }
          
          .sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 12px;
            border-bottom: 1px solid #1e293b;
          }
          .brand-logo { font-size: 16px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
          .brand-logo span { color: #3b82f6; }
          .badge-compact { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px; }
          
          .group-title { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; color: #64748b; margin-bottom: 6px; text-transform: uppercase; padding-left: 8px; }
          
          .nav-group { display: flex; flex-direction: column; gap: 3px; }
          
          .nav-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 13px;
            color: #94a3b8;
            font-weight: 500;
            transition: all 0.15s;
          }
          .nav-btn.active {
            background: #2563eb;
            color: #ffffff;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          }
          .nav-btn-left { display: flex; align-items: center; gap: 10px; }
          .count-pill { font-size: 11px; background: rgba(255,255,255,0.15); padding: 1px 7px; border-radius: 8px; font-weight: 600; }
          
          /* Mockup Page avec Onglets */
          .page-preview-card {
            background: #0d1322;
            border: 1px solid #1e293b;
            border-radius: 20px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            box-shadow: 0 12px 35px -10px rgba(0,0,0,0.6);
          }
          
          .page-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .page-title { font-size: 20px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 10px; }
          .btn-action { background: #2563eb; color: #fff; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; }
          
          /* Barre d'onglets moderne */
          .tabs-bar {
            display: flex;
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 12px;
            padding: 4px;
            gap: 4px;
          }
          .tab-btn {
            flex: 1;
            padding: 9px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #94a3b8;
            background: transparent;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.15s;
          }
          .tab-btn.active {
            background: #1e293b;
            color: #ffffff;
            border: 1px solid #334155;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          }
          .tab-badge { font-size: 10px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 1px 6px; border-radius: 6px; font-weight: 700; }
          
          /* Table mockup */
          .content-box {
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 14px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .row-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: #161f30;
            border-radius: 10px;
            font-size: 13px;
            border: 1px solid rgba(255,255,255,0.03);
          }
          .item-desc { color: #64748b; font-size: 11px; margin-top: 2px; }
          .stock-val { font-weight: 700; color: #22c55e; }
          .stock-warn { font-weight: 700; color: #f59e0b; }
          
          .highlight-banner {
            background: linear-gradient(90deg, rgba(37,99,235,0.15) 0%, rgba(16,185,129,0.15) 100%);
            border: 1px solid rgba(59,130,246,0.3);
            border-radius: 14px;
            padding: 14px 18px;
            font-size: 13px;
            color: #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            max-width: 1140px;
          }
          .highlight-banner strong { color: #60a5fa; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1>Vision Cible : Architecture Épurée avec Onglets</h1>
          <p class="subtitle">Moins de sous-menus latéraux, navigation ultra-rapide par onglets contextuels</p>
        </div>
        
        <div class="highlight-banner">
          <div>💡 <strong>Principe Clé :</strong> Plus besoin de scroller ou de chercher dans 24 sous-menus. La barre latérale reste courte et chaque page regroupe ses vues logiques en 1 clic.</div>
        </div>
        
        <div class="grid-2col">
          <!-- 1. BARRE LATÉRALE ÉPURÉE (10 LIENS AU TOTAL) -->
          <div class="sidebar-card">
            <div class="sidebar-header">
              <div class="brand-logo">REZO<span>360</span></div>
              <span class="badge-compact">Menu Compact</span>
            </div>
            
            <!-- OPÉRATIONS -->
            <div>
              <div class="group-title">Opérations</div>
              <div class="nav-group">
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>📊</span><span>Tableau de bord</span></div>
                </div>
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>📋</span><span>Missions & Chantiers</span></div>
                  <span class="count-pill">12</span>
                </div>
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>📅</span><span>Planning</span></div>
                </div>
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>🗺️</span><span>Cartographie</span></div>
                </div>
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>👤</span><span>Clients</span></div>
                </div>
              </div>
            </div>
            
            <!-- GESTION -->
            <div>
              <div class="group-title">Gestion & Logistique</div>
              <div class="nav-group">
                <div class="nav-btn active">
                  <div class="nav-btn-left"><span>📦</span><span>Stock & Matériel</span></div>
                </div>
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>🛒</span><span>Achats & Devis</span></div>
                </div>
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>👥</span><span>Équipes & Flotte</span></div>
                </div>
              </div>
            </div>
            
            <!-- OUTILS -->
            <div>
              <div class="group-title">Outils & Paramètres</div>
              <div class="nav-group">
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>🔧</span><span>Boîte à outils</span></div>
                </div>
                <div class="nav-btn">
                  <div class="nav-btn-left"><span>⚙️</span><span>Paramètres Entreprise</span></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 2. EXEMPLE : LA PAGE STOCK AVEC ONGLETS INTÉGRÉS -->
          <div class="page-preview-card">
            <div class="page-top">
              <div class="page-title">
                <span>📦</span>
                <span>Stock & Matériel</span>
              </div>
              <button class="btn-action">+ Nouveau Mouvement</button>
            </div>
            
            <!-- LES 3 ONGLETS FLUIDES -->
            <div class="tabs-bar">
              <div class="tab-btn active">
                <span>📦 Articles & Consommables</span>
                <span class="tab-badge">48 ref</span>
              </div>
              <div class="tab-btn">
                <span>🔄 Mouvements & Historique</span>
              </div>
              <div class="tab-btn">
                <span>🔧 Parc Outillage & Matériel</span>
                <span class="tab-badge">14</span>
              </div>
            </div>
            
            <!-- CONTENU DE L'ONGLET ACTIF -->
            <div class="content-box">
              <div class="row-item">
                <div>
                  <strong>Câble Fibre Optique 4 FO (Touret 500m)</strong>
                  <div class="item-desc">Réf: FO-G657-4FO • Catégorie: Câblage télécom</div>
                </div>
                <div class="stock-val">4 tourets dispo</div>
              </div>
              
              <div class="row-item">
                <div>
                  <strong>Traverse Métallique 1.5m 5 Trous</strong>
                  <div class="item-desc">Réf: TRAV-150-5T • Catégorie: Poteaux & Armements</div>
                </div>
                <div class="stock-warn">⚠️ 2 unités (Seuil bas)</div>
              </div>
              
              <div class="row-item">
                <div>
                  <strong>Connecteurs SC/APC Prémontés</strong>
                  <div class="item-desc">Réf: CON-SCAPC-100 • Sachet de 100</div>
                </div>
                <div class="stock-val">12 sachets dispo</div>
              </div>
              
              <div class="row-item">
                <div>
                  <strong>Boîtier de Protection d'Épissure (BPEO)</strong>
                  <div class="item-desc">Réf: BPEO-SIZE-1 • Capacité 48 épissures</div>
                </div>
                <div class="stock-val">8 unités dispo</div>
              </div>
            </div>
            
            <div style="font-size: 12px; color: #64748b; text-align: center;">
              ✨ En cliquant sur <strong>« Mouvements »</strong> ou <strong>« Parc Outillage »</strong>, l'affichage change instantanément sans recharger la page ni réouvrir le menu latéral !
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'tabs_architecture_concept.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved architecture preview to:', outPath);
  await browser.close();
}

generateArchitecturePreview().catch(console.error);
