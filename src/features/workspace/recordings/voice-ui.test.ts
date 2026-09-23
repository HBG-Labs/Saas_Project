import { describe, expect, it } from 'vitest';

import { countTranscriptWords, formatRecordingDuration } from './voice-ui';

describe('présentation REZO Voice', () => {
  it('affiche une durée stable au format minutes:secondes', () => {
    expect(formatRecordingDuration(0)).toBe('00:00');
    expect(formatRecordingDuration(42)).toBe('00:42');
    expect(formatRecordingDuration(138)).toBe('02:18');
  });

  it('compte uniquement les mots réellement présents', () => {
    expect(countTranscriptWords(null)).toBeNull();
    expect(countTranscriptWords('  Chantier   prêt\nDemain matin. ')).toBe(4);
  });
});
