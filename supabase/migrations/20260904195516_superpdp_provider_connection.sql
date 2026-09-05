-- Connexion d'une organisation a une plateforme agreee.
--
-- Les jetons OAuth restent dans la base pour permettre aux fonctions Edge de
-- reprendre un traitement, mais ils sont chiffres avant insertion et aucune
-- colonne sensible n'est accordee au role authenticated.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'einvoicing_connection_status') then
    create type public.einvoicing_connection_status as enum (
      'pending_verification',
      'connected',
      'action_required',
      'disconnected'
    );
  end if;
end
$$;

create table public.einvoicing_provider_connections (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider_code text not null default 'superpdp' check (provider_code = 'superpdp'),
  status public.einvoicing_connection_status not null default 'pending_verification',
  provider_company_id text,
  provider_environment text check (provider_environment in ('sandbox', 'production')),
  company_verification_status text
    check (company_verification_status in ('verified', 'needs_review', 'failed')),
  user_identity_verification_status text
    check (user_identity_verification_status in ('verified', 'needs_review', 'failed', 'not_verified')),
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  access_token_expires_at timestamptz,
  token_type text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint einvoicing_provider_company_not_blank
    check (provider_company_id is null or btrim(provider_company_id) <> ''),
  constraint einvoicing_tokens_are_a_pair
    check ((access_token_ciphertext is null) = (refresh_token_ciphertext is null)),
  constraint einvoicing_active_connection_has_tokens
    check (
      status = 'disconnected'
      or (access_token_ciphertext is not null and access_token_expires_at is not null)
    ),
  constraint einvoicing_connected_is_verified
    check (status <> 'connected' or company_verification_status = 'verified'),
  constraint einvoicing_disconnected_has_no_tokens
    check (
      status <> 'disconnected'
      or (
        access_token_ciphertext is null
        and refresh_token_ciphertext is null
        and access_token_expires_at is null
      )
    )
);

create table public.einvoicing_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_sha256 text not null unique check (state_sha256 ~ '^[0-9a-f]{64}$'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_url text not null check (
    char_length(return_url) between 10 and 2048
    and return_url ~ '^https?://'
  ),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint einvoicing_oauth_state_short_lived
    check (expires_at > created_at and expires_at <= created_at + interval '15 minutes')
);

create index einvoicing_oauth_states_expiry_idx
  on public.einvoicing_oauth_states(expires_at)
  where consumed_at is null;

create unique index invoice_transmissions_provider_submission_idx
  on public.invoice_transmissions(provider_code, provider_submission_id)
  where provider_submission_id is not null;

create or replace function app.guard_einvoicing_provider_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
      or new.provider_code is distinct from old.provider_code
      or new.created_at is distinct from old.created_at then
      raise exception 'L''identite de la connexion ne peut pas etre modifiee.'
        using errcode = 'restrict_violation';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger einvoicing_provider_connections_guard
  before insert or update on public.einvoicing_provider_connections
  for each row execute function app.guard_einvoicing_provider_connection();

create or replace function public.can_manage_einvoicing_connection(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.can_use_pro_module(p_organization_id, 'invoicing')
    and app.has_org_permission(p_organization_id, 'organization.update')
$$;

create or replace function public.can_transmit_invoice(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.invoices i
    where i.id = p_invoice_id
      and i.status in ('issued', 'sent', 'paid')
      and i.customer_type = 'company'
      and app.can_use_pro_module(i.organization_id, 'invoicing')
      and app.has_org_permission(i.organization_id, 'invoice.manage')
  )
$$;

alter table public.einvoicing_provider_connections enable row level security;
alter table public.einvoicing_oauth_states enable row level security;

revoke all on public.einvoicing_provider_connections from public, anon, authenticated, service_role;
revoke all on public.einvoicing_oauth_states from public, anon, authenticated, service_role;

grant select (
  organization_id,
  provider_code,
  status,
  provider_company_id,
  provider_environment,
  company_verification_status,
  user_identity_verification_status,
  connected_at,
  last_verified_at,
  last_error_code,
  last_error_message,
  created_at,
  updated_at
) on public.einvoicing_provider_connections to authenticated;
grant all on public.einvoicing_provider_connections, public.einvoicing_oauth_states to service_role;

revoke all on type public.einvoicing_connection_status from public, anon;
grant usage on type public.einvoicing_connection_status to authenticated, service_role;

create policy einvoicing_provider_connections_select
  on public.einvoicing_provider_connections for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'invoicing'))
    and (select app.has_org_permission(organization_id, 'organization.view'))
  );

revoke all on function app.guard_einvoicing_provider_connection() from public, anon, authenticated;
revoke all on function public.can_manage_einvoicing_connection(uuid) from public, anon;
revoke all on function public.can_transmit_invoice(uuid) from public, anon;
grant execute on function public.can_manage_einvoicing_connection(uuid) to authenticated, service_role;
grant execute on function public.can_transmit_invoice(uuid) to authenticated, service_role;

comment on table public.einvoicing_provider_connections is
  'Connexion OAuth d''une organisation a sa plateforme agreee. Les jetons sont chiffres par les fonctions Edge et ne sont jamais lisibles par le navigateur.';
comment on table public.einvoicing_oauth_states is
  'Etats OAuth a usage unique, conserves au plus quinze minutes. Ecriture et lecture service_role uniquement.';

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.einvoicing_provider_connections'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.einvoicing_oauth_states'::regclass) then
    raise exception 'RLS doit etre active sur les tables de connexion.';
  end if;
  if has_column_privilege('authenticated', 'public.einvoicing_provider_connections', 'access_token_ciphertext', 'SELECT')
    or has_column_privilege('authenticated', 'public.einvoicing_provider_connections', 'refresh_token_ciphertext', 'SELECT')
    or has_table_privilege('authenticated', 'public.einvoicing_oauth_states', 'SELECT') then
    raise exception 'Les secrets OAuth ne doivent jamais etre lisibles par authenticated.';
  end if;
end
$$;
