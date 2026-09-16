-- =============================================================================
-- SUITE DE TESTS — Prospect Radar : formule de score (Phase 5)
-- =============================================================================
-- Rejoue les garanties posées par `20260920090000_prospecting_scoring.sql` :
--
--   le score ne porte que sur des critères vérifiés (récence, pertinence du
--   secteur, présence locale) ; une entreprise cessée reçoit toujours 0 sans
--   exception ; les raisons ne contiennent jamais un critère qui ne
--   s'applique pas réellement ; le recalcul ne se déclenche QUE lorsqu'une
--   donnée de score change (jamais sur une note, une priorité ou un statut
--   commercial) ; un changement de pondération ne rescore pas rétroactivement
--   les prospects déjà notés.
--
--   npm run test:sql
--
-- Se termine par `rollback` : aucune donnée ne survit.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label, coalesce(p_condition::text, 'NULL') using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

create temporary table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

-- L'administrateur réel, résolu par e-mail — jamais un UUID recopié.
insert into t_ids (k, v) select 'admin', id from auth.users where lower(email) = 'contact@rezo360.fr';
do $$ begin perform pg_temp.ok(pg_temp.uid('admin') is not null, 'contact@rezo360.fr existe réellement'); end $$;

create function pg_temp.login_admin() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid('admin'), 'email', 'contact@rezo360.fr', 'role', 'authenticated')::text, true);
end;
$$;

select pg_temp.login_admin(); set local role authenticated;

do $$ begin raise notice '=== PARTIE 1 — les trois critères se cumulent, avec les bonnes raisons ==='; end $$;

insert into public.prospecting_zones (code, label, department_code, territory, priority, active)
values ('scoring_test_zone', 'Zone de test scoring', '972', 'outre_mer', 90, true);

insert into public.prospecting_sectors (ape_code, label, relevance_weight, active)
values ('96.09Z', 'Secteur de test scoring', 0.5, true);

insert into public.prospects (siren, raison_sociale, ape_code, created_on, statut_administratif, departement, sector_id, zone_id)
select '900000001', 'Score Complet', '96.09Z', current_date - interval '3 months', 'actif', '972',
       (select id from public.prospecting_sectors where ape_code = '96.09Z'),
       (select id from public.prospecting_zones where code = 'scoring_test_zone');

do $$ begin
-- 40 (récence < 6 mois) + round(40 * 0.5) = 20 (secteur) + 20 (présence locale) = 80.
perform pg_temp.ok(
  (select opportunity_score = 80 from public.prospects where siren = '900000001'),
  'les trois critères applicables se cumulent : 40 + 20 + 20 = 80');
perform pg_temp.ok(
  (select jsonb_array_length(score_reasons) = 3 from public.prospects where siren = '900000001'),
  'exactement trois raisons, une par critère réellement appliqué');
perform pg_temp.ok(
  not exists (
    select 1 from public.prospects, jsonb_array_elements(score_reasons) as r
    where siren = '900000001' and r->>'criterion' not in ('recence_creation', 'secteur_pertinence', 'presence_locale')
  ),
  'aucune raison ne porte un critère qui ne s''applique pas réellement');
end $$;

do $$ begin raise notice '=== PARTIE 2 — une entreprise cessée reçoit toujours 0, sans exception ==='; end $$;

insert into public.prospects (siren, raison_sociale, ape_code, created_on, statut_administratif, departement, sector_id, zone_id)
select '900000002', 'Entreprise Fermée', '96.09Z', current_date - interval '1 month', 'cesse', '972',
       (select id from public.prospecting_sectors where ape_code = '96.09Z'),
       (select id from public.prospecting_zones where code = 'scoring_test_zone');

do $$ begin
perform pg_temp.ok(
  (select opportunity_score = 0 from public.prospects where siren = '900000002'),
  'une entreprise cessée reçoit 0, même récente et bien positionnée sur le secteur/la zone');
perform pg_temp.ok(
  (select score_reasons = '[{"points": 0, "criterion": "statut_administratif", "label": "Entreprise non active (cessée)"}]'::jsonb
   from public.prospects where siren = '900000002'),
  'la raison est honnête (cessée), jamais les critères de récence/secteur/zone qui ne sont pas évalués');
end $$;

do $$ begin raise notice '=== PARTIE 3 — le recalcul ne se déclenche que sur une donnée de score ==='; end $$;

do $$
declare
  v_before_score integer;
  v_before_reasons jsonb;
begin
  select opportunity_score, score_reasons into v_before_score, v_before_reasons
  from public.prospects where siren = '900000001';

  update public.prospects set priority = 'haute' where siren = '900000001';
  update public.prospects set status = 'a_qualifier' where siren = '900000001';
  update public.prospects set assigned_to = pg_temp.uid('admin') where siren = '900000001';

  perform pg_temp.ok(
    (select opportunity_score = v_before_score and score_reasons = v_before_reasons
     from public.prospects where siren = '900000001'),
    'changer la priorité, le statut commercial ou l''assignation ne recalcule jamais le score');
end $$;

do $$
declare
  v_other_sector uuid;
begin
  insert into public.prospecting_sectors (ape_code, label, relevance_weight, active)
  values ('96.09A', 'Autre secteur de test', 1.0, true)
  returning id into v_other_sector;

  update public.prospects set sector_id = v_other_sector where siren = '900000001';

  perform pg_temp.ok(
    -- 40 (récence, inchangée) + round(40 * 1.0) = 40 (nouveau secteur) + 20 (présence locale) = 100.
    (select opportunity_score = 100 from public.prospects where siren = '900000001'),
    'changer le secteur (une donnée de score) recalcule bien, avec la nouvelle pertinence');
end $$;

do $$ begin raise notice '=== PARTIE 4 — un changement de pondération ne rescore pas rétroactivement ==='; end $$;

do $$
declare
  v_score_before integer;
begin
  select opportunity_score into v_score_before from public.prospects where siren = '900000001';

  update public.prospecting_score_weights set weight = 5 where criterion = 'presence_locale';

  perform pg_temp.ok(
    (select opportunity_score = v_score_before from public.prospects where siren = '900000001'),
    'modifier une pondération ne rescore pas silencieusement les prospects déjà notés');
end $$;

reset role;

-- =============================================================================
do $$
begin
  raise notice '';
  raise notice '=============================================';
  raise notice ' TOUS LES TESTS PASSENT';
  raise notice '=============================================';
end
$$;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
