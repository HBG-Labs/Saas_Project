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
        Math.min(boite.width, boite.height),
        `entrée ${index} mesure ${Math.round(boite.width)}×${Math.round(boite.height)} px`,
      ).toBeGreaterThanOrEqual(44);
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

  test('les états vides essentiels tiennent dans un écran mobile sans doublons', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Comportement propre à la hauteur contrainte d’un téléphone');

    await page.setViewportSize({ width: 360, height: 800 });
    await installeSupabase(page, {
      role: 'owner',
      donnees: { missions: [], interventions: [] },
    });

    await page.goto('/missions');
    await expect(page.getByText('Aucune mission en cours', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nouvelle mission', exact: true })).toHaveCount(1);
    await expect(page.getByText('Créer une première mission', { exact: true })).toHaveCount(0);
    await expect(page.getByText('CSV', { exact: true })).toHaveCount(0);

    const createButton = page.getByRole('link', { name: 'Nouvelle mission', exact: true });
    const missionsTab = page.locator('main .atelier-action-tab').first();
    const [buttonBox, tabBox] = await Promise.all([
      createButton.boundingBox(),
      missionsTab.boundingBox(),
    ]);
    expect(buttonBox).not.toBeNull();
    expect(tabBox).not.toBeNull();
    const buttonToTabsGap = (tabBox?.y ?? 0) - ((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0));
    expect(
      buttonToTabsGap,
      'le bouton vert doit être décollé des onglets de 8 px',
    ).toBeGreaterThanOrEqual(7.5);

    await expectVerticalFit(page, 'missions vides');

    await page.goto('/controle');
    await expect(page.getByText('Rien à contrôler', { exact: true })).toBeVisible();
    await expect(page.getByText('0 en attente de contrôle', { exact: true })).toHaveCount(0);
    await expectVerticalFit(page, 'rapports vides');
  });

  test('le tableau de bord propriétaire garde ses quatre indicateurs au-dessus de la navigation', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Composition propre à la hauteur contrainte d’un téléphone');

    await page.setViewportSize({ width: 360, height: 800 });
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/dashboard');

    const creation = page.getByRole('link', { name: 'Nouvelle mission', exact: true });
    const titreGuide = page.getByText('Vos premiers pas', { exact: true });
    const [creationBox, guideBox] = await Promise.all([
      creation.boundingBox(),
      titreGuide.evaluate((element) => {
        const card = element.closest('div.rounded-lg');
        const rect = card?.getBoundingClientRect();
        return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
      }),
    ]);

    expect(creationBox).not.toBeNull();
    expect(guideBox).not.toBeNull();
    const creationToGuideGap =
      (guideBox?.y ?? 0) - ((creationBox?.y ?? 0) + (creationBox?.height ?? 0));
    expect(
      creationToGuideGap,
      'le bouton vert doit respirer avant la carte des premiers pas',
    ).toBeGreaterThanOrEqual(12);

    const indicateurs = page.getByRole('region', { name: 'Indicateurs clés' });
    await expect(indicateurs.getByText('Comptes rendus à valider', { exact: true })).toBeVisible();
    await expect(indicateurs.getByText('Missions', { exact: true })).toBeVisible();
    await expect(indicateurs.getByText('Équipes de terrain', { exact: true })).toBeVisible();
    await expect(indicateurs.getByText('Intervenants', { exact: true })).toBeVisible();

    const [indicateursBox, navigationBox] = await Promise.all([
      indicateurs.boundingBox(),
      page.getByRole('navigation', { name: 'Navigation rapide' }).boundingBox(),
    ]);
    expect(indicateursBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    expect(
      (indicateursBox?.y ?? 0) + (indicateursBox?.height ?? 0),
      'les quatre indicateurs doivent rester visibles avant la navigation basse',
    ).toBeLessThanOrEqual((navigationBox?.y ?? 0) + 1);

    const raccourcis = page.getByRole('navigation', {
      name: 'Accès rapide du tableau de bord',
    });
    await expect(raccourcis.getByRole('link')).toHaveCount(4);
    await expect(raccourcis.locator('[data-atelier-illustration]')).toHaveCount(4);
    await expect(raccourcis.locator('[data-atelier-illustration="technicians"]')).toHaveCount(1);
  });
});

async function expectVerticalFit(page: import('@playwright/test').Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(overflow, `${label} déborde verticalement de ${overflow} px`).toBeLessThanOrEqual(1);
}
