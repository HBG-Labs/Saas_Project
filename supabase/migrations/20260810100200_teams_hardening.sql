-- =============================================================================
-- Durcissement du module Équipes
-- =============================================================================
--
-- Deux défauts mis au jour en préparant l'interface. Le premier est une rupture
-- d'isolation multi-tenant, mesurée sur la base ; le second une divergence entre
-- la matrice RBAC déclarée et ce que la RLS autorise réellement.
--
-- Aucune table n'est créée, aucune fonction existante n'est réécrite.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Une entité métier ne change jamais d'entreprise
-- -----------------------------------------------------------------------------
--
-- LE DÉFAUT
--
-- `teams_update_permitted` exige `team.update` dans son `USING`, évalué sur
-- l'ANCIENNE ligne, mais son `WITH CHECK` — appliqué à la NOUVELLE — ne vérifie
-- que `can_use_pro_module`, c'est-à-dire la simple appartenance.
--
-- Mesuré : un utilisateur `manager` chez A et `employee` chez B a déplacé une
-- équipe de A vers B. L'équipe atterrit chez B avec ses membres, qui référencent
-- pourtant les `organization_members` de A.
--
-- POURQUOI RENFORCER LE `WITH CHECK` NE SUFFIT PAS
--
-- Le réflexe serait d'y recopier la condition du `USING`. Elle contient
-- `id in (select app.my_led_team_ids())`, et cette fonction part de
-- `team_members` : elle renvoie les équipes dont on est `lead` QUELLE QUE SOIT
-- leur organisation. Le responsable d'équipe repasserait donc la garde après le
-- déplacement — le trou se refermerait pour le manager et resterait ouvert pour
-- le lead.
--
-- LE CORRECTIF
--
-- Comparer l'ancienne et la nouvelle ligne est exactement ce qu'une policy ne
-- sait pas faire, et ce qu'un trigger fait naturellement.
--
-- Appliqué aussi à `customers` et `missions`. Mesure faite : elles résistent
-- aujourd'hui, mais aucune règle ne l'énonce — leur protection découle d'un
-- enchaînement de conditions qu'un ajustement futur défera sans que rien ne le
-- signale. Mieux vaut une garantie écrite qu'une garantie déduite.
create or replace function app.enforce_organization_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception
      'Une entité ne peut pas changer d''organisation (% → %).',
      old.organization_id, new.organization_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists teams_organization_immutable on public.teams;
create trigger teams_organization_immutable
  before update on public.teams
  for each row execute function app.enforce_organization_immutable();

drop trigger if exists customers_organization_immutable on public.customers;
create trigger customers_organization_immutable
  before update on public.customers
  for each row execute function app.enforce_organization_immutable();

drop trigger if exists missions_organization_immutable on public.missions;
create trigger missions_organization_immutable
  before update on public.missions
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- 2. `WITH CHECK` aligné sur le `USING`
-- -----------------------------------------------------------------------------
--
-- Redondant avec le trigger ci-dessus, et conservé pour cette raison : c'est le
-- principe des trois barrières déjà appliqué partout ailleurs dans ce schéma.
-- Une policy dont le `WITH CHECK` est plus faible que le `USING` reste un piège
-- pour qui la relira, même si un trigger la couvre.
drop policy if exists "teams_update_permitted" on public.teams;
create policy "teams_update_permitted"
  on public.teams for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'teams'))
    and (
      (select app.has_org_permission(organization_id, 'team.update'))
      or id in (select app.my_led_team_ids())
    )
  )
  with check (
    (select app.can_use_pro_module(organization_id, 'teams'))
    and (
      (select app.has_org_permission(organization_id, 'team.update'))
      or id in (select app.my_led_team_ids())
    )
  );

-- -----------------------------------------------------------------------------
-- 3. La lecture des équipes suit la matrice RBAC
-- -----------------------------------------------------------------------------
--
-- `teams_select_member` n'exigeait que `can_use_pro_module`. Un `employee`, qui
-- ne possède pas `team.view`, pouvait donc lire toutes les équipes de son
-- entreprise par l'API — l'interface les lui masquait, le serveur les lui
-- servait.
--
-- Ce n'est pas une fuite : tout restait cloisonné dans l'organisation. C'est une
-- divergence entre le miroir déclaré et l'autorité réelle, dans le sens
-- permissif. Or toute la doctrine du projet repose sur l'idée que le miroir dit
-- vrai — un miroir plus restrictif que le serveur fait masquer des actions
-- pourtant permises, et laisse croire à un bogue.
--
-- Vérifié avant d'appliquer : `app.my_team_ids()` est `security definer` et lit
-- `team_members` directement, sans passer par cette policy. Les policies de
-- missions qui en dépendent ne sont donc pas affectées, et un technicien —
-- qui possède `team.view` — ne perd rien.
drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member"
  on public.teams for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'teams'))
    and (select app.has_org_permission(organization_id, 'team.view'))
  );
