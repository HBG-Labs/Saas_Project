import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearPrivateSessionStorage,
  removeLegacyPrivateLocalStorage,
  voiceRecordingSessionKey,
} from './private-session-storage';

describe('stockage privé lié à la session', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('sépare les mémos par utilisateur et organisation', () => {
    expect(voiceRecordingSessionKey('user-a', 'org-a')).not.toBe(
      voiceRecordingSessionKey('user-b', 'org-a'),
    );
    expect(voiceRecordingSessionKey('user-a', 'org-a')).not.toBe(
      voiceRecordingSessionKey('user-a', 'org-b'),
    );
  });

  it('efface les mémos privés sans toucher aux préférences publiques', () => {
    sessionStorage.setItem(voiceRecordingSessionKey('user-a', 'org-a'), 'audio-a');
    sessionStorage.setItem('rezo360_non_sensitive_preference', 'compact');
    localStorage.setItem('rezo360_field_voice_recordings', 'legacy-audio');

    clearPrivateSessionStorage();

    expect(sessionStorage.getItem(voiceRecordingSessionKey('user-a', 'org-a'))).toBeNull();
    expect(sessionStorage.getItem('rezo360_non_sensitive_preference')).toBe('compact');
    expect(localStorage.getItem('rezo360_field_voice_recordings')).toBeNull();
  });

  it('supprime uniquement l’ancien stockage local non cloisonné', () => {
    localStorage.setItem('rezo360_field_voice_recordings', 'legacy-audio');
    localStorage.setItem('rezo360_theme', 'dark');

    removeLegacyPrivateLocalStorage();

    expect(localStorage.getItem('rezo360_field_voice_recordings')).toBeNull();
    expect(localStorage.getItem('rezo360_theme')).toBe('dark');
  });
});
