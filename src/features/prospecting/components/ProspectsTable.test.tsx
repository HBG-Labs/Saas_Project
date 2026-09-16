import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import type { ProspectListRow } from '@/types/domain';

import { ProspectsTable } from './ProspectsTable';

/*
  Même patron que `ConsumablesTable.test.tsx` : les deux balisages (cartes
  mobile, table desktop) sont rendus simultanément en jsdom — seule la classe
  CSS `md:hidden`/`md:table` les distingue, ce test ne vérifie donc pas la
  bascule visuelle (aucun outil de ce projet ne le fait, voir l'audit Phase 6),
  seulement que le contenu attendu est bien présent dans les deux.
*/

function prospect(overrides: Partial<ProspectListRow> = {}): ProspectListRow {
  return {
    siren: '123456789',
    raison_sociale: 'PLOMBERIE ANTILLES',
    nom_commercial: null,
    forme_juridique: null,
    ape_code: '43.22A',
    sector_id: null,
    created_on: '2026-08-01',
    statut_administratif: 'actif',
    tranche_effectif: null,
    commune: 'Fort-de-France',
    code_postal: '97200',
    departement: '972',
    region: null,
    zone_id: null,
    source: 'recherche_entreprises',
    first_detected_at: '2026-09-16T00:00:00Z',
    last_checked_at: '2026-09-16T00:00:00Z',
    opportunity_score: 80,
    score_reasons: [],
    priority: 'normale',
    status: 'nouveau',
    assigned_to: null,
    next_followup_at: null,
    created_at: '2026-09-16T00:00:00Z',
    updated_at: '2026-09-16T00:00:00Z',
    sector: { label: 'Plomberie' },
    zone: { label: 'Martinique' },
    ...overrides,
  };
}

describe('ProspectsTable', () => {
  it('affiche un état vide explicite en l’absence de résultats', () => {
    render(<ProspectsTable rows={[]} />);

    expect(screen.getByText('Aucun prospect trouvé')).toBeInTheDocument();
  });

  it('affiche chaque prospect, avec son secteur, son score et son statut', () => {
    renderWithProviders(<ProspectsTable rows={[prospect()]} />);

    // Le nom apparaît deux fois (carte mobile + ligne desktop) : jsdom rend
    // les deux balisages, seule la CSS les distingue en conditions réelles.
    expect(screen.getAllByText('PLOMBERIE ANTILLES').length).toBeGreaterThan(0);
    expect(screen.getAllByText('80').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nouveau').length).toBeGreaterThan(0);
  });

  it('bascule sur la raison sociale quand aucun nom commercial n’est connu', () => {
    renderWithProviders(<ProspectsTable rows={[prospect({ nom_commercial: 'Clim’Antilles' })]} />);

    expect(screen.getAllByText('Clim’Antilles').length).toBeGreaterThan(0);
  });
});
