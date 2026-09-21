import { expect, test } from '@playwright/test';

import { CLIENT_ID, ORGANISATION_ID } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

const CONTEXTE_PORTAIL = {
  organization_id: ORGANISATION_ID,
  organization_name: 'HBG Labs',
  contact_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  contact_first_name: 'Marie',
  contact_last_name: 'Alizé',
  contact_email: 'marie@alizes.test',
  customer_id: CLIENT_ID,
  customer_name: 'SCI Les Alizés',
  allow_client_initiated: true,
  features: {
    missions: true,
    interventions: true,
    quotes: true,
    invoicing: true,
    documents: true,
  },
};

const ETATS_VIDES = [
  ['/vehicules', 'vehicles'],
  ['/organisation/membres', 'invitations'],
  ['/equipes', 'teams'],
  ['/dossiers-clos', 'archives'],
  ['/controle', 'reports'],
  ['/missions', 'missions'],
  ['/clients', 'customers'],
  ['/equipements', 'equipment'],
  ['/assistant-ia/documents', 'library'],
  ['/favorites', 'favorites'],
  ['/history', 'history'],
  ['/journal', 'audit'],
  ['/achats/commandes', 'purchases'],
  ['/achats/fournisseurs', 'customers'],
  ['/stock', 'stock'],
  ['/stock/mouvements', 'stock'],
] as const;

test.describe('Illustrations des premiers usages Atelier', () => {
  test.setTimeout(120_000);

  test('les grands états vides affichent une scène chargée', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        customers: [],
        missions: [],
        interventions: [],
      },
    });

    for (const [route, subject] of ETATS_VIDES) {
      await page.goto(route);
      const illustration = page.locator(`[data-atelier-illustration="${subject}"]`).first();
      await expect(illustration, `${route} doit illustrer « ${subject} »`).toBeVisible();
      const image = illustration.locator('img');
      await expect(image).toHaveAttribute('alt', '');
      await expect(image).toHaveJSProperty('complete', true);
      expect(
        await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
        `${route} doit charger le SVG « ${subject} »`,
      ).toBeGreaterThan(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        `${route} ne doit pas déborder horizontalement`,
      ).toBeLessThanOrEqual(1);
    }
  });

  test('une recherche vide garde un retour compact plutôt qu’une scène de premier usage', async ({
    page,
  }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/vehicules');

    await expect(page.locator('[data-atelier-illustration="vehicles"]')).toBeVisible();
    await page.getByRole('textbox', { name: 'Rechercher un véhicule' }).fill('introuvable');

    await expect(page.getByText('Aucun véhicule trouvé')).toBeVisible();
    await expect(page.locator('[data-atelier-illustration="vehicles"]')).toHaveCount(0);
  });

  test('le portail client illustre aussi ses rubriques encore vides', async ({ page }) => {
    await installeSupabase(page, {
      rpc: {
        portal_my_context: [CONTEXTE_PORTAIL],
        portal_touch_last_seen: null,
        portal_list_missions: [],
        portal_list_quotes: [],
        portal_list_invoices: [],
        portal_list_documents: [],
      },
    });

    for (const [route, subject] of [
      ['/portail/interventions', 'missions'],
      ['/portail/devis', 'quotes'],
      ['/portail/factures', 'invoices'],
      ['/portail/documents', 'library'],
      ['/portail/messages', 'messages'],
    ] as const) {
      await page.goto(route);
      await expect(
        page.locator(`[data-atelier-illustration="${subject}"]`).first(),
        `${route} doit illustrer « ${subject} »`,
      ).toBeVisible();
    }
  });
});
