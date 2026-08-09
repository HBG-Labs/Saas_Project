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

  // La 12ᵉ et dernière couleur de la palette France Télécom / Orange est Rose.
  // « Olive » n'appartient à aucune des trois palettes du module : l'attente
  // précédente ne pouvait donc être satisfaite par aucune norme.
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

  it('gère les câbles ultra haute capacité 3456 FO (Fibre 1000)', () => {
    const res = computeFiberMapping({ fiberNumber: 1000, standard: 'orange_ft', capacity: 3456 });

    expect(res.tubeNumber).toBe(84);
    expect(res.fiberIndexInTube).toBe(4);
    expect(res.fiberColor.name).toBe('Jaune');
  });

  it('effectue une recherche inverse exacte', () => {
    const fiberNum = computeFiberNumberFromTube(13, 1, 12);
    expect(fiberNum).toBe(145);
  });
});
