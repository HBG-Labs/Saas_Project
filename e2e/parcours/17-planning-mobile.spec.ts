import { expect, test } from '@playwright/test';

import { donneesPour, MISSION_ID } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

test.describe('Planning mobile-first', () => {
  test('ouvre le formulaire métier complet sur la date choisie puis revient au planning', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Le parcours cible l’expérience mobile.');
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/planning?section=agenda&view=day&date=2026-09-23');

    await page.getByRole('button', { name: 'Nouvelle intervention', exact: true }).click();

    await expect(page).toHaveURL(/\/missions\/nouvelle\?date=2026-09-23/);
    await expect(page.locator('input[name="scheduledStart"]')).toHaveValue('2026-09-23T09:00');
    await expect(page.getByLabel("Nature de l'intervention")).toBeVisible();
    await expect(page.getByLabel('Client')).toBeVisible();
    await expect(page.getByLabel('Site')).toBeVisible();
    await page.getByRole('link', { name: 'Annuler', exact: true }).click();
    await expect(page).toHaveURL(/\/planning\?section=agenda&view=day&date=2026-09-23/);
  });

  test('reste opérationnel de 320 à 430 px puis sur tablette', async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(
      !isMobile,
      'La matrice de largeurs est exécutée une seule fois dans le projet mobile.',
    );

    const data = donneesPour('owner');
    const base = data.missions[0];
    if (!base) throw new Error('Fixture mission absente');

    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        missions: Array.from({ length: 21 }, (_, index) => ({
          ...base,
          id: `91919191-9191-4191-8191-${String(index).padStart(12, '0')}`,
          reference: `MOB-${String(index + 1).padStart(4, '0')}`,
          title:
            index === 0
              ? 'Intervention avec un intitulé volontairement très long pour vérifier la compacité mobile'
              : `Intervention terrain ${index + 1}`,
          scheduled_start: `2026-09-23T${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}:00.000Z`,
        })),
      },
    });

    for (const width of [320, 360, 375, 390, 412, 430]) {
      await page.setViewportSize({ width, height: 820 });
      await page.goto('/planning?section=agenda&view=day&date=2026-09-23');

      await expect(page.getByRole('heading', { name: 'Planning', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Jour', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByText('En cours').first()).toBeVisible();
      await expect(page.getByText(/Intervention avec un intitulé/)).toBeVisible();

      const geometry = await page.locator('main').evaluate((element) => ({
        overflow: element.scrollWidth - element.clientWidth,
        viewport: window.innerWidth,
      }));
      expect(geometry.viewport).toBe(width);
      expect(geometry.overflow).toBeLessThanOrEqual(1);

      const firstCard = page.locator('.gestion-calendar article').first();
      const box = await firstCard.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.y ?? 9999).toBeLessThan(760);

      if (width === 390) {
        await page.screenshot({ path: testInfo.outputPath('planning-390.png'), fullPage: true });
      }
    }

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/planning');
    await expect(page.getByRole('button', { name: 'Mois', exact: true })).toBeVisible();
    const tabletOverflow = await page
      .locator('main')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(tabletOverflow).toBeLessThanOrEqual(1);
  });

  test('navigue entre semaine, mois, liste et les plannings secondaires', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Le parcours cible l’expérience mobile.');
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/planning?section=agenda&view=day&date=2026-09-19');

    const calendar = page.locator('.gestion-calendar');
    await calendar.getByRole('button', { name: 'Liste', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Prochaines interventions' })).toBeVisible();
    await expect(page.getByText('Tirage fibre bâtiment C').first()).toBeVisible();

    await calendar.getByRole('button', { name: 'Semaine', exact: true }).click();
    await expect(page.getByRole('heading', { name: /14 sept.*20 sept.*2026/i })).toBeVisible();
    await calendar.getByRole('button', { name: 'Semaine suivante' }).click();
    await expect(page).toHaveURL(/date=2026-09-26/);
    await calendar.getByRole('button', { name: 'Semaine précédente' }).click();
    await expect(page).toHaveURL(/date=2026-09-19/);

    await calendar.getByRole('button', { name: 'Mois', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Septembre 2026' })).toBeVisible();
    await calendar.getByRole('button', { name: 'Mois suivant' }).click();
    await expect(page.getByRole('heading', { name: 'Octobre 2026' })).toBeVisible();
    await calendar.getByRole('button', { name: 'Lundi 5 octobre 2026, 0 interventions' }).click();
    await expect(calendar.getByRole('button', { name: 'Jour', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await calendar.getByRole('button', { name: /Congés/ }).click();
    await expect(page).toHaveURL(/section=leaves/);
    await page.getByRole('button', { name: 'Retour au planning' }).click();
    await calendar.getByRole('button', { name: /^Tâches/ }).click();
    await expect(page).toHaveURL(/section=recurring/);
    await page.getByRole('button', { name: 'Retour au planning' }).click();
    await calendar.getByRole('button', { name: /Jours fériés/ }).click();
    await expect(page).toHaveURL(/section=holidays/);
    await page.getByRole('button', { name: 'Retour au planning' }).click();

    await calendar.getByRole('button', { name: 'Importer .ics' }).click();
    await expect(page.getByRole('dialog', { name: 'Importer un calendrier iCal' })).toBeVisible();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await calendar.getByRole('button', { name: 'Exporter .ics' }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(
      /^planning_rezo360_\d{4}-\d{2}-\d{2}\.ics$/,
    );
  });

  test('respecte le RBAC technicien et ouvre la mission en une interaction', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Le parcours cible l’expérience mobile.');
    await installeSupabase(page, { role: 'technician' });
    await page.goto('/planning?section=agenda&view=day&date=2026-09-19');

    await expect(
      page.getByRole('button', { name: 'Nouvelle intervention', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ajouter', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Importer .ics' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exporter .ics' })).toBeVisible();

    await page.getByRole('link', { name: /Ouvrir Tirage fibre bâtiment C/i }).click();
    await expect(page).toHaveURL(new RegExp(`/missions/${MISSION_ID}$`));
    await expect(page.getByRole('heading', { name: 'Tirage fibre bâtiment C' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Itinéraire GPS' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Appeler' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Planning', exact: true }).first().click();
    await expect(page).toHaveURL(/\/planning\?section=agenda&view=day&date=2026-09-19/);
  });
});
