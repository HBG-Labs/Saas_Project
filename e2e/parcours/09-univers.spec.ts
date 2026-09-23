import { expect, test } from '@playwright/test';

import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours 10 — les trois univers rangent la barre, sans rien retirer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE PARCOURS PROTÈGE
 *
 * Les univers sont une couche de navigation : ils décident dans quel volet une
 * section apparaît, jamais si elle apparaît. Deux régressions sont possibles
 * et toutes deux muettes :
 *
 * - une destination qui n'est plus dans aucun volet — l'écran existe, la
 *   permission existe, personne n'y accède plus ;
 * - un lien profond qui atterrit dans le mauvais volet — /devis ouvre la
 *   barre sur Gestion, et l'entrée active n'est nulle part.
 *
 * Il tourne sur le bureau seulement : la barre basse mobile n'a pas d'univers
 * (arbitrage D de la phase 2).
 * ─────────────────────────────────────────────────────────────────────────────
 */
test.describe('Univers', () => {
  test.beforeEach(({ viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, 'Sélecteur d’univers propre au grand écran');
  });

  test('un lien profond ouvre la barre dans le bon univers', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });

    await page.goto('/devis');
    await expect(page).toHaveURL(/\/devis$/);

    const univers = page.getByRole('radiogroup', { name: 'Univers' });
    await expect(univers.getByRole('radio', { name: /Finance/ })).toBeChecked();

    const navigation = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(navigation.getByRole('link', { name: 'Devis', exact: true })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Missions' })).toHaveCount(0);
  });

  test('changer d’univers change de volet, et la boîte à outils reste', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });

    await page.goto('/dashboard');
    const navigation = page.getByRole('navigation', { name: 'Navigation principale' });
    const univers = page.getByRole('radiogroup', { name: 'Univers' });

    // Gestion d'abord : c'est l'univers du tableau de bord.
    await expect(univers.getByRole('radio', { name: /Gestion/ })).toBeChecked();
    await expect(navigation.getByRole('link', { name: 'Missions' })).toBeVisible();

    await univers.getByRole('radio', { name: /Finance/ }).click();

    await expect(navigation.getByRole('link', { name: 'Factures', exact: true })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Missions' })).toHaveCount(0);
    // Transversale : visible depuis chaque univers.
    await expect(navigation.getByText('Boîte à outils')).toBeVisible();
  });
});
