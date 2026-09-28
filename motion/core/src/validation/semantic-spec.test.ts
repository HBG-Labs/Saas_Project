import { describe, expect, it } from 'vitest';

import { clone, codes, readFixture, resolvedInk, resolvedSignal } from '../test-support.ts';
import type { Json } from '../test-support.ts';
import { BEHAVIORS } from '../motion/registry.ts';
import { validateSpec } from './validate.ts';

const ink = resolvedInk();
const signal = resolvedSignal();
const base = (): Json => clone(readFixture('moon.spec.json'));

describe('validation sémantique de la spec', () => {
  it('est valide pour le style auquel elle est liée', () => {
    const result = validateSpec(base(), ink);
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it('la MÊME spec est valide avec l’autre style de contrôle, par substitution explicite', () => {
    const result = validateSpec(base(), signal, { allowStyleSubstitution: true });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.ok && result.warnings.map((w) => w.code)).toEqual(['style.substituted']);
  });

  it('refuse une substitution de style non déclarée', () => {
    expect(codes(validateSpec(base(), signal))).toEqual(['style.binding_mismatch']);
  });

  it('refuse les identifiants en double, même entre objets de nature différente', () => {
    const doc = base();
    doc.scenes[0].events[0].id = 'bh_accent';
    expect(codes(validateSpec(doc, ink))).toContain('id.duplicate');
  });

  it('refuse un rôle absent du style', () => {
    const doc = base();
    doc.scenes[0].layers[0].style.accent_color = 'color.highlight';
    expect(codes(validateSpec(doc, ink))).toContain('token.unknown');
  });

  it('accepte des calques supplémentaires qui n’utilisent que des rôles du contrat', () => {
    const doc = base();
    doc.scenes[0].layers.push({
      id: 'tx_logo',
      primitive: 'text',
      content: { runs: [{ id: 'r_logo', text: 'X' }], break_policy: 'explicit' },
      style: { type: 'type.body', color: 'color.text.primary' },
      behaviors: [],
    });
    expect(validateSpec(doc, ink).ok).toBe(true);
    const shape = base();
    shape.scenes[0].layers.push({ id: 'sh_bg', primitive: 'shape', shape: 'rect', fill: 'color.surface.inverse', behaviors: [] });
    expect(validateSpec(shape, ink).ok).toBe(true);
  });

  it('refuse une ancre sur un mot absent de la voix', () => {
    const doc = base();
    doc.scenes[0].layers[0].behaviors[1].at.voice_word.match = 'soleil';
    expect(codes(validateSpec(doc, ink))).toContain('anchor.word_missing');
  });

  it('retrouve un mot élidé, en capitales ou sans accent', () => {
    const doc = base();
    doc.voice.segments[0].text = 'Et si la Lune DISPARAISSAIT ?';
    expect(validateSpec(doc, ink).ok).toBe(true);
    const elided = base();
    elided.voice.segments[0].text = 'Et si l’astre disparaissait ?';
    elided.scenes[0].layers[0].behaviors[1].at.voice_word.match = 'astre';
    expect(validateSpec(elided, ink).ok).toBe(true);
  });

  it('refuse une ancre vers un segment d’une autre scène', () => {
    const doc = base();
    doc.voice.segments.push({ id: 'vo_other', text: 'Autre phrase.', gap_after: null, emphasis: [] });
    doc.scenes[0].layers[0].behaviors[1].at = { voice_segment: { segment: 'vo_other', edge: 'start' } };
    expect(codes(validateSpec(doc, ink))).toContain('anchor.foreign_segment');
  });

  it('refuse une ancre vers un comportement inexistant et détecte les cycles', () => {
    const unknown = base();
    unknown.scenes[0].layers[1].behaviors[0].at = { after: 'bh_nowhere' };
    expect(codes(validateSpec(unknown, ink))).toContain('anchor.unknown_target');
    const cycle = base();
    cycle.scenes[0].layers[0].behaviors[1].at = { after: 'bh_rule_draw' };
    expect(codes(validateSpec(cycle, ink))).toContain('anchor.cycle');
  });

  it('exige que les sections de rythme couvrent chaque scène une fois, dans l’ordre', () => {
    const doc = base();
    doc.rhythm.sections[0].scenes = ['sc_question', 'sc_question'];
    expect(codes(validateSpec(doc, ink))).toContain('rhythm.coverage');
  });

  it('applique les interdits, les variantes et les bornes du style résolu', () => {
    const forbidden = base();
    forbidden.scenes[0].layers[0].behaviors[0].behavior = 'GLITCH';
    expect(codes(validateSpec(forbidden, ink))).toContain('behavior.forbidden');

    const variant = base();
    variant.scenes[0].layers[0].behaviors[0].variant = 'fade';
    expect(validateSpec(variant, ink).ok).toBe(true);
    expect(codes(validateSpec(variant, signal, { allowStyleSubstitution: true }))).toContain('behavior.variant');

    const push = base();
    push.scenes[0].layers[1].behaviors[0] = { id: 'bh_push', behavior: 'CAMERA_PUSH', version: '1.0.0', params: { scale: 1.2 }, at: { event: 'scene.start' } };
    expect(codes(validateSpec(push, ink))).toContain('behavior.param_bounds');
    expect(codes(validateSpec(push, signal, { allowStyleSubstitution: true }))).toContain('behavior.forbidden');
  });

  it('cible un run existant d’un calque texte', () => {
    const doc = base();
    doc.scenes[0].layers[0].behaviors[1].target.run = 'r_ghost';
    expect(codes(validateSpec(doc, ink))).toContain('behavior.target');
  });

  it('refuse un asset inconnu, accepte un asset fourni par l’appelant', () => {
    const doc = base();
    doc.scenes[0].layers.push({ id: 'img_sky', primitive: 'image', asset: 'night_sky', fit: 'cover', behaviors: [] });
    expect(codes(validateSpec(doc, ink))).toContain('asset.unknown');
    expect(validateSpec(doc, ink, { assetRefs: new Set(['night_sky']) }).ok).toBe(true);
  });

  it('vérifie la continuité MATCH_LINE vers la scène suivante', () => {
    const doc = base();
    const next = clone(doc.scenes[0]);
    next.id = 'sc_answer';
    next.purpose = 'reveal';
    next.timing = { anchor: { duration: { beats: 2 } } };
    next.layers = [
      { id: 'ln_rule_next', primitive: 'path', geometry: { motif: 'motif.rule' }, style: { stroke: 'color.accent', weight: 'stroke.emphasis' }, behaviors: [] },
    ];
    next.events = [];
    next.locks = [];
    doc.scenes.push(next);
    doc.rhythm.sections.push({ id: 'sec_answer', phase: 'REVEAL', scenes: ['sc_answer'] });
    doc.scenes[0].layers[1].behaviors.push({
      id: 'bh_rule_carry',
      behavior: 'MATCH_LINE',
      version: '1.0.0',
      at: { after: 'bh_rule_draw' },
      continues_in: { scene: 'sc_answer', layer: 'ln_rule_next' },
    });
    doc.scenes[0].transition_out = { behavior: 'MATCH_LINE', version: '1.0.0', to: 'sc_answer' };
    const result = validateSpec(doc, ink);
    expect(result.ok, JSON.stringify(result)).toBe(true);

    doc.scenes[0].layers[1].behaviors.find((b: any) => b.id === 'bh_rule_carry').continues_in.layer = 'ln_missing';
    expect(codes(validateSpec(doc, ink))).toContain('behavior.continues_in');
  });

  it('refuse un verrou sur un calque inexistant', () => {
    const doc = base();
    doc.scenes[0].locks = ['layers.ln_ghost'];
    expect(codes(validateSpec(doc, ink))).toContain('lock.unknown_target');
  });

  it('la spec neutre est valide face au registre fermé du moteur', () => {
    const result = validateSpec(base(), ink, { registry: BEHAVIORS });
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it('refuse un comportement inconnu du registre, ou à une version inexistante', () => {
    const unknown = base();
    unknown.scenes[0].layers[0].behaviors[0].behavior = 'SPIN';
    expect(codes(validateSpec(unknown, ink, { registry: BEHAVIORS }))).toContain('behavior.unknown');
    const version = base();
    version.scenes[0].layers[0].behaviors[0].version = '2.0.0';
    expect(codes(validateSpec(version, ink, { registry: BEHAVIORS }))).toEqual(['behavior.unknown_version']);
  });

  it('vérifie la compatibilité comportement × primitive', () => {
    const doc = base();
    doc.scenes[0].layers[1].behaviors[0] = { id: 'bh_rule_draw', behavior: 'REVEAL_TEXT', version: '1.0.0', at: { after: 'bh_accent' } };
    expect(codes(validateSpec(doc, ink, { registry: BEHAVIORS }))).toContain('behavior.primitive');
    doc.scenes[0].layers.push({ id: 'sh_box', primitive: 'shape', shape: 'rect', fill: 'color.accent', behaviors: [{ id: 'bh_box', behavior: 'ACCENT_WORD', version: '1.0.0', target: { run: 'r_turn' }, at: { event: 'scene.start' } }] });
    expect(codes(validateSpec(doc, ink, { registry: BEHAVIORS }))).toContain('behavior.primitive');
  });

  it('applique les contraintes du registre : ancre acceptée, cible exigée, paramètres typés', () => {
    const anchor = base();
    anchor.scenes[0].layers[0].behaviors[3].at = { voice_word: { segment: 'vo_question', match: 'Lune' } };
    expect(codes(validateSpec(anchor, ink, { registry: BEHAVIORS }))).toContain('behavior.anchor_not_accepted');
    const target = base();
    delete target.scenes[0].layers[0].behaviors[1].target;
    expect(codes(validateSpec(target, ink, { registry: BEHAVIORS }))).toContain('behavior.target_required');
    const param = base();
    param.scenes[0].layers[0].behaviors[0].params = { stagger_beats: 9 };
    expect(codes(validateSpec(param, ink, { registry: BEHAVIORS }))).toContain('behavior.param_invalid');
    param.scenes[0].layers[0].behaviors[0].params = { wobble: 1 };
    expect(codes(validateSpec(param, ink, { registry: BEHAVIORS }))).toContain('behavior.param_unknown');
  });

  it('refuse une ancre réservée tant qu’aucune voix n’est alignée', () => {
    const doc = base();
    doc.scenes[0].layers[0].behaviors[0].at = { voice_breath: { segment: 'vo_question', index: 0 } };
    expect(codes(validateSpec(doc, ink))).toContain('anchor.reserved');
  });

  it('accepte les ancres de calque et refuse un calque inexistant', () => {
    const doc = base();
    doc.scenes[0].layers[1].behaviors[0].at = { after_layer: 'tx_question' };
    expect(validateSpec(doc, ink, { registry: BEHAVIORS }).ok).toBe(true);
    doc.scenes[0].layers[1].behaviors[0].at = { with_layer: 'tx_ghost' };
    expect(codes(validateSpec(doc, ink, { registry: BEHAVIORS }))).toContain('anchor.unknown_layer');
  });

  it('signale sans bloquer un segment de voix rattaché à aucune scène', () => {
    const doc = base();
    doc.voice.segments.push({ id: 'vo_orphan', text: 'Orphelin.', gap_after: null, emphasis: [] });
    const result = validateSpec(doc, ink);
    expect(result.ok && result.warnings.map((w) => w.code)).toContain('voice.unused_segment');
  });
});
