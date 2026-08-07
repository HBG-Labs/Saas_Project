import { describe, expect, it } from 'vitest';

import { parseEnv } from './env';

const VALID = {
  VITE_SUPABASE_URL: 'https://abcdefgh.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  VITE_APP_ENV: 'development',
};

describe('parseEnv', () => {
  it('accepte une configuration complète', () => {
    expect(parseEnv(VALID).VITE_SUPABASE_URL).toBe('https://abcdefgh.supabase.co');
  });

  it('applique development par défaut', () => {
    const { VITE_APP_ENV: _ignored, ...withoutEnv } = VALID;
    expect(parseEnv(withoutEnv).VITE_APP_ENV).toBe('development');
  });

  it('rejette une URL invalide en nommant la variable fautive', () => {
    expect(() => parseEnv({ ...VALID, VITE_SUPABASE_URL: 'pas-une-url' })).toThrow(
      /VITE_SUPABASE_URL/,
    );
  });

  it('rejette une clé manquante plutôt que de laisser passer undefined', () => {
    const { VITE_SUPABASE_PUBLISHABLE_KEY: _ignored, ...withoutKey } = VALID;
    expect(() => parseEnv(withoutKey)).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/);
  });
});
