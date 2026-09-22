import { expect, test } from '@playwright/test';

import {
  DEVIS_ID,
  FACTURE_ID,
  devis,
  devisTotaux,
  facture,
  factureTotaux,
} from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours critiques 5 et 6 — la chaîne de revenu.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX RÈGLES QUI NE SE NÉGOCIENT PAS
 *
 * On ne facture qu'un devis ACCEPTÉ : proposer le bouton plus tôt inviterait à
 * facturer ce que le client n'a pas validé.
 *
 * Une facture ÉMISE est définitive : numérotation sérialisée, instantané du
 * destinataire figé, immuabilité posée par trigger. L'interface ne doit plus
 * offrir de la modifier.
 * ─────────────────────────────────────────────────────────────────────────────
 */

test.describe('Devis', () => {
  test('le nouveau devis devient un éditeur de document complet sur ordinateur', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installeSupabase(page, { role: 'owner' });

    await page.goto('/devis');

    const document = page.getByLabel('Document devis');
    await expect(document).toBeVisible();
    await expect(document.getByText('Destinataire', { exact: true })).toBeVisible();
    await expect(document.getByText('Dates du document')).toBeVisible();
    await expect(document.getByText('Total TTC', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Importer le logo de l’entreprise')).toBeVisible();
    await expect(page.getByLabel('Date d’émission')).toHaveAttribute('type', 'date');
    await expect(page.getByLabel('Période de validité')).toHaveText(/60 jours/);

    const options = page.getByRole('complementary', { name: 'Options et synthèse du devis' });
    await expect(options).toBeHidden();
    await page.getByRole('button', { name: 'Ouvrir les options du devis' }).click();
    await expect(options).toBeVisible();
    await expect(options.getByText('Langue')).toHaveCount(0);
    await expect(options.getByText('Format électronique')).toBeVisible();
    await options.getByLabel('Complet').click();
    await expect(document.getByPlaceholder('Intitulé du devis')).toBeVisible();
    await expect(options.getByLabel('Coordonnées bancaires')).toBeChecked();
    await options.getByLabel('Rapide').click();
    await expect(document.getByPlaceholder('Intitulé du devis')).toHaveCount(0);
    await expect(options.getByLabel('Coordonnées bancaires')).not.toBeChecked();

    const sellerName = document.getByLabel('Nom de l’entreprise sur le devis');
    await sellerName.fill('Atelier Horizon');
    await expect(sellerName).toHaveValue('Atelier Horizon');

    await page.getByRole('button', { name: 'Aperçu PDF' }).last().click();
    const previewDialog = page.getByRole('dialog', { name: 'Document Officiel Devis PDF' });
    await expect(previewDialog).toBeVisible();
    const preview = previewDialog.locator('#quote-printable-area');
    await expect(preview.getByText('Atelier Horizon')).toBeVisible();
    await expect(preview.getByRole('columnheader', { name: 'TVA' })).toBeVisible();
    await expect(preview.locator('.financial-paper-table-head')).toHaveCSS(
      'background-color',
      'rgb(237, 243, 240)',
    );
    await expect(preview.locator('.financial-paper-accent-bar')).toHaveCount(0);
    await page.emulateMedia({ media: 'print' });
    const printTop = await page
      .locator('#quote-printable-area')
      .evaluate((element) => Math.round(element.getBoundingClientRect().top));
    expect(printTop).toBe(0);
    await page.emulateMedia({ media: 'screen' });
    await page.getByLabel('Fermer', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enregistrer le devis' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Création du devis' })).toBeHidden();
  });

  test('le nouveau devis mobile suit les quatre étapes sans perdre de rubrique', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await installeSupabase(page, { role: 'owner' });

    await page.goto('/devis');
    const main = page.getByRole('main');
    await expect(main.getByRole('navigation', { name: 'Création du devis' })).toBeVisible();
    await expect(main.getByText('Client et intervention')).toBeVisible();

    await main.getByRole('button', { name: /Étape 2 sur 4 : Prestations/ }).click();
    await expect(main.getByText('Catalogue de prestations')).toBeVisible();
    await expect(main.getByText('Prestations et fournitures')).toBeVisible();

    await main.getByRole('button', { name: /Étape 3 sur 4 : Conditions/ }).click();
    await expect(main.getByText('Conditions du devis')).toBeVisible();
    await expect(main.locator('#quote-vat-rate')).toBeVisible();

    await main.getByRole('button', { name: /Étape 4 sur 4 : Validation/ }).click();
    await expect(main.getByText('Synthèse du devis')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Enregistrer le devis' })).toBeVisible();

    const overflow = await main.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('un devis accepté propose d’être facturé', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        quotes: [devis({ status: 'accepted', client_responded_at: '2026-09-17T10:00:00.000Z' })],
        quote_totals: [devisTotaux()],
      },
    });

    await page.goto(`/devis/${DEVIS_ID}`);

    await expect(page.getByText('Facturer ce devis')).toBeVisible();
    const document = page.locator('#quote-printable-area');
    await expect(document.getByRole('columnheader', { name: 'TVA' })).toBeVisible();
    await expect(document.locator('.financial-paper-table-head')).toHaveCSS(
      'background-color',
      'rgb(237, 243, 240)',
    );
    await expect(document.locator('.financial-paper-accent-bar')).toHaveCount(0);
  });

  test('un devis encore en discussion ne propose pas de facturer', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        quotes: [devis({ status: 'sent', sent_at: '2026-09-16T10:00:00.000Z' })],
        quote_totals: [devisTotaux()],
      },
    });

    await page.goto(`/devis/${DEVIS_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByText('Facturer ce devis')).toHaveCount(0);
  });
});

test.describe('Factures', () => {
  test('le brouillon affiche tous ses champs et sa synthèse côte à côte sur ordinateur', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        invoices: [facture()],
        invoice_totals: [factureTotaux()],
      },
    });

    await page.goto(`/factures/${FACTURE_ID}`);
    await page.getByRole('button', { name: 'Modifier le brouillon' }).click();

    const dialog = page.getByRole('dialog', { name: 'Corriger le brouillon' });
    await expect(dialog.getByLabel('Nom du client')).toBeVisible();
    await expect(dialog.getByLabel('Date de prestation ou de livraison')).toBeVisible();
    await expect(dialog.getByLabel('Conditions d’escompte')).toBeVisible();
    await expect(
      dialog.getByRole('complementary', { name: 'Options et synthèse de la facture' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Enregistrer les modifications' }),
    ).toBeVisible();
    await expect(dialog.getByRole('navigation', { name: 'Correction de la facture' })).toBeHidden();
  });

  /*
    Le montant n'est pas dans la table : il vient de la vue `invoice_totals`,
    recollée côté client par `invoice_id`. Si cette jointure casse, la liste
    affiche « — » sans la moindre erreur. D'où ce test.
  */
  test('la liste affiche le montant TTC, qui vient de la vue des totaux', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        // Émise, donc identifiée par sa référence : un brouillon n'en a pas
        // encore d'utile et la liste affiche son titre à la place.
        invoices: [facture({ status: 'issued', issued_at: '2026-09-18T12:00:00.000Z' })],
        invoice_totals: [factureTotaux()],
      },
    });

    await page.goto('/factures');

    await expect(page.getByText('FA-2026-0118').filter({ visible: true }).first()).toBeVisible();
    /*
      Le montant est écrit DEUX FOIS dans la liste : une variante `sm:hidden`
      pour le téléphone, une `hidden sm:block` pour l'écran large. `.first()`
      seul désignait la variante masquée du moment — un échec qui ne disait
      rien du produit. On cherche donc celle qui est réellement affichée.
    */
    await expect(page.getByText('4320.00 €').filter({ visible: true }).first()).toBeVisible();
  });

  test('une facture en brouillon peut être émise', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        invoices: [facture()],
        invoice_totals: [factureTotaux()],
        invoice_vat_breakdown: [
          {
            invoice_id: FACTURE_ID,
            organization_id: '11111111-1111-4111-8111-111111111111',
            vat_rate: 8.5,
            vat_category: 'S',
            base_cents: 398156,
            vat_cents: 33844,
          },
        ],
      },
    });

    await page.goto(`/factures/${FACTURE_ID}`);

    await expect(page.getByRole('button', { name: 'Émettre la facture' })).toBeVisible();
  });

  test('la correction mobile du brouillon conserve toutes les rubriques dans quatre étapes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        invoices: [
          facture({
            items: [
              {
                id: '77777777-7777-4777-8777-777777777777',
                invoice_id: FACTURE_ID,
                description: 'Installation électrique',
                unit: 'forfait',
                quantity: 1,
                unit_price_cents: 25000,
                vat_rate: 20,
                vat_category: 'S',
                vat_exemption_reason: null,
              },
            ],
          }),
        ],
        invoice_totals: [factureTotaux()],
      },
    });

    await page.goto(`/factures/${FACTURE_ID}`);
    await page.getByRole('button', { name: 'Modifier le brouillon' }).click();

    const dialog = page.getByRole('dialog', { name: 'Corriger le brouillon' });
    await expect(
      dialog.getByRole('navigation', { name: 'Correction de la facture' }),
    ).toBeVisible();
    await expect(dialog.getByLabel('Nom du client')).toBeVisible();

    await dialog.getByRole('button', { name: /Étape 2 sur 4 : Prestations/ }).click();
    await expect(dialog.getByLabel('Date de prestation ou de livraison')).toBeVisible();
    await expect(dialog.getByLabel('Description 1')).toBeVisible();

    await dialog.getByRole('button', { name: /Étape 3 sur 4 : Conditions/ }).click();
    await expect(dialog.getByLabel('Conditions d’escompte')).toBeVisible();

    await dialog.getByRole('button', { name: /Étape 4 sur 4 : Validation/ }).click();
    await expect(dialog.getByText('Vérification du brouillon')).toBeVisible();
    await expect(dialog.getByLabel('Validation de la facture').getByText('300,00 €')).toBeVisible();

    const overflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  /*
    LE TEST QUI COMPTE.

    Après émission, `invoices_immutable` refuse toute écriture. L'interface
    doit refléter ce mur : plus d'émission possible, plus de modification.
  */
  test('une facture émise n’offre plus ni émission ni modification', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        invoices: [facture({ status: 'issued', issued_at: '2026-09-18T12:00:00.000Z' })],
        invoice_totals: [factureTotaux()],
      },
    });

    await page.goto(`/factures/${FACTURE_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Émettre la facture' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Modifier/ })).toHaveCount(0);
  });

  test('un chef d’équipe consulte les factures sans pouvoir les émettre', async ({ page }) => {
    // `invoice.view` sans `invoice.manage` : la lecture est permise, l'action non.
    await installeSupabase(page, {
      role: 'team_leader',
      donnees: { invoices: [facture()], invoice_totals: [factureTotaux()] },
    });

    await page.goto(`/factures/${FACTURE_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Émettre la facture' })).toHaveCount(0);
  });
});
