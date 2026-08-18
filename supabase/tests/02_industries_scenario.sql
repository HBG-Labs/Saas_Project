-- =============================================================================
-- SUITE DE TESTS — architecture multi-métiers
-- =============================================================================
-- Rejoue les garanties posées par les migrations `20260815*` :
--
--   métier de l'organisation → types d'intervention → formulaires → check-lists
--
-- et vérifie que chacune tient CÔTÉ SERVEUR, indépendamment de l'interface.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI CE FICHIER EXISTE
--
-- Chaque garantie ci-dessous a été vérifiée pendant son développement — par des
-- scripts jetables, écrits, exécutés, puis supprimés. Rien n'en subsistait.
--
-- Le jour où quelqu'un simplifiera `app.validate_form_response` ou assouplira
-- une policy, aucune alarme ne se déclenchera : les tests TypeScript ne
-- s'exécutent pas dans PostgreSQL, et l'application continuera de fonctionner
-- — en acceptant simplement des données qu'elle refusait la veille.
--
-- COMMENT L'EXÉCUTER
--
--   1. Appliquer toutes les migrations de `supabase/migrations/`.
--   2. Coller ce fichier ENTIER dans le SQL Editor du dashboard Supabase.
--   3. Exécuter, puis lire l'onglet des messages (NOTICE).
--
-- Le script se termine par `rollback` : il ne laisse AUCUNE donnée derrière lui.
-- En cas d'échec, il s'interrompt sur une exception nommant le test fautif.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

set local search_path = pg_temp, public;

-- -----------------------------------------------------------------------------
-- Identités et utilitaires — même dispositif que 01_multitenant_scenario.sql
-- -----------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);

insert into t_ids (k, v) values
  ('fibre_owner', '00000000-0000-4000-8000-00000000c001'),
  ('fibre_tech',  '00000000-0000-4000-8000-00000000c002'),
  ('clim_owner',  '00000000-0000-4000-8000-00000000c003');

grant select on t_ids to authenticated;

create function pg_temp.uid(p_key text) returns uuid
language sql stable as $$ select v from pg_temp.t_ids where k = p_key $$;

create function pg_temp.login(p_key text) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', pg_temp.uid(p_key),
      'email', p_key || '@test.local',
      'role', 'authenticated'
    )::text,
    true
  );
end;
$$;

create function pg_temp.ok(p_condition boolean, p_label text) returns void
language plpgsql as $$
begin
  -- `is not true` et non `not p_condition` : en SQL, `not null` vaut `null`, et
  -- un `if null then` ne s'exécute pas. La version précédente laissait donc
  -- PASSER en silence toute assertion dont l'expression valait NULL — le cas le
  -- plus courant étant une sous-requête qui ne ramène aucune ligne.
  --
  -- Trouvé en écrivant la suite 04 : `app.org_plan_code()` renvoyait NULL pour
  -- une organisation sans abonnement, `NULL = 'free'` valait NULL, et le test
  -- affichait « OK » sur une comparaison qui n'avait jamais été vraie.
  if p_condition is not true then
    raise exception 'ECHEC : % (condition %)', p_label,
      coalesce(p_condition::text, 'NULL')
      using errcode = 'assert_failure';
  end if;
  raise notice '  OK  %', p_label;
end;
$$;

/**
 * Une instruction doit-elle échouer ?
 *
 * Beaucoup de garanties de cette architecture s'expriment par un refus. Sans
 * cet utilitaire, chaque cas demanderait son propre bloc `exception` — huit
 * lignes pour une assertion, et la tentation de n'en écrire que la moitié.
 */
create function pg_temp.refuses(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ECHEC : % (l''instruction a ete ACCEPTEE)', p_label
    using errcode = 'assert_failure';
exception
  when assert_failure then raise;
  when others then raise notice '  OK  % (refuse : %)', p_label, left(sqlerrm, 60);
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated',
  k || '@test.local', '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  json_build_object('display_name', k)::jsonb, now(), now()
from pg_temp.t_ids;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — Le referentiel des metiers ==='; end $$;
-- =============================================================================

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.industries where status = 'active';
  perform pg_temp.ok(v_count >= 11, 'Au moins onze metiers sont proposes');

  select count(*) into v_count from public.industries
  where code in ('fiber_telecom', 'hvac', 'landscaping');
  perform pg_temp.ok(v_count = 3, 'Les trois metiers cibles existent');
end
$$;

-- Le référentiel est lisible sans session : la page d'inscription en a besoin
-- avant qu'un compte existe.
set local role anon;
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.industries;
  perform pg_temp.ok(v_count >= 11, 'Le referentiel est lisible sans session');
end
$$;
reset role;

set local role authenticated;
select pg_temp.refuses(
  $sql$ insert into public.industries (code, label) values ('intrusion', 'Test') $sql$,
  'Aucune ecriture cliente sur le referentiel des metiers'
);
reset role;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 2 — Coherence metier des interventions ==='; end $$;
-- =============================================================================

select pg_temp.login('fibre_owner');
set local role authenticated;

insert into public.organizations (slug, name, created_by, industry)
values ('essai-fibre', 'Essai Fibre', pg_temp.uid('fibre_owner'), 'fiber_telecom');

reset role;

select pg_temp.login('clim_owner');
set local role authenticated;

insert into public.organizations (slug, name, created_by, industry)
values ('essai-clim', 'Essai Clim', pg_temp.uid('clim_owner'), 'hvac');

reset role;

do $$
declare v_org uuid; v_industry text;
begin
  select id, industry into v_org, v_industry
  from public.organizations where slug = 'essai-clim';

  perform pg_temp.ok(v_industry = 'hvac', 'Le metier choisi est enregistre');
end
$$;

-- Une mission de l'entreprise de FROID ne peut pas porter un type FIBRE.
do $$
declare v_org uuid; v_type uuid; v_sql text;
begin
  select id into v_org from public.organizations where slug = 'essai-clim';
  select id into v_type from public.intervention_types
  where industry_code = 'fiber_telecom' and code = 'connection';

  v_sql := format(
    $f$ insert into public.missions (organization_id, title, created_by, intervention_type_id)
        values (%L, 'Essai', %L, %L) $f$,
    v_org, pg_temp.uid('clim_owner'), v_type
  );

  perform pg_temp.login('clim_owner');
  perform set_config('role', 'authenticated', true);
  perform pg_temp.refuses(v_sql,
    'Un type d''intervention d''un autre metier est refuse (enforce_mission_intervention_type)');
  perform set_config('role', 'postgres', true);
end
$$;

-- Le socle `general` est accepté par tous les métiers, par conception.
do $$
declare v_org uuid; v_type uuid; v_mission uuid;
begin
  select id into v_org from public.organizations where slug = 'essai-clim';
  select id into v_type from public.intervention_types
  where industry_code = 'general' and code = 'repair';

  insert into public.missions (organization_id, title, created_by, intervention_type_id)
  values (v_org, 'Depannage generique', pg_temp.uid('clim_owner'), v_type)
  returning id into v_mission;

  perform pg_temp.ok(v_mission is not null,
    'Un type generique est accepte par n''importe quel metier');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 3 — Validation des formulaires ==='; end $$;
-- =============================================================================

do $$
declare
  v_org      uuid;
  v_member   uuid;
  v_type     uuid;
  v_mission  uuid;
  v_iv       uuid;
  v_template uuid;
begin
  -- Les triggers de mission consultent `auth.uid()`. Sans identite posee, la
  -- transition est refusee faute de `mission.assign` — et le test echouerait
  -- pour une raison qui n'a rien a voir avec ce qu'il verifie.
  perform pg_temp.login('fibre_owner');

  select id into v_org from public.organizations where slug = 'essai-fibre';
  select id into v_member from public.organization_members
  where organization_id = v_org and user_id = pg_temp.uid('fibre_owner');

  select id into v_type from public.intervention_types
  where industry_code = 'fiber_telecom' and code = 'measurement';

  select id into v_template from public.form_templates
  where intervention_type_id = v_type and status = 'active';

  perform pg_temp.ok(v_template is not null,
    'Le type « Mesures & recette » dispose d''un formulaire');

  insert into public.missions (organization_id, title, created_by, intervention_type_id)
  values (v_org, 'Recette optique', pg_temp.uid('fibre_owner'), v_type)
  returning id into v_mission;

  insert into public.interventions (mission_id, organization_id, technician_id)
  values (v_mission, v_org, v_member)
  returning id into v_iv;

  -- Une clé étrangère au modèle : le document doit rester fidèle à sa définition.
  perform pg_temp.refuses(format(
    $f$ insert into public.intervention_form_responses
        (intervention_id, organization_id, form_template_id, values)
        values (%L, %L, %L, '{"pression_bar": 12}'::jsonb) $f$,
    v_iv, v_org, v_template),
    'Une cle inconnue du modele est refusee');

  -- Une puissance optique de +5 dBm n'existe pas en réception.
  perform pg_temp.refuses(format(
    $f$ insert into public.intervention_form_responses
        (intervention_id, organization_id, form_template_id, values)
        values (%L, %L, %L, '{"power_dbm": 5}'::jsonb) $f$,
    v_iv, v_org, v_template),
    'Un nombre hors bornes est refuse');

  -- Un choix hors liste.
  perform pg_temp.refuses(format(
    $f$ insert into public.intervention_form_responses
        (intervention_id, organization_id, form_template_id, values)
        values (%L, %L, %L, '{"fiber_type": "Cuivre"}'::jsonb) $f$,
    v_iv, v_org, v_template),
    'Une valeur hors liste est refusee');

  -- Un brouillon incomplet DOIT passer : on saisit sur un toit, on finit après.
  insert into public.intervention_form_responses
    (intervention_id, organization_id, form_template_id, values)
  values (v_iv, v_org, v_template, '{"link_length_m": 120}'::jsonb);

  perform pg_temp.ok(true, 'Un brouillon incomplet est accepte');

  -- Mais pas une complétion à laquelle il manque un champ obligatoire.
  perform pg_temp.refuses(format(
    $f$ update public.intervention_form_responses
        set completed_at = now() where intervention_id = %L $f$, v_iv),
    'Une completion sans champ obligatoire est refusee');

  update public.intervention_form_responses
  set values = '{"fiber_type":"Monomode G.652D","link_length_m":1240,"power_dbm":-18.4,
                 "attenuation_db":3.2,"otdr_conform":true}'::jsonb,
      completed_at = now()
  where intervention_id = v_iv;

  perform pg_temp.ok(true, 'Un releve complet et valide est accepte');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 4 — La check-list bloque la transmission ==='; end $$;
-- =============================================================================

do $$
declare
  v_org      uuid;
  v_member   uuid;
  v_type     uuid;
  v_mission  uuid;
  v_iv       uuid;
  v_list     uuid;
  v_report   uuid;
  v_required text[];
begin
  perform pg_temp.login('fibre_owner');

  select id into v_org from public.organizations where slug = 'essai-fibre';
  select id into v_member from public.organization_members
  where organization_id = v_org and user_id = pg_temp.uid('fibre_owner');

  select id into v_type from public.intervention_types
  where industry_code = 'fiber_telecom' and code = 'connection';

  select id into v_list from public.checklist_templates
  where intervention_type_id = v_type and status = 'active';

  perform pg_temp.ok(v_list is not null,
    'Le type « Raccordement client » dispose d''une check-list');

  -- Affectee des la creation : `assigned -> accepted` exige d'etre l'intervenant
  -- affecte, et non simplement d'en avoir le droit. C'est la mission qu'on prend
  -- en charge, pas celle qu'on distribue.
  insert into public.missions
    (organization_id, title, created_by, intervention_type_id, assigned_user_id)
  values (v_org, 'Raccordement essai', pg_temp.uid('fibre_owner'), v_type, v_member)
  returning id into v_mission;

  insert into public.interventions (mission_id, organization_id, technician_id)
  values (v_mission, v_org, v_member)
  returning id into v_iv;

  insert into public.intervention_reports
    (intervention_id, organization_id, technician_id, work_description)
  values (v_iv, v_org, v_member, 'Essai')
  returning id into v_report;

  -- La machine à états exige `completed` avant toute soumission, et le chemin
  -- passe par `accepted` : c'est le technicien qui prend la mission en charge,
  -- l'affectation ne vaut pas acceptation.
  update public.missions set status = 'assigned'    where id = v_mission;
  update public.missions set status = 'accepted'    where id = v_mission;
  update public.missions set status = 'in_progress' where id = v_mission;
  update public.missions set status = 'completed'   where id = v_mission;

  -- Aucun point coché : la transmission doit être refusée.
  perform pg_temp.refuses(format(
    $f$ update public.intervention_reports set status = 'submitted' where id = %L $f$, v_report),
    'La transmission est BLOQUEE tant qu''un point obligatoire manque');

  -- Une fois les points obligatoires validés, elle passe.
  select array_agg(code) into v_required
  from public.checklist_items where checklist_template_id = v_list and required;

  insert into public.intervention_checklist_responses
    (intervention_id, organization_id, checklist_template_id, checked)
  values (v_iv, v_org, v_list, to_jsonb(v_required));

  update public.intervention_reports set status = 'submitted' where id = v_report;

  perform pg_temp.ok(
    (select status from public.intervention_reports where id = v_report) = 'submitted',
    'La transmission passe une fois les points obligatoires valides');
end
$$;

-- =============================================================================
do $$ begin raise notice ''; raise notice '=== PARTIE 5 — Isolation entre metiers ==='; end $$;
-- =============================================================================

do $$
declare v_seen integer;
begin
  -- L'entreprise de froid ne doit voir aucune donnée de l'entreprise de fibre,
  -- exactement comme deux entreprises du même métier.
  perform pg_temp.login('clim_owner');
  perform set_config('role', 'authenticated', true);

  select count(*) into v_seen from public.missions m
  join public.organizations o on o.id = m.organization_id
  where o.slug = 'essai-fibre';

  perform set_config('role', 'postgres', true);

  perform pg_temp.ok(v_seen = 0,
    'Une entreprise ne voit pas les missions d''une autre, metier different compris');
end
$$;

do $$
begin
  raise notice '';
  raise notice 'TOUS LES TESTS PASSENT';
  raise notice '';
end
$$;

rollback;

-- Verdict lisible hors du SQL Editor — même raison que dans le premier scénario :
-- l'API Management ne remonte que des lignes, pas les messages du serveur.
select 'TOUS LES TESTS PASSENT' as resultat;
