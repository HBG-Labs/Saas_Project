import { describe, expect, it } from 'vitest';

import {
  buildInstagramAuthorizationUrl,
  decryptSecret,
  encryptSecret,
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  INSTAGRAM_GRAPH_API_VERSION,
  INSTAGRAM_OAUTH_URL,
  INSTAGRAM_SCOPES,
  instagramJson,
} from './instagram-platform';

const KEY = btoa('0123456789abcdef0123456789abcdef');

describe('contrat Instagram Platform API', () => {
  it('construit une URL OAuth officielle avec les scopes V1 minimaux', () => {
    const url = new URL(
      buildInstagramAuthorizationUrl({
        clientId: 'app-id',
        redirectUri: 'https://project.supabase.co/functions/v1/instagram-oauth-callback',
        state: 'state-123',
      }),
    );

    expect(url.origin + url.pathname).toBe(INSTAGRAM_OAUTH_URL);
    expect(url.searchParams.get('client_id')).toBe('app-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('scope')).toBe(INSTAGRAM_SCOPES.join(','));
    const scopes = url.searchParams.get('scope')?.split(',') ?? [];
    expect(scopes).not.toContain('instagram_business_manage_messages');
    expect(scopes).not.toContain('instagram_business_manage_comments');
    expect(scopes).not.toContain('business_basic');
  });

  it('chiffre les jetons avec un contexte organisation + compte', async () => {
    const encrypted = await encryptSecret('ig-token-secret', KEY, 'org-a:instagram:1784');
    expect(encrypted).not.toContain('ig-token-secret');
    await expect(decryptSecret(encrypted, KEY, 'org-a:instagram:1784')).resolves.toBe(
      'ig-token-secret',
    );
    await expect(decryptSecret(encrypted, KEY, 'org-b:instagram:1784')).rejects.toThrow();
  });

  it('échange un code puis un jeton long sans contacter un vrai endpoint Meta', async () => {
    const fetcher: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      if (request.url === 'https://api.instagram.com/oauth/access_token') {
        const body = await request.text();
        expect(body).toContain('grant_type=authorization_code');
        return Response.json({
          access_token: 'short-token',
          user_id: '1784140000001',
          permissions: ['instagram_business_basic'],
        });
      }
      const url = new URL(request.url);
      expect(url.origin).toBe('https://graph.instagram.com');
      expect(url.pathname).toBe(`/${INSTAGRAM_GRAPH_API_VERSION}/access_token`);
      expect(url.searchParams.get('grant_type')).toBe('ig_exchange_token');
      return Response.json({
        access_token: 'long-token',
        token_type: 'bearer',
        expires_in: 5184000,
      });
    };

    const short = await exchangeInstagramCode(
      {
        clientId: 'app-id',
        clientSecret: 'secret',
        redirectUri: 'https://callback.test',
        code: 'code-ok',
      },
      fetcher,
    );
    const long = await exchangeInstagramLongLivedToken(
      { clientSecret: 'secret', shortLivedAccessToken: short.accessToken },
      fetcher,
    );

    expect(short.userId).toBe('1784140000001');
    expect(long.accessToken).toBe('long-token');
  });

  it('lit le profil via graph.instagram.com versionné', async () => {
    const fetcher: typeof fetch = (input) => {
      const url = new URL(new Request(input).url);
      expect(url.pathname).toBe(`/${INSTAGRAM_GRAPH_API_VERSION}/me`);
      expect(url.searchParams.get('fields')).toContain('username');
      expect(url.searchParams.get('access_token')).toBe('long-token');
      return Promise.resolve(Response.json({ id: '1784', username: 'rezo.360' }));
    };

    await expect(
      instagramJson('/me?fields=id,username', 'long-token', {}, fetcher),
    ).resolves.toMatchObject({ username: 'rezo.360' });
  });
});
