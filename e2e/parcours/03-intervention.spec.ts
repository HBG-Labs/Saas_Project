import { expect, test } from '@playwright/test';

import { donneesPour, INTERVENTION_ID, MEMBRE_ID, ORGANISATION_ID } from '../fixtures/donnees';
import { installeSupabase } from '../fixtures/supabase';

/**
 * Parcours critique 3 — le chronomètre d'intervention.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CELUI-CI EST CRITIQUE
 *
 * `end_time` se pose UNE FOIS POUR TOUTES : une clôture déclenchée par erreur
 * ne se reprend pas. C'est aussi l'écran le plus utilisé sur le terrain, donc
 * celui que la refonte mobile touche le plus. Les commandes sont vérifiées
 * pour ce qu'elles font, et pour qui a le droit de les voir.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SEGMENT_OUVERT = {
  id: '99999999-9999-4999-8999-999999999999',
  intervention_id: INTERVENTION_ID,
  organization_id: ORGANISATION_ID,
  kind: 'work',
  started_at: '2026-09-19T09:48:00.000Z',
  ended_at: null,
  reason: null,
  created_at: '2026-09-19T09:48:00.000Z',
  technician_id: MEMBRE_ID,
  technician_user_id: null,
};

test.describe('Intervention', () => {
  test('sans segment ouvert, l’intervenant peut démarrer', async ({ page }) => {
    await installeSupabase(page, { role: 'technician' });

    await page.goto(`/interventions/${INTERVENTION_ID}`);

    await expect(page.getByRole('button', { name: 'Démarrer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mettre en pause' })).toHaveCount(0);
  });

  test('pendant un segment de travail, la pause remplace le démarrage', async ({ page }) => {
    await installeSupabase(page, {
      role: 'technician',
      donnees: { intervention_time_entries: [SEGMENT_OUVERT] },
      rpc: { intervention_worked_seconds: 6120 },
    });

    await page.goto(`/interventions/${INTERVENTION_ID}`);

    await expect(page.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Démarrer' })).toHaveCount(0);
  });

  test('en pause, la commande propose de reprendre', async ({ page }) => {
    await installeSupabase(page, {
      role: 'technician',
      donnees: {
        intervention_time_entries: [{ ...SEGMENT_OUVERT, kind: 'pause', reason: 'Déjeuner' }],
      },
      rpc: { intervention_worked_seconds: 6120 },
    });

    await page.goto(`/interventions/${INTERVENTION_ID}`);

    await expect(page.getByRole('button', { name: 'Reprendre' })).toBeVisible();
    await expect(page.getByText('En pause').first()).toBeVisible();
  });

  /*
    LE TEST QUI COMPTE.

    Clôturer est irréversible. La confirmation n'est donc pas un ornement : le
    bouton « Terminer l'intervention » ouvre une modale, et rien n'est envoyé
    tant qu'elle n'est pas validée.
  */
  test('terminer passe par une confirmation explicite', async ({ page }) => {
    const { appels } = await installeSupabase(page, {
      role: 'technician',
      donnees: { intervention_time_entries: [SEGMENT_OUVERT] },
      rpc: { intervention_worked_seconds: 6120 },
    });

    await page.goto(`/interventions/${INTERVENTION_ID}`);
    await page.getByRole('button', { name: 'Terminer l’intervention' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    expect(appels.some((appel) => appel.startsWith('PATCH'))).toBe(false);
  });

  test('un collaborateur qui n’est pas l’intervenant ne voit aucune commande', async ({ page }) => {
    const base = donneesPour('owner');
    await installeSupabase(page, {
      role: 'owner',
      donnees: {
        // L'intervention reste confiée au technicien : le propriétaire la
        // consulte, il ne la chronomètre pas.
        interventions: base.interventions.map((intervention) => ({
          ...intervention,
          technician_id: 'un-autre-membre',
        })),
      },
    });

    await page.goto(`/interventions/${INTERVENTION_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Démarrer' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Terminer l’intervention' })).toHaveCount(0);
  });
});
