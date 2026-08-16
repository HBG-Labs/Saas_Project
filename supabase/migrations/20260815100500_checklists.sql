-- =============================================================================
-- Check-lists : ce qui a été FAIT, distinct de ce qui a été MESURÉ
-- =============================================================================
--
-- Un formulaire recueille des grandeurs : une puissance, une longueur, un type
-- de fibre. Une check-list atteste des GESTES : le local a été rangé, le
-- client a été informé, la mise à la terre a été vérifiée. Ce sont deux natures
-- de preuve, et un contrôleur les lit différemment.
--
-- ÉCART ASSUMÉ AVEC LE PLAN
--
-- Le plan prévoyait de loger les réponses de check-list dans
-- `intervention_form_responses.values`, sous une clé réservée, au motif que
-- deux tables pour un même écran seraient une complication sans contrepartie.
--
-- Deux faits, découverts en écrivant la phase précédente, l'interdisent :
--
--   1. `app.validate_form_response` REFUSE toute clé étrangère au modèle.
--      C'est une garantie qu'on ne veut pas affaiblir : elle empêche le
--      document de dériver. Y percer une exception pour une clé magique
--      reviendrait à ouvrir la porte qu'on venait de fermer.
--
--   2. `intervention_form_responses.form_template_id` est OBLIGATOIRE. Or un
--      type d'intervention peut avoir une check-list sans formulaire — un
--      entretien se constate par des gestes, pas par des mesures. Loger l'un
--      dans l'autre rendrait le second impossible sans le premier.
--
-- Deux tables symétriques, chacune avec sa validation, coûtent moins qu'une
-- table à deux moitiés facultatives.
--
-- LE BLOCAGE DE SOUMISSION
--
-- Un point obligatoire non coché empêche le compte rendu de partir au
-- contrôle. Appliqué par trigger, jamais par l'interface : c'est une garantie
-- de qualité d'exécution, pas une aide à la saisie.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- checklist_templates
-- -----------------------------------------------------------------------------
create table if not exists public.checklist_templates (
  id                   uuid primary key default gen_random_uuid(),
  intervention_type_id uuid not null references public.intervention_types (id) on delete cascade,
  version              integer not null default 1 check (version >= 1),
  label                text not null check (char_length(label) between 2 and 120),
  description          text,
  status               public.content_status not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (intervention_type_id, version)
);

create unique index if not exists checklist_templates_one_active_per_type
  on public.checklist_templates (intervention_type_id)
  where status = 'active';

drop trigger if exists checklist_templates_set_updated_at on public.checklist_templates;
create trigger checklist_templates_set_updated_at
  before update on public.checklist_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- checklist_items
-- -----------------------------------------------------------------------------
create table if not exists public.checklist_items (
  id                    uuid primary key default gen_random_uuid(),
  checklist_template_id uuid not null references public.checklist_templates (id) on delete cascade,
  -- Code stable : c'est lui qu'on retrouve dans le document de réponses.
  -- Renommer un libellé n'invalide donc pas les relevés déjà signés.
  code                  text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label                 text not null check (char_length(label) between 2 and 200),
  help                  text,
  required              boolean not null default false,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  unique (checklist_template_id, code)
);

create index if not exists checklist_items_template_order_idx
  on public.checklist_items (checklist_template_id, sort_order);

-- -----------------------------------------------------------------------------
-- intervention_checklist_responses
-- -----------------------------------------------------------------------------
--
-- `checked` est un TABLEAU de codes, et non un objet code → booléen. Un point
-- non coché est simplement absent : il n'y a pas de troisième état, et un
-- tableau ne peut pas contenir `false` par erreur.
create table if not exists public.intervention_checklist_responses (
  id                    uuid primary key default gen_random_uuid(),
  intervention_id       uuid not null unique references public.interventions (id) on delete cascade,
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  checklist_template_id uuid not null references public.checklist_templates (id) on delete restrict,
  checked               jsonb not null default '[]'::jsonb,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint intervention_checklist_responses_checked_array check (
    jsonb_typeof(checked) = 'array'
  )
);

create index if not exists intervention_checklist_responses_org_idx
  on public.intervention_checklist_responses (organization_id);

drop trigger if exists intervention_checklist_responses_set_updated_at
  on public.intervention_checklist_responses;
create trigger intervention_checklist_responses_set_updated_at
  before update on public.intervention_checklist_responses
  for each row execute function public.set_updated_at();

drop trigger if exists intervention_checklist_responses_organization_immutable
  on public.intervention_checklist_responses;
create trigger intervention_checklist_responses_organization_immutable
  before update on public.intervention_checklist_responses
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Validation
-- -----------------------------------------------------------------------------
create or replace function app.validate_checklist_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code    jsonb;
  v_missing text;
begin
  -- Aucun code étranger au modèle : sans ce contrôle, le document accumulerait
  -- des points que plus aucune check-list n'affiche.
  for v_code in select jsonb_array_elements(new.checked)
  loop
    if jsonb_typeof(v_code) <> 'string' then
      raise exception 'Un point de contrôle doit être identifié par son code.'
        using errcode = 'check_violation';
    end if;

    if not exists (
      select 1 from public.checklist_items i
      where i.checklist_template_id = new.checklist_template_id
        and i.code = (v_code #>> '{}')
    ) then
      raise exception 'Point de contrôle « % » inconnu de cette check-list.', v_code #>> '{}'
        using errcode = 'check_violation';
    end if;
  end loop;

  -- Les points obligatoires ne s'imposent qu'à la complétion : une check-list
  -- se remplit au fil de l'intervention, pas d'un bloc à la fin.
  if new.completed_at is not null then
    select i.label into v_missing
    from public.checklist_items i
    where i.checklist_template_id = new.checklist_template_id
      and i.required
      and not (new.checked @> jsonb_build_array(i.code))
    order by i.sort_order
    limit 1;

    if v_missing is not null then
      raise exception 'Point de contrôle obligatoire non validé : « % ».', v_missing
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists intervention_checklist_responses_validate
  on public.intervention_checklist_responses;
create trigger intervention_checklist_responses_validate
  before insert or update of checked, completed_at, checklist_template_id
  on public.intervention_checklist_responses
  for each row execute function app.validate_checklist_response();

-- Même garde que pour les formulaires : la réponse appartient à l'organisation
-- de l'intervention qu'elle documente.
drop trigger if exists intervention_checklist_responses_org_matches
  on public.intervention_checklist_responses;
create trigger intervention_checklist_responses_org_matches
  before insert or update of intervention_id, organization_id
  on public.intervention_checklist_responses
  for each row execute function app.enforce_form_response_org();

-- -----------------------------------------------------------------------------
-- Blocage de la soumission
-- -----------------------------------------------------------------------------
--
-- Un compte rendu ne part au contrôle que si les points obligatoires de sa
-- check-list sont validés. C'est le sens même d'un point obligatoire : sans
-- blocage, il n'est qu'une suggestion.
--
-- La règle vit au SERVEUR. L'interface masquera le bouton, mais une interface
-- n'est jamais une barrière — et c'est ici la qualité d'exécution qui est en
-- jeu, pas le confort de saisie.
--
-- Absence de check-list = rien à vérifier. Un type d'intervention sans
-- check-list se soumet comme avant.
create or replace function app.enforce_checklist_before_submit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type_id  uuid;
  v_template uuid;
  v_checked  jsonb;
  v_missing  text;
begin
  if new.status <> 'submitted' or old.status is not distinct from 'submitted' then
    return new;
  end if;

  select m.intervention_type_id into v_type_id
  from public.interventions i
  join public.missions m on m.id = i.mission_id
  where i.id = new.intervention_id;

  if v_type_id is null then
    return new;
  end if;

  select t.id into v_template
  from public.checklist_templates t
  where t.intervention_type_id = v_type_id and t.status = 'active';

  if v_template is null then
    return new;
  end if;

  select coalesce(r.checked, '[]'::jsonb) into v_checked
  from public.intervention_checklist_responses r
  where r.intervention_id = new.intervention_id;

  v_checked := coalesce(v_checked, '[]'::jsonb);

  select i.label into v_missing
  from public.checklist_items i
  where i.checklist_template_id = v_template
    and i.required
    and not (v_checked @> jsonb_build_array(i.code))
  order by i.sort_order
  limit 1;

  if v_missing is not null then
    raise exception
      'Compte rendu non transmissible : le point « % » de la check-list n''est pas validé.',
      v_missing
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists intervention_reports_checklist_gate on public.intervention_reports;
create trigger intervention_reports_checklist_gate
  before update of status on public.intervention_reports
  for each row execute function app.enforce_checklist_before_submit();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.intervention_checklist_responses enable row level security;

drop policy if exists "checklist_templates_select_authenticated" on public.checklist_templates;
create policy "checklist_templates_select_authenticated"
  on public.checklist_templates for select
  to authenticated
  using (status = 'active');

drop policy if exists "checklist_items_select_authenticated" on public.checklist_items;
create policy "checklist_items_select_authenticated"
  on public.checklist_items for select
  to authenticated
  using (
    exists (
      select 1 from public.checklist_templates t
      where t.id = checklist_items.checklist_template_id and t.status = 'active'
    )
  );

-- Mêmes droits que les réponses de formulaire : le technicien de
-- l'intervention écrit, lui plus ceux qui contrôlent peuvent lire.
drop policy if exists "intervention_checklist_responses_select"
  on public.intervention_checklist_responses;
create policy "intervention_checklist_responses_select"
  on public.intervention_checklist_responses for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and (
      (select app.has_org_permission(organization_id, 'intervention.view_all'))
      or (select app.has_org_permission(organization_id, 'intervention.review'))
      or intervention_id in (
        select i.id from public.interventions i
        join public.organization_members m on m.id = i.technician_id
        where m.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "intervention_checklist_responses_insert"
  on public.intervention_checklist_responses;
create policy "intervention_checklist_responses_insert"
  on public.intervention_checklist_responses for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and intervention_id in (
      select i.id from public.interventions i
      join public.organization_members m on m.id = i.technician_id
      where m.user_id = (select auth.uid())
    )
  );

drop policy if exists "intervention_checklist_responses_update"
  on public.intervention_checklist_responses;
create policy "intervention_checklist_responses_update"
  on public.intervention_checklist_responses for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and intervention_id in (
      select i.id from public.interventions i
      join public.organization_members m on m.id = i.technician_id
      where m.user_id = (select auth.uid())
    )
  )
  with check ((select app.can_use_pro_module(organization_id, 'interventions')));

revoke all on public.checklist_templates from public, anon, authenticated;
revoke all on public.checklist_items from public, anon, authenticated;
revoke all on public.intervention_checklist_responses from public, anon, authenticated;

grant select on public.checklist_templates to authenticated;
grant select on public.checklist_items to authenticated;
grant select, insert, update on public.intervention_checklist_responses to authenticated;
