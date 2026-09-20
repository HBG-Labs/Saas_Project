import { expect, test } from '@playwright/test';

import {
  donneesPour,
  INTERVENTION_ID,
  MEMBRE_ID,
  ORGANISATION_ID,
} from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours critique 4 — le compte rendu.
 *
 * L'écran le plus riche du produit, et celui qui porte le plus de règles
 * serveur : paternité, immuabilité après validation, et surtout l'interdiction
 * de soumettre depuis une mission qui n'est pas terminée — le trigger
 * `sync_mission_from_report` la refuserait.
 *
 * Ces tests vérifient que l'interface ne propose pas ce que la base refusera,
 * et qu'elle EXPLIQUE le blocage au lieu de se contenter d'un bouton gris.
 */

/** Colonnes relevées sur `public.intervention_reports`. */
function compteRendu(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    intervention_id: INTERVENTION_ID,
    organization_id: ORGANISATION_ID,
    technician_id: MEMBRE_ID,
    work_description: 'Tirage réalisé du répartiteur au bâtiment C.',
    observations: null,
    materials_used: null,
    tools_used: null,
    customer_signature_path: null,
    customer_signature_name: null,
    technician_signature_path: null,
    status: 'draft',
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    created_at: '2026-09-19T10:00:00.000Z',
    updated_at: '2026-09-19T10:00:00.000Z',
    ...surcharge,
  };
}

/** Une intervention terminée, portant son compte rendu — l'état de départ réel. */
function avecCompteRendu(role: 'technician' | 'owner', rapport = compteRendu()) {
  const base = donneesPour(role);
  return {
    interventions: base.interventions.map((intervention) => ({
      ...intervention,
      status: 'completed',
      end_time: '2026-09-19T12:00:00.000Z',
      report: rapport,
    })),
    intervention_reports: [rapport],
  };
}

test.describe('Compte rendu', () => {
  /*
    LE TEST QUI COMPTE.

    Une mission encore en cours ne peut pas recevoir un compte rendu : le
    trigger la refuse. L'interface doit donc désactiver la soumission — et
    surtout dire POURQUOI, sinon l'utilisateur ne peut que constater un bouton
    inerte.
  */
  test('mission en cours : la soumission est bloquée, et expliquée', async ({ page }) => {
    await installeSupabase(page, {
      role: 'technician',
      donnees: avecCompteRendu('technician'),
    });

    await page.goto(`/interventions/${INTERVENTION_ID}/rapport`);

    const soumettre = page.getByRole('button', { name: 'Soumettre au contrôle' });
    await expect(soumettre).toBeVisible();
    await expect(soumettre).toBeDisabled();
    // Un contrôle désactivé sans explication est un défaut (§23.4 du produit) :
    // l'écran nomme le blocage, et propose le geste qui le lève.
    await expect(page.getByText('La mission est encore ouverte.')).toBeVisible();
  });

  test('mission terminée : la soumission devient possible', async ({ page }) => {
    const base = donneesPour('technician');
    await installeSupabase(page, {
      role: 'technician',
      donnees: {
        ...avecCompteRendu('technician'),
        missions: base.missions.map((mission) => ({ ...mission, status: 'completed' })),
      },
    });

    await page.goto(`/interventions/${INTERVENTION_ID}/rapport`);

    await expect(page.getByRole('button', { name: 'Soumettre au contrôle' })).toBeEnabled();
  });

  test('sans description des travaux, la soumission reste refusée', async ({ page }) => {
    const base = donneesPour('technician');
    await installeSupabase(page, {
      role: 'technician',
      donnees: {
        ...avecCompteRendu('technician', compteRendu({ work_description: '' })),
        missions: base.missions.map((mission) => ({ ...mission, status: 'completed' })),
      },
    });

    await page.goto(`/interventions/${INTERVENTION_ID}/rapport`);

    await expect(page.getByRole('button', { name: 'Soumettre au contrôle' })).toBeDisabled();
  });

  /*
    Un compte rendu validé est définitif POUR TOUT LE MONDE, son auteur compris.
    C'est le trigger de paternité ; l'écran doit refléter la même chose.
  */
  test('un compte rendu validé n’est plus modifiable par son auteur', async ({ page }) => {
    await installeSupabase(page, {
      role: 'technician',
      donnees: avecCompteRendu(
        'technician',
        compteRendu({
          status: 'approved',
          submitted_at: '2026-09-19T12:10:00.000Z',
          reviewed_at: '2026-09-19T12:30:00.000Z',
        }),
      ),
    });

    await page.goto(`/interventions/${INTERVENTION_ID}/rapport`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Soumettre au contrôle' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Signer$/ })).toHaveCount(0);
  });
});
