-- =============================================================================
-- Statistiques d'activité
-- =============================================================================
--
-- LE CONSTAT
--
-- L'écran Statistiques affichait des chiffres écrits en dur dans le composant :
-- volumes de missions, taux de conformité, temps d'intervention, répartition par
-- client. Ils ne bougeaient jamais, quelle que soit l'activité réelle.
--
-- POURQUOI UNE FONCTION ET NON UNE VUE
--
-- Une vue n'accepte pas de paramètre. Les agrégats sont bornés par une période
-- que l'utilisateur choisit ; il faudrait sinon rapatrier toutes les missions
-- pour les compter dans le navigateur — ce qui reviendrait à faire transiter
-- l'intégralité du plan de charge pour afficher quatre nombres.
--
-- POURQUOI `security definer`
--
-- Les compteurs portent sur l'ENSEMBLE de l'organisation. Un chef d'équipe voit
-- ses seules missions par `missions_select_scoped` ; s'il détient
-- `statistics.view`, il doit pourtant lire le volume global. La fonction
-- contourne donc la RLS — mais vérifie elle-même, en première instruction, que
-- l'appelant possède bien cette permission ET l'entitlement du plan.
--
-- Aucune donnée nominative n'en sort : uniquement des nombres agrégés et, pour
-- la répartition, le nom des clients de l'organisation — que `statistics.view`
-- autorise précisément à consulter.
-- =============================================================================

create or replace function public.organization_activity_stats(
  p_organization_id uuid,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := coalesce(p_from, now() - interval '90 days');
  v_to   timestamptz := coalesce(p_to, now());
  v_result jsonb;
begin
  -- Le contrôle vient AVANT toute lecture : une fonction `security definer` qui
  -- lit d'abord et filtre ensuite laisse fuir par ses messages d'erreur.
  if not app.can_use_pro_module(p_organization_id, 'statistics') then
    raise exception 'Cette formule ne comprend pas les statistiques.'
      using errcode = 'insufficient_privilege';
  end if;

  if not app.has_org_permission(p_organization_id, 'statistics.view') then
    raise exception 'Vous n''avez pas accès aux statistiques de cette organisation.'
      using errcode = 'insufficient_privilege';
  end if;

  with scoped as (
    select m.*
    from public.missions m
    where m.organization_id = p_organization_id
      and m.created_at >= v_from
      and m.created_at <= v_to
  ),
  by_status as (
    select status::text as status, count(*) as total
    from scoped
    group by status
  ),
  by_priority as (
    select priority::text as priority, count(*) as total
    from scoped
    group by priority
  ),
  by_customer as (
    select
      coalesce(c.name, s.customer_name, 'Client non renseigné') as customer,
      count(*) as total
    from scoped s
    left join public.customers c on c.id = s.customer_id
    group by 1
    order by 2 desc
    limit 8
  ),
  worked as (
    -- Temps net : seuls les segments de travail CLOS comptent. Un segment
    -- ouvert appartient à une intervention en cours, dont la durée n'est pas
    -- encore un fait.
    select coalesce(sum(extract(epoch from (t.ended_at - t.started_at))), 0)::bigint as seconds
    from public.intervention_time_entries t
    join public.interventions i on i.id = t.intervention_id
    where t.organization_id = p_organization_id
      and t.kind = 'work'
      and t.ended_at is not null
      and t.started_at >= v_from
      and t.started_at <= v_to
      and i.organization_id = p_organization_id
  ),
  reports as (
    select
      count(*) filter (where r.status = 'approved') as approved,
      count(*) filter (where r.status = 'rejected') as rejected,
      count(*) filter (where r.status = 'submitted') as pending
    from public.intervention_reports r
    where r.organization_id = p_organization_id
      and r.created_at >= v_from
      and r.created_at <= v_to
  )
  select jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'missions_total', (select count(*) from scoped),
    'missions_by_status', coalesce(
      (select jsonb_object_agg(status, total) from by_status), '{}'::jsonb
    ),
    'missions_by_priority', coalesce(
      (select jsonb_object_agg(priority, total) from by_priority), '{}'::jsonb
    ),
    'customers', coalesce(
      (select jsonb_agg(jsonb_build_object('name', customer, 'missions', total)) from by_customer),
      '[]'::jsonb
    ),
    'worked_seconds', (select seconds from worked),
    'interventions_total', (
      select count(*) from public.interventions i
      where i.organization_id = p_organization_id
        and i.created_at >= v_from and i.created_at <= v_to
    ),
    'reports_approved', (select approved from reports),
    'reports_rejected', (select rejected from reports),
    'reports_pending',  (select pending  from reports),
    'active_members', (
      select count(*) from public.organization_members m
      where m.organization_id = p_organization_id and m.status = 'active'
    ),
    'active_teams', (
      select count(*) from public.teams t
      where t.organization_id = p_organization_id and t.status = 'active'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.organization_activity_stats(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.organization_activity_stats(uuid, timestamptz, timestamptz)
  to authenticated;
