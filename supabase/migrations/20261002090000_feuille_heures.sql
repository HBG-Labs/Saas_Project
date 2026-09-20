-- =============================================================================
-- La feuille d'heures : journées, semaines, mois — calculées, puis figées
-- =============================================================================
--
-- LE CONSTAT (audit Gestion, I1)
--
-- Le temps était bien saisi et jamais totalisé : des segments travail / pause
-- par intervention, avec des règles solides (un seul segment ouvert par
-- personne, un segment clos immuable), et RIEN au-dessus — ni journée, ni
-- semaine, ni mois, ni heures contractuelles, ni clôture, ni export. La paie
-- se recomptait à la main, intervention par intervention.
--
-- CE QUI EST DÉCIDÉ ICI (arbitrages A–F du 20/09/2026)
--
-- A. Source de vérité : les segments d'intervention existants, PLUS le temps
--    hors intervention (`work_time_entries` : trajet, atelier, formation,
--    autre). Un trajet est du temps de travail effectif ; sans lui la feuille
--    ment par omission. Mêmes règles : un seul segment ouvert par personne,
--    toutes tables confondues.
--
-- B. Journées et semaines CALCULÉES (`timesheet_days`, `timesheet_weeks`),
--    dans le fuseau de l'organisation. Un segment qui traverse minuit est
--    découpé à minuit.
--
-- C. Heures contractuelles : `organizations.weekly_hours` (35 par défaut),
--    surchargeable par membre. Le dépassement est calculé — PAS la paie :
--    ni majorations, ni contingent, ni repos compensateur. La feuille donne
--    les heures ; l'expert-comptable les valorise.
--
-- D. Clôture mensuelle : un responsable fige le mois d'un salarié. Plus
--    aucun segment ne peut être ajouté, modifié ou supprimé sur un mois clos.
--    La clôture porte un instantané des totaux tel qu'envoyé en paie.
--    Réouverture possible, journalisée.
--
-- E. Export : `timesheet_month(...)` renvoie les lignes ; le fichier se
--    fabrique côté client. Aucun format propriétaire de logiciel de paie.
--
-- F. `timesheet.view_all` et `timesheet.manage` (chef d'équipe et au-dessus).
--    Chacun voit la sienne sans permission : c'est un droit du salarié.
--
-- CE QUE LA FEUILLE NE SAIT PAS
--
-- Un congé de 2,5 jours du lundi au mercredi : `leave_requests` ne dit pas
-- QUEL jour est la demi-journée. La feuille marque les trois jours « en
-- congé » et laisse le total de jours à la demande ; c'est exact au mois,
-- approximatif au jour. Le dire vaut mieux que l'inventer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Permissions
-- -----------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  ('owner', 'timesheet.view_all'), ('owner', 'timesheet.manage'),
  ('admin', 'timesheet.view_all'), ('admin', 'timesheet.manage'),
  ('manager', 'timesheet.view_all'), ('manager', 'timesheet.manage'),
  ('team_leader', 'timesheet.view_all'), ('team_leader', 'timesheet.manage')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. Heures contractuelles
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column weekly_hours numeric(4,1) not null default 35
    constraint organizations_weekly_hours_range check (weekly_hours > 0 and weekly_hours <= 60);

comment on column public.organizations.weekly_hours is
  'Durée hebdomadaire contractuelle par défaut. Surchargeable par membre. Sert au calcul du dépassement, jamais à la paie.';

alter table public.organization_members
  add column weekly_hours numeric(4,1)
    constraint organization_members_weekly_hours_range check (weekly_hours is null or (weekly_hours > 0 and weekly_hours <= 60));

comment on column public.organization_members.weekly_hours is
  'Durée hebdomadaire de ce membre (temps partiel). NULL = celle de l''organisation.';

-- -----------------------------------------------------------------------------
-- 3. Le temps hors intervention
-- -----------------------------------------------------------------------------
create type public.work_time_kind as enum ('travel', 'workshop', 'training', 'other');
revoke all on type public.work_time_kind from public, anon;
grant usage on type public.work_time_kind to authenticated, service_role;

create table public.work_time_entries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  member_id        uuid not null references public.organization_members (id) on delete restrict,
  -- Doublon volontaire, comme `technician_user_id` sur les segments
  -- d'intervention : c'est lui que l'index « un seul ouvert » regarde.
  member_user_id   uuid not null references auth.users (id) on delete cascade,
  kind             public.work_time_kind not null default 'other',
  started_at       timestamptz not null,
  ended_at         timestamptz,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint work_time_entries_order check (ended_at is null or ended_at >= started_at),
  -- Vingt-quatre heures d'un bloc, ce n'est plus du trajet ni de l'atelier.
  constraint work_time_entries_duration check (ended_at is null or ended_at - started_at <= interval '24 hours'),
  constraint work_time_entries_note_length check (note is null or length(note) <= 500)
);

comment on table public.work_time_entries is
  'Temps de travail hors intervention : trajet, atelier, formation, autre. Mêmes règles que les segments d''intervention.';

create index work_time_entries_member_idx on public.work_time_entries (member_id, started_at desc);
create unique index work_time_entries_user_open_idx on public.work_time_entries (member_user_id) where ended_at is null;

create trigger work_time_entries_set_updated_at
  before update on public.work_time_entries
  for each row execute function public.set_updated_at();

/**
 * Le garde. Même principe que les segments d'intervention : l'identité vient
 * de l'appartenance, jamais du navigateur, et POUR SOI-MÊME le serveur pose
 * l'heure — un salarié déclare « je pars », « j'arrive », pas des horaires.
 * Qui gère la feuille (`timesheet.manage`) peut poser des horaires explicites,
 * corriger et supprimer : c'est la voie de l'oubli réparé, et elle laisse une
 * trace dans le journal d'audit.
 */
create or replace function app.guard_work_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     public.work_time_entries := coalesce(new, old);
  v_member  public.organization_members%rowtype;
  v_actor   uuid := (select auth.uid());
  v_manager boolean;
  v_end     timestamptz;
begin
  select * into v_member from public.organization_members where id = v_row.member_id;
  if not found then
    raise exception 'Membre introuvable.' using errcode = 'foreign_key_violation';
  end if;
  -- Sans session (service_role, scripts), on est de confiance.
  v_manager := v_actor is null or app.has_org_permission(v_member.organization_id, 'timesheet.manage');

  if tg_op = 'DELETE' then
    if not v_manager then
      raise exception 'Un segment de temps ne se supprime pas ; il se corrige par qui gère la feuille d''heures.'
        using errcode = 'insufficient_privilege';
    end if;
    perform app.write_audit_log(old.organization_id, 'timesheet.entry_deleted', 'work_time_entry', old.id,
      jsonb_build_object('member_id', old.member_id, 'kind', old.kind, 'started_at', old.started_at, 'ended_at', old.ended_at));
    return old;
  end if;

  new.organization_id := v_member.organization_id;
  new.member_user_id := v_member.user_id;

  if not v_manager and v_member.user_id <> v_actor then
    raise exception 'Le temps hors intervention se saisit pour soi-même.' using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'INSERT' then
    if not v_manager then
      -- Le serveur pose l'heure. Aucun horodatage du client n'est retenu.
      new.started_at := now();
      new.ended_at := null;
    end if;
    new.created_at := now();
  else
    if not v_manager then
      if old.ended_at is not null then
        raise exception 'Un segment de temps clos ne peut plus être modifié.' using errcode = 'insufficient_privilege';
      end if;
      if new.member_id is distinct from old.member_id
         or new.kind is distinct from old.kind
         or new.started_at is distinct from old.started_at
         or new.note is distinct from old.note then
        raise exception 'Seule la clôture d''un segment de temps est permise.' using errcode = 'insufficient_privilege';
      end if;
      if new.ended_at is not null then
        new.ended_at := now();
      end if;
    elsif new.member_id is distinct from old.member_id then
      raise exception 'Un segment ne change pas de personne.' using errcode = 'restrict_violation';
    end if;
  end if;

  if new.started_at > now() + interval '5 minutes' or new.ended_at > now() + interval '5 minutes' then
    raise exception 'Un segment de temps ne se place pas dans le futur.' using errcode = 'check_violation';
  end if;

  -- Un seul chronomètre par personne, toutes tables confondues.
  if new.ended_at is null and exists (
       select 1 from public.intervention_time_entries e
       where e.technician_user_id = v_member.user_id and e.ended_at is null) then
    raise exception 'Un chronomètre d''intervention est déjà en cours pour cette personne.' using errcode = 'check_violation';
  end if;

  -- Pas de chevauchement avec son propre temps, d'où qu'il vienne.
  v_end := coalesce(new.ended_at, now());
  if exists (
       select 1 from public.work_time_entries w
       where w.member_user_id = v_member.user_id and w.id <> new.id and w.ended_at is not null
         and tstzrange(w.started_at, w.ended_at, '[)') && tstzrange(new.started_at, v_end, '[)'))
     or exists (
       select 1 from public.intervention_time_entries e
       where e.technician_user_id = v_member.user_id and e.kind = 'work' and e.ended_at is not null
         and tstzrange(e.started_at, e.ended_at, '[)') && tstzrange(new.started_at, v_end, '[)')) then
    raise exception 'Ce segment chevauche un autre temps déjà enregistré pour cette personne.' using errcode = 'check_violation';
  end if;

  -- Une correction par un tiers laisse une trace.
  if v_actor is not null and v_actor <> v_member.user_id then
    perform app.write_audit_log(new.organization_id,
      case when tg_op = 'INSERT' then 'timesheet.entry_declared' else 'timesheet.entry_corrected' end,
      'work_time_entry', new.id,
      jsonb_build_object('member_id', new.member_id, 'kind', new.kind, 'started_at', new.started_at, 'ended_at', new.ended_at));
  end if;

  return new;
end;
$$;

revoke all on function app.guard_work_time_entry() from public, anon, authenticated;

create trigger work_time_entries_guard
  before insert or update or delete on public.work_time_entries
  for each row execute function app.guard_work_time_entry();

/**
 * Le trajet se termine quand l'intervention commence. Le chronomètre
 * d'intervention démarre en une requête (`switch_intervention_time_entry`) ;
 * un temps hors intervention encore ouvert pour la même personne est clos à
 * cet instant, plutôt que de refuser le démarrage sur le chantier.
 */
create or replace function app.close_work_time_on_intervention_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'work' and new.ended_at is null then
    update public.work_time_entries
    set ended_at = now()
    where member_user_id = new.technician_user_id and ended_at is null;
  end if;
  return new;
end;
$$;

revoke all on function app.close_work_time_on_intervention_start() from public, anon, authenticated;

create trigger intervention_time_entries_close_work_time
  after insert on public.intervention_time_entries
  for each row execute function app.close_work_time_on_intervention_start();

/**
 * Le pendant de `switch_intervention_time_entry` pour le temps hors
 * intervention : ferme tout chronomètre du compte, ouvre le segment demandé.
 * Le verrou sérialise deux appareils.
 */
create or replace function public.start_work_time(
  p_organization_id uuid,
  p_kind public.work_time_kind,
  p_note text default null
)
returns public.work_time_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_member uuid;
  v_entry  public.work_time_entries;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'La note ne peut pas dépasser 500 caractères.' using errcode = 'check_violation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));

  select m.id into v_member
  from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = v_user and m.status = 'active';
  if v_member is null then
    raise exception 'Organisation inaccessible.' using errcode = 'insufficient_privilege';
  end if;

  update public.intervention_time_entries set ended_at = now()
  where technician_user_id = v_user and ended_at is null;
  update public.work_time_entries set ended_at = now()
  where member_user_id = v_user and ended_at is null;

  insert into public.work_time_entries (organization_id, member_id, member_user_id, kind, note)
  values (p_organization_id, v_member, v_user, p_kind, nullif(pg_catalog.btrim(p_note), ''))
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.start_work_time(uuid, public.work_time_kind, text) from public, anon;
grant execute on function public.start_work_time(uuid, public.work_time_kind, text) to authenticated;

/** Ferme le temps hors intervention en cours du compte. Renvoie null s'il n'y en avait pas. */
create or replace function public.stop_work_time()
returns public.work_time_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_entry public.work_time_entries;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  update public.work_time_entries set ended_at = now()
  where member_user_id = v_user and ended_at is null
  returning * into v_entry;
  return v_entry;
end;
$$;

revoke all on function public.stop_work_time() from public, anon;
grant execute on function public.stop_work_time() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Les clôtures
-- -----------------------------------------------------------------------------
create table public.timesheet_closures (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  member_id        uuid not null references public.organization_members (id) on delete cascade,
  -- Le premier jour du mois clos.
  month            date not null,
  -- L'instantané, tel qu'envoyé en paie.
  intervention_minutes integer not null,
  other_minutes        integer not null,
  total_minutes        integer not null,
  leave_days           numeric(5,1) not null,
  note             text,
  closed_by        uuid references auth.users (id) on delete set null,
  closed_at        timestamptz not null default now(),
  reopened_by      uuid references auth.users (id) on delete set null,
  reopened_at      timestamptz,

  constraint timesheet_closures_month_first_day check (month = date_trunc('month', month)::date),
  constraint timesheet_closures_note_length check (note is null or length(note) <= 500)
);

comment on table public.timesheet_closures is
  'Un mois de feuille d''heures figé pour un membre, avec ses totaux. Rouvert = reopened_at posé ; une clôture ne se supprime pas.';

-- Une seule clôture ACTIVE par membre et par mois ; les rouvertes restent en
-- historique.
create unique index timesheet_closures_active_idx
  on public.timesheet_closures (member_id, month) where reopened_at is null;

/** Le mois d'un instant, dans le fuseau de l'organisation. */
create or replace function app.timesheet_month_of(p_organization_id uuid, p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', (p_at at time zone coalesce((select o.timezone from public.organizations o where o.id = p_organization_id), 'Europe/Paris')))::date;
$$;

revoke all on function app.timesheet_month_of(uuid, timestamptz) from public, anon;
grant execute on function app.timesheet_month_of(uuid, timestamptz) to authenticated, service_role;

create or replace function app.timesheet_is_closed(p_organization_id uuid, p_member_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.timesheet_closures c
    where c.member_id = p_member_id
      and c.reopened_at is null
      and c.month = app.timesheet_month_of(p_organization_id, p_at)
  );
$$;

revoke all on function app.timesheet_is_closed(uuid, uuid, timestamptz) from public, anon;
grant execute on function app.timesheet_is_closed(uuid, uuid, timestamptz) to authenticated, service_role;

/**
 * Un mois clos ne bouge plus : ni ajout, ni modification, ni suppression,
 * sur les deux tables de temps. BEFORE, pour refuser avant que le garde
 * métier ne s'exécute — un refus clair d'abord.
 */
create or replace function app.guard_time_entry_closed_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member  uuid;
  v_org     uuid;
  v_at      timestamptz;
  v_i       int;
begin
  -- Sur une modification, l'ancienne position ET la nouvelle doivent être
  -- libres : on ne sort pas plus d'un mois clos qu'on n'y entre.
  for v_i in 1..2 loop
    if (v_i = 1 and tg_op = 'INSERT') or (v_i = 2 and tg_op = 'DELETE') then
      continue;
    end if;
    if tg_table_name = 'intervention_time_entries' then
      if v_i = 1 then
        v_member := old.technician_id; v_org := old.organization_id; v_at := old.started_at;
      else
        v_member := new.technician_id; v_org := new.organization_id; v_at := new.started_at;
        -- À l'insertion, le garde métier qui suit posera ces colonnes ; on
        -- les relit depuis la source.
        if v_member is null or v_org is null then
          select i.organization_id, i.technician_id into v_org, v_member
          from public.interventions i where i.id = new.intervention_id;
        end if;
      end if;
    else
      if v_i = 1 then
        v_member := old.member_id; v_org := old.organization_id; v_at := old.started_at;
      else
        v_member := new.member_id; v_org := new.organization_id; v_at := new.started_at;
        if v_org is null then
          select m.organization_id into v_org from public.organization_members m where m.id = v_member;
        end if;
      end if;
    end if;

    if v_member is not null and v_org is not null
       and app.timesheet_is_closed(v_org, v_member, coalesce(v_at, now())) then
      raise exception 'Ce mois est clos pour cette personne : la feuille d''heures a été transmise. Rouvrez le mois pour corriger.'
        using errcode = 'restrict_violation';
    end if;
  end loop;

  return coalesce(new, old);
end;
$$;

revoke all on function app.guard_time_entry_closed_month() from public, anon, authenticated;

-- « a_ » pour passer AVANT `intervention_time_entries_enforce` (ordre alphabétique).
create trigger a_intervention_time_entries_closed_month
  before insert or update or delete on public.intervention_time_entries
  for each row execute function app.guard_time_entry_closed_month();

create trigger a_work_time_entries_closed_month
  before insert or update or delete on public.work_time_entries
  for each row execute function app.guard_time_entry_closed_month();

-- -----------------------------------------------------------------------------
-- 5. Les journées et les semaines, calculées
-- -----------------------------------------------------------------------------
-- Chaque segment clos, d'où qu'il vienne, découpé à minuit dans le fuseau de
-- l'organisation, puis sommé par membre et par jour. Un segment ouvert ne
-- compte pas : il n'a pas encore de durée.
create or replace view public.timesheet_days
with (security_invoker = true)
as
with segments as (
  select e.organization_id, e.technician_id as member_id, 'intervention'::text as source, e.started_at, e.ended_at
  from public.intervention_time_entries e
  where e.kind = 'work' and e.ended_at is not null
  union all
  select w.organization_id, w.member_id, w.kind::text, w.started_at, w.ended_at
  from public.work_time_entries w
  where w.ended_at is not null
),
tranches as (
  select
    s.organization_id, s.member_id, s.source,
    d.jour::date as day,
    greatest(0, extract(epoch from (
      least(s.ended_at, (d.jour + interval '1 day') at time zone o.timezone)
      - greatest(s.started_at, d.jour at time zone o.timezone)
    )) / 60)::numeric as minutes
  from segments s
  join public.organizations o on o.id = s.organization_id
  cross join lateral generate_series(
    date_trunc('day', s.started_at at time zone o.timezone),
    date_trunc('day', s.ended_at at time zone o.timezone),
    interval '1 day'
  ) as d(jour)
)
select
  t.organization_id,
  t.member_id,
  t.day,
  coalesce(round(sum(t.minutes) filter (where t.source = 'intervention')), 0)::integer as intervention_minutes,
  coalesce(round(sum(t.minutes) filter (where t.source <> 'intervention')), 0)::integer as other_minutes,
  round(sum(t.minutes))::integer                                          as total_minutes,
  exists (select 1 from public.leave_requests l
          where l.member_id = t.member_id and l.status = 'approved'
            and t.day between l.start_date and l.end_date)               as on_leave
from tranches t
group by t.organization_id, t.member_id, t.day;

revoke all on public.timesheet_days from public, anon;
grant select on public.timesheet_days to authenticated, service_role;

create or replace view public.timesheet_weeks
with (security_invoker = true)
as
select
  d.organization_id,
  d.member_id,
  date_trunc('week', d.day)::date                       as week_start,
  sum(d.intervention_minutes)::integer                  as intervention_minutes,
  sum(d.other_minutes)::integer                         as other_minutes,
  sum(d.total_minutes)::integer                         as total_minutes,
  (coalesce(m.weekly_hours, o.weekly_hours) * 60)::integer as contract_minutes,
  greatest(sum(d.total_minutes) - coalesce(m.weekly_hours, o.weekly_hours) * 60, 0)::integer as overtime_minutes,
  count(*) filter (where d.on_leave)::integer          as leave_days_touched
from public.timesheet_days d
join public.organizations o on o.id = d.organization_id
join public.organization_members m on m.id = d.member_id
group by d.organization_id, d.member_id, date_trunc('week', d.day), m.weekly_hours, o.weekly_hours;

revoke all on public.timesheet_weeks from public, anon;
grant select on public.timesheet_weeks to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Le mois, calendrier complet : ce qu'on exporte
-- -----------------------------------------------------------------------------
-- Toutes les journées du mois pour chaque membre actif, travaillées ou non :
-- une feuille de paie a besoin des jours vides et des jours de congé autant
-- que des jours travaillés. `security invoker` : chacun ne voit que ce que
-- sa RLS lui montre — les siens, ou tous avec `timesheet.view_all`.
create or replace function public.timesheet_month(p_organization_id uuid, p_month date)
returns table (
  member_id            uuid,
  day                  date,
  intervention_minutes integer,
  other_minutes        integer,
  total_minutes        integer,
  on_leave             boolean,
  leave_type           public.leave_type,
  closed               boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mois as (
    select date_trunc('month', p_month)::date as debut,
           (date_trunc('month', p_month) + interval '1 month')::date as fin
  ),
  membres as (
    select m.id
    from public.organization_members m
    where m.organization_id = p_organization_id and m.status = 'active'
      and (m.user_id = (select auth.uid()) or app.has_org_permission(p_organization_id, 'timesheet.view_all'))
  ),
  jours as (
    select g::date as day from mois, generate_series(mois.debut, mois.fin - 1, interval '1 day') g
  )
  select
    mb.id,
    j.day,
    coalesce(d.intervention_minutes, 0),
    coalesce(d.other_minutes, 0),
    coalesce(d.total_minutes, 0),
    exists (select 1 from public.leave_requests l where l.member_id = mb.id and l.status = 'approved' and j.day between l.start_date and l.end_date),
    (select l.type from public.leave_requests l where l.member_id = mb.id and l.status = 'approved' and j.day between l.start_date and l.end_date order by l.start_date limit 1),
    exists (select 1 from public.timesheet_closures c where c.member_id = mb.id and c.reopened_at is null and c.month = (select debut from mois))
  from membres mb
  cross join jours j
  left join public.timesheet_days d on d.member_id = mb.id and d.day = j.day
  order by mb.id, j.day;
$$;

revoke all on function public.timesheet_month(uuid, date) from public, anon;
grant execute on function public.timesheet_month(uuid, date) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. Clôturer, rouvrir
-- -----------------------------------------------------------------------------
create or replace function public.close_timesheet_month(p_organization_id uuid, p_member_id uuid, p_month date, p_note text default null)
returns public.timesheet_closures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month  date := date_trunc('month', p_month)::date;
  v_result public.timesheet_closures;
  v_int integer; v_oth integer; v_tot integer; v_leave numeric;
begin
  if not app.has_org_permission(p_organization_id, 'timesheet.manage') then
    raise exception 'Réservé à la gestion des feuilles d''heures.' using errcode = 'insufficient_privilege';
  end if;
  if v_month >= date_trunc('month', current_date)::date then
    raise exception 'On ne clôture qu''un mois écoulé.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.organization_members m where m.id = p_member_id and m.organization_id <> p_organization_id) then
    raise exception 'Ce membre n''appartient pas à cette organisation.' using errcode = 'restrict_violation';
  end if;
  -- Un chronomètre encore ouvert sur ce mois : on ne fige pas une durée inconnue.
  if exists (select 1 from public.intervention_time_entries e
             where e.technician_id = p_member_id and e.ended_at is null
               and app.timesheet_month_of(p_organization_id, e.started_at) = v_month)
     or exists (select 1 from public.work_time_entries w
                where w.member_id = p_member_id and w.ended_at is null
                  and app.timesheet_month_of(p_organization_id, w.started_at) = v_month) then
    raise exception 'Un segment de temps est encore ouvert sur ce mois : clôturez-le d''abord.' using errcode = 'check_violation';
  end if;

  select coalesce(sum(t.intervention_minutes), 0), coalesce(sum(t.other_minutes), 0), coalesce(sum(t.total_minutes), 0)
    into v_int, v_oth, v_tot
  from public.timesheet_month(p_organization_id, v_month) t
  where t.member_id = p_member_id;

  -- Les jours de congé du mois : la somme des demandes validées, au prorata
  -- des jours qui tombent dans le mois (une demande à cheval compte pour sa
  -- part). `days_count` reste la référence de la demande.
  select coalesce(sum(
           l.days_count * (
             (least(l.end_date, (v_month + interval '1 month')::date - 1) - greatest(l.start_date, v_month) + 1)::numeric
             / (l.end_date - l.start_date + 1)
           )), 0)
    into v_leave
  from public.leave_requests l
  where l.member_id = p_member_id and l.status = 'approved'
    and l.start_date < (v_month + interval '1 month')::date and l.end_date >= v_month;

  insert into public.timesheet_closures (organization_id, member_id, month, intervention_minutes, other_minutes, total_minutes, leave_days, note, closed_by)
  values (p_organization_id, p_member_id, v_month, v_int, v_oth, v_tot, round(v_leave, 1), nullif(btrim(p_note), ''), (select auth.uid()))
  returning * into v_result;

  perform app.write_audit_log(p_organization_id, 'timesheet.closed', 'timesheet_closure', v_result.id,
    jsonb_build_object('member_id', p_member_id, 'month', v_month, 'total_minutes', v_tot, 'leave_days', round(v_leave, 1)));
  return v_result;
end;
$$;

revoke all on function public.close_timesheet_month(uuid, uuid, date, text) from public, anon;
grant execute on function public.close_timesheet_month(uuid, uuid, date, text) to authenticated, service_role;

create or replace function public.reopen_timesheet_month(p_closure_id uuid, p_note text default null)
returns public.timesheet_closures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.timesheet_closures;
begin
  select * into v_result from public.timesheet_closures where id = p_closure_id and reopened_at is null;
  if not found then
    raise exception 'Clôture introuvable ou déjà rouverte.' using errcode = 'no_data_found';
  end if;
  if not app.has_org_permission(v_result.organization_id, 'timesheet.manage') then
    raise exception 'Réservé à la gestion des feuilles d''heures.' using errcode = 'insufficient_privilege';
  end if;

  update public.timesheet_closures
  set reopened_at = now(), reopened_by = (select auth.uid()),
      note = coalesce(nullif(btrim(p_note), ''), note)
  where id = p_closure_id
  returning * into v_result;

  perform app.write_audit_log(v_result.organization_id, 'timesheet.reopened', 'timesheet_closure', v_result.id,
    jsonb_build_object('member_id', v_result.member_id, 'month', v_result.month));
  return v_result;
end;
$$;

revoke all on function public.reopen_timesheet_month(uuid, text) from public, anon;
grant execute on function public.reopen_timesheet_month(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. Droits
-- -----------------------------------------------------------------------------
alter table public.work_time_entries enable row level security;
alter table public.timesheet_closures enable row level security;

revoke all on public.work_time_entries, public.timesheet_closures from public, anon, authenticated, service_role;
grant select, insert, delete on public.work_time_entries to authenticated;
grant update (member_id, kind, started_at, ended_at, note) on public.work_time_entries to authenticated;
-- Les clôtures ne s'écrivent que par `close_timesheet_month` / `reopen_timesheet_month` :
-- un instantané saisi à la main n'en serait pas un.
grant select on public.timesheet_closures to authenticated;
grant all on public.work_time_entries, public.timesheet_closures to service_role;

-- La feuille lit les segments d'intervention par leur propre porte. Sans
-- elle, `timesheet_days` ne verrait que ce que `interventions_select_scoped`
-- laisse passer — et un chef d'équipe sans `intervention.view_all` aurait une
-- feuille incomplète, en silence. Ce que cette porte montre : des durées et
-- des identifiants, pas le contenu de l'intervention.
create policy intervention_time_entries_select_timesheet on public.intervention_time_entries for select to authenticated
  using (technician_user_id = (select auth.uid())
      or (select app.has_org_permission(organization_id, 'timesheet.view_all')));

-- Son temps, ou celui de tous avec view_all ; l'écriture sur soi, ou avec manage.
create policy work_time_entries_select on public.work_time_entries for select to authenticated
  using (member_user_id = (select auth.uid())
      or (select app.has_org_permission(organization_id, 'timesheet.view_all')));
create policy work_time_entries_insert on public.work_time_entries for insert to authenticated
  with check ((select app.is_org_member(organization_id))
          and (member_user_id = (select auth.uid()) or (select app.has_org_permission(organization_id, 'timesheet.manage'))));
create policy work_time_entries_update on public.work_time_entries for update to authenticated
  using (member_user_id = (select auth.uid()) or (select app.has_org_permission(organization_id, 'timesheet.manage')))
  with check (member_user_id = (select auth.uid()) or (select app.has_org_permission(organization_id, 'timesheet.manage')));
create policy work_time_entries_delete on public.work_time_entries for delete to authenticated
  using ((select app.has_org_permission(organization_id, 'timesheet.manage')));

create policy timesheet_closures_select on public.timesheet_closures for select to authenticated
  using ((select app.has_org_permission(organization_id, 'timesheet.view_all'))
      or member_id in (select m.id from public.organization_members m where m.user_id = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- 9. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  select count(distinct permission) into v from public.role_permissions where permission like 'timesheet.%';
  if v <> 2 then raise exception '% permission(s) timesheet au lieu de 2.', v; end if;
  select count(*) into v from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname in ('work_time_entries', 'timesheet_closures');
  if v <> 5 then raise exception '% politique(s) RLS au lieu de 5.', v; end if;
  select count(*) into v from pg_trigger where tgname in ('a_intervention_time_entries_closed_month', 'a_work_time_entries_closed_month');
  if v <> 2 then raise exception 'Les gardes de mois clos ne sont pas posés.'; end if;
end $$;
