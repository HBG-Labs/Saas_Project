-- =============================================================================
-- Resynchroniser les sieges quand l'abonnement Stripe change
-- =============================================================================
--
-- La file durable est deja actualisee lors des changements de membres. Le
-- nombre de sieges supplementaires depend toutefois aussi de la formule : une
-- montee ou une descente de plan change le nombre de sieges inclus sans toucher
-- a organization_members. Une creation ou une mise a jour d'abonnement Stripe
-- doit donc recalculer la quantite a transmettre au fournisseur.

create trigger subscriptions_enqueue_seat_sync_insert
  after insert on public.subscriptions
  for each row
  when (new.provider_subscription_id is not null)
  execute function app.enqueue_subscription_seat_sync();

create trigger subscriptions_enqueue_seat_sync_update
  after update of plan_code, status, provider_subscription_id
  on public.subscriptions
  for each row
  when (
    (
      old.plan_code is distinct from new.plan_code
      or old.status is distinct from new.status
      or old.provider_subscription_id is distinct from new.provider_subscription_id
    )
    and (
      old.provider_subscription_id is not null
      or new.provider_subscription_id is not null
    )
  )
  execute function app.enqueue_subscription_seat_sync();

create trigger subscriptions_enqueue_seat_sync_delete
  after delete on public.subscriptions
  for each row
  when (old.provider_subscription_id is not null)
  execute function app.enqueue_subscription_seat_sync();

comment on function app.enqueue_subscription_seat_sync() is
  'Actualise atomiquement la file Stripe apres changement de membre ou d abonnement.';
