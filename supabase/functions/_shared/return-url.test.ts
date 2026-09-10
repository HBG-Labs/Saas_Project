import { assertEquals } from 'jsr:@std/assert@1.0.14';

import { trustedReturnUrl } from './return-url.ts';

Deno.test('les retours Stripe utilisent toujours APP_URL', () => {
  assertEquals(
    trustedReturnUrl({
      configuredAppUrl: 'https://app.rezo360.com',
      explicitUrl: 'https://app.rezo360.com/page-inventee',
      requestOrigin: 'https://site-malveillant.test',
      path: '/organisation/facturation?paiement=ok',
    }),
    'https://app.rezo360.com/organisation/facturation?paiement=ok',
  );
});

Deno.test('une origine de retour étrangère est refusée', () => {
  assertEquals(
    trustedReturnUrl({
      configuredAppUrl: 'https://app.rezo360.com',
      explicitUrl: 'https://site-malveillant.test/vol',
      requestOrigin: 'https://app.rezo360.com',
      path: '/organisation/facturation',
    }),
    null,
  );
});

Deno.test('sans APP_URL, seul un hôte local est toléré', () => {
  assertEquals(
    trustedReturnUrl({
      configuredAppUrl: undefined,
      explicitUrl: undefined,
      requestOrigin: 'https://app.rezo360.com',
      path: '/organisation/facturation',
    }),
    null,
  );
  assertEquals(
    trustedReturnUrl({
      configuredAppUrl: undefined,
      explicitUrl: 'http://localhost:5173/anything',
      requestOrigin: null,
      path: '/organisation/facturation',
    }),
    'http://localhost:5173/organisation/facturation',
  );
});
