import { describe, expect, it } from 'vitest';

import {
  delaiAvantNouvelleTentative,
  prochaineTentative,
  TENTATIVES_MAXIMUM,
} from './retry-policy';

const MINUTE = 60_000;

describe('delaiAvantNouvelleTentative', () => {
  it('reporte de plus en plus loin à chaque échec', () => {
    expect(delaiAvantNouvelleTentative(1)).toBe(5 * MINUTE);
    expect(delaiAvantNouvelleTentative(2)).toBe(15 * MINUTE);
    expect(delaiAvantNouvelleTentative(3)).toBe(60 * MINUTE);
    expect(delaiAvantNouvelleTentative(4)).toBe(360 * MINUTE);
  });

  it('croît strictement : aucun palier ne doit rejouer plus tôt que le précédent', () => {
    const delais = [1, 2, 3, 4].map((n) => delaiAvantNouvelleTentative(n)!);
    for (let i = 1; i < delais.length; i += 1) expect(delais[i]!).toBeGreaterThan(delais[i - 1]!);
  });

  it('abandonne au plafond plutôt que de rejouer indéfiniment', () => {
    expect(delaiAvantNouvelleTentative(TENTATIVES_MAXIMUM)).toBeNull();
    expect(delaiAvantNouvelleTentative(TENTATIVES_MAXIMUM + 3)).toBeNull();
  });

  /*
    Le compteur vient de la base, où un trigger interdit qu'il décroisse. Une
    valeur absurde ne doit pourtant pas produire une échéance : mieux vaut ne
    plus retenter que retenter à une date fantaisiste.
  */
  it('refuse un compteur invalide', () => {
    expect(delaiAvantNouvelleTentative(0)).toBeNull();
    expect(delaiAvantNouvelleTentative(-2)).toBeNull();
    expect(delaiAvantNouvelleTentative(1.5)).toBeNull();
    expect(delaiAvantNouvelleTentative(Number.NaN)).toBeNull();
  });
});

describe('prochaineTentative', () => {
  it('date l’échéance à partir de l’instant fourni, en UTC', () => {
    const maintenant = new Date('2026-09-06T10:00:00.000Z');
    expect(prochaineTentative(1, maintenant)).toBe('2026-09-06T10:05:00.000Z');
    expect(prochaineTentative(4, maintenant)).toBe('2026-09-06T16:00:00.000Z');
  });

  it('ne pose aucune échéance quand la reprise est abandonnée', () => {
    expect(prochaineTentative(TENTATIVES_MAXIMUM, new Date())).toBeNull();
  });

  it('reste juste au passage de minuit', () => {
    expect(prochaineTentative(3, new Date('2026-09-06T23:30:00.000Z'))).toBe(
      '2026-09-07T00:30:00.000Z',
    );
  });
});
