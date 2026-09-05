-- Erreurs clientes capturées après authentification.
--
-- Cette table complète les journaux Supabase : elle permet de relier une
-- erreur React ou navigateur à une version et une route précises, sans stocker
-- l'URL complète, les champs de formulaire ou le contenu métier de la page.
create table public.client_error_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id text not null,
  error_kind text not null,
  error_name text not null,
  message text not null,
  stack text,
  component_stack text,
  route text not null,
  app_version text not null default 'unknown',
  created_at timestamptz not null default now(),

  constraint client_error_events_event_id_length check (char_length(event_id) between 1 and 80),
  constraint client_error_events_kind_length check (char_length(error_kind) between 1 and 40),
  constraint client_error_events_name_length check (char_length(error_name) between 1 and 120),
  constraint client_error_events_message_length check (char_length(message) between 1 and 1000),
  constraint client_error_events_stack_length check (stack is null or char_length(stack) <= 6000),
  constraint client_error_events_component_stack_length check (
    component_stack is null or char_length(component_stack) <= 6000
  ),
  constraint client_error_events_route_length check (char_length(route) between 1 and 500),
  constraint client_error_events_app_version_length check (char_length(app_version) between 1 and 120)
);

comment on table public.client_error_events is
  'Erreurs techniques clientes, expurgées des informations sensibles et limitées aux membres authentifiés.';

create index client_error_events_organization_created_idx
  on public.client_error_events (organization_id, created_at desc)
  where organization_id is not null;

create index client_error_events_user_created_idx
  on public.client_error_events (user_id, created_at desc);

alter table public.client_error_events enable row level security;

-- Un utilisateur ne peut écrire qu'en son nom et, s'il fournit une
-- organisation, uniquement dans une entreprise dont il est membre actif.
create policy client_error_events_insert_own
  on public.client_error_events
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      organization_id is null
      or (select app.is_org_member(organization_id))
    )
  );

-- La lecture est réservée aux personnes autorisées à consulter le journal de
-- l'entreprise. Les événements sans organisation restent visibles uniquement
-- depuis les outils d'administration de la base.
create policy client_error_events_select_auditors
  on public.client_error_events
  for select
  to authenticated
  using (
    organization_id is not null
    and (select app.has_org_permission(organization_id, 'audit.view'))
  );

-- Depuis 2026, l'exposition Data API devient explicite. RLS et GRANT sont deux
-- protections distinctes : les deux restent volontairement dans la migration.
revoke all on table public.client_error_events from anon;
revoke all on table public.client_error_events from authenticated;
grant insert, select on table public.client_error_events to authenticated;
