import { describe, expect, it } from 'vitest';

import { normalizeClientError, redactClientErrorText } from './client-errors.api';

describe('client error telemetry', () => {
  it('masque les adresses et secrets usuels', () => {
    const input =
      'Compte pierre@example.com Bearer abc.def et ?token=secret-value&code=oauth-code';

    const result = redactClientErrorText(input);

    expect(result).not.toContain('pierre@example.com');
    expect(result).not.toContain('secret-value');
    expect(result).not.toContain('oauth-code');
    expect(result).toContain('[email masqué]');
  });

  it('normalise une raison de rejet qui ne serait pas une Error', () => {
    expect(normalizeClientError('réseau indisponible').message).toBe('réseau indisponible');
    expect(normalizeClientError({ code: 503 }).message).toContain('503');
  });
});
