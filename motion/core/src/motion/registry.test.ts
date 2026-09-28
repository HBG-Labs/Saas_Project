import { describe, expect, it } from 'vitest';

import { BehaviorDefinitionSchema } from '../contracts/behavior.ts';
import { hashDocument } from '../integrity/canonical.ts';
import { BEHAVIORS, createBehaviorRegistry, latestVersion } from './registry.ts';

const reveal = () => structuredClone(BEHAVIORS.get('REVEAL_TEXT', '1.0.0')!);

describe('BehaviorDefinition', () => {
  it('chaque définition du registre respecte le contrat strict', () => {
    for (const def of BEHAVIORS.all()) expect(BehaviorDefinitionSchema.safeParse(def).success, def.id).toBe(true);
  });

  it('expose tous les champs exigés : intention, primitives, paramètres, ancres, budgets, coûts, mouvement réduit', () => {
    for (const def of BEHAVIORS.all()) {
      expect(def.intent.length).toBeGreaterThan(0);
      expect(Array.isArray(def.compatible_primitives)).toBe(true);
      expect(def.accepted_anchors.length).toBeGreaterThan(0);
      expect(def.duration_budget.max_ms).toBeGreaterThanOrEqual(def.duration_budget.min_ms);
      expect(def.attention_cost).toBeGreaterThanOrEqual(0);
      expect(['C0', 'C1', 'C2', 'C3']).toContain(def.render_cost);
      expect(['keep', 'drop_properties', 'instant']).toContain(def.reduced_motion_strategy.strategy);
    }
  });

  it('refuse toute fonction, expression ou clé inconnue', () => {
    expect(BehaviorDefinitionSchema.safeParse({ ...reveal(), expand: 'function () { return 1 }' }).success).toBe(false);
    const expression = reveal();
    (expression.variants['rise']!.tracks[0]!.keys[0]!.value as unknown) = { kind: 'expression', code: 'Math.sin(t)' };
    expect(BehaviorDefinitionSchema.safeParse(expression).success).toBe(false);
  });

  it('les définitions sont sérialisables telles quelles (données pures)', () => {
    for (const def of BEHAVIORS.all()) expect(JSON.parse(JSON.stringify(def))).toEqual(def);
  });
});

describe('registre fermé et versionné', () => {
  it('contient exactement les comportements de P1.3, en version 1.0.0', () => {
    expect(BEHAVIORS.ids().sort()).toEqual(['ACCENT_WORD', 'CUT', 'DRAW_PATH', 'EXIT_CLEAR', 'REVEAL_TEXT', 'SETTLE']);
    for (const id of BEHAVIORS.ids()) expect(BEHAVIORS.versions(id)).toEqual(['1.0.0']);
    expect(latestVersion(BEHAVIORS, 'SETTLE')).toBe('1.0.0');
  });

  it('ne connaît ni comportement inconnu ni version inexistante (aucun repli)', () => {
    expect(BEHAVIORS.get('CAMERA_PUSH', '1.0.0')).toBeUndefined();
    expect(BEHAVIORS.get('REVEAL_TEXT', '2.0.0')).toBeUndefined();
    expect(latestVersion(BEHAVIORS, 'MASK_WIPE')).toBeUndefined();
  });

  it('refuse un doublon, une propriété non déclarée, des clés mal ordonnées', () => {
    expect(() => createBehaviorRegistry([reveal(), reveal()], '0.0.1')).toThrowError(/deux fois/);
    const undeclared = reveal();
    undeclared.animatable_properties = ['opacity'];
    expect(() => createBehaviorRegistry([undeclared], '0.0.1')).toThrowError(/non déclarée animable/);
    const disordered = reveal();
    disordered.variants['rise']!.tracks[0]!.keys = [...disordered.variants['rise']!.tracks[0]!.keys].reverse();
    expect(() => createBehaviorRegistry([disordered], '0.0.1')).toThrowError(/mal ordonnées/);
  });

  it('son empreinte est stable et change dès qu’une définition change', () => {
    const again = createBehaviorRegistry(BEHAVIORS.all(), BEHAVIORS.version);
    expect(again.sha256).toBe(BEHAVIORS.sha256);
    const altered = BEHAVIORS.all().map((d) => (d.id === 'SETTLE' ? { ...d, attention_cost: 2 } : d));
    expect(createBehaviorRegistry(altered, BEHAVIORS.version).sha256).not.toBe(BEHAVIORS.sha256);
  });

  it('empreinte figée de la version publiée 1.0.0 : toute retouche impose une nouvelle version', () => {
    // Si ce test échoue, une définition publiée a changé : incrémenter sa version
    // (et celle du registre) au lieu de mettre à jour cette empreinte.
    expect(hashDocument({ version: BEHAVIORS.version, definitions: BEHAVIORS.all() })).toBe(BEHAVIORS.sha256);
    expect(BEHAVIORS.sha256).toMatchInlineSnapshot(`"a380aadd483e25c8b04a4fd3ec8d5eece16182a8b19d8a0cff5111ac2a335066"`);
  });
});
