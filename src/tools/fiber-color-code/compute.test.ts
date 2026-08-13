import { describe, expect, it } from 'vitest';
import { computeFiberMapping, computeFiberNumberFromTube } from './compute';

describe('computeFiberMapping (Norme France Telecom / Orange)', () => {
  it('identifie la fibre N°1 (Tube 1 Rouge, Fibre 1 Rouge)', () => {
    const res = computeFiberMapping({ fiberNumber: 1, standard: 'orange_ft', capacity: 144 });

    expect(res.tubeNumber).toBe(1);
    expect(res.tubeColor.name).toBe('Rouge');
    expect(res.fiberIndexInTube).toBe(1);
    expect(res.fiberColor.name).toBe('Rouge');
    expect(res.ringAnnotation).toBeNull();
  });

  it('identifie la fibre N°13 (Tube 2 Bleu, Fibre 1 Rouge)', () => {
    const res = computeFiberMapping({ fiberNumber: 13, standard: 'orange_ft', capacity: 144 });

    expect(res.tubeNumber).toBe(2);
    expect(res.tubeColor.name).toBe('Bleu');
    expect(res.fiberIndexInTube).toBe(1);
    expect(res.fiberColor.name).toBe('Rouge');
  });

  it('identifie la fibre N°144 (Tube 12 Rose, Fibre 12 Rose)', () => {
    const res = computeFiberMapping({ fiberNumber: 144, standard: 'orange_ft', capacity: 144 });

    expect(res.tubeNumber).toBe(12);
    expect(res.tubeColor.name).toBe('Rose');
    expect(res.fiberIndexInTube).toBe(12);
    expect(res.fiberColor.name).toBe('Rose');
  });

  it('gère les câbles haute capacité 288 FO avec bague marquage (Fibre 145 = Tube 13 Rouge + bague)', () => {
    const res = computeFiberMapping({ fiberNumber: 145, standard: 'orange_ft', capacity: 288 });

    expect(res.tubeNumber).toBe(13);
    expect(res.tubeColor.name).toBe('Rouge');
    expect(res.ringAnnotation).toContain('bague');
    expect(res.fiberIndexInTube).toBe(1);
    expect(res.fiberColor.name).toBe('Rouge');
  });

  it('effectue une recherche inverse exacte', () => {
    const fiberNum = computeFiberNumberFromTube(13, 1, 12);
    expect(fiberNum).toBe(145);
  });
});

describe('computeFiberMapping (Norme FOTAG IEEE 802.8)', () => {
  it('identifie la fibre N°1 (Bleu) et N°2 (Orange) selon FOTAG', () => {
    const resFibre1 = computeFiberMapping({ fiberNumber: 1, standard: 'fotag', capacity: 144 });
    expect(resFibre1.fiberColor.name).toBe('Bleu');

    const resFibre2 = computeFiberMapping({ fiberNumber: 2, standard: 'fotag', capacity: 144 });
    expect(resFibre2.fiberColor.name).toBe('Orange');

    const resFibre12 = computeFiberMapping({ fiberNumber: 12, standard: 'fotag', capacity: 144 });
    expect(resFibre12.fiberColor.name).toBe('Turquoise');
  });
});
