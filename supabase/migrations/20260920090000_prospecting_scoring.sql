-- =============================================================================
-- Prospect Radar — Phase 5 : formule de score explicable et configurable
-- =============================================================================
--
-- CE QUE LA FORMULE UTILISE, ET POURQUOI RIEN D'AUTRE
--
-- Aucun enrichissement n'existe en V1 (Phase 11, non branchée) : la formule ne
-- porte QUE sur ce que la détection (Phase 3) sait réellement, jamais une
-- donnée devinée ou un signal absent traité comme négatif :
--
--   1. Récence de création (§ cahier des charges : prioriser les entreprises
--      récemment créées) — le MEILLEUR palier applicable, jamais cumulé.
--   2. Pertinence du secteur ciblé (`prospecting_sectors.relevance_weight`,
--      Phase 4) — proportionnelle, 0 si aucun secteur ne correspond.
--   3. Présence locale — l'établissement retenu par le worker est bien dans
--      le département de la zone ciblée (pas un repli sur un siège ailleurs).
--
-- `tranche_effectif` reste EXCLU, comme documenté dans
-- `README-PROSPECT-RADAR.md` § Minimisation : « jamais utilisée dans le
-- calcul du score sans décision explicite ultérieure ». Cette migration
-- n'est pas cette décision — elle ne la prend pas silencieusement.
--
-- Une entreprise administrativement cessée ne reçoit JAMAIS un score
-- positif : c'est une porte, pas un critère pondérable — jamais un signal
-- positif fabriqué pour une entreprise fermée.
--
-- RECALCUL : UNIQUEMENT QUAND UNE DONNÉE DE SCORE CHANGE RÉELLEMENT
--
-- Le trigger ne porte que sur (created_on, statut_administratif, sector_id,
-- departement, zone_id) — modifier une note, la priorité manuelle, le
-- statut commercial ou l'assignation ne le déclenche jamais. Et même quand
-- une de ces colonnes fait partie de la clause SET (cas d'un upsert de
-- resynchronisation qui les réécrit systématiquement), le corps du trigger
-- compare ancienne et nouvelle valeur et ne recalcule QUE si quelque chose a
-- réellement changé — pas seulement parce que la colonne a été touchée.
--
-- Un changement de `relevance_weight` dans `prospecting_sectors` (ou d'un
-- poids dans `prospecting_score_weights`) NE recalcule PAS rétroactivement
-- les prospects déjà notés : ce n'est pas un oubli, c'est un choix qui évite
-- une réévaluation de masse silencieuse à chaque ajustement de configuration
-- — une reprise explicite (« recalculer tous les scores ») resterait une
-- action délibérée, hors périmètre de cette phase.
-- =============================================================================

insert into public.prospecting_score_weights (criterion, weight, description) values
  ('recence_moins_six_mois',  40, 'Points si l''entreprise a été créée il y a moins de 6 mois.'),
  ('recence_moins_douze_mois', 25, 'Points si créée il y a moins de 12 mois (et 6 mois ou plus).'),
  ('recence_moins_vingtquatre_mois', 10, 'Points si créée il y a moins de 24 mois (et 12 mois ou plus).'),
  ('secteur_pertinence_max', 40, 'Points maximum pour la pertinence du secteur ciblé, multipliés par prospecting_sectors.relevance_weight.'),
  ('presence_locale', 20, 'Points si l''établissement retenu par le worker est dans le département de la zone ciblée (pas un repli sur le siège ailleurs).');

-- -----------------------------------------------------------------------------
-- Calcul pur : ne lit que ce qu'on lui passe, jamais la table `prospects`
-- elle-même (utilisable aussi bien en BEFORE INSERT qu'en BEFORE UPDATE, où
-- la ligne n'est pas encore commise).
-- -----------------------------------------------------------------------------
create or replace function app.compute_prospect_score(
  p_created_on           date,
  p_statut_administratif text,
  p_sector_id            uuid,
  p_departement          text,
  p_zone_id              uuid
)
returns table (score integer, reasons jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reasons jsonb := '[]'::jsonb;
  v_score   integer := 0;
  v_weight  numeric;
  v_relevance numeric;
  v_zone_department text;
  v_months  numeric;
begin
  if p_statut_administratif is distinct from 'actif' then
    return query select 0, jsonb_build_array(
      jsonb_build_object('criterion', 'statut_administratif', 'label', 'Entreprise non active (cessée)', 'points', 0)
    );
    return;
  end if;

  if p_created_on is not null then
    v_months := extract(epoch from (now() - p_created_on::timestamptz)) / (30.44 * 86400);

    if v_months <= 6 then
      select weight into v_weight from public.prospecting_score_weights where criterion = 'recence_moins_six_mois';
      if v_weight is not null then
        v_score := v_score + v_weight::integer;
        v_reasons := v_reasons || jsonb_build_object(
          'criterion', 'recence_creation', 'label', 'Entreprise créée il y a moins de 6 mois', 'points', v_weight::integer);
      end if;
    elsif v_months <= 12 then
      select weight into v_weight from public.prospecting_score_weights where criterion = 'recence_moins_douze_mois';
      if v_weight is not null then
        v_score := v_score + v_weight::integer;
        v_reasons := v_reasons || jsonb_build_object(
          'criterion', 'recence_creation', 'label', 'Entreprise créée il y a moins de 12 mois', 'points', v_weight::integer);
      end if;
    elsif v_months <= 24 then
      select weight into v_weight from public.prospecting_score_weights where criterion = 'recence_moins_vingtquatre_mois';
      if v_weight is not null then
        v_score := v_score + v_weight::integer;
        v_reasons := v_reasons || jsonb_build_object(
          'criterion', 'recence_creation', 'label', 'Entreprise créée il y a moins de 24 mois', 'points', v_weight::integer);
      end if;
    end if;
  end if;

  if p_sector_id is not null then
    select relevance_weight into v_relevance from public.prospecting_sectors where id = p_sector_id;
    select weight into v_weight from public.prospecting_score_weights where criterion = 'secteur_pertinence_max';
    if v_relevance is not null and v_weight is not null then
      v_score := v_score + round(v_weight * v_relevance)::integer;
      v_reasons := v_reasons || jsonb_build_object(
        'criterion', 'secteur_pertinence',
        'label', 'Secteur ciblé (pertinence ' || v_relevance || ')',
        'points', round(v_weight * v_relevance)::integer);
    end if;
  end if;

  if p_zone_id is not null and p_departement is not null then
    select department_code into v_zone_department from public.prospecting_zones where id = p_zone_id;
    if v_zone_department is not null and v_zone_department = p_departement then
      select weight into v_weight from public.prospecting_score_weights where criterion = 'presence_locale';
      if v_weight is not null then
        v_score := v_score + v_weight::integer;
        v_reasons := v_reasons || jsonb_build_object(
          'criterion', 'presence_locale',
          'label', 'Établissement retenu situé dans le département ciblé',
          'points', v_weight::integer);
      end if;
    end if;
  end if;

  return query select least(v_score, 100), v_reasons;
end;
$$;

revoke all on function app.compute_prospect_score(date, text, uuid, text, uuid) from public, anon, authenticated;

comment on function app.compute_prospect_score is
  'Calcul pur du score d''opportunité (Phase 5) : récence de création (meilleur palier, jamais cumulé), '
  'pertinence du secteur ciblé, présence locale. Aucune donnée non vérifiée n''y participe (pas tranche_effectif, '
  'pas de dirigeant). Une entreprise cessée reçoit toujours 0, sans exception.';

-- -----------------------------------------------------------------------------
-- Trigger : ne recalcule QUE si une donnée participant réellement au score a
-- changé — jamais parce que la colonne était simplement présente dans un SET.
-- -----------------------------------------------------------------------------
create or replace function app.score_prospect()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score   integer;
  v_reasons jsonb;
begin
  if tg_op = 'UPDATE'
     and new.created_on is not distinct from old.created_on
     and new.statut_administratif is not distinct from old.statut_administratif
     and new.sector_id is not distinct from old.sector_id
     and new.departement is not distinct from old.departement
     and new.zone_id is not distinct from old.zone_id
  then
    return new;
  end if;

  select c.score, c.reasons into v_score, v_reasons
  from app.compute_prospect_score(new.created_on, new.statut_administratif, new.sector_id, new.departement, new.zone_id) as c;

  new.opportunity_score := v_score;
  new.score_reasons := v_reasons;
  return new;
end;
$$;

create trigger prospects_score_before_write
  before insert or update of created_on, statut_administratif, sector_id, departement, zone_id on public.prospects
  for each row execute function app.score_prospect();

comment on function app.score_prospect() is
  'Recalcule opportunity_score/score_reasons UNIQUEMENT quand une des colonnes surveillées a réellement changé de '
  'valeur (pas seulement touchée par un UPDATE) — voir §5 de la validation utilisateur du 17/09/2026.';

-- -----------------------------------------------------------------------------
-- Reprise ponctuelle : les quelques prospects déjà détectés en Phase 3/4
-- avaient un score figé à 0 (formule non encore posée). Reprise unique,
-- bornée à ce qui existe aujourd'hui — pas un job récurrent.
-- -----------------------------------------------------------------------------
update public.prospects
set opportunity_score = c.score,
    score_reasons = c.reasons
from (
  select p.siren, comp.score, comp.reasons
  from public.prospects p,
       lateral app.compute_prospect_score(p.created_on, p.statut_administratif, p.sector_id, p.departement, p.zone_id) as comp
) as c
where prospects.siren = c.siren;
