import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateSidebarComparison() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1150, height: 980 });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #080c16; color: #ffffff; padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; }
          h1 { font-size: 22px; font-weight: 800; margin-bottom: 6px; text-align: center; }
          p.subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; text-align: center; }
          
          .comparison-container { display: flex; gap: 32px; justify-content: center; width: 100%; max-width: 1060px; }
          
          .column { flex: 1; display: flex; flex-direction: column; gap: 12px; }
          .col-header { padding: 12px 16px; border-radius: 12px; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: space-between; }
          .col-header.current { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25); color: #f87171; }
          .col-header.proposed { background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.25); color: #4ade80; }
          
          .sidebar-mockup {
            background: #0d1322;
            border: 1px solid #1e293b;
            border-radius: 16px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
          }
          
          .group-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 10px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.05em;
            color: #38bdf8;
            cursor: pointer;
          }
          .group-header.closed { color: #64748b; }
          
          .group-title-left { display: flex; align-items: center; gap: 8px; }
          
          .items-list { display: flex; flex-direction: column; gap: 3px; padding-left: 6px; }
          
          .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 12px;
            border-radius: 10px;
            font-size: 13px;
            color: #94a3b8;
            background: transparent;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .nav-item.active {
            background: #2563eb;
            color: #ffffff;
            font-weight: 600;
          }
          
          .nav-item.highlight-issue {
            border: 1px dashed #ef4444;
            background: rgba(239, 68, 68, 0.08);
            color: #fca5a5;
          }
          
          .nav-item.highlight-good {
            border: 1px solid rgba(34, 197, 94, 0.3);
            background: rgba(34, 197, 94, 0.08);
            color: #86efac;
          }
          
          .tag {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 6px;
            font-weight: 600;
          }
          .tag.warn { background: #7f1d1d; color: #fca5a5; }
          .tag.good { background: #14532d; color: #86efac; }
          
          .chevron { font-size: 10px; color: #64748b; }
          .icon { width: 14px; height: 14px; flex-shrink: 0; opacity: 0.8; }
          
          .notes-box {
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 12px;
            padding: 12px;
            font-size: 12px;
            color: #94a3b8;
            line-height: 1.5;
          }
          .notes-box strong { color: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>Comparatif Navigation : Actuel vs Épuré</h1>
        <p class="subtitle">Visualisation côte à côte de la barre latérale</p>
        
        <div class="comparison-container">
          
          <!-- COLONNE ACTUELLE -->
          <div class="column">
            <div class="col-header current">
              <span>⚠️ Configuration Actuelle</span>
              <span class="tag warn">Textes longs tronqués</span>
            </div>
            
            <div class="sidebar-mockup">
              <!-- INTERVENTIONS -->
              <div>
                <div class="group-header">
                  <div class="group-title-left">
                    <span>📋</span>
                    <span>INTERVENTIONS</span>
                  </div>
                  <span class="chevron">▼</span>
                </div>
                <div class="items-list">
                  <div class="nav-item">📊 Tableau de bord</div>
                  <div class="nav-item">✨ Assistant IA</div>
                  <div class="nav-item">📋 Missions</div>
                  <div class="nav-item">📅 Planning & Congés</div>
                  <div class="nav-item">🗺️ Cartographie & Chantiers</div>
                  <div class="nav-item">👤 Clients</div>
                  <div class="nav-item">📈 Statistiques & Performance</div>
                  <div class="nav-item">📑 Contrôle & Rapports</div>
                  <div class="nav-item">🗄️ Dossiers clôturés</div>
                </div>
              </div>
              
              <!-- STOCK -->
              <div>
                <div class="group-header">
                  <div class="group-title-left">
                    <span>📦</span>
                    <span>STOCK</span>
                  </div>
                  <span class="chevron">▼</span>
                </div>
                <div class="items-list">
                  <div class="nav-item highlight-issue">
                    <span>📦 Fournitures & Consommabl...</span>
                  </div>
                  <div class="nav-item">🔄 Mouvements & Historique</div>
                  <div class="nav-item">🔧 Parc Matériel & Outillage</div>
                </div>
              </div>
              
              <!-- ACHATS -->
              <div>
                <div class="group-header">
                  <div class="group-title-left">
                    <span>🛒</span>
                    <span>ACHATS</span>
                  </div>
                  <span class="chevron">▼</span>
                </div>
                <div class="items-list">
                  <div class="nav-item">🛒 Commandes Fournisseurs</div>
                  <div class="nav-item">🏬 Fournisseurs & Tarifs</div>
                  <div class="nav-item highlight-issue">
                    <span>🧮 Devis & Chiffrage Express</span>
                  </div>
                </div>
              </div>
              
              <!-- ADMINISTRATION -->
              <div>
                <div class="group-header closed">
                  <div class="group-title-left">
                    <span>⚙️</span>
                    <span>ADMINISTRATION</span>
                  </div>
                  <span class="chevron">▶</span>
                </div>
              </div>
              
              <!-- BOITE A OUTILS -->
              <div>
                <div class="group-header closed">
                  <div class="group-title-left">
                    <span>🔧</span>
                    <span>BOÎTE À OUTILS</span>
                  </div>
                  <span class="chevron">▶</span>
                </div>
              </div>
            </div>
            
            <div class="notes-box">
              ❌ <strong>Points de friction :</strong> Libellés longs avec des « & » qui dépassent et sont tronqués avec <code>...</code> sur smartphone. Le devis est placé dans les achats.
            </div>
          </div>
          
          <!-- COLONNE PROPOSÉE -->
          <div class="column">
            <div class="col-header proposed">
              <span>✨ Proposition Épurée & Nette</span>
              <span class="tag good">Zéro texte coupé</span>
            </div>
            
            <div class="sidebar-mockup">
              <!-- INTERVENTIONS -->
              <div>
                <div class="group-header">
                  <div class="group-title-left">
                    <span>📋</span>
                    <span>INTERVENTIONS</span>
                  </div>
                  <span class="chevron">▼</span>
                </div>
                <div class="items-list">
                  <div class="nav-item active">📊 Tableau de bord</div>
                  <div class="nav-item">✨ Assistant IA</div>
                  <div class="nav-item">📋 Missions</div>
                  <div class="nav-item">📅 Planning</div>
                  <div class="nav-item">🗺️ Carte & Chantiers</div>
                  <div class="nav-item">👤 Clients</div>
                  <div class="nav-item">📈 Statistiques</div>
                  <div class="nav-item">📑 Rapports & Validation</div>
                  <div class="nav-item">🗄️ Archives</div>
                </div>
              </div>
              
              <!-- STOCK -->
              <div>
                <div class="group-header">
                  <div class="group-title-left">
                    <span>📦</span>
                    <span>STOCK</span>
                  </div>
                  <span class="chevron">▼</span>
                </div>
                <div class="items-list">
                  <div class="nav-item highlight-good">
                    <span>📦 Articles & Fournitures</span>
                  </div>
                  <div class="nav-item highlight-good">
                    <span>🔄 Mouvements</span>
                  </div>
                  <div class="nav-item highlight-good">
                    <span>🔧 Matériel & Flotte</span>
                  </div>
                </div>
              </div>
              
              <!-- ACHATS & DEVIS -->
              <div>
                <div class="group-header">
                  <div class="group-title-left">
                    <span>🛒</span>
                    <span>ACHATS & DEVIS</span>
                  </div>
                  <span class="chevron">▼</span>
                </div>
                <div class="items-list">
                  <div class="nav-item">🛒 Commandes</div>
                  <div class="nav-item">🏬 Fournisseurs</div>
                  <div class="nav-item highlight-good">
                    <span>🧮 Devis & Chiffrage</span>
                  </div>
                </div>
              </div>
              
              <!-- ADMINISTRATION -->
              <div>
                <div class="group-header closed">
                  <div class="group-title-left">
                    <span>⚙️</span>
                    <span>ADMINISTRATION</span>
                  </div>
                  <span class="chevron">▶</span>
                </div>
              </div>
              
              <!-- BOITE A OUTILS -->
              <div>
                <div class="group-header closed">
                  <div class="group-title-left">
                    <span>🔧</span>
                    <span>BOÎTE À OUTILS</span>
                  </div>
                  <span class="chevron">▶</span>
                </div>
              </div>
            </div>
            
            <div class="notes-box">
              ✅ <strong>Gains :</strong> Tous les libellés tiennent sur une seule ligne sans coupure, le menu est instantanément lisible au premier coup d'œil, et le groupe <code>ACHATS & DEVIS</code> est clair.
            </div>
          </div>
          
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'sidebar_comparison_audit.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved preview to:', outPath);
  await browser.close();
}

generateSidebarComparison().catch(console.error);
