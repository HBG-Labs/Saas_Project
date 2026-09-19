import { expect, test } from '@playwright/test';

import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours critique 1 — session, organisation et gardes de route.
 *
 * Tout le reste en dépend : si l'ossature authentifiée ne se monte pas, aucun
 * autre parcours n'a de sens. C'est aussi la zone la plus touchée par la
 * refonte (en-tête, barre latérale, sélecteur d'univers), donc celle qu'il faut
 * figer AVANT d'y toucher.
 */
test.describe('Session et gardes de route', () => {
  test('un propriétaire connecté atteint son tableau de bord', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible();
  });

  test('sur grand écran, la barre latérale nomme l’organisation courante', async ({
    page,
    viewport,
  }) => {
    // Sous 1024 px, la barre latérale est repliée dans un tiroir : le nom n'est
    // pas à l'écran, et l'exiger ferait échouer le parcours mobile pour une
    // raison d'affichage, pas de session.
    test.skip((viewport?.width ?? 0) < 1024, 'Barre latérale absente sous 1024 px');

    await installeSupabase(page, { role: 'owner' });
    await page.goto('/dashboard');

    await expect(page.getByText('HBG Labs').first()).toBeVisible();
  });

  test('un visiteur non connecté est renvoyé vers la connexion', async ({ page }) => {
    // Pas de session installée : seules les routes publiques répondent.
    await page.goto('/missions');

    await expect(page).toHaveURL(/\/login/);
  });

  test('la barre latérale ne propose que ce que le rôle autorise', async ({ page }) => {
    await installeSupabase(page, { role: 'technician' });

    await page.goto('/dashboard');

    /*
      D'ABORD prouver que la session tient.

      Ce test a commencé sa vie en faux vert : l'application redirigeait vers
      `/login`, où il n'y a évidemment aucune entrée « Factures ». Une absence
      ne vaut que si la présence attendue est vérifiée juste à côté.
    */
    await expect(page).toHaveURL(/\/dashboard$/);
    const navigation = page.getByRole('navigation').first();
    await expect(navigation.getByRole('link', { name: 'Missions' })).toBeVisible();

    // `invoice.view` n'appartient pas au technicien : l'entrée est absente,
    // pas verrouillée (cf. `useVisibleNavItems`).
    await expect(navigation.getByRole('link', { name: 'Factures', exact: true })).toHaveCount(0);
  });
});
