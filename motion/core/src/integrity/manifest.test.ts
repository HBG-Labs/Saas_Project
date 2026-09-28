import { describe, expect, it } from 'vitest';

import type { MotionSceneSpec } from '../contracts/motion-spec.ts';
import type { PlatformPresets } from '../contracts/platform.ts';
import type { RenderPlan } from '../contracts/render-plan.ts';
import type { ResolvedStyle } from '../contracts/resolved-style.ts';
import { clone, minimalPlan, readFixture, resolvedInk, resolvedSignal } from '../test-support.ts';
import { canonicalJson, hashDocument } from './canonical.ts';
import { buildReproducibilityManifest, isReferenceEligible, ManifestError, manifestHash, verifyManifest } from './manifest.ts';
import { readVersioned } from '../validation/versioning.ts';
import type { ManifestInput } from './manifest.ts';

const spec = readFixture('moon.spec.json') as unknown as MotionSceneSpec;
const presets = readFixture('platforms.json') as unknown as PlatformPresets;

function planFor(resolved: ResolvedStyle): RenderPlan {
  const plan = minimalPlan();
  plan.spec = { spec_id: spec.spec_id, revision: spec.revision, sha256: hashDocument(spec) };
  plan.style = { mode: resolved.mode, sha256: resolved.sha256 };
  return plan as unknown as RenderPlan;
}

function inputFor(resolved: ResolvedStyle, extra: Partial<ManifestInput> = {}): ManifestInput {
  return {
    createdAt: '2026-09-27T18:00:00+02:00',
    engine: { name: '@motion-engine/core', version: '0.1.0' },
    git: { commit: 'c906ca8', dirty: false },
    spec,
    resolvedStyle: resolved,
    plan: planFor(resolved),
    platformPresets: presets,
    toolchain: { node: 'v24.19.0', remotion: null, chromium: null, ffmpeg: null },
    renderConfig: { width: 1080, height: 1920, fps: 30, codec: 'png-still', crf: null, pixel_format: null, color_space: null },
    ...extra,
  };
}

describe('JSON canonique', () => {
  it('ne dépend pas de l’ordre des clés', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: [3, { y: 2, z: 1 }] }, b: 1 }));
  });
  it('conserve l’ordre des tableaux (il est signifiant)', () => {
    expect(hashDocument([1, 2])).not.toBe(hashDocument([2, 1]));
  });
  it('refuse les nombres non finis', () => {
    expect(() => canonicalJson({ x: Number.NaN })).toThrow();
  });
});

describe('manifeste de reproductibilité', () => {
  const ink = resolvedInk();
  const signal = resolvedSignal();

  it('trace le style lié, résolu et ses sources, sans substitution', () => {
    const manifest = buildReproducibilityManifest(inputFor(ink));
    expect(manifest.style).toMatchObject({
      binding: { kind: 'style', id: 'fixture_ink', version: '1.1.0' },
      mode: 'creative',
      resolved_sha256: ink.sha256,
      substituted: false,
      substitution_reason: null,
    });
    expect(manifest.platform_presets?.sha256).toBe(hashDocument(presets));
    expect(verifyManifest(manifest)).toBe(true);
  });

  it('exige un motif pour toute substitution de style, et l’enregistre', () => {
    expect(() => buildReproducibilityManifest(inputFor(signal))).toThrowError(ManifestError);
    const manifest = buildReproducibilityManifest(inputFor(signal, { substitutionReason: 'test d’indépendance du moteur' }));
    expect(manifest.style.substituted).toBe(true);
    expect(manifest.style.substitution_reason).toBe('test d’indépendance du moteur');
    expect(manifest.style.sources.style.id).toBe('fixture_signal');
  });

  it('refuse un motif de substitution quand le style correspond à la liaison', () => {
    expect(() => buildReproducibilityManifest(inputFor(ink, { substitutionReason: 'inutile' }))).toThrowError(ManifestError);
  });

  it('refuse un plan compilé avec un autre style ou depuis une autre spec', () => {
    expect(() => buildReproducibilityManifest(inputFor(ink, { plan: planFor(signal) }))).toThrowError(/autre style/);
    const otherSpec = clone(spec);
    otherSpec.revision = 2;
    expect(() => buildReproducibilityManifest(inputFor(ink, { spec: otherSpec }))).toThrowError(/autre spec/);
  });

  it('est stable pour des entrées identiques et exclut la date', () => {
    const a = buildReproducibilityManifest(inputFor(ink));
    const b = buildReproducibilityManifest(inputFor(ink, { createdAt: '2027-01-01T00:00:00Z' }));
    expect(a.manifest_sha256).toBe(b.manifest_sha256);
  });

  it('change dès que le style, les presets, l’outillage ou la configuration changent', () => {
    const reference = buildReproducibilityManifest(inputFor(ink)).manifest_sha256;
    const variants = [
      buildReproducibilityManifest(inputFor(signal, { substitutionReason: 'autre style' })),
      buildReproducibilityManifest(inputFor(ink, { platformPresets: null })),
      buildReproducibilityManifest(inputFor(ink, { toolchain: { node: 'v24.19.0', remotion: '4.0.529', chromium: null, ffmpeg: null } })),
      buildReproducibilityManifest(
        inputFor(ink, { renderConfig: { width: 1080, height: 1920, fps: 60, codec: 'png-still', crf: null, pixel_format: null, color_space: null } }),
      ),
    ];
    for (const manifest of variants) expect(manifest.manifest_sha256).not.toBe(reference);
  });

  it('détecte un manifeste altéré', () => {
    const manifest = buildReproducibilityManifest(inputFor(ink));
    const tampered = { ...manifest, render_plan_sha256: 'f'.repeat(64) };
    expect(verifyManifest(tampered)).toBe(false);
    expect(manifestHash(tampered)).not.toBe(manifest.manifest_sha256);
  });
});

describe('manifeste 0.3.0 : état git, éligibilité, timing, registre', () => {
  const ink = resolvedInk();
  const complete = { node: 'v24.19.0', remotion: '4.0.529', chromium: '149.0.7790.0', ffmpeg: 'ffmpeg version n7.1' };
  const video = { width: 540, height: 960, fps: 30, codec: 'h264' as const, crf: 20, pixel_format: 'yuv420p', color_space: 'bt709' as const };

  it('dit la vérité sur l’état git : un arbre modifié n’est jamais une référence', () => {
    const clean = buildReproducibilityManifest(inputFor(ink, { toolchain: complete, renderConfig: video }));
    expect(clean.engine).toMatchObject({ git_commit: 'c906ca8', git_dirty: false });
    expect(clean.reference_eligible).toBe(true);
    const dirty = buildReproducibilityManifest(inputFor(ink, { git: { commit: 'c906ca8', dirty: true }, toolchain: complete, renderConfig: video }));
    expect(dirty.engine.git_dirty).toBe(true);
    expect(dirty.reference_eligible).toBe(false);
    expect(dirty.manifest_sha256).not.toBe(clean.manifest_sha256);
  });

  it('l’éligibilité exige commit connu, arbre propre et outillage identifié pour une vidéo', () => {
    expect(isReferenceEligible({ commit: null, dirty: false }, complete, 'h264')).toBe(false);
    expect(isReferenceEligible({ commit: 'abc1234', dirty: null }, complete, 'h264')).toBe(false);
    expect(isReferenceEligible({ commit: 'abc1234', dirty: false }, { ...complete, chromium: null }, 'h264')).toBe(false);
    expect(isReferenceEligible({ commit: 'abc1234', dirty: false }, complete, 'h264')).toBe(true);
  });

  it('reprend du Render Plan la source du timing, le registre et le mouvement réduit', () => {
    const manifest = buildReproducibilityManifest(inputFor(ink));
    expect(manifest.timing_source).toBe('estimated');
    expect(manifest.behavior_registry).toEqual({ version: '1.0.0', sha256: 'd'.repeat(64) });
    expect(manifest.render_config.reduced_motion).toBe(false);
  });

  it('migre un manifeste 0.2.0 en 0.3.0 sans rien affirmer de ce qu’il ignore', () => {
    const current = buildReproducibilityManifest(inputFor(ink));
    const { reference_eligible: _r, timing_source: _t, behavior_registry: _b, ...rest } = current;
    const v2 = {
      ...rest,
      schema_version: '0.2.0',
      engine: { name: current.engine.name, version: current.engine.version, git_commit: current.engine.git_commit },
      render_config: { ...current.render_config, reduced_motion: undefined },
    };
    const read = readVersioned('reproducibility-manifest', JSON.parse(JSON.stringify(v2)));
    expect(read.ok && read.migratedFrom).toBe('0.2.0');
    if (!read.ok) throw new Error('migration refusée');
    expect(read.value.engine.git_dirty).toBeNull();
    expect(read.value.reference_eligible).toBe(false);
    expect(read.value.timing_source).toBe('unknown');
    expect(read.value.behavior_registry).toBeNull();
  });

  it('aller-retour : un manifeste 0.3.0 se relit à l’identique et reste vérifiable', () => {
    const manifest = buildReproducibilityManifest(inputFor(ink, { toolchain: complete, renderConfig: video }));
    const read = readVersioned('reproducibility-manifest', JSON.parse(JSON.stringify(manifest)));
    expect(read.ok && read.migratedFrom).toBeNull();
    expect(read.ok && read.value).toEqual(manifest);
    expect(verifyManifest(manifest)).toBe(true);
  });
});
