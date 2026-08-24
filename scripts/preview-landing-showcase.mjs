import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\1ae01ce1-97ea-4550-92f9-ef58e4247a8f';

async function generateFullLandingWithPhotos() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 1600 });

  // Read base64 images so local images render perfectly in standalone HTML
  const fieldImgBase64 = fs.readFileSync('public/images/hero-telecom-field.jpg').toString('base64');
  const cockpitImgBase64 = fs.readFileSync('public/images/cockpit-supervisors.png').toString('base64');
  const inspectionImgBase64 = fs.readFileSync('public/images/field-inspection-team.jpg').toString('base64');

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
            overflow-x: hidden;
          }
          
          .section-wrapper {
            max-width: 1200px;
            margin: 0 auto;
            padding: 60px 24px;
          }
          
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 16px;
            border-radius: 9999px;
            background: rgba(37, 99, 235, 0.12);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 20px;
          }
          
          h2 {
            font-size: 38px;
            font-weight: 800;
            line-height: 1.2;
            letter-spacing: -0.02em;
            color: #ffffff;
            text-align: center;
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
            max-width: 720px;
            margin: 12px auto 48px;
            text-align: center;
          }
          
          /* Grille Bento */
          .bento-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 28px;
          }
          
          .bento-card {
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(51, 65, 85, 0.8);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          
          .bento-card:hover {
            transform: translateY(-4px);
            border-color: rgba(56, 189, 248, 0.5);
            box-shadow: 0 20px 40px rgba(2, 132, 199, 0.2);
          }
          
          .img-container {
            position: relative;
            width: 100%;
            height: 240px;
            overflow: hidden;
            background: #020617;
          }
          
          .img-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.6s ease;
          }
          .bento-card:hover .img-container img {
            transform: scale(1.04);
          }
          
          .img-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.2) 50%, transparent 100%);
          }
          
          .top-chip {
            position: absolute;
            top: 14px;
            left: 14px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 9999px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 700;
            color: #ffffff;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          
          .status-live {
            position: absolute;
            top: 14px;
            right: 14px;
            background: rgba(4, 47, 46, 0.85);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 9999px;
            padding: 4px 10px;
            font-size: 10px;
            font-weight: 800;
            color: #6ee7b7;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .ping-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 8px #10b981;
          }
          
          .bottom-info {
            position: absolute;
            bottom: 12px;
            left: 16px;
            right: 16px;
          }
          .location-tag {
            font-size: 10px;
            font-family: monospace;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #38bdf8;
          }
          .tech-name {
            font-size: 16px;
            font-weight: 800;
            color: #ffffff;
            margin-top: 2px;
          }
          
          .card-body {
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            flex: 1;
            justify-content: space-between;
          }
          
          .role-badge {
            display: inline-block;
            background: rgba(37, 99, 235, 0.15);
            border: 1px solid rgba(56, 189, 248, 0.2);
            color: #7dd3fc;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
          }
          
          .quote {
            font-size: 12.5px;
            color: #cbd5e1;
            line-height: 1.55;
            font-style: italic;
          }
          
          .card-footer {
            padding-top: 14px;
            border-top: 1px solid rgba(51, 65, 85, 0.6);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: #94a3b8;
          }
          .verified {
            color: #34d399;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 4px;
          }
        </style>
      </head>
      <body>
        <div class="section-wrapper">
          <div style="text-align: center;">
            <div class="badge">
              <span>⚡ IMMERSION TERRAIN & SUPERVISION</span>
            </div>
            <h2>
              Le SaaS pensé pour <span class="gradient-text">les pros du terrain</span>
            </h2>
            <p class="subtitle">
              Du raccordement d’infrastructures au pilotage opérationnel en régie : vos équipes disposent d’une synchronisation continue, même hors-ligne.
            </p>
          </div>
          
          <div class="bento-grid">
            <!-- CARTE 1 : FIBRE & TÉLÉCOMS -->
            <div class="bento-card">
              <div class="img-container">
                <img src="data:image/jpeg;base64,${fieldImgBase64}" alt="Technicien télécoms" />
                <div class="img-overlay"></div>
                <div class="top-chip">
                  <span>📶 Réflectométrie & Épissure</span>
                </div>
                <div class="status-live">
                  <div class="ping-dot"></div>
                  <span>SYNCHRO PWA</span>
                </div>
                <div class="bottom-info">
                  <div class="location-tag">📍 Chantier FTTH · Armoire HUB-4B</div>
                  <div class="tech-name">Samuel M. & Équipe Déploiement</div>
                </div>
              </div>
              <div class="card-body">
                <div>
                  <span class="role-badge">Technicien Télécoms & Raccordement Fibre</span>
                  <p class="quote">
                    "Avec REZO360 sur tablette, je valide les soudures, le bilan optique et la recette client directement au pied de l'armoire."
                  </p>
                </div>
                <div class="card-footer">
                  <span class="verified">✓ Fiche d'intervention signée</span>
                  <span style="font-family: monospace;">PDF Horodaté</span>
                </div>
              </div>
            </div>

            <!-- CARTE 2 : SUPERVISION & COCKPIT -->
            <div class="bento-card">
              <div class="img-container">
                <img src="data:image/png;base64,${cockpitImgBase64}" alt="Superviseurs d'opérations" />
                <div class="img-overlay"></div>
                <div class="top-chip">
                  <span>📊 Supervision Opérationnelle 24/7</span>
                </div>
                <div class="status-live">
                  <div class="ping-dot"></div>
                  <span>COCKPIT LIVE</span>
                </div>
                <div class="bottom-info">
                  <div class="location-tag">📍 Cockpit Central · Multi-Équipes</div>
                  <div class="tech-name">Laurent & Équipe Exploitation</div>
                </div>
              </div>
              <div class="card-body">
                <div>
                  <span class="role-badge">Superviseurs d’Opérations & Pilotage</span>
                  <p class="quote">
                    "La synchronisation en temps réel avec nos équipes sur le terrain a réduit nos temps de validation de 45%."
                  </p>
                </div>
                <div class="card-footer">
                  <span class="verified">✓ 14/16 Techniciens Actifs</span>
                  <span style="font-family: monospace;">Temps Réel</span>
                </div>
              </div>
            </div>

            <!-- CARTE 3 : AUDIT & CONFORMITÉ -->
            <div class="bento-card">
              <div class="img-container">
                <img src="data:image/jpeg;base64,${inspectionImgBase64}" alt="Inspection et conformité" />
                <div class="img-overlay"></div>
                <div class="top-chip">
                  <span>🛡️ Normes NF & UTE C 15-105</span>
                </div>
                <div class="status-live">
                  <div class="ping-dot"></div>
                  <span>CONFORME</span>
                </div>
                <div class="bottom-info">
                  <div class="location-tag">📍 Site Industriel · Équipements</div>
                  <div class="tech-name">Amina & Thomas</div>
                </div>
              </div>
              <div class="card-body">
                <div>
                  <span class="role-badge">Contrôleurs Techniques & Conformité</span>
                  <p class="quote">
                    "Toutes nos fiches d'intervention et signatures clients sont générées et horodatées sans aucune saisie papier."
                  </p>
                </div>
                <div class="card-footer">
                  <span class="verified">✓ Audit Réglementaire Conforme</span>
                  <span style="font-family: monospace;">ISO / RGPD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await page.setContent(html);
  const outPath = path.join(artifactsDir, 'landing_technician_showcase_preview.png');
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('Saved landing showcase preview to:', outPath);
  await browser.close();
}

generateFullLandingWithPhotos().catch(console.error);
