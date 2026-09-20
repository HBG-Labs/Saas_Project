-- =============================================================================
-- Gestion — le planning ne ment pas : conflits d'affectation, récurrences
-- =============================================================================
--
-- Audit fonctionnel de la phase 3 (20/09/2026), deux manques classés
-- indispensables, tous deux du pur modèle :
--
-- I3 — CONFLITS D'AFFECTATION. Rien n'empêchait d'affecter un technicien à
--      deux missions sur le même créneau, ni pendant un congé validé. Le
--      double-booking se découvrait sur le chantier.
--
-- I2 — RÉCURRENCES. `recurring_tasks` portait une `next_date` que rien
--      n'avançait et qui ne créait aucune mission : un contrat d'entretien
--      n'était qu'un mémo, et l'écran laissait croire à une automatisation.
--
-- CE QUI EST DÉCIDÉ ICI
--
-- Le congé validé est un mur : on ne l'affecte pas, point. Le chevauchement
-- entre deux missions est un avertissement qu'on peut passer outre — deux
-- visites courtes le même après-midi, ça arrive — mais EN LE DISANT :
-- `schedule_conflict_acknowledged = true` dans la même écriture, sinon refus.
-- Le client sait quoi montrer grâce à `mission_conflicts(...)`.
--
-- Une mission sans heure de fin est comptée pour UNE HEURE dans la détection.
-- C'est une convention, pas une vérité : sans elle, une mission sans fin ne
-- chevaucherait jamais rien, et c'est précisément celle qu'on oublie.
--
-- Les missions récurrentes sont créées chaque nuit, quinze jours à l'avance,
-- en brouillon, affectées si la tâche le prévoit — et le planning les voit
-- donc, conflits compris. Chaque occurrence est tracée ; une occurrence
-- refusée par un quota de formule reste tracée « ignorée », sans avancer la
-- date, pour être retentée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Le fuseau de l'organisation
-- -----------------------------------------------------------------------------
-- Une récurrence dit « le 3 du mois », jamais « à 08:00 UTC ». Pour poser une
-- heure de rendez-vous juste, il faut savoir où l'entreprise travaille : une
-- entreprise de Fort-de-France à 08:00 Europe/Paris commencerait à 02:00.
-- Par défaut Europe/Paris ; réglable, et vérifié par trigger (un `check` ne
-- peut pas interroger `pg_timezone_names`).
alter table public.organizations
  add column timezone text not null default 'Europe/Paris';

comment on column public.organizations.timezone is
  'Fuseau IANA de l''entreprise (Europe/Paris, America/Martinique…). Sert aux heures des récurrences.';

create or replace function app.guard_organization_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is distinct from old.timezone or tg_op = 'INSERT' then
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
      raise exception 'Fuseau horaire inconnu : %', new.timezone using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.guard_organization_timezone() from public, anon, authenticated;

create trigger organizations_guard_timezone
  before insert or update on public.organizations
  for each row execute function app.guard_organization_timezone();

-- -----------------------------------------------------------------------------
-- 2. Conflits d'affectation
-- -----------------------------------------------------------------------------

alter table public.missions
  add column schedule_conflict_acknowledged boolean not null default false;

comment on column public.missions.schedule_conflict_acknowledged is
  'Le chevauchement avec une autre mission du même technicien a été vu et accepté. Sans lui, l''affectation est refusée.';

/** La fenêtre de détection d'une mission : sa plage, ou une heure si la fin manque. */
create or replace function app.mission_window(p_start timestamptz, p_end timestamptz)
returns tstzrange
language sql
immutable
set search_path = ''
as $$
  select case
    when p_start is null then null
    else tstzrange(p_start, coalesce(p_end, p_start + interval '1 hour'), '[)')
  end;
$$;

revoke all on function app.mission_window(timestamptz, timestamptz) from public, anon;
grant execute on function app.mission_window(timestamptz, timestamptz) to authenticated, service_role;

-- Les statuts qui OCCUPENT un créneau. Un brouillon aussi : il est posé au
-- planning, et deux brouillons au même endroit sont déjà un conflit.
create or replace function app.mission_occupies_slot(p_status public.mission_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('draft', 'assigned', 'accepted', 'in_progress', 'submitted');
$$;

revoke all on function app.mission_occupies_slot(public.mission_status) from public, anon;
grant execute on function app.mission_occupies_slot(public.mission_status) to authenticated, service_role;

/**
 * Ce qui gêne l'affectation d'un membre sur une fenêtre.
 *
 * `security invoker` : la personne ne voit que les missions et congés que sa
 * RLS lui montre — c'est ce qu'il faut pour un avertissement à l'écran. Le
 * garde du trigger, lui, regarde tout (§ suivant).
 */
create or replace function public.mission_conflicts(
  p_member_id          uuid,
  p_start              timestamptz,
  p_end                timestamptz,
  p_exclude_mission_id uuid default null
)
returns table (
  kind          text,
  mission_id    uuid,
  reference     text,
  title         text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  leave_id      uuid,
  leave_type    public.leave_type
)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'mission', m.id, m.reference, m.title, m.scheduled_start, m.scheduled_end, null::uuid, null::public.leave_type
  from public.missions m
  where m.assigned_user_id = p_member_id
    and (p_exclude_mission_id is null or m.id <> p_exclude_mission_id)
    and app.mission_occupies_slot(m.status)
    and app.mission_window(m.scheduled_start, m.scheduled_end) && app.mission_window(p_start, p_end)
  union all
  select 'leave', null, null, null,
         l.start_date::timestamptz, (l.end_date + 1)::timestamptz, l.id, l.type
  from public.leave_requests l
  where l.member_id = p_member_id
    and l.status = 'approved'
    and tstzrange(l.start_date::timestamptz, (l.end_date + 1)::timestamptz, '[)')
        && app.mission_window(p_start, p_end)
  order by 1, 5;
$$;

revoke all on function public.mission_conflicts(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.mission_conflicts(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;

/**
 * Le garde. `security definer` : il doit voir toutes les missions et tous les
 * congés du membre, pas seulement ceux que la RLS de l'auteur lui montre.
 *
 * Ne s'exécute que si quelque chose a bougé : le technicien, la fenêtre, ou
 * le passage d'un statut libre à un statut occupant. Modifier le titre d'une
 * mission ne redéclenche pas le contrôle.
 */
create or replace function app.guard_mission_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conflit record;
begin
  if new.assigned_user_id is null or new.scheduled_start is null then
    return new;
  end if;
  if not app.mission_occupies_slot(new.status) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.assigned_user_id is not distinct from old.assigned_user_id
     and new.scheduled_start is not distinct from old.scheduled_start
     and new.scheduled_end is not distinct from old.scheduled_end
     and app.mission_occupies_slot(old.status) then
    return new;
  end if;

  -- Le congé validé : un mur.
  select l.start_date, l.end_date, l.type into v_conflit
  from public.leave_requests l
  where l.member_id = new.assigned_user_id
    and l.status = 'approved'
    and tstzrange(l.start_date::timestamptz, (l.end_date + 1)::timestamptz, '[)')
        && app.mission_window(new.scheduled_start, new.scheduled_end)
  limit 1;
  if found then
    raise exception
      'Ce technicien est en congé validé (%) du % au %. Choisissez quelqu''un d''autre ou déplacez la mission.',
      v_conflit.type, to_char(v_conflit.start_date, 'DD/MM/YYYY'), to_char(v_conflit.end_date, 'DD/MM/YYYY')
      using errcode = 'restrict_violation';
  end if;

  -- Une autre mission : un avertissement, qu'on peut passer outre en le disant.
  if not new.schedule_conflict_acknowledged then
    select m.reference, m.scheduled_start into v_conflit
    from public.missions m
    where m.assigned_user_id = new.assigned_user_id
      and m.id <> new.id
      and app.mission_occupies_slot(m.status)
      and app.mission_window(m.scheduled_start, m.scheduled_end)
          && app.mission_window(new.scheduled_start, new.scheduled_end)
    limit 1;
    if found then
      raise exception
        'Ce technicien est déjà sur la mission % à ce créneau. Confirmez le chevauchement (schedule_conflict_acknowledged) ou déplacez l''une des deux.',
        v_conflit.reference
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.guard_mission_schedule() from public, anon, authenticated;

-- Reconnaître un chevauchement fait partie de la DÉFINITION d'une mission :
-- un intervenant sans `mission.update` ne le fait pas à la place du
-- responsable. Redéfinition du garde de périmètre (20260810100300) avec la
-- colonne en plus ; rien d'autre ne change.
create or replace function app.enforce_mission_assignee_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if app.has_org_permission(new.organization_id, 'mission.update') then
    return new;
  end if;

  if new.title            is distinct from old.title
     or new.description   is distinct from old.description
     or new.category_id   is distinct from old.category_id
     or new.customer_id   is distinct from old.customer_id
     or new.site_id       is distinct from old.site_id
     or new.priority      is distinct from old.priority
     or new.assigned_team_id is distinct from old.assigned_team_id
     or new.assigned_user_id is distinct from old.assigned_user_id
     or new.scheduled_start  is distinct from old.scheduled_start
     or new.scheduled_end    is distinct from old.scheduled_end
     or new.reference     is distinct from old.reference
     or new.customer_name is distinct from old.customer_name
     or new.location_label is distinct from old.location_label
     or new.schedule_conflict_acknowledged is distinct from old.schedule_conflict_acknowledged
  then
    raise exception
      'En tant qu''intervenant, vous pouvez faire avancer la mission et la commenter, mais pas en modifier la définition.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Après `enforce_mission_assignment_same_org` (ordre alphabétique) : d'abord
-- « ce technicien est-il de la maison », puis « est-il libre ».
create trigger missions_guard_schedule
  before insert or update on public.missions
  for each row execute function app.guard_mission_schedule();

-- `mission_assignments` peut être alimentée sans passer par `missions` : le
-- même garde, depuis la fenêtre de la mission.
create or replace function app.guard_mission_assignment_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.missions%rowtype;
  v_conflit record;
begin
  if new.member_id is null then
    return new;
  end if;

  select * into v_mission from public.missions where id = new.mission_id;
  if not found or v_mission.scheduled_start is null or not app.mission_occupies_slot(v_mission.status) then
    return new;
  end if;

  select l.start_date, l.end_date, l.type into v_conflit
  from public.leave_requests l
  where l.member_id = new.member_id
    and l.status = 'approved'
    and tstzrange(l.start_date::timestamptz, (l.end_date + 1)::timestamptz, '[)')
        && app.mission_window(v_mission.scheduled_start, v_mission.scheduled_end)
  limit 1;
  if found then
    raise exception
      'Ce technicien est en congé validé (%) du % au %.',
      v_conflit.type, to_char(v_conflit.start_date, 'DD/MM/YYYY'), to_char(v_conflit.end_date, 'DD/MM/YYYY')
      using errcode = 'restrict_violation';
  end if;

  if not v_mission.schedule_conflict_acknowledged then
    select m.reference into v_conflit
    from public.missions m
    where m.assigned_user_id = new.member_id
      and m.id <> new.mission_id
      and app.mission_occupies_slot(m.status)
      and app.mission_window(m.scheduled_start, m.scheduled_end)
          && app.mission_window(v_mission.scheduled_start, v_mission.scheduled_end)
    limit 1;
    if found then
      raise exception
        'Ce technicien est déjà sur la mission % à ce créneau. Confirmez le chevauchement sur la mission ou déplacez l''une des deux.',
        v_conflit.reference
        using errcode = 'restrict_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app.guard_mission_assignment_schedule() from public, anon, authenticated;

create trigger mission_assignments_guard_schedule
  before insert on public.mission_assignments
  for each row execute function app.guard_mission_assignment_schedule();

-- Un congé validé APRÈS l'affectation : on ne casse pas l'affectation en
-- silence, mais on refuse de valider un congé qui rendrait une mission
-- orpheline. C'est au responsable de réaffecter d'abord.
create or replace function app.guard_leave_against_missions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = 'approved') then
    return new;
  end if;

  select m.reference into v_ref
  from public.missions m
  where m.assigned_user_id = new.member_id
    and app.mission_occupies_slot(m.status)
    and m.scheduled_start is not null
    and app.mission_window(m.scheduled_start, m.scheduled_end)
        && tstzrange(new.start_date::timestamptz, (new.end_date + 1)::timestamptz, '[)')
  limit 1;
  if found then
    raise exception
      'Ce collaborateur est affecté à la mission % sur cette période. Réaffectez-la avant de valider le congé.',
      v_ref
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

revoke all on function app.guard_leave_against_missions() from public, anon, authenticated;

create trigger leave_requests_guard_missions
  before insert or update on public.leave_requests
  for each row execute function app.guard_leave_against_missions();

-- -----------------------------------------------------------------------------
-- 3. Les récurrences : chaque occurrence tracée
-- -----------------------------------------------------------------------------
create type public.recurring_occurrence_status as enum ('created', 'skipped');

revoke all on type public.recurring_occurrence_status from public, anon;
grant usage on type public.recurring_occurrence_status to authenticated, service_role;

create table public.recurring_task_occurrences (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  recurring_task_id  uuid not null references public.recurring_tasks (id) on delete cascade,
  occurrence_date    date not null,
  status             public.recurring_occurrence_status not null,
  mission_id         uuid references public.missions (id) on delete set null,
  reason             text,
  created_at         timestamptz not null default now(),

  -- Une occurrence par tâche et par date : le générateur peut repasser
  -- autant de fois qu'il veut, il ne crée jamais deux fois la même visite.
  unique (recurring_task_id, occurrence_date),
  constraint recurring_task_occurrences_reason_length check (reason is null or length(reason) <= 500)
);

comment on table public.recurring_task_occurrences is
  'Trace de chaque passage du générateur sur une tâche récurrente : mission créée, ou ignorée et pourquoi.';

create index recurring_task_occurrences_task_idx on public.recurring_task_occurrences (recurring_task_id, occurrence_date desc);

alter table public.recurring_task_occurrences enable row level security;
revoke all on public.recurring_task_occurrences from public, anon, authenticated, service_role;
grant select on public.recurring_task_occurrences to authenticated;
grant all on public.recurring_task_occurrences to service_role;

create policy recurring_task_occurrences_select
  on public.recurring_task_occurrences for select to authenticated
  using ((select app.can_use_pro_module(organization_id, 'planning'))
     and (select app.has_org_permission(organization_id, 'planning.view')));

-- Le générateur avance la date ; le client ne la recule pas en dessous
-- d'une occurrence déjà créée, sinon la même visite reviendrait.
alter table public.recurring_tasks
  add column last_generated_on date,
  add column generated_count integer not null default 0;

-- -----------------------------------------------------------------------------
-- 4. Le générateur
-- -----------------------------------------------------------------------------
create or replace function app.recurrence_step(p_frequency public.recurrence_frequency)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_frequency
    when 'weekly'    then interval '1 week'
    when 'monthly'   then interval '1 month'
    when 'quarterly' then interval '3 months'
    when 'bi_annual' then interval '6 months'
    when 'yearly'    then interval '1 year'
  end;
$$;

revoke all on function app.recurrence_step(public.recurrence_frequency) from public, anon;

/**
 * Crée les missions des tâches récurrentes échues d'ici `p_horizon_days`.
 *
 * `security definer`, hors RLS : c'est le cron qui l'appelle. Les triggers de
 * `missions` s'appliquent quand même — référence, organisation du technicien,
 * conflits, quota de formule. Un refus n'arrête pas les autres tâches : il est
 * tracé « skipped » avec sa raison, et la date n'avance pas, pour être
 * retentée le lendemain.
 *
 * Rattrapage borné : si le cron a manqué des jours, on crée les occurrences
 * en retard, douze au plus par tâche et par passage — au-delà, quelque chose
 * ne va pas et il vaut mieux le voir dans les occurrences que de créer cent
 * missions d'un coup.
 */
create or replace function app.generate_recurring_missions(p_horizon_days integer default 14)
returns table (created integer, skipped integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task      record;
  v_customer  public.customers%rowtype;
  v_site      public.sites%rowtype;
  v_tz        text;
  v_start     timestamptz;
  v_end       timestamptz;
  v_mission   uuid;
  v_tours     integer;
  v_created   integer := 0;
  v_skipped   integer := 0;
begin
  for v_task in
    select t.* from public.recurring_tasks t
    where t.is_active
      and t.next_date <= current_date + p_horizon_days
    order by t.next_date, t.id
    for update of t skip locked
  loop
    v_tours := 0;

    while v_task.next_date <= current_date + p_horizon_days and v_tours < 12 loop
      v_tours := v_tours + 1;

      -- Déjà faite (repassage, ou rattrapage) : on avance sans rien créer.
      if exists (select 1 from public.recurring_task_occurrences o
                 where o.recurring_task_id = v_task.id and o.occurrence_date = v_task.next_date and o.status = 'created') then
        v_task.next_date := v_task.next_date + app.recurrence_step(v_task.frequency);
        continue;
      end if;

      select o.timezone into v_tz from public.organizations o where o.id = v_task.organization_id;
      v_start := (v_task.next_date + time '08:00') at time zone coalesce(v_tz, 'Europe/Paris');
      v_end   := v_start + make_interval(mins => coalesce(v_task.estimated_minutes, 60));

      v_customer := null; v_site := null;
      if v_task.customer_id is not null then
        select * into v_customer from public.customers c where c.id = v_task.customer_id;
      end if;
      if v_task.site_id is not null then
        select * into v_site from public.sites s where s.id = v_task.site_id;
      end if;

      begin
        insert into public.missions (
          organization_id, title, description, intervention_type_id, customer_id, site_id,
          status, assigned_user_id, scheduled_start, scheduled_end,
          customer_name, customer_phone, customer_email,
          location_label, postal_code, city, country, latitude, longitude,
          created_by
        ) values (
          v_task.organization_id, v_task.title, v_task.notes, v_task.intervention_type_id, v_task.customer_id, v_task.site_id,
          case when v_task.assigned_member_id is null then 'draft' else 'assigned' end,
          v_task.assigned_member_id, v_start, v_end,
          v_customer.name, v_customer.phone, v_customer.email,
          coalesce(v_site.name, v_customer.name),
          coalesce(v_site.postal_code, v_customer.postal_code),
          coalesce(v_site.city, v_customer.city),
          coalesce(v_site.country, v_customer.country, 'FR'),
          v_site.latitude, v_site.longitude,
          v_task.created_by
        ) returning id into v_mission;

        -- Même trace que `assignMission` côté client : la mission dit qui, la
        -- ligne d'affectation dit quand et par qui (l'auteur de la tâche).
        if v_task.assigned_member_id is not null then
          insert into public.mission_assignments (mission_id, member_id, assigned_by)
          values (v_mission, v_task.assigned_member_id, v_task.created_by);
        end if;

        insert into public.recurring_task_occurrences (organization_id, recurring_task_id, occurrence_date, status, mission_id)
        values (v_task.organization_id, v_task.id, v_task.next_date, 'created', v_mission)
        on conflict (recurring_task_id, occurrence_date)
        do update set status = 'created', mission_id = excluded.mission_id, reason = null;

        v_created := v_created + 1;
        update public.recurring_tasks
        set next_date = v_task.next_date + app.recurrence_step(v_task.frequency),
            last_generated_on = v_task.next_date,
            generated_count = generated_count + 1
        where id = v_task.id;
        v_task.next_date := v_task.next_date + app.recurrence_step(v_task.frequency);

      exception when others then
        -- Quota de formule, technicien en congé, conflit non reconnu… La
        -- raison est tracée, la date n'avance pas : on retentera.
        insert into public.recurring_task_occurrences (organization_id, recurring_task_id, occurrence_date, status, reason)
        values (v_task.organization_id, v_task.id, v_task.next_date, 'skipped', left(sqlerrm, 500))
        on conflict (recurring_task_id, occurrence_date)
        do update set status = 'skipped', reason = excluded.reason;
        v_skipped := v_skipped + 1;
        exit;
      end;
    end loop;
  end loop;

  return query select v_created, v_skipped;
end;
$$;

revoke all on function app.generate_recurring_missions(integer) from public, anon, authenticated;

-- Chaque nuit, 04:30 UTC : après les relances de devis, avant l'ouverture.
select cron.schedule(
  'recurring-missions-generate',
  '30 4 * * *',
  $$select app.generate_recurring_missions(14)$$
);

/**
 * Le même générateur, à la demande, pour UNE organisation — le bouton
 * « Générer maintenant » d'un responsable qui vient de créer une tâche et
 * ne veut pas attendre la nuit. Réservé à `planning.manage`.
 */
create or replace function public.run_recurring_tasks(p_organization_id uuid, p_horizon_days integer default 14)
returns table (created integer, skipped integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_org_permission(p_organization_id, 'planning.manage') then
    raise exception 'Réservé à la gestion du planning.' using errcode = 'insufficient_privilege';
  end if;

  -- Le générateur global fait tout ; on ne relit ici que le compte de
  -- cette organisation depuis les occurrences du jour.
  perform app.generate_recurring_missions(p_horizon_days);

  return query
    select
      count(*) filter (where o.status = 'created')::integer,
      count(*) filter (where o.status = 'skipped')::integer
    from public.recurring_task_occurrences o
    where o.organization_id = p_organization_id
      and o.created_at >= now() - interval '1 minute';
end;
$$;

revoke all on function public.run_recurring_tasks(uuid, integer) from public, anon;
grant execute on function public.run_recurring_tasks(uuid, integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Auto-vérification
-- -----------------------------------------------------------------------------
do $$
declare v int;
begin
  if not exists (select 1 from cron.job where jobname = 'recurring-missions-generate') then
    raise exception 'Le cron des récurrences n''est pas planifié.';
  end if;
  select count(*) into v from pg_trigger where tgname in ('missions_guard_schedule', 'mission_assignments_guard_schedule', 'leave_requests_guard_missions');
  if v <> 3 then raise exception '% garde(s) de planning au lieu de 3.', v; end if;
end $$;
