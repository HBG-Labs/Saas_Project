import { assertEquals } from 'jsr:@std/assert@1';

import type {
  ClaimedSocialPost,
  InstagramPublisher,
  InstagramPublishResult,
} from '../_shared/social-publisher.ts';
import type { MarkPublishResultInput, SocialWorkerStore } from '../_shared/social-worker-store.ts';
import { createSocialWorkerHandler, type SocialWorkerConfig } from './handler.ts';

const SECRET = 'social-worker-secret';
const ORG = '00000000-0000-4000-8000-000000000360';
const WEEK = '00000000-0000-4000-8000-00000000bb01';
const NOW = new Date('2026-09-28T18:31:00.000Z');

function request(secret = SECRET) {
  return new Request('https://worker.local/social-worker', {
    method: 'POST',
    headers: { 'x-worker-secret': secret },
  });
}

function claim(index: number, overrides: Partial<ClaimedSocialPost> = {}): ClaimedSocialPost {
  return {
    postId: `00000000-0000-4000-8000-00000000aa0${index}`,
    organizationId: ORG,
    weekId: WEEK,
    accountId: null,
    scheduledAt: `2026-09-${27 + index}T18:30:00.000Z`,
    attemptId: `00000000-0000-4000-8000-00000000cc0${index}`,
    attempts: 1,
    publishMode: 'dry_run',
    approvedSnapshot: {
      hook: `Hook ${index}`,
      caption: `Caption ${index}`,
      asset: { storage_path: `${ORG}/social-studio/generated/post-${index}/final.png` },
    },
    ...overrides,
  };
}

function weekClaims() {
  return Array.from({ length: 7 }, (_, index) => claim(index + 1));
}

class StaticPublisher implements InstagramPublisher {
  readonly id = 'mock';
  readonly mode = 'dry_run' as const;
  calls: ClaimedSocialPost[] = [];

  constructor(
    private readonly result: InstagramPublishResult = { status: 'success', mediaId: 'dry_run:ok' },
  ) {}

  publish(post: ClaimedSocialPost): Promise<InstagramPublishResult> {
    this.calls.push(post);
    return Promise.resolve(this.result);
  }
}

class LivePublisher implements InstagramPublisher {
  readonly id = 'meta';
  readonly mode = 'live' as const;
  calls = 0;

  publish(): Promise<InstagramPublishResult> {
    this.calls += 1;
    return Promise.resolve({ status: 'success', mediaId: 'real-media' });
  }
}

function setup(
  options: {
    claims?: ClaimedSocialPost[];
    publisher?: InstagramPublisher;
    missing?: string[];
    allowLivePublishing?: boolean;
  } = {},
) {
  const marks: MarkPublishResultInput[] = [];
  const liveMarks: Array<{ postId: string; attemptId: string; mediaId: string }> = [];
  let claimedOnce = false;
  const store: SocialWorkerStore = {
    claimDuePosts: async () => {
      await Promise.resolve();
      if (claimedOnce) return [];
      claimedOnce = true;
      return options.claims ?? [];
    },
    markPublishResult: async (input) => {
      await Promise.resolve();
      marks.push(input);
    },
    markLivePublishSuccess: async (input) => {
      await Promise.resolve();
      liveMarks.push({
        postId: input.postId,
        attemptId: input.attemptId,
        mediaId: input.mediaId,
      });
    },
  };

  const handler = createSocialWorkerHandler({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'service-role',
    secret: SECRET,
    missing: options.missing ?? [],
    publisher: options.publisher ?? new StaticPublisher(),
    stores: { social: store },
    now: () => NOW,
    randomId: () => '00000000-0000-4000-8000-00000000dddd',
    maxAttempts: 5,
    allowLivePublishing: options.allowLivePublishing,
  } satisfies SocialWorkerConfig);

  return { handler, marks, liveMarks, store };
}

Deno.test(
  'social-worker refuse secret absent, config manquante et publisher non dry-run',
  async () => {
    const forbidden = setup();
    assertEquals((await forbidden.handler(request('bad'))).status, 401);

    const missing = setup({ missing: ['SOCIAL_WORKER_SECRET'] });
    assertEquals((await missing.handler(request())).status, 503);

    const livePublisher = new LivePublisher();
    const live = setup({ publisher: livePublisher, claims: [claim(1)] });
    const response = await live.handler(request());
    assertEquals(response.status, 503);
    assertEquals(livePublisher.calls, 0, 'aucun appel live Meta ne peut partir en Phase F');
  },
);

Deno.test(
  'social-worker publie un claim live seulement quand le mode live est active',
  async () => {
    const livePublisher = new LivePublisher();
    const live = setup({
      publisher: livePublisher,
      allowLivePublishing: true,
      claims: [
        claim(1, {
          accountId: '00000000-0000-4000-8000-00000000a001',
          publishMode: 'live',
        }),
      ],
    });
    const payload = await (await live.handler(request())).json();

    assertEquals(payload.claimed, 1);
    assertEquals(payload.livePublished, 1);
    assertEquals(livePublisher.calls, 1);
    assertEquals(live.liveMarks[0]?.mediaId, 'real-media');
    assertEquals(live.marks.length, 0);
  },
);

Deno.test('social-worker garde Meta desactive selon les combinaisons live/dry-run', async () => {
  const dryRunPublisher = new StaticPublisher();
  const dryRun = setup({ claims: [claim(1)], publisher: dryRunPublisher });
  assertEquals((await (await dryRun.handler(request())).json()).simulated, 1);
  assertEquals(dryRunPublisher.calls.length, 1);

  const liveDisabledPublisher = new LivePublisher();
  const liveDisabled = setup({
    publisher: liveDisabledPublisher,
    claims: [claim(1, { publishMode: 'live' })],
    allowLivePublishing: false,
  });
  assertEquals((await liveDisabled.handler(request())).status, 503);
  assertEquals(liveDisabledPublisher.calls, 0);

  const dryRunMisconfiguredPublisher = new StaticPublisher();
  const dryRunMisconfigured = setup({
    publisher: dryRunMisconfiguredPublisher,
    claims: [claim(1)],
    allowLivePublishing: true,
  });
  assertEquals((await dryRunMisconfigured.handler(request())).status, 503);
  assertEquals(dryRunMisconfiguredPublisher.calls.length, 0);
});

Deno.test('social-worker simule 7 publications dry-run sans appel Meta', async () => {
  const publisher = new StaticPublisher();
  const { handler, marks } = setup({ claims: weekClaims(), publisher });
  const payload = await (await handler(request())).json();

  assertEquals(payload.claimed, 7);
  assertEquals(payload.simulated, 7);
  assertEquals(payload.failed, 0);
  assertEquals(publisher.calls.length, 7);
  assertEquals(
    marks.map((mark) => mark.result),
    Array(7).fill('simulated_success'),
  );
});

Deno.test('social-worker ne traite pas deux fois le meme claim idempotent', async () => {
  const { handler, marks } = setup({ claims: [claim(1)] });

  assertEquals((await (await handler(request())).json()).claimed, 1);
  assertEquals((await (await handler(request())).json()).claimed, 0);
  assertEquals(marks.length, 1);
});

Deno.test(
  'social-worker reprogramme une erreur temporaire puis abandonne au max attempts',
  async () => {
    const temporary = new StaticPublisher({
      status: 'failure',
      kind: 'temporary',
      code: 'rate_limit',
      message: 'Rate limit',
    });
    const retry = setup({ claims: [claim(1, { attempts: 2 })], publisher: temporary });
    const retryPayload = await (await retry.handler(request())).json();
    assertEquals(retryPayload.retried, 1);
    assertEquals(retry.marks[0]?.result, 'temporary_failure');

    const exhausted = setup({ claims: [claim(1, { attempts: 5 })], publisher: temporary });
    const exhaustedPayload = await (await exhausted.handler(request())).json();
    assertEquals(exhaustedPayload.failed, 1);
    assertEquals(exhausted.marks[0]?.result, 'temporary_failure');
  },
);

Deno.test(
  'social-worker marque les erreurs permanentes et les timeouts ambigus sans retry automatique',
  async () => {
    const permanent = setup({
      claims: [claim(1)],
      publisher: new StaticPublisher({
        status: 'failure',
        kind: 'permanent',
        code: 'asset_missing',
        message: 'Asset missing',
      }),
    });
    assertEquals((await (await permanent.handler(request())).json()).failed, 1);
    assertEquals(permanent.marks[0]?.result, 'permanent_failure');

    const ambiguous = setup({
      claims: [claim(1)],
      publisher: new StaticPublisher({
        status: 'failure',
        kind: 'ambiguous_timeout',
        code: 'timeout_after_submit',
        message: 'Timeout apres envoi',
      }),
    });
    const payload = await (await ambiguous.handler(request())).json();
    assertEquals(payload.reconciliationRequired, 1);
    assertEquals(ambiguous.marks[0]?.result, 'ambiguous_timeout');
  },
);
