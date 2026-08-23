import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateMobileAudit() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1100, height: 850 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #070b14; color: #ffffff; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; gap: 24px; }
          
          .header-box { text-align: center; max-width: 800px; }
          h1 { font-size: 22px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
          p.subtitle { color: #94a3b8; font-size: 13px; }
          
          .devices-row { display: flex; gap: 28px; justify-content: center; width: 100%; max-width: 1040px; }
          
          /* Mockup Mobile Phone Frame */
          .phone-frame {
            width: 330px;
            height: 640px;
            background: #0b101d;
            border: 4px solid #1e293b;
            border-radius: 36px;
            padding: 16px 14px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            box-shadow: 0 20px 45px -10px rgba(0,0,0,0.8);
            position: relative;
            overflow: hidden;
          }
          
          .phone-notch {
            width: 100px;
            height: 18px;
            background: #1e293b;
            border-radius: 0 0 12px 12px;
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .phone-camera { width: 6px; height: 6px; border-radius: 50%; background: #000; }
          
          .app-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }
          .brand-logo { font-size: 15px; font-weight: 900; letter-spacing: -0.5px; color: #fff; }
          .brand-logo span { color: #3b82f6; }
          
          .page-header-mini {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          .page-title-mini { font-size: 17px; font-weight: 800; color: #f8fafc; }
          .page-desc-mini { font-size: 11px; color: #94a3b8; }
          
          /* LE NOUVEAU BANDEAU D'ONGLETS RESPONSIVE & HORIZONTAL SWIPE */
          .mobile-tabs-scroll {
            display: flex;
            align-items: center;
            gap: 8px;
            overflow-x: auto;
            white-space: nowrap;
            padding-bottom: 8px;
            margin: 0 -14px;
            padding-left: 14px;
            padding-right: 14px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            scrollbar-width: none;
          }
          .mobile-tabs-scroll::-webkit-scrollbar { display: none; }
          
          .tab-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 12px;
            border-radius: 10px;
            font-size: 11.5px;
            font-weight: 600;
            color: #94a3b8;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            flex-shrink: 0;
          }
          .tab-pill.active {
            background: #2563eb;
            color: #ffffff;
            border-color: #3b82f6;
            box-shadow: 0 2px 8px rgba(37,99,235,0.4);
          }
          .tab-badge-mini {
            font-size: 9px;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 6px;
            background: rgba(245,158,11,0.2);
            color: #fbbf24;
          }
          .tab-badge-active {
            background: rgba(255,255,255,0.2);
            color: #fff;
          }
          
          /* Card Content */
          .card-mini {
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1;
          }
          .card-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 9px 10px;
            background: #172033;
            border-radius: 8px;
            font-size: 11px;
            border: 1px solid rgba(255,255,255,0.04);
          }
          .status-badge {
            font-size: 9px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 5px;
          }
          .status-blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
          .status-green { background: rgba(34,197,94,0.15); color: #4ade80; }
          .status-amber { background: rgba(245,158,11,0.15); color: #fbbf24; }
          
          /* Bottom Navigation */
          .mobile-bottom-bar {
            display: flex;
            align-items: center;
            justify-content: space-around;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.08);
            margin-top: auto;
          }
          .bottom-tab {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            font-size: 9px;
            color: #64748b;
            font-weight: 600;
          }
          .bottom-tab.active { color: #3b82f6; }
          .bottom-tab-icon { font-size: 16px; }
          
          .comparison-label {
            text-align: center;
            font-size: 13px;
            font-weight: 700;
            color: #60a5fa;
            background: rgba(59,130,246,0.1);
            border: 1px solid rgba(59,130,246,0.25);
            padding: 6px 12px;
            border-radius: 20px;
            width: fit-content;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1>Validation de l'Ergonomie Mobile & Responsivité</h1>
          <p class="subtitle">Onglets en ligne unique avec défilement horizontal fluide (sans retour à la ligne ni débordement)</p>
        </div>
        
        <div class="devices-row">
          <!-- PHONE 1 : MISSIONS -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="comparison-label">📋 Espace Missions</div>
            <div class="phone-frame">
              <div class="phone-notch"><div class="phone-camera"></div></div>
              
              <div class="app-topbar">
                <div class="brand-logo">REZO<span>360</span></div>
                <div style="font-size: 14px;">🔔</div>
              </div>
              
              <div class="page-header-mini">
                <div class="page-title-mini">Missions & Chantiers</div>
                <div class="page-desc-mini">12 interventions actives</div>
              </div>
              
              <!-- BANDEAU ONGLETS MISSIONS -->
              <div class="mobile-tabs-scroll">
                <div class="tab-pill active">
                  <span>📋</span>
                  <span>Missions & Chantiers</span>
                </div>
                <div class="tab-pill">
                  <span>📑</span>
                  <span>Contrôle & Rapports</span>
                  <span class="tab-badge-mini">3</span>
                </div>
                <div class="tab-pill">
                  <span>🗄️</span>
                  <span>Dossiers clos</span>
                </div>
              </div>
              
              <div class="card-mini">
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">MIS-2026-042</strong>
                    <div style="color: #64748b; font-size: 10px;">Raccordement Fibre • SFR Pro</div>
                  </div>
                  <span class="status-badge status-blue">En cours</span>
                </div>
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">MIS-2026-041</strong>
                    <div style="color: #64748b; font-size: 10px;">Tirage Câble • Orange D2</div>
                  </div>
                  <span class="status-badge status-amber">À planifier</span>
                </div>
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">MIS-2026-040</strong>
                    <div style="color: #64748b; font-size: 10px;">Audit Colonne • Free Infra</div>
                  </div>
                  <span class="status-badge status-green">Terminé</span>
                </div>
              </div>
              
              <div class="mobile-bottom-bar">
                <div class="bottom-tab"><div class="bottom-tab-icon">📊</div><span>Accueil</span></div>
                <div class="bottom-tab active"><div class="bottom-tab-icon">📋</div><span>Missions</span></div>
                <div class="bottom-tab"><div class="bottom-tab-icon">📅</div><span>Planning</span></div>
                <div class="bottom-tab"><div class="bottom-tab-icon">🗺️</div><span>Carte</span></div>
              </div>
            </div>
          </div>
          
          <!-- PHONE 2 : STOCK -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="comparison-label">📦 Espace Stock & Matériel</div>
            <div class="phone-frame">
              <div class="phone-notch"><div class="phone-camera"></div></div>
              
              <div class="app-topbar">
                <div class="brand-logo">REZO<span>360</span></div>
                <div style="font-size: 14px;">🔔</div>
              </div>
              
              <div class="page-header-mini">
                <div class="page-title-mini">Articles & Fournitures</div>
                <div class="page-desc-mini">Gestion du stock et consommables</div>
              </div>
              
              <!-- BANDEAU ONGLETS STOCK -->
              <div class="mobile-tabs-scroll">
                <div class="tab-pill active">
                  <span>📦</span>
                  <span>Articles & Fournitures</span>
                </div>
                <div class="tab-pill">
                  <span>🔄</span>
                  <span>Mouvements</span>
                </div>
                <div class="tab-pill">
                  <span>🔧</span>
                  <span>Matériel & Outillage</span>
                  <span class="tab-badge-mini">14</span>
                </div>
              </div>
              
              <div class="card-mini">
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">Câble FO 4 FO</strong>
                    <div style="color: #64748b; font-size: 10px;">Touret 500m • Réf: FO-04</div>
                  </div>
                  <span class="status-badge status-green">4 tourets</span>
                </div>
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">Connecteurs SC/APC</strong>
                    <div style="color: #64748b; font-size: 10px;">Sachet de 100 • Réf: SC-100</div>
                  </div>
                  <span class="status-badge status-green">12 sachets</span>
                </div>
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">Boîtier BPEO Taille 1</strong>
                    <div style="color: #64748b; font-size: 10px;">Capacité 48 épissures</div>
                  </div>
                  <span class="status-badge status-amber">2 dispo</span>
                </div>
              </div>
              
              <div class="mobile-bottom-bar">
                <div class="bottom-tab"><div class="bottom-tab-icon">📊</div><span>Accueil</span></div>
                <div class="bottom-tab active"><div class="bottom-tab-icon">📦</div><span>Stock</span></div>
                <div class="bottom-tab"><div class="bottom-tab-icon">📅</div><span>Planning</span></div>
                <div class="bottom-tab"><div class="bottom-tab-icon">⚙️</div><span>Menu</span></div>
              </div>
            </div>
          </div>
          
          <!-- PHONE 3 : ÉQUIPES & FLOTTE -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="comparison-label">👥 Espace Équipes & Flotte</div>
            <div class="phone-frame">
              <div class="phone-notch"><div class="phone-camera"></div></div>
              
              <div class="app-topbar">
                <div class="brand-logo">REZO<span>360</span></div>
                <div style="font-size: 14px;">🔔</div>
              </div>
              
              <div class="page-header-mini">
                <div class="page-title-mini">Gestion des Équipes</div>
                <div class="page-desc-mini">Techniciens, chefs d'équipe & véhicules</div>
              </div>
              
              <!-- BANDEAU ONGLETS ÉQUIPES -->
              <div class="mobile-tabs-scroll">
                <div class="tab-pill active">
                  <span>👥</span>
                  <span>Équipes</span>
                </div>
                <div class="tab-pill">
                  <span>👤</span>
                  <span>Techniciens & Membres</span>
                  <span class="tab-badge-mini">8</span>
                </div>
                <div class="tab-pill">
                  <span>🚚</span>
                  <span>Flotte & Véhicules</span>
                </div>
              </div>
              
              <div class="card-mini">
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">Équipe Nord - D3</strong>
                    <div style="color: #64748b; font-size: 10px;">Chef: Marc L. • 3 techniciens</div>
                  </div>
                  <span class="status-badge status-blue">Zone 75/93</span>
                </div>
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">Équipe Sud - Raccordement</strong>
                    <div style="color: #64748b; font-size: 10px;">Chef: Yassine B. • 2 techniciens</div>
                  </div>
                  <span class="status-badge status-blue">Zone 91/94</span>
                </div>
                <div class="card-row">
                  <div>
                    <strong style="color: #f1f5f9;">Équipe Ouest - Audit</strong>
                    <div style="color: #64748b; font-size: 10px;">Chef: David P. • 2 techniciens</div>
                  </div>
                  <span class="status-badge status-blue">Zone 78/92</span>
                </div>
              </div>
              
              <div class="mobile-bottom-bar">
                <div class="bottom-tab"><div class="bottom-tab-icon">📊</div><span>Accueil</span></div>
                <div class="bottom-tab"><div class="bottom-tab-icon">📋</div><span>Missions</span></div>
                <div class="bottom-tab active"><div class="bottom-tab-icon">👥</div><span>Équipes</span></div>
                <div class="bottom-tab"><div class="bottom-tab-icon">⚙️</div><span>Menu</span></div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'mobile_tabs_ergonomics.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved mobile audit preview to:', outPath);
  await browser.close();
}

generateMobileAudit().catch(console.error);
