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

test.describe('Transversal Atelier', () => {
  test('le portail client conserve une navigation lisible et une entrée sans dégradé', async ({
    page,
  }) => {
    await installeSupabase(page, {
      rpc: {
        portal_my_context: [CONTEXTE_PORTAIL],
        portal_touch_last_seen: null,
        portal_list_missions: [],
        portal_list_invoices: [],
        portal_list_documents: [],
      },
    });

    await page.goto('/portail');

    const welcome = page.getByRole('region', { name: /Bonjour Marie/ });
    await expect(welcome).toBeVisible();
    await expect(page.getByText('HBG Labs').filter({ visible: true }).first()).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Navigation du portail' }).filter({ visible: true }),
    ).toBeVisible();
    expect(await welcome.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe(
      'none',
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('l’assistant garde sa saisie et ses commandes accessibles', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/assistant-ia');

    await expect(page.getByText('Assistant REZO360 IA')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Historique des recherches' })).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('le profil et le centre de notifications restent utilisables ensemble', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/profile');

    await expect(page.getByRole('heading', { name: 'Profil & Fiche Technicien' })).toBeVisible();
    await expect(page.getByRole('button', { name: "Changer d'avatar" })).toBeVisible();
    await page.getByRole('button', { name: /Notifications d'activité/ }).click();
    await expect(page.getByLabel('Centre de notifications')).toBeVisible();
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
  });

  test('les paramètres et la facturation partagent la même navigation calme', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/settings');

    const settings = page.getByRole('navigation', { name: 'Catégories de paramètres' });
    await expect(settings.getByRole('button', { name: 'Apparence & Cockpit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await settings.getByRole('button', { name: 'Alertes & Notifications' }).click();
    await expect(page.getByText('Alertes & notifications terrain')).toBeVisible();

    await page.goto('/organisation/facturation');
    await expect(page.getByRole('heading', { name: 'Facturation', level: 1 })).toBeVisible();
    await expect(page.getByText('Formule en cours')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
