import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearChunkLoadRecoveryGuard,
  installChunkLoadRecovery,
  isChunkLoadError,
} from './chunk-load-recovery';

function memoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('récupération des modules différés', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('reconnaît les erreurs de module sans confondre une erreur applicative', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')),
    ).toBe(true);
    expect(isChunkLoadError(new Error('Client introuvable'))).toBe(false);
  });

  it('actualise une seule fois si plusieurs erreurs arrivent dans la même fenêtre', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    let currentTime = 100_000;

    cleanups.push(installChunkLoadRecovery({ storage, reload, now: () => currentTime }));

    const firstError = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(firstError);
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));

    expect(firstError.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    currentTime += 31_000;
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('peut réarmer la récupération après un démarrage réussi', () => {
    const storage = memoryStorage();
    const reload = vi.fn();

    cleanups.push(installChunkLoadRecovery({ storage, reload, now: () => 100_000 }));
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));

    clearChunkLoadRecoveryGuard(storage);
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));

    expect(reload).toHaveBeenCalledTimes(2);
  });
});
