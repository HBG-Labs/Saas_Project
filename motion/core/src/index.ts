// API publique de @motion-engine/core.

export * from './contracts/common.ts';
export * from './contracts/creative-intent.ts';
export * from './contracts/style-roles.ts';
export * from './contracts/style-profile.ts';
export * from './contracts/brand-profile.ts';
export * from './contracts/series-profile.ts';
export * from './contracts/resolved-style.ts';
export * from './contracts/platform.ts';
export * from './contracts/motion-spec.ts';
export * from './contracts/render-plan.ts';
export * from './contracts/manifest.ts';

export { resolveStyle, resolvedStyleHash } from './style/resolve-style.ts';
export type { ResolveStyleInput } from './style/resolve-style.ts';
export { bindingMatches, describeResolved } from './style/binding.ts';
export { contrastRatio, relativeLuminance } from './style/contrast.ts';

export { canonicalJson, hashDocument, sha256Hex } from './integrity/canonical.ts';
export { buildReproducibilityManifest, isReferenceEligible, manifestHash, verifyManifest, ManifestError } from './integrity/manifest.ts';
export type { ManifestInput } from './integrity/manifest.ts';

export {
  validateBrandProfile,
  validateIntent,
  validatePlatformPresets,
  validateRenderPlan,
  validateResolvedStyle,
  validateSeriesProfile,
  validateSpec,
  validateStyle,
} from './validation/validate.ts';
export { readVersioned, currentVersion, documentKinds } from './validation/versioning.ts';
export type { DocumentKind, DocumentKinds } from './validation/versioning.ts';
export { formatIssues, hasErrors, ValidationFailure } from './validation/issues.ts';
export type { ValidationIssue, ValidationResult } from './validation/issues.ts';
export type { SpecSemanticOptions } from './validation/semantic-spec.ts';

export { loadBrandFile, loadPlatformPresetsFile, loadSeriesFile, loadStyleFile, resolveResource } from './io/load.ts';
export type { LoadedBrand, LoadedSeries, LoadOptions } from './io/load.ts';

export { findWordMatches, normalizeWord, voiceWords } from './text/voice-words.ts';

export * from './contracts/pattern.ts';
export { validatePattern } from './validation/validate.ts';
export { loadPatternPacks } from './io/load.ts';

export { buildSpec, SPEC_BUILDER_VERSION } from './builder/build-spec.ts';
export type { BuildSpecInput } from './builder/build-spec.ts';
export { compileSpec, COMPILER_VERSION } from './compiler/compile.ts';
export type { CompileInput, CompileOutput, OutputConfig } from './compiler/compile.ts';
export * from './contracts/behavior.ts';
export { BEHAVIORS, BEHAVIOR_REGISTRY_VERSION, createBehaviorRegistry, latestVersion } from './motion/registry.ts';
export type { BehaviorRegistry } from './motion/registry.ts';
export { EASING_ROLE_INTENTS, EASING_TYPES, resolveEasing, resolveAllEasings } from './motion/easing-catalog.ts';
export { compileTracks } from './motion/tracks.ts';
export { resolveTemporalPlan, distribute, SCENE_PHASES, TemporalError } from './temporal/engine.ts';
export type { TemporalPlan, TemporalScene, ResolvedBehavior, PhaseSpan, ScenePhase } from './temporal/engine.ts';
export { estimateSpeech } from './temporal/speech.ts';
export type { EstimatedSpeechTiming, VoiceAlignment, SpeechTiming } from './temporal/speech.ts';
export { readingTime } from './temporal/readability.ts';
export type { ReadingRequirement } from './temporal/readability.ts';
export { msToFrame, toSceneFrames } from './temporal/frames.ts';

export { cubicBezier, evaluateEasing, mixColor, sampleProperty, sampleTrack, springResponse } from './runtime/index.ts';

export { appendToLock, checkVersionLock, LOCKED_KINDS, VersionLockSchema } from './integrity/version-lock.ts';
export type { VersionedDocument, VersionLock } from './integrity/version-lock.ts';
export { collectVersionedDocuments, loadVersionLock } from './io/load.ts';
export { ENGINE_NAME, ENGINE_VERSION } from './version.ts';
