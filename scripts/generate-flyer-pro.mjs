import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function generateFlyer() {
  console.log('🚀 Démarrage de la génération HD du flyer REZO360...');

  // 1. QR code officiel
  const qrPath = path.join(projectRoot, 'public/images/rezo360-qr.png');
  let qrBase64 = '';
  if (fs.existsSync(qrPath)) {
    qrBase64 = `data:image/png;base64,${fs.readFileSync(qrPath).toString('base64')}`;
  }

  // 2. Technician image for bottom right CTA
  const techImgPath = path.join(projectRoot, 'public/images/backgrounds/cta-depot-technician-neon-blue.jpg');
  let techBase64 = '';
  if (fs.existsSync(techImgPath)) {
    techBase64 = `data:image/jpeg;base64,${fs.readFileSync(techImgPath).toString('base64')}`;
  }

  // 3. Cropped devices mockup
  const devicesCropPath = path.join(projectRoot, 'public/images/devices-cropped.png');
  let devicesBase64 = '';
  if (fs.existsSync(devicesCropPath)) {
    devicesBase64 = `data:image/png;base64,${fs.readFileSync(devicesCropPath).toString('base64')}`;
  }

  const browser = await chromium.launch({ headless: true });
  // Set scale factor for 300 DPI print quality
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1680 },
    deviceScaleFactor: 2
  });

  const html = `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>REZO360 — Flyer Commercial</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700;1,800&display=swap" rel="stylesheet">
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      body {
        width: 1200px;
        height: 1680px;
        background: #ffffff;
        color: #0f172a;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      /* Fond technique */
      .bg-pattern {
        position: absolute;
        inset: 0;
        background-image: radial-gradient(#cbd5e1 1.2px, transparent 1.2px);
        background-size: 26px 26px;
        opacity: 0.55;
        pointer-events: none;
      }

      /* Grand accent bleu en haut à droite */
      .bg-top-blue-accent {
        position: absolute;
        top: 0;
        right: 0;
        width: 580px;
        height: 520px;
        background: linear-gradient(145deg, #1e40af 0%, #1d4ed8 45%, #2563eb 100%);
        border-bottom-left-radius: 260px;
        opacity: 0.95;
        box-shadow: -10px 10px 40px rgba(29, 78, 216, 0.15);
        pointer-events: none;
      }

      /* 1. HEADER */
      header {
        position: relative;
        z-index: 20;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 46px 64px 10px;
      }

      .brand-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .logo {
        font-size: 56px;
        font-weight: 900;
        color: #002d72;
        letter-spacing: -2px;
        line-height: 0.95;
      }

      .sub-brand {
        font-size: 13px;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-top: 6px;
      }

      .sub-brand-line {
        width: 48px;
        height: 4px;
        background: #2563eb;
        border-radius: 2px;
        margin-top: 6px;
      }

      .badge-target {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: #1d4ed8;
        color: #ffffff;
        padding: 12px 24px;
        border-radius: 9999px;
        font-size: 15px;
        font-weight: 700;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.25);
      }

      .badge-target svg {
        width: 22px;
        height: 22px;
        fill: #ffffff;
      }

      /* 2. HERO SECTION */
      .hero {
        position: relative;
        z-index: 15;
        padding: 24px 64px 10px;
        display: grid;
        grid-template-columns: 480px 1fr;
        gap: 20px;
        align-items: center;
      }

      .hero-copy {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 480px;
      }

      .hero-title {
        font-size: 52px;
        font-weight: 900;
        line-height: 1.08;
        color: #0b1c3d;
        letter-spacing: -1.5px;
      }

      .hero-title span.blue-text {
        color: #1d4ed8;
        display: block;
      }

      .hero-desc {
        font-size: 19px;
        line-height: 1.5;
        color: #334155;
        font-weight: 500;
      }

      .hero-desc strong {
        color: #0f172a;
        font-weight: 800;
      }

      .hero-visual {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      .devices-image {
        width: 635px;
        height: auto;
        display: block;
        filter: drop-shadow(0 20px 45px rgba(15, 23, 42, 0.22));
        transform: translateY(-8px);
        border-radius: 8px;
      }

      /* 3. FEATURES (5 CARDS) */
      .features-wrap {
        position: relative;
        z-index: 20;
        padding: 10px 64px;
      }

      .features-card-container {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 16px;
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        padding: 24px 20px;
        border-radius: 22px;
        box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
      }

      .feature-col {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 2px 4px;
      }

      .feat-icon-wrap {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: #eff6ff;
        border: 1.5px solid #bfdbfe;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1d4ed8;
      }

      .feat-icon-wrap svg {
        width: 24px;
        height: 24px;
      }

      .feat-name {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
      }

      .feat-text {
        font-size: 13.5px;
        color: #475569;
        line-height: 1.45;
        font-weight: 500;
      }

      /* 4. BANNER "TOUT VOTRE MÉTIER" */
      .banner-wrap {
        position: relative;
        z-index: 20;
        padding: 6px 64px 14px;
      }

      .center-pill-banner {
        background: linear-gradient(135deg, #091a38 0%, #0f2b5c 100%);
        border: 1px solid rgba(56, 189, 248, 0.35);
        border-radius: 20px;
        padding: 16px 28px;
        display: flex;
        align-items: center;
        gap: 22px;
        box-shadow: 0 10px 30px rgba(9, 26, 56, 0.25);
      }

      .banner-icon-box {
        width: 48px;
        height: 48px;
        background: #1d4ed8;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(29, 78, 216, 0.4);
      }

      .banner-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .banner-main-title {
        font-size: 21px;
        font-weight: 800;
        color: #ffffff;
        letter-spacing: -0.3px;
      }

      .banner-tags {
        font-size: 14.5px;
        color: #94a3b8;
        font-weight: 600;
        letter-spacing: 0.3px;
      }

      .banner-tags span.dot {
        color: #38bdf8;
        padding: 0 4px;
      }

      /* 5. PRICING & TRUST */
      .pricing-trust-wrap {
        position: relative;
        z-index: 20;
        padding: 8px 64px 22px;
        display: grid;
        grid-template-columns: 350px 1fr;
        gap: 28px;
        align-items: center;
      }

      .price-card {
        background: #ffffff;
        border: 2px solid #e2e8f0;
        border-radius: 20px;
        padding: 22px 28px;
        box-shadow: 0 8px 25px rgba(15, 23, 42, 0.06);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .price-card-label {
        font-size: 12px;
        font-weight: 800;
        color: #64748b;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }

      .price-figure {
        font-size: 52px;
        font-weight: 900;
        color: #1d4ed8;
        line-height: 1;
        display: flex;
        align-items: baseline;
        gap: 6px;
      }

      .price-figure .month {
        font-size: 21px;
        font-weight: 800;
        color: #0f172a;
      }

      .price-sub {
        font-size: 13.5px;
        font-weight: 600;
        color: #334155;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
      }

      .price-sub svg {
        width: 17px;
        height: 17px;
        color: #16a34a;
      }

      .trust-trio {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 18px;
      }

      .trust-card {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .trust-icon-wrap {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #eff6ff;
        border: 1.5px solid #bfdbfe;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1d4ed8;
        flex-shrink: 0;
      }

      .trust-texts {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .trust-h {
        font-size: 16px;
        font-weight: 800;
        color: #0f172a;
      }

      .trust-p {
        font-size: 12.5px;
        color: #64748b;
        line-height: 1.35;
        font-weight: 500;
      }

      /* 6. BOTTOM CTA (FOOTER) */
      footer.cta-footer {
        position: relative;
        z-index: 25;
        background: linear-gradient(135deg, #001f5c 0%, #003699 50%, #0047cc 100%);
        padding: 44px 64px 48px;
        color: #ffffff;
        display: grid;
        grid-template-columns: 160px 1fr 350px;
        gap: 36px;
        align-items: center;
        overflow: hidden;
        border-top: 2px solid rgba(255, 255, 255, 0.15);
      }

      .cta-worker-img {
        position: absolute;
        right: -10px;
        bottom: 0;
        width: 390px;
        height: 100%;
        object-fit: cover;
        object-position: center top;
        opacity: 0.38;
        mix-blend-mode: luminosity;
        pointer-events: none;
      }

      .qr-wrapper {
        width: 154px;
        height: 154px;
        background: #ffffff;
        padding: 10px;
        border-radius: 18px;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .qr-wrapper img {
        width: 100%;
        height: 100%;
        display: block;
      }

      .cta-main-info {
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: relative;
        z-index: 2;
      }

      .cta-head {
        font-size: 34px;
        font-weight: 900;
        line-height: 1.12;
        letter-spacing: -0.6px;
      }

      .cta-head span.cyan {
        color: #38bdf8;
        display: block;
      }

      .cta-sub-instructions {
        font-size: 15.5px;
        color: #cbd5e1;
        font-weight: 500;
        line-height: 1.4;
      }

      .cta-btn-line {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 4px;
      }

      .curved-arrow {
        width: 32px;
        height: 28px;
        color: #ffffff;
        transform: rotate(-10deg);
      }

      .url-badge-btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: #1d4ed8;
        color: #ffffff;
        border: 2px solid rgba(255, 255, 255, 0.4);
        padding: 12px 30px;
        border-radius: 9999px;
        font-size: 20px;
        font-weight: 800;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        letter-spacing: -0.3px;
      }

      .checklist-area {
        display: flex;
        flex-direction: column;
        gap: 14px;
        position: relative;
        z-index: 2;
      }

      .checklist-row {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 15.5px;
        font-weight: 700;
        color: #ffffff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .check-bullet {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: rgba(56, 189, 248, 0.2);
        border: 2px solid #38bdf8;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #38bdf8;
        flex-shrink: 0;
      }

      .check-bullet svg {
        width: 15px;
        height: 15px;
        stroke-width: 3.2;
      }
    </style>
  </head>
  <body>
    <div class="bg-pattern"></div>
    <div class="bg-top-blue-accent"></div>

    <!-- 1. HEADER -->
    <header>
      <div class="brand-block">
        <div class="logo">REZO360</div>
        <div class="sub-brand">Le logiciel de gestion pour les professionnels de terrain</div>
        <div class="sub-brand-line"></div>
      </div>
      <div class="badge-target">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        Conçu pour les professionnels exigeants
      </div>
    </header>

    <!-- 2. HERO -->
    <section class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">
          Pilotez votre activité technique,
          <span class="blue-text">du devis au compte rendu signé.</span>
        </h1>
        <p class="hero-desc">
          <strong>REZO360</strong> centralise vos missions, vos équipes, vos clients et vos comptes rendus dans un <strong>seul outil</strong>.
        </p>
      </div>
      <div class="hero-visual">
        <img class="devices-image" src="${devicesBase64}" alt="Interface REZO360 sur ordinateur et smartphone" />
      </div>
    </section>

    <!-- 3. FEATURES ROW (5 CARDS) -->
    <section class="features-wrap">
      <div class="features-card-container">
        <!-- Missions -->
        <div class="feature-col">
          <div class="feat-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="m9 16 2 2 4-4"></path></svg>
          </div>
          <div class="feat-name">Missions</div>
          <div class="feat-text">Planifiez et suivez vos interventions en toute simplicité.</div>
        </div>

        <!-- Équipes -->
        <div class="feature-col">
          <div class="feat-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div class="feat-name">Équipes</div>
          <div class="feat-text">Organisez vos équipes de terrain et assignez les bonnes missions.</div>
        </div>

        <!-- Terrain -->
        <div class="feature-col">
          <div class="feat-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <div class="feat-name">Terrain</div>
          <div class="feat-text">Localisez vos interventions et optimisez vos déplacements.</div>
        </div>

        <!-- Comptes rendus -->
        <div class="feature-col">
          <div class="feat-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
          </div>
          <div class="feat-name">Comptes rendus</div>
          <div class="feat-text">Créez vos rapports, ajoutez des photos et faites-les signer en un clic.</div>
        </div>

        <!-- Devis & Clients -->
        <div class="feature-col">
          <div class="feat-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h12"></path><path d="M4 14h9"></path><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12a7.9 7.9 0 0 0 7.8 8 7.7 7.7 0 0 0 5.2-2"></path></svg>
          </div>
          <div class="feat-name">Devis & Clients</div>
          <div class="feat-text">Gérez vos clients, vos devis et votre activité en un seul endroit.</div>
        </div>
      </div>
    </section>

    <!-- 4. BANNER "TOUT VOTRE MÉTIER" -->
    <section class="banner-wrap">
      <div class="center-pill-banner">
        <div class="banner-icon-box">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </div>
        <div class="banner-content">
          <div class="banner-main-title">Tout votre métier. Un seul outil.</div>
          <div class="banner-tags">
            Missions <span class="dot">•</span> Équipes <span class="dot">•</span> Clients <span class="dot">•</span> Devis <span class="dot">•</span> Comptes rendus <span class="dot">•</span> Stock <span class="dot">•</span> Statistiques
          </div>
        </div>
      </div>
    </section>

    <!-- 5. PRICING & TRUST -->
    <section class="pricing-trust-wrap">
      <div class="price-card">
        <div class="price-card-label">À partir de</div>
        <div class="price-figure">
          19€ <span class="month">/MOIS</span>
        </div>
        <div class="price-sub">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          Essai gratuit • Sans engagement
        </div>
      </div>

      <div class="trust-trio">
        <div class="trust-card">
          <div class="trust-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <div class="trust-texts">
            <div class="trust-h">Sécurisé</div>
            <div class="trust-p">Vos données sont protégées.</div>
          </div>
        </div>

        <div class="trust-card">
          <div class="trust-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
          </div>
          <div class="trust-texts">
            <div class="trust-h">Accessible partout</div>
            <div class="trust-p">Sur ordinateur, tablette et mobile.</div>
          </div>
        </div>

        <div class="trust-card">
          <div class="trust-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>
          </div>
          <div class="trust-texts">
            <div class="trust-h">Support réactif</div>
            <div class="trust-p">Une équipe à votre écoute.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. BOTTOM CTA FOOTER -->
    <footer class="cta-footer">
      ${techBase64 ? `<img class="cta-worker-img" src="${techBase64}" alt="Technicien de terrain" />` : ''}

      <!-- QR Card -->
      <div class="qr-wrapper">
        <img src="${qrBase64}" alt="QR Code REZO360" />
      </div>

      <!-- Center CTA -->
      <div class="cta-main-info">
        <div class="cta-head">
          ESSAYEZ REZO360
          <span class="cyan">GRATUITEMENT !</span>
        </div>
        <div class="cta-sub-instructions">
          Scannez le QR code pour commencer<br>ou rendez-vous sur
        </div>
        <div class="cta-btn-line">
          <svg class="curved-arrow" viewBox="0 0 46 36" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M 6 28 C 16 34 26 26 34 14" />
            <path d="M 24 12 L 35 13 L 34 24" />
          </svg>
          <div class="url-badge-btn">
            🌐 rezo360.com
          </div>
        </div>
      </div>

      <!-- Checklist -->
      <div class="checklist-area">
        <div class="checklist-row">
          <div class="check-bullet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          Prise en main rapide
        </div>
        <div class="checklist-row">
          <div class="check-bullet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          Interface intuitive
        </div>
        <div class="checklist-row">
          <div class="check-bullet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          Conçu pour les pros de terrain
        </div>
        <div class="checklist-row">
          <div class="check-bullet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          Gagnez du temps au quotidien
        </div>
      </div>
    </footer>
  </body>
  </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const outputPath = path.join(projectRoot, 'public/flyer-rezo360-pro.jpg');
  const rootOutputPath = path.join(projectRoot, 'rezo360-flyer-officiel.jpg');
  const brainPath = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\18d27ded-a879-4810-ba07-6f468bca047b\\rezo360_flyer_officiel_hd.jpg';

  await page.screenshot({
    path: outputPath,
    type: 'jpeg',
    quality: 98,
    fullPage: true,
  });

  fs.copyFileSync(outputPath, rootOutputPath);
  fs.copyFileSync(outputPath, brainPath);

  // Copie de la version IA également pour comparaison
  const aiSource = 'C:\\Users\\HBZ\\.gemini\\antigravity-ide\\brain\\18d27ded-a879-4810-ba07-6f468bca047b\\rezo360_flyer_hd_1788363753984.jpg';
  const aiRootDest = path.join(projectRoot, 'rezo360-flyer-modele-ia.jpg');
  const aiPublicDest = path.join(projectRoot, 'public/flyer-rezo360-modele-ia.jpg');
  if (fs.existsSync(aiSource)) {
    fs.copyFileSync(aiSource, aiRootDest);
    fs.copyFileSync(aiSource, aiPublicDest);
  }

  console.log('✅ Flyer Haute Définition (300 DPI) généré avec succès :');
  console.log(' - ' + outputPath);
  console.log(' - ' + rootOutputPath);
  console.log(' - ' + brainPath);

  await browser.close();
}

generateFlyer().catch(console.error);
