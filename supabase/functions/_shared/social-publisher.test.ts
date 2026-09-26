import { assertEquals } from 'jsr:@std/assert@1';

import {
  MetaInstagramPublisher,
  type ClaimedSocialPost,
  type MetaInstagramPublisherStore,
} from './social-publisher.ts';

const POST: ClaimedSocialPost = {
  postId: '00000000-0000-4000-8000-00000000aa01',
  organizationId: '00000000-0000-4000-8000-000000000360',
  weekId: '00000000-0000-4000-8000-00000000bb01',
  accountId: '00000000-0000-4000-8000-00000000cc01',
  scheduledAt: '2026-09-28T18:30:00.000Z',
  attemptId: '00000000-0000-4000-8000-00000000dd01',
  attempts: 1,
  publishMode: 'live',
  approvedSnapshot: {
    hook: 'Le chantier est fini. Pas l’administratif.',
    visual_text: 'LE CHANTIER EST FINI.\nPAS L’ADMINISTRATIF.',
    caption: 'Le terrain est terminé. Le suivi client, lui, doit rester propre.',
    cta: 'Voir REZO360',
    hashtags: ['artisan', '#btp'],
    asset: {
      storage_path: 'org/social-studio/generated/post/final.png',
      mime_type: 'image/png',
      width: 1080,
      height: 1350,
    },
  },
};

function store(): MetaInstagramPublisherStore & { containers: string[] } {
  const containers: string[] = [];
  return {
    containers,
    loadCredential: () =>
      Promise.resolve({
        providerAccountId: '17841400000000000',
        accessToken: 'ig-token',
        expiresAt: '2026-12-31T00:00:00.000Z',
        grantedPermissions: ['instagram_business_content_publish'],
      }),
    createSignedAssetUrl: () => Promise.resolve('https://assets.example.test/signed/final.png'),
    markContainer: (input) => {
      containers.push(`${input.containerId}:${input.status}`);
      return Promise.resolve();
    },
  };
}

Deno.test('MetaInstagramPublisher cree un container puis publie le media', async () => {
  const calls: string[] = [];
  const publisherStore = store();
  const publisher = new MetaInstagramPublisher({
    store: publisherStore,
    pollDelayMs: 0,
    fetcher: (async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (String(url).includes('/media_publish')) {
        return Response.json({ id: '17900000000000001' });
      }
      if (String(url).includes('/container-1')) {
        return Response.json({ status_code: 'FINISHED' });
      }
      return Response.json({ id: 'container-1' });
    }) as typeof fetch,
  });

  const result = await publisher.publish(POST);

  assertEquals(result.status, 'success');
  if (result.status === 'success') assertEquals(result.mediaId, '17900000000000001');
  assertEquals(calls.length, 3);
  assertEquals(publisherStore.containers, ['container-1:CREATED', 'container-1:FINISHED']);
});

Deno.test('MetaInstagramPublisher classe un timeout apres media_publish comme ambigu', async () => {
  const publisher = new MetaInstagramPublisher({
    store: store(),
    pollDelayMs: 0,
    publishTimeoutMs: 1,
    fetcher: (async (url, init) => {
      if (String(url).includes('/media_publish')) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 20);
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timeout);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        });
        return Response.json({ id: 'late-media' });
      }
      if (String(url).includes('/container-1')) {
        return Response.json({ status_code: 'FINISHED' });
      }
      return Response.json({ id: 'container-1' });
    }) as typeof fetch,
  });

  const result = await publisher.publish(POST);

  assertEquals(result.status, 'failure');
  if (result.status === 'failure') {
    assertEquals(result.kind, 'ambiguous_timeout');
    assertEquals(result.code, 'meta_timeout');
  }
});
