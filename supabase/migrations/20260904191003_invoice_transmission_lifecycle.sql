-- Cycle de transmission électronique, distinct du statut comptable de la facture.
--
-- Une facture `sent` dans REZO360 peut avoir été remise par e-mail. Inversement,
-- une plateforme peut avoir reçu un document qui n'est pas encore marqué envoyé
-- par l'utilisateur. Mélanger ces deux vérités rendrait les incidents impossibles
-- à diagnostiquer et permettrait à un webhook de modifier un état comptable.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_transmission_status') then
    create type public.invoice_transmission_status as enum (
      'queued',
      'submitting',
      'submitted',
      'delivered',
      'accepted',
      'rejected',
      'failed',
      'cancelled'
    );
  end if;
end
$$;

create table public.invoice_transmissions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null unique references public.invoices(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider_code text not null check (char_length(btrim(provider_code)) between 2 and 80),
  status public.invoice_transmission_status not null default 'queued',
  idempotency_key uuid not null default gen_random_uuid() unique,
  provider_submission_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  submitted_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoice_transmissions_external_id_not_blank
    check (provider_submission_id is null or btrim(provider_submission_id) <> ''),
  constraint invoice_transmissions_failure_has_message
    check (status <> 'failed' or nullif(btrim(last_error_message), '') is not null),
  constraint invoice_transmissions_no_current_error_after_recovery
    check (status = 'failed' or (last_error_code is null and last_error_message is null))
);

create index invoice_transmissions_organization_status_idx
  on public.invoice_transmissions(organization_id, status, updated_at desc);

create index invoice_transmissions_retry_idx
  on public.invoice_transmissions(next_attempt_at)
  where status in ('queued', 'failed') and next_attempt_at is not null;

create table public.invoice_transmission_events (
  id uuid primary key default gen_random_uuid(),
  transmission_id uuid not null references public.invoice_transmissions(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source text not null check (source in ('application', 'provider', 'administration')),
  event_type text not null check (char_length(btrim(event_type)) between 1 and 100),
  normalized_status public.invoice_transmission_status,
  provider_status_code text,
  provider_event_id text,
  message text,
  payload_sha256 text,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),

  constraint invoice_transmission_events_status_not_blank
    check (provider_status_code is null or btrim(provider_status_code) <> ''),
  constraint invoice_transmission_events_provider_id_not_blank
    check (provider_event_id is null or btrim(provider_event_id) <> ''),
  constraint invoice_transmission_events_payload_hash
    check (payload_sha256 is null or payload_sha256 ~ '^[0-9a-f]{64}$')
);

create index invoice_transmission_events_timeline_idx
  on public.invoice_transmission_events(transmission_id, occurred_at desc, recorded_at desc);

create unique index invoice_transmission_events_provider_event_idx
  on public.invoice_transmission_events(transmission_id, provider_event_id)
  where provider_event_id is not null;

create or replace function app.guard_invoice_transmission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  if tg_op = 'DELETE' then
    raise exception 'Une transmission ne peut pas être supprimée : son historique doit être conservé.'
      using errcode = 'restrict_violation';
  end if;

  if tg_op = 'UPDATE' then
    if new.invoice_id is distinct from old.invoice_id
      or new.organization_id is distinct from old.organization_id
      or new.provider_code is distinct from old.provider_code
      or new.idempotency_key is distinct from old.idempotency_key then
      raise exception 'L’identité d’une transmission ne peut pas être modifiée.'
        using errcode = 'restrict_violation';
    end if;

    if old.provider_submission_id is not null
      and new.provider_submission_id is distinct from old.provider_submission_id then
      raise exception 'L’identifiant attribué par la plateforme ne peut pas être remplacé.'
        using errcode = 'restrict_violation';
    end if;

    if new.attempt_count < old.attempt_count then
      raise exception 'Le compteur de tentatives ne peut pas diminuer.'
        using errcode = 'check_violation';
    end if;

    if new.status is distinct from old.status and not (
      (old.status in ('queued', 'submitting', 'failed') and new.status in
        ('queued', 'submitting', 'submitted', 'delivered', 'accepted', 'rejected', 'failed', 'cancelled'))
      or (old.status = 'submitted' and new.status in
        ('delivered', 'accepted', 'rejected', 'failed', 'cancelled'))
      or (old.status = 'delivered' and new.status in ('accepted', 'rejected', 'failed'))
    ) then
      raise exception 'Transition de transmission interdite : % vers %.', old.status, new.status
        using errcode = 'check_violation';
    end if;
  else
    select * into v_invoice from public.invoices where id = new.invoice_id;
    if v_invoice.id is null then
      raise exception 'Facture introuvable.' using errcode = 'foreign_key_violation';
    end if;
    if v_invoice.status not in ('issued', 'sent', 'paid') then
      raise exception 'Seule une facture ou un avoir émis peut être transmis.'
        using errcode = 'check_violation';
    end if;
    new.organization_id := v_invoice.organization_id;
  end if;

  if new.status in ('submitted', 'delivered', 'accepted', 'rejected') then
    new.submitted_at := coalesce(new.submitted_at, now());
  end if;
  if new.status in ('delivered', 'accepted') then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  if new.status in ('accepted', 'rejected', 'cancelled') then
    new.completed_at := coalesce(new.completed_at, now());
    new.next_attempt_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger invoice_transmissions_guard
  before insert or update or delete on public.invoice_transmissions
  for each row execute function app.guard_invoice_transmission();

create or replace function app.guard_invoice_transmission_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Un événement de transmission est immuable.'
      using errcode = 'restrict_violation';
  end if;

  select t.invoice_id, t.organization_id
    into new.invoice_id, new.organization_id
  from public.invoice_transmissions t
  where t.id = new.transmission_id;

  if new.invoice_id is null then
    raise exception 'Transmission introuvable.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger invoice_transmission_events_guard
  before insert or update or delete on public.invoice_transmission_events
  for each row execute function app.guard_invoice_transmission_event();

alter table public.invoice_transmissions enable row level security;
alter table public.invoice_transmission_events enable row level security;

revoke all on public.invoice_transmissions from public, anon, authenticated, service_role;
revoke all on public.invoice_transmission_events from public, anon, authenticated, service_role;
grant select on public.invoice_transmissions, public.invoice_transmission_events to authenticated;
grant select, insert, update on public.invoice_transmissions to service_role;
grant select, insert on public.invoice_transmission_events to service_role;

revoke all on type public.invoice_transmission_status from public, anon;
grant usage on type public.invoice_transmission_status to authenticated, service_role;

create policy "invoice_transmissions_select"
  on public.invoice_transmissions for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.view'))
  );

create policy "invoice_transmission_events_select"
  on public.invoice_transmission_events for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'invoice.view'))
  );

revoke all on function app.guard_invoice_transmission() from public, anon, authenticated;
revoke all on function app.guard_invoice_transmission_event() from public, anon, authenticated;

comment on table public.invoice_transmissions is
  'État opérationnel de l’envoi électronique, séparé du statut comptable de la facture. Écriture serveur uniquement.';
comment on table public.invoice_transmission_events is
  'Journal immuable des événements de transport. Les réponses brutes ne sont pas conservées ici, seulement leur empreinte et les données utiles au suivi.';

do $$
begin
  if not has_table_privilege('authenticated', 'public.invoice_transmissions', 'SELECT')
    or has_table_privilege('authenticated', 'public.invoice_transmissions', 'INSERT')
    or has_table_privilege('authenticated', 'public.invoice_transmission_events', 'INSERT') then
    raise exception 'Les droits du cycle de transmission ne correspondent pas au modèle lecture cliente/écriture serveur.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.invoice_transmissions'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.invoice_transmission_events'::regclass) then
    raise exception 'RLS doit être active sur les tables de transmission.';
  end if;
end
$$;
