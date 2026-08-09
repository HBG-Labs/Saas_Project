import { describe, expect, it } from 'vitest';

import {
  ACTIVE_STATUSES,
  countActiveFilters,
  EMPTY_MISSION_FILTERS,
  toMissionQuery,
  type MissionListFilters,
} from './mission-filters';

const withFilters = (patch: Partial<MissionListFilters>): MissionListFilters => ({
  ...EMPTY_MISSION_FILTERS,
  ...patch,
});

describe('traduction des critères de la liste des missions', () => {
  it('exclut les états terminaux par défaut', () => {
    const query = toMissionQuery(EMPTY_MISSION_FILTERS);

    expect(query.status).toEqual(ACTIVE_STATUSES);
    expect(query.status).not.toContain('closed');
    expect(query.status).not.toContain('cancelled');
  });

  it("n'envoie aucun critère facultatif quand rien n'est saisi", () => {
    const query = toMissionQuery(EMPTY_MISSION_FILTERS);

    // La distinction compte : `{ teamId: undefined }` et l'absence de clé se
    // sérialisent différemment dans la clé de cache de TanStack Query, et
    // produiraient deux entrées pour une même requête.
    expect(Object.keys(query)).toEqual(['status']);
  });

  it('ignore une recherche réduite à des espaces', () => {
    expect(toMissionQuery(withFilters({ search: '   ' }))).not.toHaveProperty('search');
    expect(toMissionQuery(withFilters({ search: '  fibre ' })).search).toBe('fibre');
  });

  it('restreint aux seuls états choisis', () => {
    expect(toMissionQuery(withFilters({ status: 'closed' })).status).toEqual(['closed']);
  });

  it('transmet les sélections de client, d’équipe et d’intervenant', () => {
    const query = toMissionQuery(
      withFilters({ customerId: 'c-1', teamId: 't-1', memberId: 'm-1' }),
    );

    expect(query.customerId).toBe('c-1');
    expect(query.teamId).toBe('t-1');
    expect(query.memberId).toBe('m-1');
  });

  it('borne la journée entière en heure locale', () => {
    /*
      Le point vérifié ici est qu'une date saisie couvre la journée COMPLÈTE de
      l'utilisateur. Concaténer « AAAA-MM-JJ » tel quel dans une comparaison sur
      `timestamptz` le ferait interpréter en UTC : un technicien parisien
      cherchant le 9 août manquerait la mission planifiée le 9 à 23 h 30.

      L'assertion est écrite sans figer le fuseau de la machine de test : on
      compare aux bornes locales recalculées, pas à une chaîne UTC en dur.
    */
    const query = toMissionQuery(withFilters({ from: '2026-08-09', to: '2026-08-09' }));

    expect(query.from).toBe(new Date('2026-08-09T00:00:00').toISOString());
    expect(query.to).toBe(new Date('2026-08-09T23:59:59.999').toISOString());
    expect(new Date(query.to ?? '').getTime()).toBeGreaterThan(
      new Date(query.from ?? '').getTime(),
    );
  });

  it('écarte une date invalide plutôt que d’envoyer « Invalid Date »', () => {
    const query = toMissionQuery(withFilters({ from: '2026-13-45' }));

    expect(query).not.toHaveProperty('from');
  });
});

describe('compte des critères actifs', () => {
  it('ne compte rien sur des critères vierges', () => {
    expect(countActiveFilters(EMPTY_MISSION_FILTERS)).toBe(0);
  });

  it('compte chaque critère posé', () => {
    expect(countActiveFilters(withFilters({ status: 'closed' }))).toBe(1);
    expect(countActiveFilters(withFilters({ search: 'fibre', teamId: 't-1' }))).toBe(2);
    expect(
      countActiveFilters(
        withFilters({
          search: 'fibre',
          status: 'closed',
          customerId: 'c-1',
          teamId: 't-1',
          memberId: 'm-1',
          from: '2026-08-01',
          to: '2026-08-31',
        }),
      ),
    ).toBe(7);
  });

  it('ne compte pas une recherche réduite à des espaces', () => {
    expect(countActiveFilters(withFilters({ search: '   ' }))).toBe(0);
  });
});
