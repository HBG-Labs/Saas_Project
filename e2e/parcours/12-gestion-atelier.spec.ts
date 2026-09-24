import { expect, test } from '@playwright/test';

import { CLIENT_ID, donneesPour } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

test.describe('Gestion Atelier', () => {
  test('le client reste consultable dans les deux présentations de la liste', async ({
    page,
    isMobile,
  }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/clients');
    if (!isMobile) {
      await expect(page.getByRole('region', { name: 'Liste des clients' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Contact', exact: true })).toBeVisible();
    }
    await page
      .getByRole('link', { name: /SCI Les Alizés/ })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_ID}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SCI Les Alizés');
    for (const name of ['Contacts', 'Sites d’intervention', 'Historique des missions']) {
      await page.getByRole('tab', { name: new RegExp(name.replace('’', '.')) }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });

  test('le panneau client conserve les commandes et le focus après défilement', async ({
    page,
    isMobile,
  }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/clients');
    const trigger = page.getByRole('button', { name: 'Nouveau client', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Nouveau client', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nom du client').fill('Client conservé');
    await dialog.locator('summary').filter({ hasText: 'Adresse principale' }).click();
    await dialog.getByLabel('Ville', { exact: true }).scrollIntoViewIfNeeded();
    const geometry = await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const action = element.querySelector('button[type="submit"]')?.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        width: box.width,
        viewport: window.innerWidth,
        height: window.innerHeight,
        actionBottom: action?.bottom,
        actionTop: action?.top,
      };
    });
    expect(geometry.right).toBeCloseTo(geometry.viewport, 0);
    expect(geometry.top).toBe(0);
    expect(geometry.width).toBeCloseTo(isMobile ? geometry.viewport : 480, 0);
    expect(geometry.actionTop).toBeGreaterThan(0);
    expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.height);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer à modifier' }).click();
    await expect(dialog.getByLabel('Nom du client')).toHaveValue('Client conservé');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog.getByLabel('Nom du client')).toHaveValue('');
  });

  test('les formulaires site et contact protègent aussi une saisie commencée', async ({ page }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto(`/clients/${CLIENT_ID}`);

    await page.getByRole('tab', { name: /Sites d.intervention/ }).click();
    await page.getByRole('button', { name: 'Nouveau site' }).click();
    const siteDialog = page.getByRole('dialog', { name: 'Nouveau site d’intervention' });
    await siteDialog.getByLabel('Nom du site').fill('Atelier protégé');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer à modifier' }).click();
    await expect(siteDialog.getByLabel('Nom du site')).toHaveValue('Atelier protégé');
    await siteDialog.getByRole('button', { name: 'Annuler' }).click();
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click();

    await page.getByRole('tab', { name: 'Contacts' }).click();
    await page.getByRole('button', { name: 'Ajouter un contact' }).click();
    const contactDialog = page.getByRole('dialog', { name: 'Nouvel interlocuteur' });
    const contactName = contactDialog.getByRole('textbox', { name: /^Nom/ });
    await contactName.fill('Interlocuteur protégé');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer à modifier' }).click();
    await expect(contactName).toHaveValue('Interlocuteur protégé');
    await contactDialog.getByRole('button', { name: 'Annuler' }).click();
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
  });

  test('les vues du planning restent accessibles avec la journée initiale sur téléphone', async ({
    page,
    isMobile,
  }) => {
    await installeSupabase(page, { role: 'owner' });
    await page.goto('/planning');
    const calendar = page.locator('.gestion-calendar');
    if (isMobile) {
      const day = calendar.getByRole('button', { name: 'Jour', exact: true });
      await expect(day).toHaveAttribute('aria-pressed', 'true');
      await calendar.getByRole('button', { name: 'Mois', exact: true }).click();
      await expect(calendar.getByRole('button', { name: 'Mois', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await day.click();
      await expect(day).toHaveAttribute('aria-pressed', 'true');
      await calendar.getByRole('button', { name: /ouvrir les filtres/i }).click();
      await expect(page.getByRole('dialog', { name: 'Filtres' })).toBeVisible();
      await expect(page.getByPlaceholder('Rechercher…')).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      const agenda = calendar.getByRole('button', { name: 'Agenda', exact: true });
      await expect(agenda).toHaveAttribute('aria-pressed', 'false');
      await calendar.getByRole('button', { name: 'Mois', exact: true }).click();
      await agenda.click();
      await expect(agenda).toHaveAttribute('aria-pressed', 'true');
      await expect(
        calendar.getByRole('textbox', { name: 'Rechercher dans le planning' }),
      ).toBeVisible();
    }
    const overflow = await page
      .locator('main')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('une liste dense conserve les missions et les actions terrain', async ({
    page,
    isMobile,
  }) => {
    const data = donneesPour('owner');
    const base = data.missions[0];
    if (!base) throw new Error('Fixture mission absente');
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        missions: Array.from({ length: 12 }, (_, index) => ({
          ...base,
          id: `55555555-5555-4555-8555-${String(index).padStart(12, '0')}`,
          reference: `MIS-${String(index + 1).padStart(4, '0')}`,
          title: `Intervention terrain ${index + 1}`,
        })),
      },
    });
    await page.goto('/missions');
    const list = page.getByLabel('Liste des missions');
    await expect(list.getByRole('link', { name: 'Voir la fiche', exact: true })).toHaveCount(12);
    await expect(list.getByRole('button', { name: 'Itinéraire', exact: true })).toHaveCount(12);
    const bounds = await list.evaluate((element) => {
      const row = element.firstElementChild?.getBoundingClientRect();
      return {
        height: row?.height ?? 0,
        right: element.getBoundingClientRect().right,
        viewport: window.innerWidth,
      };
    });
    expect(bounds.height).toBeGreaterThan(0);
    if (!isMobile) expect(bounds.height).toBeLessThan(140);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
  });
});
