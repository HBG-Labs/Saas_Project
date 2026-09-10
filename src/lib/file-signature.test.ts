import { describe, expect, it } from 'vitest';

import { assertFileSignature } from './file-signature';

function fichier(bytes: number[] | string, name: string, type: string): File {
  return new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name, { type });
}

describe('assertFileSignature', () => {
  it('accepte un PDF portant sa signature réelle', async () => {
    await expect(
      assertFileSignature(fichier('%PDF-1.7\ncontenu', 'notice.pdf', 'application/pdf')),
    ).resolves.toBeUndefined();
  });

  it('refuse un exécutable déguisé en PDF', async () => {
    await expect(
      assertFileSignature(fichier([0x4d, 0x5a, 0x90, 0x00], 'facture.pdf', 'application/pdf')),
    ).rejects.toThrow(/ne correspond pas/i);
  });

  it('refuse un binaire déguisé en texte', async () => {
    await expect(
      assertFileSignature(fichier([0x61, 0x00, 0x62], 'mesures.csv', 'text/csv')),
    ).rejects.toThrow(/ne correspond pas/i);
  });

  it('refuse un fichier vide', async () => {
    await expect(assertFileSignature(fichier([], 'vide.txt', 'text/plain'))).rejects.toThrow(
      /vide/i,
    );
  });
});
