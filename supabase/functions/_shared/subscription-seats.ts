import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';

import { stripeDelete, stripeRequest } from './billing.ts';

export interface SubscriptionSeatSyncJob {
  organization_id: string;
  desired_extra_seats: number;
  attempts: number;
  revision: string;
}

interface StripeItem {
  id: string;
  quantity?: number;
  price?: { id?: string };
}

export interface SubscriptionSeatSyncResult {
  synced: boolean;
  skipped: boolean;
  desiredExtraSeats: number;
  stripeQuantity: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur inconnue.';
}

export async function getSubscriptionSeatSyncJob(
  admin: SupabaseClient,
  organizationId: string,
): Promise<SubscriptionSeatSyncJob | null> {
  const { data, error } = await admin
    .from('subscription_seat_sync_jobs')
    .select('organization_id,desired_extra_seats,attempts,revision')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new Error(`File de sièges illisible : ${error.message}`);
  return data as SubscriptionSeatSyncJob | null;
}

export async function synchronizeSubscriptionSeatJob(
  admin: SupabaseClient,
  job: SubscriptionSeatSyncJob,
  requestFetch: typeof fetch = fetch,
  stripeSecretKey?: string,
): Promise<SubscriptionSeatSyncResult> {
  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('provider_subscription_id,plan_code')
    .eq('organization_id', job.organization_id)
    .in('status', ['trialing', 'active', 'past_due'])
    .not('provider_subscription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    throw new Error(`Abonnement illisible : ${subscriptionError.message}`);
  }

  if (!subscription?.provider_subscription_id) {
    return {
      synced: true,
      skipped: true,
      desiredExtraSeats: job.desired_extra_seats,
      stripeQuantity: 0,
    };
  }

  const [{ data: plan, error: planError }, { data: settings, error: settingsError }] =
    await Promise.all([
      admin
        .from('plans')
        .select('stripe_price_id_monthly')
        .eq('code', subscription.plan_code)
        .maybeSingle(),
      admin.from('billing_settings').select('extra_seat_price_id_monthly').maybeSingle(),
    ]);

  if (planError || settingsError) throw new Error('Tarifs Stripe illisibles.');

  const planPriceId = plan?.stripe_price_id_monthly;
  const extraSeatPriceId = settings?.extra_seat_price_id_monthly;
  if (!planPriceId || !extraSeatPriceId) {
    throw new Error(`Tarifs Stripe non configurés pour « ${subscription.plan_code} ».`);
  }

  const remote = (await stripeRequest(
    `/v1/subscriptions/${subscription.provider_subscription_id}`,
    {},
    'GET',
    requestFetch,
    stripeSecretKey,
  )) as { items?: { data?: StripeItem[] } };

  const seatItem = (remote.items?.data ?? []).find((item) => item.price?.id === extraSeatPriceId);
  const proration = { proration_behavior: 'create_prorations' };

  if (job.desired_extra_seats > 0 && seatItem) {
    await stripeRequest(
      `/v1/subscription_items/${seatItem.id}`,
      { quantity: String(job.desired_extra_seats), ...proration },
      'POST',
      requestFetch,
      stripeSecretKey,
    );
  } else if (job.desired_extra_seats > 0) {
    await stripeRequest(
      '/v1/subscription_items',
      {
        subscription: subscription.provider_subscription_id,
        price: extraSeatPriceId,
        quantity: String(job.desired_extra_seats),
        ...proration,
      },
      'POST',
      requestFetch,
      stripeSecretKey,
    );
  } else if (seatItem) {
    await stripeDelete(
      `/v1/subscription_items/${seatItem.id}`,
      proration,
      requestFetch,
      stripeSecretKey,
    );
  }

  const after = (await stripeRequest(
    `/v1/subscriptions/${subscription.provider_subscription_id}`,
    {},
    'GET',
    requestFetch,
    stripeSecretKey,
  )) as { items?: { data?: StripeItem[] } };
  const stripeQuantity =
    (after.items?.data ?? []).find((item) => item.price?.id === extraSeatPriceId)?.quantity ?? 0;

  if (stripeQuantity !== job.desired_extra_seats) {
    throw new Error(
      `Stripe conserve ${stripeQuantity} siège(s) supplémentaire(s), ${job.desired_extra_seats} attendu(s).`,
    );
  }

  return {
    synced: true,
    skipped: false,
    desiredExtraSeats: job.desired_extra_seats,
    stripeQuantity,
  };
}

export async function completeSubscriptionSeatSyncJob(
  admin: SupabaseClient,
  job: SubscriptionSeatSyncJob,
): Promise<void> {
  const { error } = await admin
    .from('subscription_seat_sync_jobs')
    .delete()
    .eq('organization_id', job.organization_id)
    .eq('revision', job.revision);
  if (error) throw new Error(`Tâche de sièges non acquittée : ${error.message}`);
}

export function nextSubscriptionSeatSyncAttempt(attempts: number, now = new Date()): Date {
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(Math.max(attempts, 0), 7));
  return new Date(now.getTime() + delaySeconds * 1000);
}

export async function deferSubscriptionSeatSyncJob(
  admin: SupabaseClient,
  job: SubscriptionSeatSyncJob,
  failure: unknown,
  now = new Date(),
): Promise<void> {
  const attempts = job.attempts + 1;
  const { error } = await admin
    .from('subscription_seat_sync_jobs')
    .update({
      attempts,
      next_attempt_at: nextSubscriptionSeatSyncAttempt(attempts, now).toISOString(),
      locked_at: null,
      last_error: errorMessage(failure).slice(0, 500),
      updated_at: now.toISOString(),
    })
    .eq('organization_id', job.organization_id)
    .eq('revision', job.revision);
  if (error) throw new Error(`Reprise de sièges non planifiée : ${error.message}`);
}
