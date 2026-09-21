import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearChunkLoadRecoveryGuard,
  installChunkLoadRecovery,
  installStylesheetLoadRecovery,
  isChunkLoadError,
  recoverChunkLoadError,
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

  it('actualise une seule fois si plusieurs erreurs arrivent dans la même fenêtre', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const prepareReload = vi.fn();
    let currentTime = 100_000;

    cleanups.push(
      installChunkLoadRecovery({ storage, reload, prepareReload, now: () => currentTime }),
    );

    const firstError = Object.assign(new Event('vite:preloadError', { cancelable: true }), {
      payload: new TypeError('Failed to fetch dynamically imported module: /assets/x.js'),
    });
    window.dispatchEvent(firstError);
    window.dispatchEvent(
      Object.assign(new Event('vite:preloadError', { cancelable: true }), {
        payload: new TypeError('Failed to fetch dynamically imported module: /assets/x.js'),
      }),
    );

    expect(firstError.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(prepareReload).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    currentTime += 31_000;
    window.dispatchEvent(
      Object.assign(new Event('vite:preloadError', { cancelable: true }), {
        payload: new TypeError('Failed to fetch dynamically imported module: /assets/x.js'),
      }),
    );
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
  });

  it('peut réarmer la récupération après un démarrage réussi', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const prepareReload = vi.fn();

    cleanups.push(installChunkLoadRecovery({ storage, reload, prepareReload, now: () => 100_000 }));
    const dispatchChunkError = () =>
      window.dispatchEvent(
        Object.assign(new Event('vite:preloadError', { cancelable: true }), {
          payload: new TypeError('Failed to fetch dynamically imported module: /assets/x.js'),
        }),
      );

    dispatchChunkError();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    clearChunkLoadRecoveryGuard(storage);
    dispatchChunkError();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
  });

  it('récupère aussi une erreur attrapée directement pendant le démarrage', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const prepareReload = vi.fn();

    expect(
      recoverChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: /assets/App-old.js'),
        { storage, reload, prepareReload, now: () => 100_000 },
      ),
    ).toBe(true);

    await vi.waitFor(() => expect(prepareReload).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('recharge une interface dont la feuille principale a échoué', async () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const prepareReload = vi.fn();
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/assets/index-obsolete.css';
    document.head.append(stylesheet);

    const cleanup = installStylesheetLoadRecovery({
      storage,
      reload,
      prepareReload,
      now: () => 100_000,
    });
    stylesheet.dispatchEvent(new Event('error'));

    await vi.waitFor(() => expect(prepareReload).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    cleanup();
    stylesheet.remove();
  });
});
