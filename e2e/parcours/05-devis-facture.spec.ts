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
  });

  test('un devis encore en discussion ne propose pas de facturer', async ({ page }) => {
    await installeSupabase(page, {
      role: 'owner',
      donnees: { quotes: [devis({ status: 'sent', sent_at: '2026-09-16T10:00:00.000Z' })], quote_totals: [devisTotaux()] },
    });

    await page.goto(`/devis/${DEVIS_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByText('Facturer ce devis')).toHaveCount(0);
  });
});

test.describe('Factures', () => {
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

    await expect(page.getByText('FA-2026-0118').first()).toBeVisible();
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
