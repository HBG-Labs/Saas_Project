-- =============================================================================
-- Prospect Radar — RPC d'upsert restreinte aux colonnes factuelles
-- =============================================================================
--
-- Phase 3 connecte le worker à l'API Recherche d'Entreprises. Ce fichier ne
-- fait QUE poser le point d'écriture que ce worker utilisera : deux fonctions
-- SECURITY DEFINER, réservées à service_role, qui n'acceptent JAMAIS de
-- modifier `status`, `priority`, `assigned_to`, `next_followup_at`,
-- `opportunity_score` ni `score_reasons` d'un prospect existant.
--
-- POURQUOI UNE RPC PLUTÔT QUE LAISSER LE WORKER FAIRE UN UPSERT DIRECT
--
-- `service_role` a déjà GRANT insert/update sur `prospects` (Phase 2) — il
-- POURRAIT écrire n'importe quelle colonne. Le patron déjà suivi sur
-- `claim_quote_reminders` est de ne pas compter sur la discipline du code
-- appelant pour une garantie critique : ici, « une resynchronisation ne doit
-- jamais écraser le statut commercial, l'assignation ou le score ». Cette RPC
-- rend cette garantie vraie même si le worker de Phase 3, ou un futur worker
-- de Phase 5/10, contenait un bug d'upsert.
--
-- `first_detected_at` et `source` ne sont jamais dans la liste de mise à jour
-- : ils décrivent la détection ORIGINALE, pas la dernière vérification.
-- =============================================================================

create or replace function public.upsert_prospect(
  p_siren                text,
  p_raison_sociale       text,
  p_nom_commercial       text,
  p_forme_juridique      text,
  p_ape_code             text,
  p_sector_id            uuid,
  p_created_on           date,
  p_statut_administratif text,
  p_tranche_effectif     text,
  p_commune              text,
  p_code_postal          text,
  p_departement          text,
  p_region               text,
  p_zone_id              uuid
)
returns table (siren text, inserted boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  insert into public.prospects (
    siren, raison_sociale, nom_commercial, forme_juridique, ape_code, sector_id,
    created_on, statut_administratif, tranche_effectif,
    commune, code_postal, departement, region, zone_id, last_checked_at
  )
  values (
    p_siren, p_raison_sociale, p_nom_commercial, p_forme_juridique, p_ape_code, p_sector_id,
    p_created_on, p_statut_administratif, p_tranche_effectif,
    p_commune, p_code_postal, p_departement, p_region, p_zone_id, now()
  )
  on conflict (siren) do update set
    raison_sociale       = excluded.raison_sociale,
    nom_commercial       = excluded.nom_commercial,
    forme_juridique      = excluded.forme_juridique,
    ape_code             = excluded.ape_code,
    sector_id            = excluded.sector_id,
    statut_administratif = excluded.statut_administratif,
    tranche_effectif     = excluded.tranche_effectif,
    commune              = excluded.commune,
    code_postal          = excluded.code_postal,
    departement          = excluded.departement,
    region               = excluded.region,
    zone_id              = excluded.zone_id,
    last_checked_at      = now()
    -- Volontairement absents : status, priority, assigned_to,
    -- next_followup_at, opportunity_score, score_reasons, first_detected_at,
    -- source. Une resynchronisation ne les touche jamais.
  returning prospects.siren, (xmax = 0) as inserted;
end;
$$;

revoke all on function public.upsert_prospect(
  text, text, text, text, text, uuid, date, text, text, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.upsert_prospect(
  text, text, text, text, text, uuid, date, text, text, text, text, text, text, uuid
) to service_role;

comment on function public.upsert_prospect is
  'Point d''écriture unique du worker de détection (Phase 3+). Ne peut jamais modifier le statut commercial, '
  'la priorité, l''assignation ou le score d''un prospect existant — seules les colonnes factuelles de la fiche '
  'Sirene/RNE sont mises à jour.';

create or replace function public.upsert_prospect_establishment(
  p_siret           text,
  p_siren           text,
  p_enseigne        text,
  p_is_headquarters boolean,
  p_adresse_line    text,
  p_code_postal     text,
  p_commune         text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.prospect_establishments (
    siret, siren, enseigne, is_headquarters, adresse_line, code_postal, commune
  )
  values (
    p_siret, p_siren, p_enseigne, p_is_headquarters, p_adresse_line, p_code_postal, p_commune
  )
  on conflict (siret) do update set
    enseigne        = excluded.enseigne,
    is_headquarters = excluded.is_headquarters,
    adresse_line    = excluded.adresse_line,
    code_postal     = excluded.code_postal,
    commune         = excluded.commune;
end;
$$;

revoke all on function public.upsert_prospect_establishment(
  text, text, text, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.upsert_prospect_establishment(
  text, text, text, boolean, text, text, text
) to service_role;
