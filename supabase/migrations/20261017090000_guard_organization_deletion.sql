-- =============================================================================
-- Suppression d'une organisation : abonnement externe et trace d'audit
-- =============================================================================
--
-- La policy `organizations_delete_owner` réserve déjà DELETE au propriétaire.
-- Ce garde ajoute la contrainte qui ne peut pas rester au frontend : une
-- organisation liée à un abonnement Stripe encore vivant ne doit pas
-- disparaître de REZO360 pendant que la facturation continue chez le provider.
--
-- Les essais internes sans identifiant provider restent supprimables. Les
-- abonnements externes clôturés (`canceled` / `expired`) le sont également.
-- =============================================================================

create or replace function app.guard_organization_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.subscriptions s
    where s.organization_id = old.id
      and s.provider_subscription_id is not null
      and s.status in ('trialing', 'active', 'past_due')
  ) then
    raise exception
      'Résiliez d''abord l''abonnement de cette entreprise et attendez sa clôture effective avant de la supprimer.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

revoke all on function app.guard_organization_deletion() from public, anon, authenticated;

drop trigger if exists organizations_guard_deletion on public.organizations;
create trigger organizations_guard_deletion
  before delete on public.organizations
  for each row execute function app.guard_organization_deletion();

create or replace function app.audit_organization_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.write_audit_log(
    old.id,
    'organization.deleted',
    'organization',
    old.id,
    jsonb_build_object('name', old.name, 'slug', old.slug)
  );

  return old;
end;
$$;

revoke all on function app.audit_organization_deletion() from public, anon, authenticated;

drop trigger if exists organizations_audit_deletion on public.organizations;
create trigger organizations_audit_deletion
  before delete on public.organizations
  for each row execute function app.audit_organization_deletion();
