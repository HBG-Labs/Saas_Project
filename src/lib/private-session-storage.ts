const PRIVATE_SESSION_PREFIXES = ['rezo360_field_voice_recordings:'] as const;
const PRIVATE_LOCAL_PREFIXES = ['rezo_ai_search_history_'] as const;
const LEGACY_LOCAL_KEYS = ['rezo360_field_voice_recordings'] as const;

export function removeLegacyPrivateLocalStorage(): void {
  try {
    LEGACY_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Le stockage peut être indisponible en navigation privée stricte.
  }
}

/**
 * Efface les données privées qui ne doivent jamais survivre à un changement
 * d'utilisateur dans le même navigateur.
 */
export function clearPrivateSessionStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key && PRIVATE_SESSION_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Le stockage peut être indisponible en navigation privée stricte.
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && PRIVATE_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Le stockage peut être indisponible en navigation privée stricte.
  }

  removeLegacyPrivateLocalStorage();
}

export function voiceRecordingSessionKey(userId: string, organizationId: string): string {
  return `rezo360_field_voice_recordings:${userId}:${organizationId}`;
}
