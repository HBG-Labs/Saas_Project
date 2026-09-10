-- =============================================================================
-- Un seul chronomètre actif par utilisateur, bascule atomique
-- =============================================================================
--
-- L'index historique ne protégeait qu'une intervention. Un même technicien
-- pouvait donc démarrer deux interventions depuis deux onglets ou appareils.
-- Le frontend fermait ensuite un segment puis en ouvrait un autre en deux
-- requêtes : une coupure entre les deux arrêtait le chronomètre en silence.
-- =============================================================================

alter table public.intervention_time_entries
  add column if not exists technician_id uuid,
  add column if not exists technician_user_id uuid;

update public.intervention_time_entries e
set technician_id = i.technician_id,
    technician_user_id = m.user_id
from public.interventions i
join public.organization_members m on m.id = i.technician_id
where i.id = e.intervention_id
  and (e.technician_id is null or e.technician_user_id is null);

do $$
begin
  if exists (
    select 1
    from public.intervention_time_entries
    where technician_id is null or technician_user_id is null
  ) then
    raise exception 'Impossible d''identifier le technicien de certains segments de temps.';
  end if;
end
$$;

alter table public.intervention_time_entries
  alter column technician_id set not null,
  alter column technician_user_id set not null;

alter table public.intervention_time_entries
  add constraint intervention_time_entries_technician_id_fkey
  foreign key (technician_id)
  references public.organization_members (id)
  on delete restrict;

-- Si des doubles chronomètres existent déjà, garder le plus récent ouvert et
-- clore chaque ancien au démarrage du suivant. La période de chevauchement ne
-- sera ainsi jamais comptée deux fois.
alter table public.intervention_time_entries
  disable trigger intervention_time_entries_enforce;

with open_segments as (
  select
    id,
    lead(started_at) over (
      partition by technician_user_id
      order by started_at, id
    ) as next_started_at
  from public.intervention_time_entries
  where ended_at is null
)
update public.intervention_time_entries e
set ended_at = open_segments.next_started_at
from open_segments
where e.id = open_segments.id
  and open_segments.next_started_at is not null;

alter table public.intervention_time_entries
  enable trigger intervention_time_entries_enforce;

create index if not exists intervention_time_entries_technician_idx
  on public.intervention_time_entries (technician_id, started_at desc);

create unique index if not exists intervention_time_entries_user_open_idx
  on public.intervention_time_entries (technician_user_id)
  where ended_at is null;

-- L'identité et l'organisation viennent de l'affectation, jamais du navigateur.
create or replace function app.enforce_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_technician uuid;
  v_user uuid;
begin
  if tg_op = 'INSERT' then
    select i.organization_id, i.technician_id, m.user_id
      into v_org, v_technician, v_user
    from public.interventions i
    join public.organization_members m on m.id = i.technician_id
    where i.id = new.intervention_id;

    if v_org is null or v_technician is null or v_user is null then
      raise exception 'L''intervention ou son technicien est introuvable.'
        using errcode = 'foreign_key_violation';
    end if;

    new.organization_id := v_org;
    new.technician_id := v_technician;
    new.technician_user_id := v_user;
    new.started_at := now();
    new.ended_at := null;
    new.created_at := now();
    return new;
  end if;

  if old.ended_at is not null then
    raise exception 'Un segment de temps clos ne peut plus être modifié.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.id is distinct from old.id
     or new.intervention_id is distinct from old.intervention_id
     or new.organization_id is distinct from old.organization_id
     or new.technician_id is distinct from old.technician_id
     or new.technician_user_id is distinct from old.technician_user_id
     or new.kind is distinct from old.kind
     or new.started_at is distinct from old.started_at
     or new.reason is distinct from old.reason
     or new.created_at is distinct from old.created_at then
    raise exception 'Seule la clôture d''un segment de temps est permise.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.ended_at is not null then
    new.ended_at := now();
  end if;

  return new;
end;
$$;

-- Ferme le chronomètre actif du compte puis ouvre le segment demandé. Le verrou
-- transactionnel sérialise deux clics simultanés venant de deux appareils.
create or replace function public.switch_intervention_time_entry(
  p_intervention_id uuid,
  p_to public.time_entry_kind,
  p_reason text default null
)
returns public.intervention_time_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_technician uuid;
  v_entry public.intervention_time_entries;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'Le motif ne peut pas dépasser 500 caractères.'
      using errcode = 'check_violation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text, 0)
  );

  select i.organization_id, i.technician_id
    into v_org, v_technician
  from public.interventions i
  join public.organization_members m on m.id = i.technician_id
  where i.id = p_intervention_id
    and m.user_id = v_user
    and m.status = 'active'
    and i.status not in ('completed', 'cancelled')
    and app.can_use_pro_module(i.organization_id, 'interventions');

  if v_org is null then
    raise exception 'Intervention inaccessible ou déjà terminée.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.intervention_time_entries
  set ended_at = now()
  where technician_user_id = v_user
    and ended_at is null;

  insert into public.intervention_time_entries (
    intervention_id,
    organization_id,
    technician_id,
    technician_user_id,
    kind,
    reason
  ) values (
    p_intervention_id,
    v_org,
    v_technician,
    v_user,
    p_to,
    nullif(pg_catalog.btrim(p_reason), '')
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.switch_intervention_time_entry(
  uuid, public.time_entry_kind, text
) from public, anon;
grant execute on function public.switch_intervention_time_entry(
  uuid, public.time_entry_kind, text
) to authenticated;

comment on function public.switch_intervention_time_entry(
  uuid, public.time_entry_kind, text
) is 'Bascule atomiquement le chronomètre global du compte authentifié.';
