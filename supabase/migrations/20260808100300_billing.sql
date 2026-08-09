-- =============================================================================
-- Abonnements et entitlements
-- =============================================================================
-- Le §13 impose de ne pas disperser les limitations. Aujourd'hui elles vivent
-- dans deux fichiers TypeScript (`config/pricing.ts` et `history/types.ts`) et
-- s'appliquent... dans un `useState` du navigateur. Concrètement, un bouton du
-- composant `ScientificCalculatorTool` fait passer l'utilisateur en plan Pro.
--
-- La chaîne devient :
--
--     subscription → plan → plan_features → policies RLS
--
-- Ce qui change réellement : un droit refusé l'est par PostgreSQL. Modifier la
-- variable côté client ne donne plus rien, puisque le serveur ne renvoie
-- simplement pas les lignes.
--
-- `config/pricing.ts` reste la source du CONTENU MARKETING (prix affiché,
-- arguments de vente). Il ne décide plus d'aucun droit.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'trialing', 'active', 'past_due', 'canceled', 'expired'
    );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- plans
-- -----------------------------------------------------------------------------
-- La clé est le `code` textuel et non un UUID : il est stable, lisible dans les
-- logs, et correspond aux identifiants déjà utilisés côté marketing.
create table if not exists public.plans (
  code           text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  name           text not null,
  description    text,
  -- Prix en CENTIMES, entier. Jamais de flottant pour de la monnaie : 14.99
  -- n'est pas représentable exactement en binaire et les écarts s'accumulent.
  price_monthly_cents integer not null default 0 check (price_monthly_cents >= 0),
  price_annual_cents  integer not null default 0 check (price_annual_cents >= 0),
  currency       text not null default 'EUR' check (char_length(currency) = 3),
  -- Un plan destiné aux organisations ne peut pas être souscrit par un
  -- particulier, et réciproquement. Cette colonne le formalise.
  is_organization_plan boolean not null default false,
  sort_order     integer not null default 0,
  status         public.content_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- plan_features
-- -----------------------------------------------------------------------------
-- `limit_value` : NULL = illimité, 0 = interdit, n > 0 = quota.
-- Le booléen « la fonctionnalité est-elle présente » se lit par l'existence de
-- la ligne ; le quota, par la valeur. Deux notions, une table.
create table if not exists public.plan_features (
  plan_code   text not null references public.plans (code) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_]*$'),
  limit_value integer check (limit_value is null or limit_value >= 0),
  primary key (plan_code, feature_key)
);

comment on column public.plan_features.limit_value is
  'NULL = illimité · 0 = explicitement interdit · n > 0 = quota. L''absence de ligne vaut absence de la fonctionnalité.';

-- -----------------------------------------------------------------------------
-- subscriptions
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),

  -- Un abonnement porte SOIT sur un particulier, SOIT sur une organisation.
  -- La contrainte XOR ci-dessous rend l'ambiguïté impossible : sans elle, une
  -- ligne renseignant les deux rendrait la facturation indéterminée.
  user_id         uuid references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,

  plan_code       text not null references public.plans (code) on delete restrict,
  status          public.subscription_status not null default 'trialing',

  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  trial_ends_at        timestamptz,
  canceled_at          timestamptz,

  -- Références du prestataire de paiement. Nullables : l'abonnement gratuit
  -- n'en a pas, et le plan d'essai est créé avant tout passage en caisse.
  provider              text,
  provider_customer_id  text,
  provider_subscription_id text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint subscriptions_subject_xor check (
    (user_id is not null and organization_id is null)
    or (user_id is null and organization_id is not null)
  )
);

-- Un seul abonnement vivant par sujet. Sans cette contrainte, deux abonnements
-- actifs simultanés rendraient les droits dépendants de l'ordre de lecture.
create unique index if not exists subscriptions_active_user_idx
  on public.subscriptions (user_id)
  where user_id is not null and status in ('trialing', 'active', 'past_due');

create unique index if not exists subscriptions_active_org_idx
  on public.subscriptions (organization_id)
  where organization_id is not null and status in ('trialing', 'active', 'past_due');

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Cache dénormalisé du plan sur l'organisation
-- -----------------------------------------------------------------------------
-- §5 demande `subscription_plan` sur l'organisation. C'est également une
-- optimisation : les policies des missions consultent le plan à chaque ligne
-- évaluée, et une jointure vers `subscriptions` à chaque fois coûterait cher.
--
-- La source de vérité reste `subscriptions` ; cette colonne en est un reflet
-- maintenu par trigger, jamais écrit par le client.
alter table public.organizations
  add column if not exists plan_code text references public.plans (code) on delete set null;

comment on column public.organizations.plan_code is
  'CACHE dénormalisé de l''abonnement actif. Maintenu par trigger depuis `subscriptions` — ne jamais écrire directement.';

-- =============================================================================
-- SEED DES PLANS
-- =============================================================================
-- ⚠️ CONTREPARTIE SQL DE src/features/billing/entitlements.ts.
-- `entitlements.test.ts` compare les deux. Les prix restent alignés sur
-- `src/config/pricing.ts` (14,99 € et 39,99 €).
insert into public.plans (code, name, description, price_monthly_cents, price_annual_cents, is_organization_plan, sort_order) values
  ('free', 'Gratuit', 'Découverte de la plateforme et usage étudiant.', 0, 0, false, 10),
  ('pro', 'Pro', 'Techniciens et ingénieurs en activité.', 1499, 14900, false, 20),
  ('business', 'Entreprise', 'Bureaux d''études et équipes terrain : organisations, équipes, missions et contrôle des interventions.', 3999, 39900, true, 30)
on conflict (code) do update set
  name                = excluded.name,
  description         = excluded.description,
  price_monthly_cents = excluded.price_monthly_cents,
  price_annual_cents  = excluded.price_annual_cents,
  is_organization_plan = excluded.is_organization_plan,
  sort_order          = excluded.sort_order;

delete from public.plan_features;

insert into public.plan_features (plan_code, feature_key, limit_value) values
  -- ------------------------------------------------------------------ free
  ('free', 'catalog_access',      null),
  ('free', 'calculation_history', 10),   -- remplace PLAN_HISTORY_LIMITS.free
  ('free', 'favorites',           3),

  -- ------------------------------------------------------------------- pro
  ('pro', 'catalog_access',       null),
  ('pro', 'calculation_history',  null),
  ('pro', 'favorites',            null),
  ('pro', 'pro_tools',            null),  -- outils en visibility = 'pro'
  ('pro', 'export_pdf',           null),
  ('pro', 'export_csv',           null),

  -- -------------------------------------------------------------- business
  -- Le module professionnel du §3 est intégralement porté par ce plan.
  ('business', 'catalog_access',      null),
  ('business', 'calculation_history', null),
  ('business', 'favorites',           null),
  ('business', 'pro_tools',           null),
  ('business', 'export_pdf',          null),
  ('business', 'export_csv',          null),
  ('business', 'organizations',       null),
  ('business', 'teams',               null),
  ('business', 'members',             25),  -- quota, relevable par avenant
  ('business', 'missions',            null),
  ('business', 'interventions',       null),
  ('business', 'intervention_review', null),
  ('business', 'audit_log',           null),
  ('business', 'statistics',          null),
  ('business', 'attachments',         null);

-- =============================================================================
-- FONCTIONS D'ENTITLEMENT
-- =============================================================================

-- Plan effectif d'une organisation. Un abonnement `past_due` conserve ses
-- droits : couper l'accès terrain d'une entreprise sur un incident de
-- prélèvement ferait plus de dégâts commerciaux que l'impayé lui-même. Les
-- statuts `canceled` et `expired`, eux, ne donnent plus rien.
create or replace function app.org_plan_code(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.plan_code
  from public.subscriptions s
  where s.organization_id = p_organization_id
    and s.status in ('trialing', 'active', 'past_due')
    and (s.current_period_end is null or s.current_period_end > now())
  order by s.created_at desc
  limit 1;
$$;

create or replace function app.org_has_feature(p_organization_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plan_features f
    where f.plan_code = app.org_plan_code(p_organization_id)
      and f.feature_key = p_feature_key
      -- 0 = fonctionnalité explicitement interdite, malgré la présence de la ligne.
      and (f.limit_value is null or f.limit_value > 0)
  );
$$;

-- Quota d'une fonctionnalité. `null` = illimité ou absent : l'appelant lève
-- l'ambiguïté avec `org_has_feature()`.
create or replace function app.org_feature_limit(p_organization_id uuid, p_feature_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select f.limit_value
  from public.plan_features f
  where f.plan_code = app.org_plan_code(p_organization_id)
    and f.feature_key = p_feature_key;
$$;

-- Équivalent pour un particulier. Sans abonnement, tout utilisateur connecté
-- relève du plan `free` — le défaut est explicite plutôt qu'implicite.
create or replace function app.user_plan_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan_code
     from public.subscriptions s
     where s.user_id = (select auth.uid())
       and s.status in ('trialing', 'active', 'past_due')
       and (s.current_period_end is null or s.current_period_end > now())
     order by s.created_at desc
     limit 1),
    'free'
  );
$$;

create or replace function app.user_has_feature(p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plan_features f
    where f.plan_code = app.user_plan_code()
      and f.feature_key = p_feature_key
      and (f.limit_value is null or f.limit_value > 0)
  );
$$;

-- Droit d'accès au module professionnel : appartenance ET abonnement.
-- Les deux conditions, jamais l'une sans l'autre. Toutes les policies des
-- migrations suivantes passent par cette fonction.
create or replace function app.can_use_pro_module(p_organization_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_org_member(p_organization_id)
     and app.org_has_feature(p_organization_id, p_feature_key);
$$;

revoke all on function app.org_plan_code(uuid) from public, anon;
revoke all on function app.org_has_feature(uuid, text) from public, anon;
revoke all on function app.org_feature_limit(uuid, text) from public, anon;
revoke all on function app.user_plan_code() from public, anon;
revoke all on function app.user_has_feature(text) from public;
revoke all on function app.can_use_pro_module(uuid, text) from public, anon;

-- `user_has_feature` est la SEULE fonction accordée à `anon`, parce que la
-- policy de `tools` l'évalue pour les visiteurs non connectés. PostgreSQL ne
-- garantit pas le court-circuit d'un `or` dans une policy : sans ce droit,
-- un visiteur anonyme déclencherait « permission denied for function » au lieu
-- de simplement ne pas voir les outils réservés. L'exposition est nulle — sans
-- session, `auth.uid()` est NULL, le plan retombe sur `free`, et la réponse est
-- invariablement `false`.
grant execute on function app.user_has_feature(text) to anon;

grant execute on function app.org_plan_code(uuid) to authenticated;
grant execute on function app.org_has_feature(uuid, text) to authenticated;
grant execute on function app.org_feature_limit(uuid, text) to authenticated;
grant execute on function app.user_plan_code() to authenticated;
grant execute on function app.user_has_feature(text) to authenticated;
grant execute on function app.can_use_pro_module(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Synchronisation du cache `organizations.plan_code`
-- -----------------------------------------------------------------------------
create or replace function app.sync_organization_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
begin
  if v_org is not null then
    update public.organizations
    set plan_code = app.org_plan_code(v_org)
    where id = v_org;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists subscriptions_sync_org_plan on public.subscriptions;
create trigger subscriptions_sync_org_plan
  after insert or update or delete on public.subscriptions
  for each row execute function app.sync_organization_plan();

-- -----------------------------------------------------------------------------
-- Quota de membres
-- -----------------------------------------------------------------------------
-- Un quota appliqué uniquement par l'interface n'est pas un quota. Ce trigger
-- le rend effectif au niveau du moteur, quel que soit le chemin d'écriture.
create or replace function app.enforce_member_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := app.org_feature_limit(new.organization_id, 'members');
  v_count integer;
begin
  if v_limit is null then
    return new;  -- illimité, ou plan sans quota déclaré
  end if;

  select count(*) into v_count
  from public.organization_members
  where organization_id = new.organization_id
    and status in ('active', 'invited')
    and id <> new.id;

  if v_count >= v_limit then
    raise exception
      'Limite de % membres atteinte pour votre abonnement. Contactez-nous pour relever ce quota.', v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_enforce_quota on public.organization_members;
create trigger organization_members_enforce_quota
  before insert on public.organization_members
  for each row execute function app.enforce_member_quota();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.plans         enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;

-- Le catalogue tarifaire est public : la page « Tarifs » doit s'afficher sans
-- compte. Aucune policy d'écriture — les plans s'administrent par migration.
drop policy if exists "plans_select_public" on public.plans;
create policy "plans_select_public"
  on public.plans for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "plan_features_select_public" on public.plan_features;
create policy "plan_features_select_public"
  on public.plan_features for select
  to anon, authenticated
  using (true);

-- Un abonnement se lit par son sujet : le particulier concerné, ou les membres
-- de l'organisation habilités à voir la facturation.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (organization_id is not null
        and (select app.has_org_permission(organization_id, 'billing.view')))
  );

-- AUCUNE policy insert/update/delete, délibérément.
--
-- Un abonnement se crée et se modifie depuis le prestataire de paiement, via
-- un webhook serveur utilisant `service_role`. Autoriser le client à écrire
-- dans cette table reviendrait à lui laisser s'attribuer le plan `business` :
-- toute la chaîne d'entitlements s'effondrerait. C'est la table la plus
-- sensible du schéma, et la seule totalement fermée en écriture.

-- =============================================================================
-- Visibilité des outils réservés aux abonnés
-- =============================================================================
-- Remplace la policy posée par `catalog_v2`, qui masquait les outils `pro`
-- faute de savoir les évaluer.
drop policy if exists "tools_select_visible" on public.tools;
create policy "tools_select_visible"
  on public.tools for select
  to anon, authenticated
  using (
    status = 'active'
    and (
      visibility = 'public'
      or (visibility = 'authenticated' and (select auth.uid()) is not null)
      or (visibility = 'pro' and (select app.user_has_feature('pro_tools')))
    )
  );
