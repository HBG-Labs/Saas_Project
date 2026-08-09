-- =============================================================================
-- Temps d'intervention — démarrage, pause, reprise, fin
-- =============================================================================
--
-- LA LACUNE FONCTIONNELLE
--
-- `interventions` ne porte que `start_time` et `end_time`. Impossible d'en tirer
-- un temps NET : un technicien parti déjeuner quatre-vingt-dix minutes verrait
-- ce temps facturé au client. Le §7 du cahier des charges demande démarrage,
-- pause, reprise et fin ; la base n'en modélisait que les deux extrémités.
--
-- LA FAILLE, PLUS GRAVE
--
-- `interventions_update_scoped` ouvre l'écriture à l'intervenant, et son
-- `WITH CHECK` ne vérifie que l'appartenance. Mesuré sur la base : un technicien
-- a antidaté le début de son intervention de six heures, et a déplacé celle-ci
-- vers une autre mission.
--
-- Bâtir un relevé d'heures sur une table dont l'intéressé fixe l'horloge n'a
-- aucun sens. Un tel relevé sert à facturer un client, à payer un salarié et à
-- prouver qu'on est intervenu : il ne vaut que s'il est INopposable à celui
-- qu'il engage.
--
-- LE PRINCIPE RETENU
--
-- Le client déclare des ÉVÉNEMENTS — « je démarre », « je fais une pause » — et
-- le serveur pose l'heure. Aucun horodatage fourni par l'appelant n'est jamais
-- retenu, nulle part dans ce fichier.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'time_entry_kind') then
    create type public.time_entry_kind as enum ('work', 'pause');
  end if;
end
$$;

create table if not exists public.intervention_time_entries (
  id              uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions (id) on delete cascade,
  -- Dénormalisé pour que les policies filtrent sans jointure. ÉCRASÉ PAR TRIGGER.
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            public.time_entry_kind not null default 'work',
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  -- Motif d'une pause : déjeuner, attente de matériel, intempéries. Ce qui
  -- permet de distinguer un aléa de chantier d'une organisation défaillante.
  reason          text,
  created_at      timestamptz not null default now(),

  constraint intervention_time_entries_order check (ended_at is null or ended_at >= started_at)
);

create index if not exists intervention_time_entries_intervention_idx
  on public.intervention_time_entries (intervention_id, started_at);

-- UN SEUL SEGMENT OUVERT PAR INTERVENTION.
--
-- C'est cet index qui empêche le double démarrage. Le cas n'est pas théorique :
-- un technicien qui ouvre l'application sur son téléphone ET sur la tablette du
-- véhicule enverrait deux « démarrer », et compterait ses heures en double.
-- Aucune vérification côté client ne peut fermer cette porte — deux appareils,
-- deux sessions, aucune des deux ne voit l'autre.
create unique index if not exists intervention_time_entries_open_idx
  on public.intervention_time_entries (intervention_id)
  where ended_at is null;

-- -----------------------------------------------------------------------------
-- L'horloge appartient au serveur
-- -----------------------------------------------------------------------------
create or replace function app.enforce_time_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if tg_op = 'INSERT' then
    select i.organization_id into v_org
    from public.interventions i where i.id = new.intervention_id;

    if v_org is null then
      raise exception 'L''intervention référencée est introuvable.'
        using errcode = 'foreign_key_violation';
    end if;

    new.organization_id := v_org;

    -- L'heure de début n'est jamais celle que l'appelant annonce.
    new.started_at := now();
    new.ended_at := null;

    return new;
  end if;

  -- UPDATE : un segment clos est définitif. Le rouvrir ou en déplacer les bornes
  -- reviendrait à réécrire un relevé d'heures déjà constitué.
  if old.ended_at is not null then
    raise exception 'Un segment de temps clos ne peut plus être modifié.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.intervention_id is distinct from old.intervention_id
     or new.kind is distinct from old.kind
     or new.started_at is distinct from old.started_at then
    raise exception 'Seule la clôture d''un segment de temps est permise.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Clôture : là encore, c'est l'horloge du serveur qui fait foi.
  if new.ended_at is not null then
    new.ended_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists intervention_time_entries_enforce on public.intervention_time_entries;
create trigger intervention_time_entries_enforce
  before insert or update on public.intervention_time_entries
  for each row execute function app.enforce_time_entry();

-- -----------------------------------------------------------------------------
-- Temps net travaillé
-- -----------------------------------------------------------------------------
--
-- Somme des seuls segments `work` CLOS. Un segment en cours est délibérément
-- exclu : le compteur qui tourne à l'écran se calcule dans le navigateur à
-- partir de `started_at`, jamais stocké. Stocker un compteur inviterait
-- l'incohérence dès qu'un onglet se ferme.
create or replace function app.intervention_worked_seconds(p_intervention_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    sum(extract(epoch from (e.ended_at - e.started_at)))::integer,
    0
  )
  from public.intervention_time_entries e
  where e.intervention_id = p_intervention_id
    and e.kind = 'work'
    and e.ended_at is not null;
$$;

revoke all on function app.intervention_worked_seconds(uuid) from public, anon;
grant execute on function app.intervention_worked_seconds(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.intervention_time_entries enable row level security;

-- Lecture : qui voit l'intervention voit son relevé. La sous-requête réévalue
-- `interventions_select_scoped` — motif déjà employé partout ailleurs.
drop policy if exists "intervention_time_entries_select" on public.intervention_time_entries;
create policy "intervention_time_entries_select"
  on public.intervention_time_entries for select
  to authenticated
  using (intervention_id in (select i.id from public.interventions i));

-- Écriture réservée à l'INTERVENANT de cette intervention.
--
-- Pas au responsable : pointer les heures de quelqu'un d'autre viderait le
-- relevé de son sens. Un responsable consulte, il ne pointe pas.
drop policy if exists "intervention_time_entries_insert" on public.intervention_time_entries;
create policy "intervention_time_entries_insert"
  on public.intervention_time_entries for insert
  to authenticated
  with check (
    intervention_id in (
      select i.id
      from public.interventions i
      join public.organization_members m on m.id = i.technician_id
      where m.user_id = (select auth.uid())
        and (select app.can_use_pro_module(i.organization_id, 'interventions'))
    )
  );

drop policy if exists "intervention_time_entries_update" on public.intervention_time_entries;
create policy "intervention_time_entries_update"
  on public.intervention_time_entries for update
  to authenticated
  using (
    intervention_id in (
      select i.id
      from public.interventions i
      join public.organization_members m on m.id = i.technician_id
      where m.user_id = (select auth.uid())
    )
  )
  with check (
    intervention_id in (
      select i.id
      from public.interventions i
      join public.organization_members m on m.id = i.technician_id
      where m.user_id = (select auth.uid())
    )
  );

-- Aucune policy DELETE : un relevé d'heures est une pièce, pas un brouillon.

do $$
begin
  execute 'revoke all on public.intervention_time_entries from public, anon, authenticated';
end
$$;

grant select, insert, update on public.intervention_time_entries to authenticated;
