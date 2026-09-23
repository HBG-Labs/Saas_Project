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
    localStorage.setItem('rezo_ai_search_history_user-a_org-a', '["client privé"]');
    localStorage.setItem('rezo_ai_search_history_user-b_org-b', '["autre client privé"]');
    localStorage.setItem('rezo360_field_voice_recordings', 'legacy-audio');
    localStorage.setItem('rezo360_theme', 'dark');

    clearPrivateSessionStorage();

    expect(sessionStorage.getItem(voiceRecordingSessionKey('user-a', 'org-a'))).toBeNull();
    expect(sessionStorage.getItem('rezo360_non_sensitive_preference')).toBe('compact');
    expect(localStorage.getItem('rezo_ai_search_history_user-a_org-a')).toBeNull();
    expect(localStorage.getItem('rezo_ai_search_history_user-b_org-b')).toBeNull();
    expect(localStorage.getItem('rezo360_field_voice_recordings')).toBeNull();
    expect(localStorage.getItem('rezo360_theme')).toBe('dark');
  });

  it('supprime uniquement l’ancien stockage local non cloisonné', () => {
    localStorage.setItem('rezo360_field_voice_recordings', 'legacy-audio');
    localStorage.setItem('rezo360_theme', 'dark');

    removeLegacyPrivateLocalStorage();

    expect(localStorage.getItem('rezo360_field_voice_recordings')).toBeNull();
    expect(localStorage.getItem('rezo360_theme')).toBe('dark');
  });
});
