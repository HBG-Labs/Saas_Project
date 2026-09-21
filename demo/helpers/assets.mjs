import { chromium } from '@playwright/test';

const ASSET_SPECS = [
  [
    'intervention-attachments',
    'photo-before.png',
    'Avant intervention',
    'Ancien tableau et repérage initial',
    '#ef4444',
  ],
  [
    'intervention-attachments',
    'photo-progress.png',
    'Travaux en cours',
    'Pose et raccordement des protections',
    '#f59e0b',
  ],
  [
    'intervention-attachments',
    'photo-after.png',
    'Installation terminée',
    'Tableau neuf, circuits identifiés',
    '#10b981',
  ],
  [
    'intervention-attachments',
    'test-report.png',
    'Contrôles électriques',
    'Mesures conformes et essais validés',
    '#2563eb',
  ],
  [
    'organization-documents',
    'contrat-maintenance.png',
    'Contrat de maintenance',
    'Document partagé dans l’espace client',
    '#7c3aed',
  ],
];

function illustrationMarkup(title, subtitle, accent) {
  return `<!doctype html>
    <html>
      <body style="margin:0;background:#0f172a">
        <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
          <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
          <rect width="1600" height="900" rx="42" fill="url(#g)"/>
          <rect x="95" y="105" width="1410" height="690" rx="34" fill="#f8fafc" opacity=".96"/>
          <circle cx="250" cy="280" r="86" fill="${accent}" opacity=".18"/>
          <path d="M185 310h130M250 245v130" stroke="${accent}" stroke-width="26" stroke-linecap="round"/>
          <text x="410" y="320" font-family="Arial, sans-serif" font-size="70" font-weight="700" fill="#0f172a">${title}</text>
          <text x="410" y="405" font-family="Arial, sans-serif" font-size="36" fill="#475569">${subtitle}</text>
          <rect x="410" y="500" width="750" height="34" rx="17" fill="${accent}" opacity=".75"/>
          <rect x="410" y="570" width="930" height="24" rx="12" fill="#cbd5e1"/>
          <rect x="410" y="625" width="660" height="24" rx="12" fill="#cbd5e1"/>
          <text x="120" y="755" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#334155">REZO360 · Démonstration fictive</text>
        </svg>
      </body>
    </html>`;
}

export async function commercialDemoAssets(constants) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const interventionPrefix = `${constants.organizationId}/${constants.missionId}/${constants.interventionId}`;
  const assets = [];

  try {
    for (const [bucket, filename, title, subtitle, accent] of ASSET_SPECS) {
      await page.setContent(illustrationMarkup(title, subtitle, accent), {
        waitUntil: 'load',
      });
      assets.push({
        bucket,
        path:
          bucket === 'organization-documents'
            ? `${constants.organizationId}/portal/${filename}`
            : `${interventionPrefix}/${filename}`,
        body: await page.screenshot({ type: 'png' }),
      });
    }
  } finally {
    await browser.close();
  }

  return assets;
}

export function signatureDataUrl(name, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="150" viewBox="0 0 520 150"><rect width="520" height="150" fill="white"/><path d="M30 105 C85 20,105 130,155 70 S225 115,270 58 S345 118,405 48" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/><text x="315" y="128" font-family="Arial" font-size="20" fill="#475569">${name}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
