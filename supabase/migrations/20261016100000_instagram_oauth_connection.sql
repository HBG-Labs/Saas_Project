-- =============================================================================
-- Social Studio / Instagram — connexion OAuth serveur
-- =============================================================================
--
-- Migration additive uniquement :
--   - métadonnées publiques non sensibles sur social_accounts ;
--   - credentials et états OAuth dans le schéma app, sans grant navigateur ;
--   - RPC service_role pour terminer/déconnecter une connexion en transaction ;
--   - RPC authenticated pour vérifier le droit de gestion depuis l'Edge Function.
-- =============================================================================

alter table public.social_accounts
  add column if not exists account_type text,
  add column if not exists connected_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text;

alter table public.social_accounts
  add constraint social_accounts_account_type_not_blank
  check (account_type is null or length(btrim(account_type)) between 1 and 80)
  not valid;

alter table public.social_accounts
  validate constraint social_accounts_account_type_not_blank;

create table if not exists app.social_account_credentials (
  account_id uuid primary key references public.social_accounts (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'instagram',
  provider_account_id text not null,
  access_token_ciphertext text not null,
  token_type text,
  access_token_expires_at timestamptz not null,
  granted_permissions text[] not null default '{}',
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_credentials_provider check (provider = 'instagram'),
  constraint social_credentials_provider_id_not_blank check (length(btrim(provider_account_id)) between 1 and 180),
  constraint social_credentials_token_not_blank check (length(btrim(access_token_ciphertext)) > 20),
  constraint social_credentials_expires_future check (access_token_expires_at > created_at)
);

create index if not exists social_credentials_org_idx
  on app.social_account_credentials (organization_id);

create table if not exists app.social_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_sha256 text not null unique check (state_sha256 ~ '^[0-9a-f]{64}$'),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  return_url text not null check (
    char_length(return_url) between 10 and 2048
    and return_url ~ '^https://'
  ),
  scopes text[] not null default '{}',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint social_oauth_state_short_lived
    check (expires_at > created_at and expires_at <= created_at + interval '15 minutes')
);

create index if not exists social_oauth_states_expiry_idx
  on app.social_oauth_states (expires_at)
  where consumed_at is null;

alter table app.social_account_credentials enable row level security;
alter table app.social_oauth_states enable row level security;

revoke all on app.social_account_credentials from public, anon, authenticated, service_role;
revoke all on app.social_oauth_states from public, anon, authenticated, service_role;
grant select, insert, update, delete on app.social_account_credentials to service_role;
grant select, insert, update, delete on app.social_oauth_states to service_role;

drop trigger if exists social_credentials_set_updated_at on app.social_account_credentials;
create trigger social_credentials_set_updated_at
  before update on app.social_account_credentials
  for each row execute function public.set_updated_at();

create or replace function public.can_manage_social_connection(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.can_use_pro_module(p_organization_id, 'social_studio')
    and app.has_org_permission(p_organization_id, 'social.publish')
$$;

revoke all on function public.can_manage_social_connection(uuid) from public, anon;
grant execute on function public.can_manage_social_connection(uuid) to authenticated, service_role;

create or replace function public.complete_instagram_connection(
  p_organization_id uuid,
  p_user_id uuid,
  p_provider_account_id text,
  p_username text,
  p_display_name text,
  p_profile_picture_url text,
  p_account_type text,
  p_granted_permissions text[],
  p_access_token_ciphertext text,
  p_token_type text,
  p_access_token_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
begin
  if not app.can_use_pro_module(p_organization_id, 'social_studio') then
    raise exception 'Social Studio n''est pas disponible pour cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.social_accounts (
    organization_id,
    provider,
    provider_account_id,
    username,
    display_name,
    profile_picture_url,
    account_type,
    status,
    granted_permissions,
    last_synced_at,
    connected_by,
    connected_at,
    publishing_suspended_at,
    publishing_suspended_by,
    last_error_code,
    last_error_message
  )
  values (
    p_organization_id,
    'instagram',
    p_provider_account_id,
    nullif(btrim(coalesce(p_username, '')), ''),
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_profile_picture_url, '')), ''),
    nullif(btrim(coalesce(p_account_type, '')), ''),
    'connected',
    coalesce(p_granted_permissions, '{}'::text[]),
    now(),
    p_user_id,
    now(),
    null,
    null,
    null,
    null
  )
  on conflict (organization_id, provider) do update set
    provider_account_id = excluded.provider_account_id,
    username = excluded.username,
    display_name = excluded.display_name,
    profile_picture_url = excluded.profile_picture_url,
    account_type = excluded.account_type,
    status = 'connected',
    granted_permissions = excluded.granted_permissions,
    last_synced_at = now(),
    connected_by = p_user_id,
    connected_at = coalesce(public.social_accounts.connected_at, now()),
    publishing_suspended_at = null,
    publishing_suspended_by = null,
    last_error_code = null,
    last_error_message = null
  returning id into v_account_id;

  insert into app.social_account_credentials (
    account_id,
    organization_id,
    provider,
    provider_account_id,
    access_token_ciphertext,
    token_type,
    access_token_expires_at,
    granted_permissions,
    refreshed_at
  )
  values (
    v_account_id,
    p_organization_id,
    'instagram',
    p_provider_account_id,
    p_access_token_ciphertext,
    p_token_type,
    p_access_token_expires_at,
    coalesce(p_granted_permissions, '{}'::text[]),
    now()
  )
  on conflict (account_id) do update set
    organization_id = excluded.organization_id,
    provider_account_id = excluded.provider_account_id,
    access_token_ciphertext = excluded.access_token_ciphertext,
    token_type = excluded.token_type,
    access_token_expires_at = excluded.access_token_expires_at,
    granted_permissions = excluded.granted_permissions,
    refreshed_at = now();

  return v_account_id;
end;
$$;

revoke all on function public.complete_instagram_connection(
  uuid, uuid, text, text, text, text, text, text[], text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_instagram_connection(
  uuid, uuid, text, text, text, text, text, text[], text, text, timestamptz
) to service_role;

create or replace function public.disconnect_instagram_connection(
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
begin
  select id into v_account_id
  from public.social_accounts
  where organization_id = p_organization_id
    and provider = 'instagram';

  if v_account_id is null then
    return false;
  end if;

  delete from app.social_account_credentials
  where account_id = v_account_id;

  update public.social_accounts
  set status = 'disconnected',
      publishing_suspended_at = now(),
      publishing_suspended_by = p_user_id,
      connected_at = null,
      last_synced_at = now(),
      last_error_code = null,
      last_error_message = null
  where id = v_account_id;

  return true;
end;
$$;

revoke all on function public.disconnect_instagram_connection(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.disconnect_instagram_connection(uuid, uuid) to service_role;

comment on table app.social_account_credentials is
  'Credentials Instagram chiffres. Aucun grant navigateur ; lecture/ecriture uniquement par Edge Functions service_role.';
comment on table app.social_oauth_states is
  'Etats OAuth Instagram hashes, expirables et single-use. Aucun grant navigateur.';

do $$
begin
  if has_table_privilege('authenticated', 'app.social_account_credentials', 'SELECT')
     or has_table_privilege('authenticated', 'app.social_oauth_states', 'SELECT')
     or has_table_privilege('anon', 'app.social_account_credentials', 'SELECT')
     or has_table_privilege('anon', 'app.social_oauth_states', 'SELECT') then
    raise exception 'Les credentials et states Instagram ne doivent jamais être lisibles par le navigateur.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.complete_instagram_connection(uuid,uuid,text,text,text,text,text,text[],text,text,timestamptz)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.disconnect_instagram_connection(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Les RPC de credentials Instagram doivent rester service_role uniquement.';
  end if;
end
$$;
