import { expect, test } from '@playwright/test';

import { CLIENT_ID, DEVIS_ID, ORGANISATION_ID } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours critique 7 — le portail client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA SEULE SURFACE VUE PAR LES CLIENTS DE TES CLIENTS
 *
 * Une régression ici ne gêne pas un collaborateur : elle se voit de
 * l'extérieur. Le portail est entièrement servi par des fonctions serveur
 * (`portal_*`), et `portal_my_context()` décide seul de ce qui est visible —
 * la garde côté écran ne sécurise rien.
 *
 * On vérifie donc les trois états qui comptent : pas de session, session sans
 * espace actif, et espace ouvert.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CONTEXTE_PORTAIL = {
  organization_id: ORGANISATION_ID,
  organization_name: 'HBG Labs',
  contact_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  contact_first_name: 'Marie',
  contact_last_name: 'Alizé',
  contact_email: 'marie@alizes.test',
  customer_id: CLIENT_ID,
  customer_name: 'SCI Les Alizés',
  allow_client_initiated: true,
  features: { missions: true, interventions: true, quotes: true, invoicing: true, documents: true },
};

const FACTURE_PORTAIL = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  organization_id: ORGANISATION_ID,
  reference: 'FA-2026-0118',
  document_type: 'invoice',
  title: 'Raccordement bâtiment C',
  status: 'issued',
  issued_at: '2026-09-18T12:00:00.000Z',
  due_date: '2026-10-18',
  subtotal_cents: 398156,
  vat_cents: 33844,
  total_cents: 432000,
  pdf_path: null,
};

const DEVIS_PORTAIL = {
  id: DEVIS_ID,
  organization_id: ORGANISATION_ID,
  reference: 'DV-2026-0087',
  title: 'Raccordement bâtiment C',
  status: 'sent',
  notes: null,
  valid_until: '2026-10-19',
  vat_rate: 8.5,
  created_at: '2026-09-16T09:00:00.000Z',
  client_responded_at: null,
  site_name: null,
  subtotal_cents: 398156,
  vat_cents: 33844,
  total_cents: 432000,
  pdf_path: null,
  items: [],
};

test.describe('Portail client', () => {
  test('sans session, l’espace client renvoie à sa page de connexion', async ({ page }) => {
    await page.goto('/portail');

    await expect(page).toHaveURL(/\/portail\/connexion/);
  });

  /*
    LE TEST QUI COMPTE.

    Un accès révoqué, un portail désactivé, une formule qui ne l'inclut plus :
    `portal_my_context()` ne renvoie rien. L'écran doit le dire clairement —
    sans exposer LAQUELLE de ces raisons s'applique, qui regarde l'entreprise
    et non le visiteur.
  */
  test('une session sans espace actif reçoit une explication, pas une erreur', async ({ page }) => {
    await installeSupabase(page, { rpc: { portal_my_context: [] } });

    await page.goto('/portail');

    await expect(page.getByText('Aucun espace client pour ce compte')).toBeVisible();
  });

  test('un client voit ses factures avec leur montant', async ({ page }) => {
    await installeSupabase(page, {
      rpc: {
        portal_my_context: [CONTEXTE_PORTAIL],
        portal_list_invoices: [FACTURE_PORTAIL],
        portal_touch_last_seen: null,
      },
    });

    await page.goto('/portail/factures');

    await expect(page.getByText('FA-2026-0118').first()).toBeVisible();
    await expect(page.getByText('4 320,00 €').first()).toBeVisible();
  });

  test('un devis envoyé attend la réponse du client, et la propose', async ({ page }) => {
    await installeSupabase(page, {
      rpc: {
        portal_my_context: [CONTEXTE_PORTAIL],
        portal_quote_detail: DEVIS_PORTAIL,
        portal_touch_last_seen: null,
      },
    });

    await page.goto(`/portail/devis/${DEVIS_ID}`);

    await expect(page.getByRole('button', { name: 'Accepter le devis' })).toBeVisible();
    // `exact` : sans lui, « Tout refuser » de la bannière cookies correspond
    // aussi — la correspondance par nom accessible est une sous-chaîne.
    await expect(page.getByRole('button', { name: 'Refuser', exact: true })).toBeVisible();
  });

  test('un devis déjà accepté ne se répond plus', async ({ page }) => {
    await installeSupabase(page, {
      rpc: {
        portal_my_context: [CONTEXTE_PORTAIL],
        portal_quote_detail: {
          ...DEVIS_PORTAIL,
          status: 'accepted',
          client_responded_at: '2026-09-17T10:00:00.000Z',
        },
        portal_touch_last_seen: null,
      },
    });

    await page.goto(`/portail/devis/${DEVIS_ID}`);

    await expect(page.getByRole('button', { name: 'Accepter le devis' })).toHaveCount(0);
  });
});
