-- =============================================================================
-- Journal d'audit
-- =============================================================================
-- Le §10 demande une traçabilité professionnelle. Deux exigences en découlent,
-- souvent négligées :
--
--   1. Le journal doit être ÉCRIT PAR LA BASE, pas par le client. Un audit
--      alimenté depuis le frontend n'enregistre que ce que le frontend veut
--      bien déclarer — c'est-à-dire rien en cas d'abus.
--
--   2. Le journal doit être INALTÉRABLE. Une trace modifiable ne vaut rien en
--      litige. Aucune policy `update` ni `delete` n'est définie, et un trigger
--      rejette la tentative même par un chemin privilégié.
-- =============================================================================

create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,

  -- `on delete set null` : la suppression d'un compte ne doit pas effacer la
  -- trace de ses actions. C'est précisément l'inverse de ce qu'on veut d'un
  -- journal d'audit.
  user_id         uuid references auth.users (id) on delete set null,
  -- Copie de l'identité au moment des faits : après suppression du compte,
  -- `user_id` est NULL et cette colonne reste la seule trace exploitable.
  actor_label     text,

  action          text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type     text not null,
  entity_id       uuid,

  metadata        jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now()
);

comment on table public.audit_logs is
  'Journal inaltérable des actions sensibles. Alimenté exclusivement par triggers (jamais par le client).';

-- Requête dominante : « l'activité récente de l'organisation X ».
create index if not exists audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index if not exists audit_logs_user_idx
  on public.audit_logs (user_id, created_at desc);

-- Index GIN sur les métadonnées : permet de filtrer sur le contenu du JSON
-- (« toutes les missions passées en `rejected` ») sans table supplémentaire.
create index if not exists audit_logs_metadata_idx
  on public.audit_logs using gin (metadata jsonb_path_ops);

-- -----------------------------------------------------------------------------
-- Écriture
-- -----------------------------------------------------------------------------
create or replace function app.write_audit_log(
  p_organization_id uuid,
  p_action          text,
  p_entity_type     text,
  p_entity_id       uuid,
  p_metadata        jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_label text;
begin
  select coalesce(p.display_name, u.email)
  into v_label
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = v_user;

  insert into public.audit_logs (organization_id, user_id, actor_label, action, entity_type, entity_id, metadata)
  values (p_organization_id, v_user, v_label, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function app.write_audit_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

-- Immuabilité, appliquée par le moteur. Sans ce trigger, un `service_role`
-- compromis — ou une erreur de script — pourrait réécrire l'histoire.
create or replace function app.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Le journal d''audit est immuable : ni modification ni suppression.'
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function app.reject_audit_mutation();

-- =============================================================================
-- TRIGGERS MÉTIER
-- =============================================================================
-- Couvre exactement les événements listés au §10.

-- ------------------------------------------------------------------ missions
create or replace function app.audit_mission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(
      new.organization_id, 'mission.created', 'mission', new.id,
      jsonb_build_object('reference', new.reference, 'title', new.title, 'status', new.status)
    );

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform app.write_audit_log(
        new.organization_id, 'mission.status_changed', 'mission', new.id,
        jsonb_build_object('reference', new.reference, 'from', old.status, 'to', new.status)
      );
    end if;

    if new.assigned_team_id is distinct from old.assigned_team_id
       or new.assigned_user_id is distinct from old.assigned_user_id then
      perform app.write_audit_log(
        new.organization_id, 'mission.assigned', 'mission', new.id,
        jsonb_build_object(
          'reference', new.reference,
          'team_id', new.assigned_team_id,
          'member_id', new.assigned_user_id
        )
      );
    end if;

  elsif tg_op = 'DELETE' then
    perform app.write_audit_log(
      old.organization_id, 'mission.deleted', 'mission', old.id,
      jsonb_build_object('reference', old.reference, 'title', old.title)
    );
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists missions_audit on public.missions;
create trigger missions_audit
  after insert or update or delete on public.missions
  for each row execute function app.audit_mission();

-- ------------------------------------------------------ intervention_reports
create or replace function app.audit_intervention_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(
      new.organization_id, 'report.created', 'intervention_report', new.id,
      jsonb_build_object('intervention_id', new.intervention_id)
    );

  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform app.write_audit_log(
      new.organization_id,
      case new.status
        when 'submitted' then 'report.submitted'
        when 'approved'  then 'report.approved'
        when 'rejected'  then 'report.rejected'
        else 'report.updated'
      end,
      'intervention_report', new.id,
      jsonb_build_object(
        'intervention_id', new.intervention_id,
        'from', old.status,
        'to', new.status,
        'reviewed_by', new.reviewed_by,
        'rejection_reason', new.rejection_reason
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists intervention_reports_audit on public.intervention_reports;
create trigger intervention_reports_audit
  after insert or update on public.intervention_reports
  for each row execute function app.audit_intervention_report();

-- ------------------------------------------------------- organization_members
create or replace function app.audit_organization_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(
      new.organization_id, 'member.added', 'organization_member', new.id,
      jsonb_build_object('user_id', new.user_id, 'role', new.role)
    );

  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      perform app.write_audit_log(
        new.organization_id, 'member.role_changed', 'organization_member', new.id,
        jsonb_build_object('user_id', new.user_id, 'from', old.role, 'to', new.role)
      );
    end if;

    if new.status is distinct from old.status then
      perform app.write_audit_log(
        new.organization_id, 'member.status_changed', 'organization_member', new.id,
        jsonb_build_object('user_id', new.user_id, 'from', old.status, 'to', new.status)
      );
    end if;

  elsif tg_op = 'DELETE' then
    perform app.write_audit_log(
      old.organization_id, 'member.removed', 'organization_member', old.id,
      jsonb_build_object('user_id', old.user_id, 'role', old.role)
    );
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_audit on public.organization_members;
create trigger organization_members_audit
  after insert or update or delete on public.organization_members
  for each row execute function app.audit_organization_member();

-- --------------------------------------------------------------------- teams
create or replace function app.audit_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit_log(new.organization_id, 'team.created', 'team', new.id,
      jsonb_build_object('name', new.name));
  elsif tg_op = 'DELETE' then
    perform app.write_audit_log(old.organization_id, 'team.deleted', 'team', old.id,
      jsonb_build_object('name', old.name));
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists teams_audit on public.teams;
create trigger teams_audit
  after insert or delete on public.teams
  for each row execute function app.audit_team();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.audit_logs enable row level security;

-- Lecture réservée aux rôles habilités (`audit.view` : owner et admin). Un
-- manager pilote l'activité mais n'a pas à consulter le journal des
-- changements de rôles ; un technicien encore moins.
drop policy if exists "audit_logs_select_permitted" on public.audit_logs;
create policy "audit_logs_select_permitted"
  on public.audit_logs for select
  to authenticated
  using (
    organization_id is not null
    and (select app.can_use_pro_module(organization_id, 'audit_log'))
    and (select app.has_org_permission(organization_id, 'audit.view'))
  );

-- AUCUNE policy insert/update/delete.
-- Le journal n'est alimenté que par `app.write_audit_log()`, appelée depuis des
-- triggers SECURITY DEFINER. Le client ne peut ni écrire, ni corriger, ni
-- effacer — c'est la définition même d'un audit.
