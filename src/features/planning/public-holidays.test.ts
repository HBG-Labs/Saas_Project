import { describe, expect, it } from 'vitest';

import { getHolidaysForTerritory, getNationalHolidays, holidayDateSet } from './public-holidays';

/**
 * Le calcul remplace une liste écrite à la main pour 2026.
 *
 * Ces tests vérifient d'abord qu'il REPRODUIT cette liste — sans quoi le
 * remplacement introduirait une régression au lieu d'en supprimer une — puis
 * qu'il tient sur d'autres années, ce que la liste ne faisait pas.
 */
describe('jours fériés nationaux', () => {
  it('retrouve exactement les dates saisies à la main pour 2026', () => {
    const dates = getNationalHolidays(2026).map((entry) => entry.date);

    expect(dates).toEqual([
      '2026-01-01',
      '2026-04-06', // lundi de Pâques
      '2026-05-01',
      '2026-05-08',
      '2026-05-14', // Ascension
      '2026-05-25', // lundi de Pentecôte
      '2026-07-14',
      '2026-08-15',
      '2026-11-01',
      '2026-11-11',
      '2026-12-25',
    ]);
  });

  it('déplace les fêtes mobiles d’une année à l’autre', () => {
    // Le défaut que la liste figée ne pouvait pas éviter : en 2027, Pâques
    // tombe le 28 mars, et les trois fêtes qui en dérivent avec.
    const dates2027 = getNationalHolidays(2027).map((entry) => entry.date);

    expect(dates2027).toContain('2027-03-29'); // lundi de Pâques
    expect(dates2027).toContain('2027-05-06'); // Ascension
    expect(dates2027).toContain('2027-05-17'); // lundi de Pentecôte
  });

  it('en compte onze, quelle que soit l’année', () => {
    for (const year of [2024, 2025, 2026, 2027, 2030, 2038]) {
      expect(getNationalHolidays(year)).toHaveLength(11);
    }
  });

  it('produit des dates valides et bien formées', () => {
    for (const entry of getNationalHolidays(2029)) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.date))).toBe(false);
    }
  });
});

describe('fériés par territoire', () => {
  it('ajoute au socle national sans le remplacer', () => {
    const metropole = getHolidaysForTerritory('metropole', 2026);
    const martinique = getHolidaysForTerritory('martinique', 2026);

    expect(metropole).toHaveLength(11);
    expect(martinique).toHaveLength(14);
    expect(martinique.map((entry) => entry.date)).toContain('2026-05-22');
  });

  it('ne confond pas les dates d’abolition, qui diffèrent d’un territoire à l’autre', () => {
    // Elles commémorent la promulgation LOCALE du décret de 1848. Les aligner
    // serait une erreur historique autant qu'une erreur de paie.
    const abolition = (territory: 'martinique' | 'guadeloupe' | 'guyane' | 'mayotte' | 'reunion') =>
      getHolidaysForTerritory(territory, 2026)
        .filter((entry) => entry.name.startsWith('Abolition'))
        .map((entry) => entry.date);

    expect(abolition('martinique')).toEqual(['2026-05-22']);
    expect(abolition('guadeloupe')).toEqual(['2026-05-27']);
    expect(abolition('guyane')).toEqual(['2026-06-10']);
    expect(abolition('mayotte')).toEqual(['2026-04-27']);
    expect(abolition('reunion')).toEqual(['2026-12-20']);
  });

  it('donne le Vendredi Saint à l’Alsace-Moselle, pas à la métropole', () => {
    const alsace = holidayDateSet('alsace_moselle', 2026);
    const metropole = holidayDateSet('metropole', 2026);

    expect(alsace.has('2026-04-03')).toBe(true);
    expect(metropole.has('2026-04-03')).toBe(false);
    expect(alsace.has('2026-12-26')).toBe(true);
  });

  it('rend les fériés triés par date', () => {
    const dates = getHolidaysForTerritory('guadeloupe', 2028).map((entry) => entry.date);
    expect([...dates].sort((a, b) => a.localeCompare(b))).toEqual(dates);
  });
});
