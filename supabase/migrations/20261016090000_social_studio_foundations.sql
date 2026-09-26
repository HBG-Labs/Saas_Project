-- =============================================================================
-- Social Studio / Instagram Growth Engine — fondations V1
-- =============================================================================
--
-- Migration additive uniquement :
--   - feature gate `social_studio` pour Pro et au-dessus ;
--   - permissions RBAC minimales ;
--   - tables multi-tenant pour compte social, semaine éditoriale, posts et assets ;
--   - bucket privé pour les médias sociaux ;
--   - RLS, grants explicites, triggers d'intégrité.
--
-- Les secrets OAuth, les tentatives de publication et les métriques arrivent
-- dans les phases suivantes. Aucune table existante n'est modifiée destructivement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Feature gate + RBAC
-- -----------------------------------------------------------------------------

insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('pro',        'social_studio', null),
  ('business',   'social_studio', null),
  ('enterprise', 'social_studio', null)
on conflict (plan_code, feature_key) do update
  set limit_value = excluded.limit_value;

insert into public.role_permissions (role, permission) values
  ('owner',   'social.view'),
  ('owner',   'social.manage'),
  ('owner',   'social.publish'),
  ('admin',   'social.view'),
  ('admin',   'social.manage'),
  ('admin',   'social.publish'),
  ('manager', 'social.view'),
  ('manager', 'social.manage')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. Références métier
-- -----------------------------------------------------------------------------

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'instagram',
  provider_account_id text,
  username text,
  display_name text,
  profile_picture_url text,
  status text not null default 'disconnected',
  granted_permissions text[] not null default '{}',
  last_synced_at timestamptz,
  publishing_suspended_at timestamptz,
  publishing_suspended_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_accounts_provider check (provider in ('instagram')),
  constraint social_accounts_status check (
    status in ('disconnected', 'connected', 'needs_reconnect', 'error')
  ),
  constraint social_accounts_username_not_blank check (
    username is null or length(btrim(username)) between 1 and 120
  ),
  constraint social_accounts_provider_id_not_blank check (
    provider_account_id is null or length(btrim(provider_account_id)) between 1 and 180
  )
);

create unique index if not exists social_accounts_one_provider_per_org_idx
  on public.social_accounts (organization_id, provider);

create unique index if not exists social_accounts_provider_account_idx
  on public.social_accounts (provider, provider_account_id)
  where provider_account_id is not null;

create index if not exists social_accounts_organization_status_idx
  on public.social_accounts (organization_id, status);

create table if not exists public.social_weeks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid references public.social_accounts (id) on delete set null,
  starts_on date not null,
  status text not null default 'draft',
  objective text,
  audience text,
  zone text,
  strategy jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_weeks_status check (
    status in ('draft', 'ready', 'scheduled', 'partially_published', 'published', 'cancelled')
  ),
  constraint social_weeks_objective_not_blank check (
    objective is null or length(btrim(objective)) between 1 and 240
  ),
  constraint social_weeks_strategy_object check (jsonb_typeof(strategy) = 'object'),
  constraint social_weeks_scheduled_requires_approval check (
    status not in ('scheduled', 'partially_published', 'published')
    or (approved_by is not null and approved_at is not null)
  )
);

create unique index if not exists social_weeks_unique_week_idx
  on public.social_weeks (organization_id, starts_on);

create index if not exists social_weeks_organization_status_idx
  on public.social_weeks (organization_id, status, starts_on desc);

create index if not exists social_weeks_account_idx
  on public.social_weeks (account_id)
  where account_id is not null;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  week_id uuid references public.social_weeks (id) on delete cascade,
  account_id uuid references public.social_accounts (id) on delete set null,
  slot_index smallint not null,
  status text not null default 'draft',
  format text not null default 'image',
  scheduled_at timestamptz,
  hook text,
  marketing_angle text,
  concept text,
  visual_brief text,
  visual_text text,
  caption text,
  cta text,
  hashtags text[] not null default '{}',
  image_prompt text,
  recommendation_reason text,
  content jsonb not null default '{}'::jsonb,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  published_at timestamptz,
  instagram_media_id text,
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_posts_slot_index check (slot_index between 1 and 7),
  constraint social_posts_status check (
    status in ('draft', 'ready', 'scheduled', 'processing', 'published', 'failed', 'cancelled')
  ),
  constraint social_posts_format check (format in ('image', 'carousel')),
  constraint social_posts_content_object check (jsonb_typeof(content) = 'object'),
  constraint social_posts_ready_has_content check (
    status not in ('ready', 'scheduled', 'processing', 'published')
    or (
      nullif(btrim(coalesce(hook, '')), '') is not null
      and nullif(btrim(coalesce(caption, '')), '') is not null
    )
  ),
  constraint social_posts_scheduled_requires_approval check (
    status not in ('scheduled', 'processing', 'published')
    or (approved_by is not null and approved_at is not null and scheduled_at is not null)
  ),
  constraint social_posts_published_requires_media_id check (
    status <> 'published'
    or (instagram_media_id is not null and published_at is not null)
  )
);

create unique index if not exists social_posts_week_slot_idx
  on public.social_posts (week_id, slot_index)
  where week_id is not null;

create index if not exists social_posts_organization_status_idx
  on public.social_posts (organization_id, status, scheduled_at);

create index if not exists social_posts_account_idx
  on public.social_posts (account_id)
  where account_id is not null;

create table if not exists public.social_post_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  post_id uuid not null references public.social_posts (id) on delete cascade,
  kind text not null default 'source',
  position smallint not null default 1,
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  alt_text text,
  provider text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint social_post_assets_kind check (kind in ('source', 'generated', 'selected')),
  constraint social_post_assets_position check (position between 1 and 10),
  constraint social_post_assets_path_not_blank check (length(btrim(storage_path)) between 1 and 1024),
  constraint social_post_assets_size_positive check (size_bytes is null or size_bytes > 0),
  constraint social_post_assets_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  )
);

create unique index if not exists social_post_assets_storage_path_idx
  on public.social_post_assets (storage_path);

create unique index if not exists social_post_assets_post_position_idx
  on public.social_post_assets (post_id, position);

create index if not exists social_post_assets_organization_idx
  on public.social_post_assets (organization_id, post_id);

-- -----------------------------------------------------------------------------
-- 3. Storage privé pour les médias sociaux
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media-assets',
  'social-media-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "social_media_assets_read" on storage.objects;
create policy "social_media_assets_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'social-media-assets'
    and exists (
      select 1
      from public.social_post_assets asset
      where asset.storage_path = storage.objects.name
    )
  );

drop policy if exists "social_media_assets_upload" on storage.objects;
create policy "social_media_assets_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'social-media-assets'
    and (select app.org_has_feature(((storage.foldername(name))[1])::uuid, 'social_studio'))
    and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'social.manage'))
  );

drop policy if exists "social_media_assets_delete" on storage.objects;
create policy "social_media_assets_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'social-media-assets'
    and (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'social.manage'))
  );

-- -----------------------------------------------------------------------------
-- 4. Triggers d'intégrité
-- -----------------------------------------------------------------------------

create or replace function app.enforce_social_account_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_id is not null and not exists (
    select 1
    from public.social_accounts account
    where account.id = new.account_id
      and account.organization_id = new.organization_id
  ) then
    raise exception 'Le compte social ne correspond pas à l''organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_social_account_scope() from public, anon, authenticated;

create or replace function app.enforce_social_post_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week_org uuid;
  v_week_account uuid;
begin
  if new.week_id is not null then
    select week.organization_id, week.account_id
      into v_week_org, v_week_account
    from public.social_weeks week
    where week.id = new.week_id;

    if v_week_org is null then
      raise exception 'Semaine Social Studio introuvable.' using errcode = 'foreign_key_violation';
    end if;
    if v_week_org <> new.organization_id then
      raise exception 'Le post ne correspond pas à l''organisation de sa semaine.'
        using errcode = 'foreign_key_violation';
    end if;
    if new.account_id is null and v_week_account is not null then
      new.account_id := v_week_account;
    end if;
  end if;

  if new.account_id is not null and not exists (
    select 1
    from public.social_accounts account
    where account.id = new.account_id
      and account.organization_id = new.organization_id
  ) then
    raise exception 'Le post ne correspond pas au compte social de son organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_social_post_scope() from public, anon, authenticated;

create or replace function app.verify_social_post_asset_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := (select auth.uid())::text;
  v_owner text;
  v_mime text;
  v_size text;
  v_post_org uuid;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.post_id is distinct from old.post_id
       or new.storage_path is distinct from old.storage_path
       or new.original_filename is distinct from old.original_filename
       or new.mime_type is distinct from old.mime_type
       or new.size_bytes is distinct from old.size_bytes
       or new.created_by is distinct from old.created_by then
      raise exception 'Le fichier social et ses métadonnées techniques sont immuables.'
        using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  select post.organization_id into v_post_org
  from public.social_posts post
  where post.id = new.post_id;

  if v_post_org is null then
    raise exception 'Post Social Studio introuvable.' using errcode = 'foreign_key_violation';
  end if;
  if v_post_org <> new.organization_id then
    raise exception 'L''asset ne correspond pas à l''organisation de son post.'
      using errcode = 'foreign_key_violation';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.organization_id::text
     or split_part(new.storage_path, '/', 2) <> new.post_id::text then
    raise exception 'Le chemin du média social doit commencer par {organization_id}/{post_id}.'
      using errcode = 'check_violation';
  end if;

  select o.owner_id, o.metadata ->> 'mimetype',
         coalesce(o.metadata ->> 'size', o.metadata ->> 'contentLength')
    into v_owner, v_mime, v_size
  from storage.objects o
  where o.bucket_id = 'social-media-assets'
    and o.name = new.storage_path;

  if not found then
    raise exception 'Le fichier Storage doit exister avant sa référence.'
      using errcode = 'foreign_key_violation';
  end if;
  if v_actor is not null and v_owner is distinct from v_actor then
    raise exception 'Le fichier doit avoir été déposé par l''utilisateur courant.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_mime not in ('image/jpeg', 'image/png', 'image/webp')
     or v_size is null
     or v_size !~ '^[0-9]+$' then
    raise exception 'Le média social doit être une image avec une taille vérifiable.'
      using errcode = 'check_violation';
  end if;

  new.mime_type := v_mime;
  new.size_bytes := v_size::bigint;
  if v_actor is not null then new.created_by := v_actor::uuid; end if;
  return new;
end;
$$;

revoke all on function app.verify_social_post_asset_object() from public, anon, authenticated;

create or replace function app.enforce_social_publish_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_requires_publish boolean := false;
begin
  -- Les workers et Edge Functions internes utilisent service_role : ils n'ont
  -- pas d'utilisateur courant et franchiront les états techniques plus tard.
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_requires_publish :=
      new.status in ('scheduled', 'processing', 'published')
      or new.approved_by is not null
      or new.approved_at is not null;
  elsif tg_op = 'UPDATE' then
    v_requires_publish :=
      (
        new.status is distinct from old.status
        and new.status in ('scheduled', 'processing', 'published')
      )
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at;
  end if;

  if v_requires_publish
     and not (select app.has_org_permission(new.organization_id, 'social.publish')) then
    raise exception 'La validation ou programmation Social Studio exige social.publish.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function app.enforce_social_publish_permission()
  from public, anon, authenticated;

drop trigger if exists social_accounts_set_updated_at on public.social_accounts;
create trigger social_accounts_set_updated_at
  before update on public.social_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists social_accounts_organization_immutable on public.social_accounts;
create trigger social_accounts_organization_immutable
  before update on public.social_accounts
  for each row execute function app.enforce_organization_immutable();

drop trigger if exists social_weeks_set_updated_at on public.social_weeks;
create trigger social_weeks_set_updated_at
  before update on public.social_weeks
  for each row execute function public.set_updated_at();

drop trigger if exists social_weeks_organization_immutable on public.social_weeks;
create trigger social_weeks_organization_immutable
  before update on public.social_weeks
  for each row execute function app.enforce_organization_immutable();

drop trigger if exists social_weeks_account_scope on public.social_weeks;
create trigger social_weeks_account_scope
  before insert or update on public.social_weeks
  for each row execute function app.enforce_social_account_scope();

drop trigger if exists social_weeks_publish_permission on public.social_weeks;
create trigger social_weeks_publish_permission
  before insert or update on public.social_weeks
  for each row execute function app.enforce_social_publish_permission();

drop trigger if exists social_posts_set_updated_at on public.social_posts;
create trigger social_posts_set_updated_at
  before update on public.social_posts
  for each row execute function public.set_updated_at();

drop trigger if exists social_posts_organization_immutable on public.social_posts;
create trigger social_posts_organization_immutable
  before update on public.social_posts
  for each row execute function app.enforce_organization_immutable();

drop trigger if exists social_posts_scope on public.social_posts;
create trigger social_posts_scope
  before insert or update on public.social_posts
  for each row execute function app.enforce_social_post_scope();

drop trigger if exists social_posts_publish_permission on public.social_posts;
create trigger social_posts_publish_permission
  before insert or update on public.social_posts
  for each row execute function app.enforce_social_publish_permission();

drop trigger if exists social_post_assets_organization_immutable on public.social_post_assets;
create trigger social_post_assets_organization_immutable
  before update on public.social_post_assets
  for each row execute function app.enforce_organization_immutable();

drop trigger if exists social_post_assets_verify_object on public.social_post_assets;
create trigger social_post_assets_verify_object
  before insert or update on public.social_post_assets
  for each row execute function app.verify_social_post_asset_object();

-- -----------------------------------------------------------------------------
-- 5. Grants + RLS
-- -----------------------------------------------------------------------------

alter table public.social_accounts enable row level security;
alter table public.social_weeks enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_assets enable row level security;

grant select, insert, update, delete on public.social_accounts to authenticated;
grant select, insert, update, delete on public.social_weeks to authenticated;
grant select, insert, update, delete on public.social_posts to authenticated;
grant select, insert, update, delete on public.social_post_assets to authenticated;

drop policy if exists "social_accounts_select" on public.social_accounts;
create policy "social_accounts_select"
  on public.social_accounts for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.view'))
  );

drop policy if exists "social_accounts_insert" on public.social_accounts;
create policy "social_accounts_insert"
  on public.social_accounts for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_accounts_update" on public.social_accounts;
create policy "social_accounts_update"
  on public.social_accounts for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_accounts_delete" on public.social_accounts;
create policy "social_accounts_delete"
  on public.social_accounts for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_weeks_select" on public.social_weeks;
create policy "social_weeks_select"
  on public.social_weeks for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.view'))
  );

drop policy if exists "social_weeks_insert" on public.social_weeks;
create policy "social_weeks_insert"
  on public.social_weeks for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_weeks_update" on public.social_weeks;
create policy "social_weeks_update"
  on public.social_weeks for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (
      (select app.has_org_permission(organization_id, 'social.manage'))
      or (select app.has_org_permission(organization_id, 'social.publish'))
    )
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (
      (select app.has_org_permission(organization_id, 'social.manage'))
      or (select app.has_org_permission(organization_id, 'social.publish'))
    )
  );

drop policy if exists "social_weeks_delete" on public.social_weeks;
create policy "social_weeks_delete"
  on public.social_weeks for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_posts_select" on public.social_posts;
create policy "social_posts_select"
  on public.social_posts for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.view'))
  );

drop policy if exists "social_posts_insert" on public.social_posts;
create policy "social_posts_insert"
  on public.social_posts for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_posts_update" on public.social_posts;
create policy "social_posts_update"
  on public.social_posts for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (
      (select app.has_org_permission(organization_id, 'social.manage'))
      or (select app.has_org_permission(organization_id, 'social.publish'))
    )
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (
      (select app.has_org_permission(organization_id, 'social.manage'))
      or (select app.has_org_permission(organization_id, 'social.publish'))
    )
  );

drop policy if exists "social_posts_delete" on public.social_posts;
create policy "social_posts_delete"
  on public.social_posts for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_post_assets_select" on public.social_post_assets;
create policy "social_post_assets_select"
  on public.social_post_assets for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.view'))
  );

drop policy if exists "social_post_assets_insert" on public.social_post_assets;
create policy "social_post_assets_insert"
  on public.social_post_assets for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_post_assets_update" on public.social_post_assets;
create policy "social_post_assets_update"
  on public.social_post_assets for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

drop policy if exists "social_post_assets_delete" on public.social_post_assets;
create policy "social_post_assets_delete"
  on public.social_post_assets for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'social_studio'))
    and (select app.has_org_permission(organization_id, 'social.manage'))
  );

-- -----------------------------------------------------------------------------
-- 6. Gardes de cohérence de la migration
-- -----------------------------------------------------------------------------

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.plan_features
  where feature_key = 'social_studio'
    and plan_code in ('pro', 'business', 'enterprise');
  if v_count <> 3 then
    raise exception 'social_studio doit être disponible sur Pro, Business et Enterprise (% lignes).', v_count;
  end if;

  select count(*) into v_count
  from public.role_permissions
  where permission in ('social.view', 'social.manage', 'social.publish');
  if v_count <> 8 then
    raise exception 'Matrice RBAC Social Studio inattendue (% lignes).', v_count;
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'social-media-assets'
      and public
  ) then
    raise exception 'Le bucket social-media-assets doit rester privé.';
  end if;
end
$$;
