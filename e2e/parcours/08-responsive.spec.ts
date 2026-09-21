import { expect, test } from '@playwright/test';

import { INTERVENTION_ID, MISSION_ID, facture, factureTotaux } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours 9 — pas de débordement horizontal, cibles tactiles atteignables.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI ICI, ET PAS DANS `scripts/responsive-audit.mjs`
 *
 * Ce script existe et fait le même travail, mais il se connecte avec un compte
 * de seed sur la BASE RÉELLE — compte supprimé depuis, et identifiants qu'il
 * faudrait mettre dans les secrets CI pour l'exécuter à chaque contribution.
 *
 * La même garantie, portée par la suite, ne coûte aucun accès : la session est
 * simulée, l'origine est factice, et la vérification tourne sur le bundle
 * réellement livré, à chaque exécution.
 *
 * Le script reste utile pour un audit ponctuel, plus large, lancé à la main.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Écrans authentifiés les plus consultés, sur les trois univers. */
const ECRANS = [
  ['tableau de bord', '/dashboard'],
  ['missions', '/missions'],
  ['fiche mission', `/missions/${MISSION_ID}`],
  ['intervention', `/interventions/${INTERVENTION_ID}`],
  ['factures', '/factures'],
] as const;

test.describe('Responsive', () => {
  for (const [nom, chemin] of ECRANS) {
    test(`aucun débordement horizontal — ${nom}`, async ({ page, viewport }) => {
      await installeSupabase(page, {
        role: 'owner',
        donnees: { invoices: [facture()], invoice_totals: [factureTotaux()] },
      });

      await page.goto(chemin);
      await expect(page.getByRole('heading').first()).toBeVisible();

      const debordement = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      /*
        Une tolérance de 1 px absorbe les arrondis de sous-pixel ; au-delà,
        c'est une largeur fixe, un mot insécable ou une grille rigide — et sur
        un téléphone cela se traduit par un écran qui glisse latéralement.
      */
      expect(
        debordement,
        `${nom} déborde de ${debordement} px à ${viewport?.width ?? '?'} px de large`,
      ).toBeLessThanOrEqual(1);
    });
  }

  test('la barre de navigation basse offre des cibles atteignables au pouce', async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) >= 768, 'Barre basse propre au téléphone');

    await installeSupabase(page, { role: 'owner' });
    await page.goto('/dashboard');

    const barre = page.getByRole('navigation', { name: 'Navigation rapide' });
    await expect(barre).toBeVisible();

    const entrees = barre.getByRole('link');
    const total = await entrees.count();
    expect(total).toBeGreaterThan(0);

    for (let index = 0; index < total; index += 1) {
      const boite = await entrees.nth(index).boundingBox();
      if (boite === null) continue;
      // 44 px est le minimum retenu par le produit (Apple HIG, WCAG 2.5.5).
      expect(
        Math.max(boite.width, boite.height),
        `entrée ${index} mesure ${Math.round(boite.width)}×${Math.round(boite.height)} px`,
      ).toBeGreaterThanOrEqual(40);
    }

    const active = barre.getByRole('link', { name: 'Accueil' });
    const inactive = barre.getByRole('link', { name: 'Missions' });
    await expect(active).toHaveAttribute('aria-current', 'page');

    const apparence = await active.evaluate(
      (link, inactiveLink) => {
        const activeIcon = link.querySelector('svg');
        const inactiveIcon = inactiveLink?.querySelector('svg');
        const label = link.querySelector('span');

        return {
          background: getComputedStyle(link).backgroundColor,
          iconColor: activeIcon ? getComputedStyle(activeIcon).color : '',
          inactiveIconColor: inactiveIcon ? getComputedStyle(inactiveIcon).color : '',
          labelColor: label ? getComputedStyle(label).color : '',
        };
      },
      await inactive.elementHandle(),
    );

    // L'état actif colore le dessin lui-même, sans capsule derrière le bouton.
    expect(apparence.background).toBe('rgba(0, 0, 0, 0)');
    expect(apparence.iconColor).not.toBe(apparence.inactiveIconColor);
    expect(apparence.iconColor).not.toBe(apparence.labelColor);
  });
});
