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
  it('registre 1.1.0 : les comportements de P1.3 en 1.0.0, plus EXIT_CLEAR 1.1.0 (images et masques)', () => {
    expect(BEHAVIORS.version).toBe('1.1.0');
    expect(BEHAVIORS.ids().sort()).toEqual(['ACCENT_WORD', 'CUT', 'DRAW_PATH', 'EXIT_CLEAR', 'REVEAL_TEXT', 'SETTLE']);
    for (const id of BEHAVIORS.ids()) expect(BEHAVIORS.versions(id)).toEqual(id === 'EXIT_CLEAR' ? ['1.0.0', '1.1.0'] : ['1.0.0']);
    expect(latestVersion(BEHAVIORS, 'SETTLE')).toBe('1.0.0');
    expect(latestVersion(BEHAVIORS, 'EXIT_CLEAR')).toBe('1.1.0');
  });

  it('EXIT_CLEAR 1.1.0 n’élargit que la compatibilité : 1.0.0 reste identique', () => {
    const v10 = BEHAVIORS.get('EXIT_CLEAR', '1.0.0')!;
    const v11 = BEHAVIORS.get('EXIT_CLEAR', '1.1.0')!;
    expect(v10.compatible_primitives).toEqual(['text', 'shape', 'path', 'group']);
    expect(v11.compatible_primitives).toEqual(['text', 'shape', 'path', 'group', 'image', 'mask']);
    const { version: _a, compatible_primitives: _b, ...rest10 } = v10;
    const { version: _c, compatible_primitives: _d, ...rest11 } = v11;
    expect(rest11).toEqual(rest10);
    // Empreinte figée de la définition publiée en P1.3.
    expect(hashDocument(v10)).toMatchInlineSnapshot(`"ed324742864de1447ab0401df617944d646144a365aa6684501bf9bc5de9e572"`);
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

  it('empreinte figée du registre publié 1.1.0 : toute retouche impose une nouvelle version', () => {
    // Si ce test échoue, une définition publiée a changé : incrémenter sa version
    // (et celle du registre) au lieu de mettre à jour cette empreinte.
    // Registre 1.0.0 (P1.3) : a380aadd483e25c8b04a4fd3ec8d5eece16182a8b19d8a0cff5111ac2a335066.
    expect(hashDocument({ version: BEHAVIORS.version, definitions: BEHAVIORS.all() })).toBe(BEHAVIORS.sha256);
    expect(BEHAVIORS.sha256).toMatchInlineSnapshot(`"0c7669f1cd7d293915590f114d8291a0035ddb10076ba89dc00821c25248b7f2"`);
  });

  it('les définitions 1.0.0 publiées en P1.3 sont inchangées (registre 1.0.0 reconstruit à l’identique)', () => {
    const v10 = BEHAVIORS.all().filter((d) => d.version === '1.0.0');
    expect(createBehaviorRegistry(v10, '1.0.0').sha256).toBe('a380aadd483e25c8b04a4fd3ec8d5eece16182a8b19d8a0cff5111ac2a335066');
  });
});
