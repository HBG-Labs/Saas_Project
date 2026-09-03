-- =============================================================================
-- Assistant IA — conversations, messages et consommation
-- =============================================================================
--
-- L'historique de conversation vit aujourd'hui dans un `useState` React : perdu
-- au moindre rechargement, jamais consultable après coup. Cette migration lui
-- donne une persistance serveur, et pose `ai_usage` — la table qui permettra à
-- la Edge Function de refuser une requête au-delà du quota du plan, au lieu de
-- consommer sans limite un modèle facturé au token.
--
-- Une conversation est strictement PERSONNELLE : personne d'autre que son
-- auteur, y compris un propriétaire d'organisation, n'y a accès. C'est un
-- chat, pas un registre d'entreprise — contrairement aux devis ou aux
-- missions, rien ici ne justifie qu'un responsable consulte les questions
-- d'un technicien à l'assistant.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permission
-- -----------------------------------------------------------------------------
-- Interroger l'assistant n'est pas un privilège de gestion : c'est le
-- technicien sur le terrain qui en a le plus l'usage. Accordée à tous les
-- rôles — le vrai frein est le quota du plan (`ai_assistant` dans
-- `plan_features`), pas le rôle.
insert into public.role_permissions (role, permission) values
  ('owner',       'ai.use'),
  ('admin',       'ai.use'),
  ('manager',     'ai.use'),
  ('team_leader', 'ai.use'),
  ('technician',  'ai.use'),
  ('employee',    'ai.use')
on conflict (role, permission) do nothing;

-- -----------------------------------------------------------------------------
-- ai_conversations
-- -----------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null default 'Nouvelle conversation',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx
  on public.ai_conversations (organization_id, user_id, updated_at desc);

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

drop trigger if exists ai_conversations_organization_immutable on public.ai_conversations;
create trigger ai_conversations_organization_immutable
  before update on public.ai_conversations
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- ai_messages
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_message_role') then
    create type public.ai_message_role as enum ('user', 'assistant', 'system');
  end if;
end
$$;

-- `organization_id` et `user_id` sont dénormalisés depuis la conversation
-- parente et ÉCRASÉS PAR TRIGGER — même geste que `quote_items`. Le message
-- « assistant » n'a pas d'auteur propre : il hérite de l'utilisateur de la
-- conversation, ce qui garde la policy de lecture simple (un seul champ à
-- comparer) sans rien changer à qui peut voir quoi.
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.ai_message_role not null,
  content         text not null,
  -- [{ "document_id": "...", "title": "...", "page": 12, "similarity": 0.87 }]
  -- `null` tant qu'aucune source documentaire n'a été utilisée — jamais un
  -- tableau vide présenté comme « sources consultées ».
  sources         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

create or replace function app.enforce_ai_message_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select c.organization_id, c.user_id into new.organization_id, new.user_id
  from public.ai_conversations c
  where c.id = new.conversation_id;

  if new.organization_id is null then
    raise exception 'Conversation introuvable.' using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists ai_messages_enforce_org on public.ai_messages;
create trigger ai_messages_enforce_org
  before insert on public.ai_messages
  for each row execute function app.enforce_ai_message_org();

-- -----------------------------------------------------------------------------
-- ai_usage
-- -----------------------------------------------------------------------------
-- Une ligne par appel au modèle réellement effectué. Sert au quota mensuel
-- (`app.ai_quota_status` ci-dessous) et, plus tard, à un tableau de bord de
-- coût. `request_type` distingue le futur usage « données métier » de la
-- discussion documentaire, sans exiger une nouvelle colonne le jour où il
-- apparaîtra.
create table if not exists public.ai_usage (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  request_type    text not null default 'chat',
  input_tokens    integer not null default 0 check (input_tokens >= 0),
  output_tokens   integer not null default 0 check (output_tokens >= 0),
  estimated_cost  numeric(10, 6) not null default 0 check (estimated_cost >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists ai_usage_organization_month_idx
  on public.ai_usage (organization_id, created_at);

-- -----------------------------------------------------------------------------
-- Quota mensuel
-- -----------------------------------------------------------------------------
-- Compte les requêtes du mois CIVIL en cours, pas une fenêtre glissante de 30
-- jours : plus simple à expliquer à un client (« 100 requêtes par mois »,
-- remis à zéro le 1er), et cohérent avec la facturation par mois calendaire.
--
-- `unlimited = true` quand `plan_features.limit_value` est `null` pour cette
-- organisation — même convention que le reste de la matrice d'entitlements.
create or replace function app.ai_quota_status(p_organization_id uuid)
returns table (
  used integer,
  quota_limit integer,
  remaining integer,
  unlimited boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_used  integer;
begin
  if not app.is_org_member(p_organization_id) then
    return;
  end if;

  v_limit := app.org_feature_limit(p_organization_id, 'ai_assistant');

  select count(*) into v_used
  from public.ai_usage
  where organization_id = p_organization_id
    and created_at >= date_trunc('month', now());

  return query select
    v_used,
    v_limit,
    case when v_limit is null then null else greatest(v_limit - v_used, 0) end,
    v_limit is null;
end;
$$;

revoke all on function app.ai_quota_status(uuid) from public, anon;
grant execute on function app.ai_quota_status(uuid) to authenticated;

comment on function app.ai_quota_status(uuid) is
  'Consommation IA du mois civil en cours pour une organisation, comparee au plafond du plan. Appelee par la Edge Function ai-assistant avant tout appel au modele.';

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array['ai_conversations', 'ai_messages', 'ai_usage'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end
$$;

-- ---------------------------------------------------------- ai_conversations
grant select, insert, update, delete on public.ai_conversations to authenticated;

drop policy if exists "ai_conversations_select" on public.ai_conversations;
create policy "ai_conversations_select"
  on public.ai_conversations for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "ai_conversations_insert" on public.ai_conversations;
create policy "ai_conversations_insert"
  on public.ai_conversations for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select app.can_use_pro_module(organization_id, 'ai_assistant'))
    and (select app.has_org_permission(organization_id, 'ai.use'))
  );

drop policy if exists "ai_conversations_update" on public.ai_conversations;
create policy "ai_conversations_update"
  on public.ai_conversations for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "ai_conversations_delete" on public.ai_conversations;
create policy "ai_conversations_delete"
  on public.ai_conversations for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- --------------------------------------------------------------- ai_messages
-- Ni UPDATE ni DELETE : un message envoyé ne se corrige pas, comme n'importe
-- quel historique dans REZO360. Supprimer la conversation entière (autorisé
-- ci-dessus) l'emporte en cascade.
grant select, insert on public.ai_messages to authenticated;

drop policy if exists "ai_messages_select" on public.ai_messages;
create policy "ai_messages_select"
  on public.ai_messages for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "ai_messages_insert" on public.ai_messages;
create policy "ai_messages_insert"
  on public.ai_messages for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- ------------------------------------------------------------------ ai_usage
-- Aucun grant insert/update/delete à `authenticated` : seule la Edge Function
-- `ai-assistant` (rôle de service, hors RLS) enregistre la consommation. Un
-- utilisateur qui pourrait écrire ici pourrait se créditer un quota.
grant select on public.ai_usage to authenticated;

drop policy if exists "ai_usage_select" on public.ai_usage;
create policy "ai_usage_select"
  on public.ai_usage for select
  to authenticated
  using ((select app.has_org_permission(organization_id, 'billing.view')));
