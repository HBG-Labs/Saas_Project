import { assertEquals } from 'jsr:@std/assert@1';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import {
  nextSubscriptionSeatSyncAttempt,
  synchronizeSubscriptionSeatJob,
} from './subscription-seats.ts';

Deno.test('la reprise des sièges applique un délai exponentiel plafonné', () => {
  const now = new Date('2026-09-09T12:00:00.000Z');

  assertEquals(nextSubscriptionSeatSyncAttempt(1, now).toISOString(), '2026-09-09T12:01:00.000Z');
  assertEquals(nextSubscriptionSeatSyncAttempt(20, now).toISOString(), '2026-09-09T13:00:00.000Z');
});

Deno.test('la synchronisation pose la quantité calculée puis relit Stripe', async () => {
  const admin = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        not: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: () => {
          if (table === 'subscriptions') {
            return Promise.resolve({
              data: { provider_subscription_id: 'sub_123', plan_code: 'pro' },
              error: null,
            });
          }
          if (table === 'plans') {
            return Promise.resolve({
              data: { stripe_price_id_monthly: 'price_plan' },
              error: null,
            });
          }
          return Promise.resolve({
            data: { extra_seat_price_id_monthly: 'price_seat' },
            error: null,
          });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  let stripeQuantity = 0;
  const calls: string[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);

    if (url.includes('/v1/subscription_items') && init?.method === 'POST') {
      const body = new URLSearchParams(String(init.body));
      stripeQuantity = Number(body.get('quantity'));
      return Promise.resolve(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }

    if (url.includes('/v1/subscriptions/sub_123')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            items: {
              data:
                stripeQuantity === 0
                  ? []
                  : [{ id: 'si_123', quantity: stripeQuantity, price: { id: 'price_seat' } }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    return Promise.resolve(new Response('{}', { status: 500 }));
  };

  const result = await synchronizeSubscriptionSeatJob(
    admin,
    {
      organization_id: 'org-a',
      desired_extra_seats: 3,
      attempts: 0,
      revision: 'revision-a',
    },
    fakeFetch,
    'sk_test_fake',
  );

  assertEquals(result.stripeQuantity, 3);
  assertEquals(result.synced, true);
  assertEquals(calls.filter((call) => call.startsWith('GET')).length, 2);
  assertEquals(calls.filter((call) => call.startsWith('POST')).length, 1);
});
