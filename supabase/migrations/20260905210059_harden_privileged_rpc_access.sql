-- =============================================================================
-- Durcissement des RPC privilégiées et de l'auto-édition des membres
-- =============================================================================
--
-- Cette migration ferme trois surfaces relevées par l'audit :
--   1. une auto-édition de membre ne doit jamais permettre de déplacer la ligne
--      vers une autre organisation ni d'altérer les attributs d'autorisation ;
--   2. le calcul du temps travaillé n'a pas besoin de contourner la RLS ;
--   3. les deux RPC documentaires IA sont exclusivement appelées par l'Edge
--      Function avec le rôle serveur, donc les sessions utilisateur n'ont pas
--      à pouvoir les exécuter directement.
--
-- Les RPC métier qui doivent rester accessibles au navigateur conservent leur
-- rôle, leur signature et leurs contrôles explicites.

-- -----------------------------------------------------------------------------
-- 1. Membres : seuls le poste et le téléphone sont auto-modifiables
-- -----------------------------------------------------------------------------

create or replace function app.prevent_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  -- Les tâches serveur et migrations n'ont pas de session utilisateur.
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Une appartenance est attachée définitivement à une personne et une
    -- entreprise. La déplacer créerait une appartenance dans un autre tenant.
    if new.id is distinct from old.id
       or new.organization_id is distinct from old.organization_id
       or new.user_id is distinct from old.user_id
       or new.invited_by is distinct from old.invited_by
       or new.joined_at is distinct from old.joined_at
       or new.created_at is distinct from old.created_at then
      raise exception 'Les attributs d''appartenance ne peuvent pas être modifiés.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Depuis son profil, un membre ne peut modifier que ses coordonnées
    -- professionnelles. Rôle et statut restent des décisions d'administration.
    if old.user_id = v_actor
       and (new.role is distinct from old.role or new.status is distinct from old.status) then
      raise exception 'Vous pouvez uniquement modifier votre poste et votre téléphone.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Seul un propriétaire en place peut en nommer un autre. La première ligne
  -- owner reste autorisée lors du bootstrap d'une organisation.
  if new.role = 'owner' and (tg_op = 'INSERT' or old.role is distinct from 'owner') then
    if exists (
      select 1
      from public.organization_members m
      where m.organization_id = new.organization_id
        and m.role = 'owner'
        and m.status = 'active'
        and m.id <> new.id
    ) and app.current_org_role(new.organization_id) is distinct from 'owner' then
      raise exception 'Seul un propriétaire peut nommer un autre propriétaire.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

-- Une seule policy conserve les deux chemins autorisés : gestion par un rôle
-- habilité, ou auto-édition. Le trigger ci-dessus limite alors les colonnes.
drop policy if exists "organization_members_update_permitted" on public.organization_members;
drop policy if exists "organization_members_update_self" on public.organization_members;
drop policy if exists "organization_members_update_scoped" on public.organization_members;

create policy "organization_members_update_scoped"
  on public.organization_members for update
  to authenticated
  using (
    (select app.has_org_permission(organization_id, 'member.update_role'))
    or user_id = (select auth.uid())
  )
  with check (
    (select app.has_org_permission(organization_id, 'member.update_role'))
    or user_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 2. Temps travaillé : laisser la RLS décider de la visibilité
-- -----------------------------------------------------------------------------

create or replace function app.intervention_worked_seconds(p_intervention_id uuid)
returns integer
language sql
stable
security invoker
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

create or replace function public.intervention_worked_seconds(p_intervention_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select app.intervention_worked_seconds(p_intervention_id);
$$;

revoke all on function app.intervention_worked_seconds(uuid) from public, anon;
revoke all on function public.intervention_worked_seconds(uuid) from public, anon;
grant execute on function app.intervention_worked_seconds(uuid) to authenticated;
grant execute on function public.intervention_worked_seconds(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. IA documentaire : exécution serveur uniquement
-- -----------------------------------------------------------------------------

revoke execute on function public.match_ai_document_chunks(
  uuid, extensions.vector, double precision, integer
) from public, anon, authenticated;
grant execute on function public.match_ai_document_chunks(
  uuid, extensions.vector, double precision, integer
) to service_role;

revoke execute on function public.ai_quota_status(uuid)
  from public, anon, authenticated;
grant execute on function public.ai_quota_status(uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- 4. Synthèse de facturation : permission métier, pas simple appartenance
-- -----------------------------------------------------------------------------

create or replace function public.organization_billing_summary(p_organization_id uuid)
returns table (
  plan_code           text,
  plan_name           text,
  included_seats      integer,
  active_seats        integer,
  extra_seats         integer,
  extra_seat_cents    integer,
  base_cents          integer,
  total_cents         integer,
  max_users           integer,
  subscription_status text,
  is_billed           boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Le service_role est utilisé par les Edge Functions après leur propre garde.
  -- Une session utilisateur doit posséder le droit explicite de facturation.
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
     and not app.has_org_permission(p_organization_id, 'billing.view') then
    raise exception 'Organisation inconnue ou accès refusé.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.code,
    p.name,
    app.org_included_seats(p_organization_id),
    app.org_billable_seats(p_organization_id),
    app.org_extra_seats(p_organization_id),
    p.extra_user_price_cents,
    case when p.code = 'free' then 0 else p.price_monthly_cents end,
    app.org_monthly_amount_cents(p_organization_id),
    p.max_users,
    app.org_subscription_status(p_organization_id),
    app.org_is_billed(p_organization_id)
  from public.plans p
  where p.code = app.org_effective_plan(p_organization_id);
end;
$$;

revoke all on function public.organization_billing_summary(uuid) from public, anon;
grant execute on function public.organization_billing_summary(uuid)
  to authenticated, service_role;

comment on function public.organization_billing_summary(uuid) is
  'Synthèse tarifaire réservée aux rôles disposant de billing.view et aux appels serveur contrôlés.';
