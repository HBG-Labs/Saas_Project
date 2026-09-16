-- =============================================================================
-- Prospect Radar — Phase 9 : conversion prospect → essai → client
-- =============================================================================
--
-- CE QUE CETTE MIGRATION AJOUTE
--
-- « Passer en essai » (§19) reste un simple changement de statut — déjà
-- possible depuis la Phase 7 (`update_prospect_status`), rien à ajouter en
-- base. « Convertir en client » (§22), en revanche, doit :
--   1. relier le prospect à l'organisation REZO360 réelle qu'il est devenu ;
--   2. ne jamais créer de doublon (une organisation ne peut être liée qu'à
--      UN SEUL prospect) ;
--   3. arrêter les relances commerciales en cours ;
--   4. conserver historique, source et score initial — déjà garanti : le
--      trigger `app.audit_prospect_status_change` (Phase 2) prend
--      l'instantané du score à la transition « converti », et rien ici ne
--      touche `first_detected_at`/`source`/`score_reasons`.
--
-- POURQUOI DEUX RPC PLUTÔT QU'UN UPDATE DIRECT DEPUIS LE FRONTEND
--
-- `organizations` est une table TENANT : ses policies RLS ne renvoient à un
-- utilisateur que les organisations dont il est membre. Un administrateur
-- plateforme n'est membre d'AUCUNE organisation cliente — une requête
-- directe depuis le frontend ne verrait donc jamais aucune organisation à
-- lier. `prospecting_search_organizations` lit `organizations` en
-- SECURITY DEFINER (même patron que `organization_billing_summary`,
-- `prospecting_dashboard_stats`), gardée par `prospecting.manage` — jamais
-- un client REZO360 authentifié ne peut l'appeler utilement.
--
-- `convert_prospect_to_client` regroupe la mise à jour du prospect et
-- l'arrêt des relances dans UNE transaction : un échec à mi-chemin ne doit
-- jamais laisser un prospect « converti » avec des relances encore actives,
-- ni l'inverse.
-- =============================================================================

alter table public.prospects
  add column converted_organization_id uuid references public.organizations (id) on delete set null;

comment on column public.prospects.converted_organization_id is
  'Organisation REZO360 réelle que ce prospect est devenu (Phase 9). NULL tant qu''il n''est pas converti. '
  'Une organisation ne peut être liée qu''à un seul prospect — voir l''index unique ci-dessous.';

-- Le filet de sécurité DB : même si `convert_prospect_to_client` avait un
-- jour un bug qui oublie de vérifier l'unicité, cet index rendrait
-- l'écriture impossible plutôt que de laisser deux prospects revendiquer la
-- même conversion.
create unique index prospects_converted_organization_unique_idx
  on public.prospects (converted_organization_id)
  where converted_organization_id is not null;

-- -----------------------------------------------------------------------------
-- Recherche d'une organisation à lier — jamais d'accès direct à `organizations`
-- -----------------------------------------------------------------------------
create or replace function public.prospecting_search_organizations(p_query text default '')
returns table (id uuid, name text, legal_name text, registration_number text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_platform_permission('prospecting.manage') then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  return query
  select o.id, o.name, o.legal_name, o.registration_number
  from public.organizations o
  where o.status = 'active'
    -- Jamais une organisation déjà revendiquée par un autre prospect converti.
    and not exists (
      select 1 from public.prospects p
      where p.converted_organization_id = o.id
    )
    and (
      coalesce(p_query, '') = ''
      or o.name ilike '%' || p_query || '%'
      or o.legal_name ilike '%' || p_query || '%'
      or o.registration_number ilike p_query || '%'
    )
  order by o.name
  limit 20;
end;
$$;

revoke all on function public.prospecting_search_organizations(text) from public, anon;
grant execute on function public.prospecting_search_organizations(text) to authenticated;

comment on function public.prospecting_search_organizations is
  'Recherche d''organisations REZO360 à lier à un prospect converti (Phase 9). Refuse quiconque n''a pas '
  'prospecting.manage. N''expose que id/name/legal_name/registration_number — jamais de données de facturation.';

-- -----------------------------------------------------------------------------
-- Conversion — statut + lien + arrêt des relances, dans une transaction
-- -----------------------------------------------------------------------------
create or replace function public.convert_prospect_to_client(p_siren text, p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_platform_permission('prospecting.manage') then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id and status = 'active') then
    raise exception 'Organisation introuvable ou inactive.' using errcode = 'foreign_key_violation';
  end if;

  if exists (select 1 from public.prospects where converted_organization_id = p_organization_id) then
    raise exception 'Cette organisation est déjà liée à un autre prospect converti.' using errcode = 'unique_violation';
  end if;

  update public.prospects
  set status = 'converti',
      converted_organization_id = p_organization_id
  where siren = p_siren;

  if not found then
    raise exception 'Prospect introuvable.' using errcode = 'no_data_found';
  end if;

  -- « Arrêter les relances commerciales » (§22) : un pense-bête devenu sans
  -- objet une fois le prospect converti, jamais un envoi à annuler (aucun
  -- envoi n'est jamais automatique dans ce module).
  update public.prospect_followups
  set completed_at = now()
  where siren = p_siren and completed_at is null;
end;
$$;

revoke all on function public.convert_prospect_to_client(text, uuid) from public, anon;
grant execute on function public.convert_prospect_to_client(text, uuid) to authenticated;

comment on function public.convert_prospect_to_client is
  'Convertit un prospect en client REZO360 (Phase 9) : statut, lien vers l''organisation réelle, arrêt des '
  'relances en attente — dans une seule transaction. Refuse quiconque n''a pas prospecting.manage.';
