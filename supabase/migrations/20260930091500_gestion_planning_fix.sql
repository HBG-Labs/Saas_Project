-- =============================================================================
-- Récurrences : le statut de la mission générée doit être un `mission_status`
-- =============================================================================
--
-- Dans 20260930090000, `case … then 'draft' else 'assigned' end` produisait du
-- TEXTE ; la colonne attend l'enum. Chaque occurrence était donc tracée
-- « skipped » avec cette raison, et aucune mission n'était créée. Trouvé par
-- la suite 21 à sa première exécution — c'est exactement ce que la trace des
-- occurrences est censée révéler.
--
-- Redéfinition de la fonction, avec le transtypage. Rien d'autre ne change.
-- =============================================================================

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
          (case when v_task.assigned_member_id is null then 'draft' else 'assigned' end)::public.mission_status,
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
