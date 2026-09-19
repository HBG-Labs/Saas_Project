import { expect, test } from '@playwright/test';

import { donneesPour, MEMBRE_ID, MISSION_ID } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours critique 2 — les missions.
 *
 * Le cœur du produit, et l'écran le plus dense : c'est là que la refonte a le
 * plus à perdre. Les transitions sont vérifiées pour ce qu'elles VALENT
 * métier — qui peut faire avancer quoi — et non pour leur apparence.
 */
test.describe('Missions', () => {
  test('la liste affiche les missions de l’organisation', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });

    await page.goto('/missions');

    await expect(page.getByRole('link', { name: /Tirage fibre bâtiment C/ }).first()).toBeVisible();
    await expect(page.getByText('MIS-0413').first()).toBeVisible();
  });

  test('ouvrir une mission mène à sa fiche, client compris', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });

    await page.goto(`/missions/${MISSION_ID}`);

    await expect(
      page.getByRole('heading', { name: 'Tirage fibre bâtiment C', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('MIS-0413').first()).toBeVisible();
    await expect(page.getByText('SCI Les Alizés').first()).toBeVisible();
  });

  /*
    LES DEUX TESTS QUI COMPTENT.

    `workflow.ts` dit qu'une mission en cours ne se termine que par son
    intervenant (`assigneeOnly`), et ne s'interrompt qu'avec `mission.cancel`.
    Ces deux règles sont rejouées en base par un trigger ; ici on vérifie que
    l'interface ne PROPOSE jamais une action que le serveur refuserait — la
    règle 23.4 du produit.
  */
  test('un propriétaire non affecté peut interrompre, pas terminer', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });

    await page.goto(`/missions/${MISSION_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Interrompre' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terminer les travaux' })).toHaveCount(0);
  });

  test('l’intervenant affecté peut terminer, pas interrompre', async ({ page }) => {
    const base = donneesPour('technician');
    await installeSupabase(page, {
      role: 'technician',
      donnees: {
        // `assigned_user_id` porte l'identifiant de l'APPARTENANCE, pas celui
        // du compte : c'est ce que compare `MissionDetailPage`.
        missions: base.missions.map((mission) => ({ ...mission, assigned_user_id: MEMBRE_ID })),
      },
    });

    await page.goto(`/missions/${MISSION_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Terminer les travaux' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Interrompre' })).toHaveCount(0);
  });
});
