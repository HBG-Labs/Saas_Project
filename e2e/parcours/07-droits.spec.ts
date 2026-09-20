import { expect, test } from '@playwright/test';

import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours critique 8 — les refus, et ce qu'ils disent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN REFUS EST UNE INFORMATION, PAS UN MUR
 *
 * Masquer une entrée de menu ne suffit pas : on arrive aussi sur une page par
 * un lien, un favori ou un e-mail. Le produit distingue alors deux refus, et
 * cette distinction fait partie de ce qu'on vend :
 *
 *   « vous n'avez pas le droit »  → nomme le rôle, et qui peut le changer.
 *   « votre formule ne l'inclut pas » → nomme la formule requise et son prix.
 *
 * Les confondre, ou les remplacer par une page blanche, serait une régression
 * fonctionnelle — pas un détail d'affichage.
 * ─────────────────────────────────────────────────────────────────────────────
 */
test.describe('Refus de droit', () => {
  test('un technicien qui ouvre les factures voit son rôle nommé', async ({ page }) => {
    await installeSupabase(page, { role: 'technician' });

    await page.goto('/factures');

    await expect(page.getByText('Cette section ne vous est pas accessible')).toBeVisible();
    // Le rôle est nommé DANS l'explication du refus — pas ailleurs à l'écran,
    // où « Technicien » apparaît aussi comme libellé de navigation.
    await expect(
      page.getByText(/Votre rôle \(Technicien\).*propriétaire ou un administrateur/s),
    ).toBeVisible();
  });

  test('une formule sans le module annonce la formule requise et son prix', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      // La formule fait foi côté serveur ; ici on simule l'organisation restée
      // en Gratuit, qui n'inclut pas la facturation.
      rpc: { organization_plan_code: 'free' },
    });

    await page.goto('/factures');

    await expect(page.getByText(/nécessite la formule/)).toBeVisible();
    await expect(page.getByText(/€\/mois/)).toBeVisible();
  });

  test('le refus de formule ne se confond pas avec le refus de rôle', async ({ page }) => {
    await installeSupabase(page, { role: 'owner', rpc: { organization_plan_code: 'free' } });

    await page.goto('/factures');

    await expect(page.getByText(/nécessite la formule/)).toBeVisible();
    await expect(page.getByText('Cette section ne vous est pas accessible')).toHaveCount(0);
  });

  test('un technicien ne voit pas non plus le journal d’activité', async ({ page }) => {
    // `audit.view` n'appartient ni au technicien ni au manager.
    await installeSupabase(page, { role: 'technician' });

    await page.goto('/journal');

    await expect(page.getByText('Cette section ne vous est pas accessible')).toBeVisible();
  });
});
