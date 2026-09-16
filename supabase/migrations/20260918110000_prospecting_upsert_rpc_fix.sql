-- =============================================================================
-- Correctif — colonne de sortie « siren » ambiguë avec la colonne de table
-- =============================================================================
-- Constaté au premier test réel (Phase 3, run `cc425c96-...`) : les 5
-- upserts sont tombés en erreur avec « column reference "siren" is
-- ambiguous ». `returns table (siren text, ...)` déclare une variable
-- PL/pgSQL nommée `siren`, visible dans tout le corps de la fonction ; à
-- l'intérieur, `on conflict (siren)` et `returning prospects.siren` ne
-- peuvent alors plus distinguer la variable de sortie de la colonne de la
-- table, même qualifiée — c'est un piège connu de PL/pgSQL, pas une erreur
-- de syntaxe SQL ordinaire.
--
-- La migration d'origine (20260918090000) est déjà appliquée et immuable :
-- on DROP puis on RECRÉE la fonction, avec la colonne de sortie renommée
-- `out_siren` pour ne plus jamais coïncider avec un nom de colonne de table.
-- =============================================================================

drop function if exists public.upsert_prospect(
  text, text, text, text, text, uuid, date, text, text, text, text, text, text, uuid
);

create function public.upsert_prospect(
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
returns table (out_siren text, inserted boolean)
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
    region                = excluded.region,
    zone_id              = excluded.zone_id,
    last_checked_at      = now()
  returning prospects.siren, (xmax = 0);
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
  'Sirene/RNE sont mises à jour. Colonne de sortie « out_siren » (pas « siren ») : voir ce fichier pour le piège évité.';
