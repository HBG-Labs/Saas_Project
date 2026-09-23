import { describe, expect, it, vi } from 'vitest';

import { collectAllPages } from './pagination';

describe('collectAllPages', () => {
  it('lit toutes les pages sans tronquer le résultat', async () => {
    const source = Array.from({ length: 1_205 }, (_, index) => index);
    const load = vi.fn((offset: number, size: number) =>
      Promise.resolve(source.slice(offset, offset + size)),
    );

    const result = await collectAllPages(load, { pageSize: 500 });

    expect(result).toEqual(source);
    expect(load.mock.calls).toEqual([
      [0, 500],
      [500, 500],
      [1_000, 500],
    ]);
  });

  it('respecte une limite explicite sans surlecture', async () => {
    const source = Array.from({ length: 900 }, (_, index) => index);
    const load = vi.fn((offset: number, size: number) =>
      Promise.resolve(source.slice(offset, offset + size)),
    );

    const result = await collectAllPages(load, { limit: 520, pageSize: 500 });

    expect(result).toHaveLength(520);
    expect(load.mock.calls).toEqual([
      [0, 500],
      [500, 20],
    ]);
  });

  it('s’arrête immédiatement pour une limite invalide', async () => {
    const load = vi.fn(() => Promise.resolve([1]));
    await expect(collectAllPages(load, { limit: 0 })).resolves.toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
});
