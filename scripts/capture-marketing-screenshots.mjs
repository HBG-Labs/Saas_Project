import { existsSync, mkdirSync, readFileSync } from 'node:fs';

import { chromium } from '@playwright/test';

const baseUrl = process.argv.find((arg) => arg.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:5173';
const outputDirectory = 'public/images/product';

const env = existsSync('.env.local')
  ? Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.includes('=') && !line.startsWith('#'))
        .map((line) => {
          const separator = line.indexOf('=');
          return [
            line.slice(0, separator).trim(),
            line
              .slice(separator + 1)
              .trim()
              .replace(/^["']|["']$/g, ''),
          ];
        }),
    )
  : {};

const email = process.env.AUDIT_EMAIL ?? 'owner.a@nexoratech.local';
const password = process.env.AUDIT_PASSWORD ?? env.SEED_TEST_PASSWORD ?? '';

if (!password) {
  throw new Error('SEED_TEST_PASSWORD est requis pour capturer les écrans de démonstration.');
}

mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
});
const page = await context.newPage();

await page.addInitScript(() => {
  localStorage.setItem(
    'rezo360_cookie_consent',
    JSON.stringify({ necessary: true, analytics: false, marketing: false }),
  );
});

const demoUserId = '00000000-0000-4000-8000-000000000360';
const demoOrganizationId = '10000000-0000-4000-8000-000000000360';
const demoMemberId = '20000000-0000-4000-8000-000000000360';
const now = '2026-09-04T09:00:00.000Z';

const demoOrganization = {
  id: demoOrganizationId,
  slug: 'atelier-demo',
  name: 'Atelier Démonstration',
  legal_name: null,
  logo_url: null,
  registration_number: null,
  vat_number: null,
  email: null,
  phone: null,
  address_line1: null,
  address_line2: null,
  postal_code: null,
  city: null,
  country: 'FR',
  status: 'active',
  industry: null,
  default_vat_rate: 20,
  quote_payment_terms: null,
  quote_payment_method: null,
  legal_form: null,
  ape_code: null,
  share_capital_cents: null,
  rcs_city: null,
  iban: null,
  bic: null,
  vat_regime: null,
  holiday_territory: 'metropole',
  plan_code: 'business',
  created_by: demoUserId,
  created_at: now,
  updated_at: now,
};

const demoMember = {
  id: demoMemberId,
  organization_id: demoOrganizationId,
  user_id: demoUserId,
  role: 'owner',
  status: 'active',
  job_title: 'Responsable opérations',
  phone: null,
  invited_by: null,
  joined_at: now,
  created_at: now,
  updated_at: now,
  profile: {
    id: demoUserId,
    display_name: 'Compte démonstration',
    avatar_id: null,
  },
};

const missionBase = {
  organization_id: demoOrganizationId,
  description: null,
  category_id: null,
  intervention_type_id: null,
  customer_id: null,
  site_id: null,
  assigned_team_id: null,
  assigned_user_id: demoMemberId,
  actual_start: null,
  actual_end: null,
  address_line2: null,
  country: 'FR',
  latitude: null,
  longitude: null,
  customer_contact: null,
  customer_phone: null,
  customer_email: null,
  notes: null,
  created_by: demoUserId,
  created_at: now,
  updated_at: now,
  category: null,
  assigned_team: null,
  assigned_member: demoMember,
  customer: null,
};

const demoMissions = [
  {
    ...missionBase,
    id: '30000000-0000-4000-8000-000000000361',
    reference: '2026-0142',
    title: 'Maintenance préventive CVC',
    priority: 'high',
    status: 'in_progress',
    scheduled_start: '2026-09-04T08:30:00.000Z',
    scheduled_end: '2026-09-04T10:30:00.000Z',
    location_label: 'Site Horizon',
    address_line1: '12 rue de la Démonstration',
    postal_code: '75000',
    city: 'Paris',
    customer_name: 'Client Démonstration',
    site: { id: 'site-demo-1', name: 'Site Horizon', city: 'Paris', access_notes: null },
  },
  {
    ...missionBase,
    id: '30000000-0000-4000-8000-000000000362',
    reference: '2026-0143',
    title: 'Contrôle du réseau fibre',
    priority: 'normal',
    status: 'submitted',
    scheduled_start: '2026-09-04T11:00:00.000Z',
    scheduled_end: '2026-09-04T13:00:00.000Z',
    location_label: 'Bâtiment Atlas',
    address_line1: '8 avenue de la Démonstration',
    postal_code: '69000',
    city: 'Lyon',
    customer_name: 'Entreprise Exemple',
    site: { id: 'site-demo-2', name: 'Bâtiment Atlas', city: 'Lyon', access_notes: null },
  },
  {
    ...missionBase,
    id: '30000000-0000-4000-8000-000000000363',
    reference: '2026-0144',
    title: 'Mise en service armoire électrique',
    priority: 'urgent',
    status: 'assigned',
    scheduled_start: '2026-09-04T14:00:00.000Z',
    scheduled_end: '2026-09-04T16:30:00.000Z',
    location_label: 'Atelier Delta',
    address_line1: '4 allée de la Démonstration',
    postal_code: '33000',
    city: 'Bordeaux',
    customer_name: 'Société Test',
    site: { id: 'site-demo-3', name: 'Atelier Delta', city: 'Bordeaux', access_notes: null },
  },
];

await page.route(/\/rest\/v1\//, async (route) => {
  const requestUrl = new URL(route.request().url());
  const endpoint = requestUrl.pathname.split('/').at(-1);
  const accept = route.request().headers().accept ?? '';
  const wantsObject = accept.includes('application/vnd.pgrst.object+json');

  let body = [];
  if (endpoint === 'organizations') body = wantsObject ? demoOrganization : [demoOrganization];
  if (endpoint === 'organization_members') body = wantsObject ? demoMember : [demoMember];
  if (endpoint === 'subscriptions') {
    body = wantsObject
      ? {
          id: 'subscription-demo',
          user_id: demoUserId,
          organization_id: demoOrganizationId,
          plan_code: 'business',
          status: 'trialing',
          current_period_start: now,
          current_period_end: null,
          trial_ends_at: '2026-09-18T09:00:00.000Z',
          canceled_at: null,
          cancel_at_period_end: false,
          provider: null,
          provider_customer_id: null,
          provider_subscription_id: null,
          created_at: now,
          updated_at: now,
        }
      : [];
  }
  if (endpoint === 'organization_plan_code') body = 'business';
  if (endpoint === 'missions') {
    body = requestUrl.searchParams.get('select') === 'status'
      ? demoMissions.map(({ status }) => ({ status }))
      : demoMissions;
  }
  if (endpoint === 'interventions') {
    body = [
      {
        id: '40000000-0000-4000-8000-000000000360',
        mission_id: demoMissions[0].id,
        organization_id: demoOrganizationId,
        technician_id: demoMemberId,
        status: 'in_progress',
        start_time: '2026-09-04T08:42:00.000Z',
        end_time: null,
        start_latitude: null,
        start_longitude: null,
        notes: null,
        created_at: now,
        updated_at: now,
        report: null,
        attachments: [],
      },
    ];
  }
  if (endpoint === 'intervention_reports') {
    const report = {
      id: '50000000-0000-4000-8000-000000000360',
      intervention_id: '40000000-0000-4000-8000-000000000360',
      organization_id: demoOrganizationId,
      technician_id: demoMemberId,
      work_description: 'Contrôle complet effectué et relevés consignés. Équipement prêt pour validation.',
      observations: 'Aucune anomalie bloquante constatée.',
      materials_used: [],
      tools_used: [],
      customer_signature_path: null,
      customer_signature_name: 'Client Démonstration',
      technician_signature_path: null,
      status: 'submitted',
      submitted_at: '2026-09-04T10:20:00.000Z',
      reviewed_at: null,
      reviewed_by: null,
      rejection_reason: null,
      created_at: now,
      updated_at: now,
      intervention: {
        id: '40000000-0000-4000-8000-000000000360',
        mission: {
          id: demoMissions[0].id,
          reference: demoMissions[0].reference,
          title: demoMissions[0].title,
        },
        technician: demoMember,
      },
    };
    body = requestUrl.searchParams.get('select') === 'status' ? [{ status: 'submitted' }] : [report];
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Content-Range': Array.isArray(body) ? `0-${Math.max(0, body.length - 1)}/${body.length}` : '0-0/1' },
    body: JSON.stringify(body),
  });
});

await page.route('**/auth/v1/token*', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'rezo360-demo-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'rezo360-demo-refresh-token',
      user: {
        id: demoUserId,
        email: 'demo@rezo360.app',
        user_metadata: { display_name: 'Compte démonstration' },
      },
    }),
  });
});

await page.route('**/rest/v1/profiles*', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: demoUserId,
      display_name: 'Compte démonstration',
      avatar_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }),
  });
});

await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
await page.getByLabel(/adresse e-?mail/i).fill(email);
await page.locator('input[type="password"]').first().fill(password);
await page.getByRole('button', { name: /se connecter|connexion/i }).click();
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });

const captures = [
  ['dashboard', '/dashboard'],
  ['missions', '/missions'],
  ['reports', '/comptes-rendus'],
  ['review', '/controle'],
];

for (const [name, route] of captures) {
  if (new URL(page.url()).pathname !== route) {
    await page.evaluate((nextRoute) => {
      window.history.pushState({}, '', nextRoute);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, route);
  }
  await page.waitForTimeout(1_200);
  await page.screenshot({
    path: `${outputDirectory}/${name}.png`,
    fullPage: false,
  });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => {
  window.history.pushState({}, '', '/tools');
  window.dispatchEvent(new PopStateEvent('popstate'));
});
await page.waitForTimeout(1_200);
await page.screenshot({
  path: `${outputDirectory}/tools-mobile.png`,
  fullPage: false,
});

await browser.close();
console.log(`Captures enregistrées dans ${outputDirectory}.`);
