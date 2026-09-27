import { readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadRenderProfile, PROFILES_DIR } from './profile.ts';
import { readToolchain } from './toolchain.ts';

describe('profils de rendu', () => {
  it('tous les profils fournis sont valides, en 9:16 et en BT.709', () => {
    const names = readdirSync(PROFILES_DIR).filter((n) => n.endsWith('.json')).map((n) => n.replace('.json', ''));
    expect(names.sort()).toEqual(['dev', 'master', 'smoke']);
    for (const name of names) {
      const profile = loadRenderProfile(name);
      expect(profile.width / profile.height).toBeCloseTo(9 / 16, 3);
      expect(profile.color_space).toBe('bt709');
      expect(profile.pixel_format).toBe('yuv420p');
    }
  });
});

describe('outillage', () => {
  it('lit les versions réellement installées sans rien supposer', () => {
    const tools = readToolchain(null);
    expect(tools.node).toBe(process.version);
    expect(tools.remotion).toBe('4.0.529');
    expect(tools.ffmpeg).toMatch(/^ffmpeg version /);
    expect(tools.chromium).toBeNull();
  });
});
