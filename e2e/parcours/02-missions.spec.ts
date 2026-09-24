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
    await expect(page.getByText('MIS-0413').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('SCI Les Alizés').filter({ visible: true }).first()).toBeVisible();
  });

  test('une mission commencée demande confirmation avant de quitter', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/missions/nouvelle');

    const title = page.getByLabel('Intitulé');
    await title.fill('Intervention à conserver');
    await page.getByRole('link', { name: 'Annuler', exact: true }).click();

    const confirmation = page.getByRole('dialog', { name: 'Quitter sans créer la mission ?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Continuer à modifier' }).click();
    await expect(title).toHaveValue('Intervention à conserver');

    await page.getByRole('link', { name: 'Annuler', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await expect(page).toHaveURL(/\/missions$/);
  });

  test('une création réussie navigue sans avertissement de perte', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/missions/nouvelle');

    await page.getByLabel('Intitulé').fill('Maintenance préventive');
    await page.getByRole('button', { name: 'Créer la mission' }).click();

    await expect(page).toHaveURL(/\/missions\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('dialog', { name: 'Quitter sans créer la mission ?' })).toHaveCount(
      0,
    );
  });

  test('une modification commencée reste protégée dans le panneau mission', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto(`/missions/${MISSION_ID}`);

    await page.getByRole('button', { name: 'Modifier', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Modifier la mission' });
    const title = dialog.getByLabel('Intitulé');
    await title.fill('Mission modifiée à conserver');
    await page.keyboard.press('Escape');

    const confirmation = page.getByRole('dialog', { name: 'Quitter sans enregistrer ?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Continuer à modifier' }).click();
    await expect(title).toHaveValue('Mission modifiée à conserver');

    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await confirmation.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await expect(dialog).toHaveCount(0);
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
