-- =============================================================================
-- Planning : congés, soldes et tâches récurrentes
-- =============================================================================
--
-- LE CONSTAT
--
-- L'écran « Planning & Congés » est complet — demandes, validation, soldes,
-- récurrences, jours fériés par territoire, import et export iCalendar — et ne
-- persiste RIEN. Tout tient dans un `useState` alimenté par
-- `mock-planning-data.ts`. Une demande de congé saisie disparaît au
-- rechargement de la page.
--
-- Ce n'est pas une donnée de confort. Un solde de congés payés est une créance
-- du salarié sur l'employeur, et le refus d'une demande doit pouvoir être
-- retrouvé, daté, et attribué à quelqu'un.
--
-- CE QUI EST MODÉLISÉ, ET CE QUI NE L'EST PAS
--
-- Les JOURS FÉRIÉS ne sont pas une table. Les onze fériés français et leurs
-- variantes ultramarines se calculent — Pâques donne le lundi de Pâques,
-- l'Ascension et la Pentecôte. Une table les figerait année par année et
-- demanderait une migration chaque décembre. Ils restent une fonction pure
-- côté client.
--
-- Les ÉVÉNEMENTS DE CALENDRIER ne sont pas une table non plus. Le calendrier
-- affiche des missions, des congés et des tâches récurrentes : trois objets qui
-- existent déjà. Une table `calendar_events` les dupliquerait, et deux copies
-- d'une même vérité finissent toujours par diverger. La vue est composée à la
-- lecture.
--
-- Le SOLDE RESTANT n'est pas stocké. Seul l'ACQUIS l'est ; le restant se déduit
-- des congés approuvés. Stocker les deux, c'est garantir qu'ils divergeront le
-- jour où une demande sera annulée sans que le solde soit repris.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'leave_type') then
    create type public.leave_type as enum (
      'paid_leave', 'rtt', 'sick_leave', 'unpaid', 'family', 'recovery'
    );
  end if;

  -- `cancelled` existe en plus des trois états de l'interface : une demande
  -- retirée par son auteur n'est pas un refus, et confondre les deux fausserait
  -- autant les soldes que l'historique social.
  if not exists (select 1 from pg_type where typname = 'leave_status') then
    create type public.leave_status as enum (
      'pending', 'approved', 'rejected', 'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'recurrence_frequency') then
    create type public.recurrence_frequency as enum (
      'weekly', 'monthly', 'quarterly', 'bi_annual', 'yearly'
    );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- app.is_own_membership — « cette ligne parle-t-elle de moi ? »
-- -----------------------------------------------------------------------------
--
-- Une policy de congés doit distinguer « voir les demandes de l'équipe » de
-- « voir les miennes ». La seconde ne demande aucune permission : un salarié
-- consulte toujours ses propres congés.
--
-- `security definer` parce que la sous-requête sur `organization_members`
-- serait sinon elle-même filtrée par RLS, avec le risque de récursion que cela
-- suppose. Même raison d'être que `app.is_mission_assignee`.
create or replace function app.is_own_membership(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.id = p_member_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function app.is_own_membership(uuid) from public;
grant execute on function app.is_own_membership(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- leave_requests
-- -----------------------------------------------------------------------------
create table if not exists public.leave_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Vers le MEMBRE, pas vers l'utilisateur : une même personne peut appartenir
  -- à plusieurs entreprises, et ses congés ne sont pas les mêmes chez chacune.
  member_id       uuid not null references public.organization_members (id) on delete cascade,
  type            public.leave_type not null,
  start_date      date not null,
  end_date        date not null,
  -- Demi-journées comptées : `numeric(4,1)` et non `integer`.
  days_count      numeric(4,1) not null check (days_count > 0 and days_count <= 366),
  reason          text check (reason is null or char_length(reason) <= 1000),
  status          public.leave_status not null default 'pending',
  requested_at    timestamptz not null default now(),
  reviewed_by     uuid references auth.users (id) on delete set null,
  reviewed_at     timestamptz,
  review_note     text check (review_note is null or char_length(review_note) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint leave_requests_dates_ordered check (end_date >= start_date),

  -- Une décision porte une trace ou n'en est pas une. Symétriquement, une
  -- demande en attente ne peut pas déjà désigner un décideur.
  constraint leave_requests_review_coherent check (
    (status = 'pending' and reviewed_at is null)
    or (status = 'cancelled')
    or (status in ('approved', 'rejected') and reviewed_at is not null)
  )
);

create index if not exists leave_requests_org_status_idx
  on public.leave_requests (organization_id, status, start_date desc);

-- Le solde restant s'obtient en sommant les congés approuvés d'un membre sur
-- une année : c'est la requête la plus fréquente de l'écran.
create index if not exists leave_requests_member_idx
  on public.leave_requests (member_id, start_date);

drop trigger if exists leave_requests_set_updated_at on public.leave_requests;
create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

drop trigger if exists leave_requests_organization_immutable on public.leave_requests;
create trigger leave_requests_organization_immutable
  before update on public.leave_requests
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Le membre concerné appartient à l'organisation
-- -----------------------------------------------------------------------------
create or replace function app.enforce_leave_member_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_org uuid;
begin
  select m.organization_id into v_member_org
  from public.organization_members m
  where m.id = new.member_id;

  if v_member_org is distinct from new.organization_id then
    raise exception 'Ce membre n''appartient pas à cette organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists leave_requests_member_org on public.leave_requests;
create trigger leave_requests_member_org
  before insert or update on public.leave_requests
  for each row execute function app.enforce_leave_member_org();

-- -----------------------------------------------------------------------------
-- Qui décide, et de quoi
-- -----------------------------------------------------------------------------
--
-- C'est la règle centrale de cette table, et elle ne peut PAS vivre dans une
-- policy : une policy raisonne par ligne, jamais par colonne. Ouvrir l'UPDATE à
-- un responsable pour qu'il approuve lui ouvrirait aussi la réécriture des
-- dates et du motif — exactement la faille qui avait été trouvée sur les
-- comptes rendus.
--
-- Quatre décisions appliquées ici :
--
--   1. Une demande naît TOUJOURS en attente. Personne ne s'auto-approuve en
--      posant `status = 'approved'` à l'insertion.
--   2. On ne décide pas de ses propres congés. Même règle, même motif que
--      `enforce_report_review_separation` : la comparaison porte sur
--      `auth.users.id`, pas sur l'identifiant de membership — une personne
--      pourrait posséder deux lignes de membership et se valider par ce détour.
--   3. L'auteur peut RETIRER sa demande tant qu'elle est en attente. C'est le
--      seul changement de statut qu'il maîtrise.
--   4. Une demande décidée est FIGÉE : ni les dates, ni le type, ni le membre
--      ne bougent après coup. Revenir sur une décision passe par une nouvelle
--      demande, ce qui laisse une trace.
--
-- L'horodatage et l'identité du décideur sont posés par le SERVEUR. Le client
-- ne les fournit jamais — même principe que `enforce_intervention_scope`.
create or replace function app.enforce_leave_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor      uuid := (select auth.uid());
  v_subject    uuid;
  v_can_decide boolean;
begin
  select m.user_id into v_subject
  from public.organization_members m
  where m.id = new.member_id;

  v_can_decide := app.has_org_permission(new.organization_id, 'leave.approve');

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'Une demande de congé est créée en attente de validation.'
        using errcode = 'check_violation';
    end if;

    -- Saisir pour quelqu'un d'autre est un acte de gestion, pas une demande.
    if v_subject is distinct from v_actor and not v_can_decide then
      raise exception 'Vous ne pouvez déposer une demande que pour vous-même.'
        using errcode = 'insufficient_privilege';
    end if;

    new.reviewed_by := null;
    new.reviewed_at := null;
    return new;
  end if;

  -- À partir d'ici : UPDATE.
  if old.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée : elle n''est plus modifiable.'
      using errcode = 'check_violation';
  end if;

  if new.member_id is distinct from old.member_id then
    raise exception 'Une demande ne change pas de titulaire.'
      using errcode = 'check_violation';
  end if;

  if new.status = old.status then
    -- Simple correction avant décision : réservée à l'auteur.
    if v_subject is distinct from v_actor then
      raise exception 'Seul l''auteur peut corriger sa demande.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.status = 'cancelled' then
    if v_subject is distinct from v_actor and not v_can_decide then
      raise exception 'Seul l''auteur peut retirer sa demande.'
        using errcode = 'insufficient_privilege';
    end if;
    new.reviewed_by := null;
    new.reviewed_at := now();
    return new;
  end if;

  if new.status in ('approved', 'rejected') then
    if not v_can_decide then
      raise exception 'Vous n''avez pas le droit de statuer sur une demande de congé.'
        using errcode = 'insufficient_privilege';
    end if;

    if v_subject = v_actor then
      raise exception 'Vous ne pouvez pas statuer sur vos propres congés.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Le serveur signe et horodate. Ce que le client aurait envoyé est écrasé.
    new.reviewed_by := v_actor;
    new.reviewed_at := now();

    -- Une décision ne réécrit pas la demande.
    new.type       := old.type;
    new.start_date := old.start_date;
    new.end_date   := old.end_date;
    new.days_count := old.days_count;
    new.reason     := old.reason;
    return new;
  end if;

  raise exception 'Transition de statut non autorisée.' using errcode = 'check_violation';
end;
$$;

drop trigger if exists leave_requests_decision on public.leave_requests;
create trigger leave_requests_decision
  before insert or update on public.leave_requests
  for each row execute function app.enforce_leave_decision();

-- -----------------------------------------------------------------------------
-- leave_balances
-- -----------------------------------------------------------------------------
--
-- Une ligne par membre et par année de référence. Seul l'ACQUIS est stocké :
-- ce que le salarié a gagné. Ce qu'il a consommé se lit dans `leave_requests`,
-- et le restant est la différence. Une seule vérité, donc pas de reprise de
-- solde à faire lorsqu'une demande est annulée.
create table if not exists public.leave_balances (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  member_id           uuid not null references public.organization_members (id) on delete cascade,
  -- Année de référence, au sens de la période d'acquisition.
  year                integer not null check (year between 2000 and 2100),
  paid_leave_acquired numeric(5,1) not null default 0 check (paid_leave_acquired >= 0),
  rtt_acquired        numeric(5,1) not null default 0 check (rtt_acquired >= 0),
  -- Heures, pas jours : la récupération se compte en heures dans la plupart des
  -- conventions du bâtiment et des télécoms.
  recovery_hours      numeric(6,2) not null default 0 check (recovery_hours >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint leave_balances_unique_member_year unique (member_id, year)
);

create index if not exists leave_balances_org_year_idx
  on public.leave_balances (organization_id, year);

drop trigger if exists leave_balances_set_updated_at on public.leave_balances;
create trigger leave_balances_set_updated_at
  before update on public.leave_balances
  for each row execute function public.set_updated_at();

drop trigger if exists leave_balances_organization_immutable on public.leave_balances;
create trigger leave_balances_organization_immutable
  before update on public.leave_balances
  for each row execute function app.enforce_organization_immutable();

create or replace function app.enforce_balance_member_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_org uuid;
begin
  select m.organization_id into v_member_org
  from public.organization_members m
  where m.id = new.member_id;

  if v_member_org is distinct from new.organization_id then
    raise exception 'Ce membre n''appartient pas à cette organisation.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists leave_balances_member_org on public.leave_balances;
create trigger leave_balances_member_org
  before insert or update on public.leave_balances
  for each row execute function app.enforce_balance_member_org();

-- -----------------------------------------------------------------------------
-- recurring_tasks
-- -----------------------------------------------------------------------------
--
-- L'entretien annuel d'une PAC, la tonte bimensuelle d'une copropriété, la
-- vérification semestrielle d'un coffret : un modèle de mission qui revient.
--
-- Ce n'est PAS un planificateur. Aucun `pg_cron` ne crée de mission ici : la
-- table dit ce qui doit revenir et quand, l'entreprise décide de générer la
-- mission. Automatiser la création avant qu'un usage réel ne l'exige
-- fabriquerait des missions que personne n'attend.
create table if not exists public.recurring_tasks (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  title                text not null check (char_length(title) between 2 and 200),
  frequency            public.recurrence_frequency not null,
  next_date            date not null,
  -- Le client par sa fiche, pas par son nom : un texte libre ne survit ni à un
  -- homonyme ni à un changement de raison sociale.
  customer_id          uuid references public.customers (id) on delete set null,
  site_id              uuid references public.sites (id) on delete set null,
  assigned_member_id   uuid references public.organization_members (id) on delete set null,
  -- Rattachement au métier de l'organisation, comme les missions.
  intervention_type_id uuid references public.intervention_types (id) on delete set null,
  estimated_minutes    integer check (estimated_minutes is null or estimated_minutes between 5 and 10080),
  notes                text check (notes is null or char_length(notes) <= 2000),
  is_active            boolean not null default true,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists recurring_tasks_org_next_idx
  on public.recurring_tasks (organization_id, next_date)
  where is_active;

drop trigger if exists recurring_tasks_set_updated_at on public.recurring_tasks;
create trigger recurring_tasks_set_updated_at
  before update on public.recurring_tasks
  for each row execute function public.set_updated_at();

drop trigger if exists recurring_tasks_organization_immutable on public.recurring_tasks;
create trigger recurring_tasks_organization_immutable
  before update on public.recurring_tasks
  for each row execute function app.enforce_organization_immutable();

-- Client, site, membre et type d'intervention doivent tous appartenir à la même
-- organisation. Sans ce contrôle, un identifiant forgé rattacherait la tâche au
-- client d'une autre entreprise : la policy ne vérifie que `organization_id`,
-- jamais ce que la ligne référence.
create or replace function app.enforce_recurring_task_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.customer_id is not null then
    select c.organization_id into v_org from public.customers c where c.id = new.customer_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Ce client n''appartient pas à cette organisation.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  if new.site_id is not null then
    select s.organization_id into v_org from public.sites s where s.id = new.site_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Ce site n''appartient pas à cette organisation.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  if new.assigned_member_id is not null then
    select m.organization_id into v_org
    from public.organization_members m where m.id = new.assigned_member_id;
    if v_org is distinct from new.organization_id then
      raise exception 'Ce membre n''appartient pas à cette organisation.'
        using errcode = 'foreign_key_violation';
    end if;
  end if;

  -- Le type d'intervention doit relever du métier de l'organisation : même
  -- règle que pour les missions, même motif.
  if new.intervention_type_id is not null then
    if not exists (
      select 1
      from public.intervention_types t
      join public.organizations o on o.id = new.organization_id
      where t.id = new.intervention_type_id
        and (t.industry_code is null or t.industry_code = o.industry)
    ) then
      raise exception 'Ce type d''intervention ne relève pas du métier de cette organisation.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists recurring_tasks_refs on public.recurring_tasks;
create trigger recurring_tasks_refs
  before insert or update on public.recurring_tasks
  for each row execute function app.enforce_recurring_task_refs();

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
--
-- `leave.request` est donnée à TOUS les rôles, technicien et employé compris :
-- poser un congé n'est pas un privilège de gestion. Voir les congés des AUTRES
-- en est un — d'où la distinction avec `leave.view`, qui s'arrête au chef
-- d'équipe pour qu'il puisse organiser ses semaines.
--
-- `leave.approve` s'arrête au responsable. Un chef d'équipe constate les
-- absences, il ne les accorde pas : c'est une décision d'employeur.
insert into public.role_permissions (role, permission) values
  ('owner',       'leave.view'),
  ('owner',       'leave.request'),
  ('owner',       'leave.approve'),
  ('owner',       'planning.view'),
  ('owner',       'planning.manage'),
  ('admin',       'leave.view'),
  ('admin',       'leave.request'),
  ('admin',       'leave.approve'),
  ('admin',       'planning.view'),
  ('admin',       'planning.manage'),
  ('manager',     'leave.view'),
  ('manager',     'leave.request'),
  ('manager',     'leave.approve'),
  ('manager',     'planning.view'),
  ('manager',     'planning.manage'),
  ('team_leader', 'leave.view'),
  ('team_leader', 'leave.request'),
  ('team_leader', 'planning.view'),
  ('technician',  'leave.request'),
  ('technician',  'planning.view'),
  ('employee',    'leave.request')
on conflict (role, permission) do nothing;

-- -----------------------------------------------------------------------------
-- Entitlement
-- -----------------------------------------------------------------------------
--
-- `null` = illimité. Comme pour le parc matériel, ce n'est pas un volume qui
-- distingue les offres mais l'accès au module : l'ABSENCE de la clé pour `free`
-- et `pro` suffit à le refuser.
insert into public.plan_features (plan_code, feature_key, limit_value) values
  ('business', 'planning', null),
  ('ultimate', 'planning', null)
on conflict (plan_code, feature_key) do update set
  limit_value = excluded.limit_value;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- -----------------------------------------------------------------------------
revoke all on public.leave_requests  from public, anon, authenticated;
revoke all on public.leave_balances  from public, anon, authenticated;
revoke all on public.recurring_tasks from public, anon, authenticated;

grant select, insert, update, delete on public.leave_requests  to authenticated;
grant select, insert, update         on public.leave_balances  to authenticated;
grant select, insert, update, delete on public.recurring_tasks to authenticated;

alter table public.leave_requests  enable row level security;
alter table public.leave_balances  enable row level security;
alter table public.recurring_tasks enable row level security;

-- ── leave_requests ───────────────────────────────────────────────────────────
--
-- Un salarié voit TOUJOURS ses propres demandes, sans aucune permission. Voir
-- celles des autres exige `leave.view`.
drop policy if exists "leave_requests_select" on public.leave_requests;
create policy "leave_requests_select"
  on public.leave_requests for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (
      (select app.has_org_permission(organization_id, 'leave.view'))
      or (select app.is_own_membership(member_id))
    )
  );

drop policy if exists "leave_requests_insert" on public.leave_requests;
create policy "leave_requests_insert"
  on public.leave_requests for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'leave.request'))
  );

-- L'UPDATE est ouvert largement, et c'est ASSUMÉ : le trigger
-- `enforce_leave_decision` décide de ce qui peut réellement changer, parce que
-- la règle porte sur une TRANSITION et non sur un état. Une policy ne sait pas
-- exprimer « vous pouvez passer ceci de "en attente" à "approuvé", mais pas en
-- réécrire les dates ».
drop policy if exists "leave_requests_update" on public.leave_requests;
create policy "leave_requests_update"
  on public.leave_requests for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (
      (select app.has_org_permission(organization_id, 'leave.approve'))
      or (select app.is_own_membership(member_id))
    )
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (
      (select app.has_org_permission(organization_id, 'leave.approve'))
      or (select app.is_own_membership(member_id))
    )
  );

-- Supprimer une demande efface une trace sociale. Réservé à qui décide, et le
-- retrait ordinaire passe par le statut `cancelled`, qui laisse la ligne.
drop policy if exists "leave_requests_delete" on public.leave_requests;
create policy "leave_requests_delete"
  on public.leave_requests for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'leave.approve'))
  );

-- ── leave_balances ───────────────────────────────────────────────────────────
--
-- Chacun voit son solde. Le fixer relève de l'employeur : `leave.approve`.
-- Aucune policy de suppression — un solde se corrige, il ne s'efface pas.
drop policy if exists "leave_balances_select" on public.leave_balances;
create policy "leave_balances_select"
  on public.leave_balances for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (
      (select app.has_org_permission(organization_id, 'leave.view'))
      or (select app.is_own_membership(member_id))
    )
  );

drop policy if exists "leave_balances_insert" on public.leave_balances;
create policy "leave_balances_insert"
  on public.leave_balances for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'leave.approve'))
  );

drop policy if exists "leave_balances_update" on public.leave_balances;
create policy "leave_balances_update"
  on public.leave_balances for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'leave.approve'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'leave.approve'))
  );

-- ── recurring_tasks ──────────────────────────────────────────────────────────
drop policy if exists "recurring_tasks_select" on public.recurring_tasks;
create policy "recurring_tasks_select"
  on public.recurring_tasks for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'planning.view'))
  );

drop policy if exists "recurring_tasks_insert" on public.recurring_tasks;
create policy "recurring_tasks_insert"
  on public.recurring_tasks for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'planning.manage'))
  );

drop policy if exists "recurring_tasks_update" on public.recurring_tasks;
create policy "recurring_tasks_update"
  on public.recurring_tasks for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'planning.manage'))
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'planning.manage'))
  );

drop policy if exists "recurring_tasks_delete" on public.recurring_tasks;
create policy "recurring_tasks_delete"
  on public.recurring_tasks for delete
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'planning'))
    and (select app.has_org_permission(organization_id, 'planning.manage'))
  );
