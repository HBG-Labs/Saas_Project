-- =============================================================================
-- Pack métier « Froid & Climatisation »
-- =============================================================================
--
-- CE FICHIER NE CONTIENT QUE DES DONNÉES.
--
-- Aucune table, aucune colonne, aucune fonction, aucune policy, et pas une
-- ligne de TypeScript en regard. C'est la thèse de toute cette architecture,
-- mise à l'épreuve : un second métier s'ajoute par un `insert`.
--
-- Si ce fichier avait dû créer quoi que ce soit, l'architecture aurait été
-- fausse — et il aurait mieux valu s'en apercevoir maintenant qu'au dixième
-- métier.
--
-- LES VALEURS SONT CELLES DU MÉTIER
--
-- Pressions en bar relatif, surchauffe et sous-refroidissement en kelvin,
-- charge en kilogrammes. Les bornes viennent de l'exploitation : une haute
-- pression au-delà de 45 bar ou une surchauffe négative signalent une erreur de
-- saisie, pas un relevé.
--
-- Le contrôle d'étanchéité et la tenue du registre ne sont pas des options de
-- confort : le règlement F-Gas les impose au-delà de certaines charges. Ils
-- sont donc OBLIGATOIRES, ce qui bloque la transmission du compte rendu tant
-- qu'ils ne sont pas validés.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types d'intervention
-- -----------------------------------------------------------------------------
insert into public.intervention_types (industry_code, code, label, description, icon, sort_order)
values
  ('hvac', 'commissioning', 'Mise en service',
   'Première mise en route, réglages et remise au client.', 'power', 10),
  ('hvac', 'maintenance', 'Entretien périodique',
   'Visite d''entretien contractuelle ou réglementaire.', 'shield-check', 20),
  ('hvac', 'repair', 'Dépannage',
   'Intervention curative sur défaut ou arrêt d''installation.', 'wrench', 30),
  ('hvac', 'leak_search', 'Recherche de fuite',
   'Localisation, réparation et recharge de fluide frigorigène.', 'search', 40),
  ('hvac', 'installation', 'Installation',
   'Pose d''un équipement, liaisons frigorifiques et raccordements.', 'hammer', 50)
on conflict (industry_code, code) do update
  set label = excluded.label, description = excluded.description,
      icon = excluded.icon, sort_order = excluded.sort_order, updated_at = now();

-- -----------------------------------------------------------------------------
-- Formulaire — Entretien périodique
-- -----------------------------------------------------------------------------
with template as (
  insert into public.form_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Relevé d''entretien frigorifique',
         'Valeurs relevées en fonctionnement stabilisé.'
  from public.intervention_types t
  where t.industry_code = 'hvac' and t.code = 'maintenance'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.form_fields
  (form_template_id, key, label, help, type, required, unit, min_value, max_value, options, sort_order)
select template.id, f.key, f.label, f.help, f.type::public.form_field_type,
       f.required, f.unit, f.min_value, f.max_value, f.options, f.sort_order
from template,
  (values
    ('refrigerant',        'Fluide frigorigène', null,
     'select', true, null, null::numeric, null::numeric,
     '["R32","R410A","R134a","R407C","R290","R744","R448A","R452A"]'::jsonb, 10),
    ('charge_kg',          'Charge nominale', 'Portée sur la plaque signalétique.',
     'number', true, 'kg', 0::numeric, 500::numeric, null::jsonb, 20),
    ('pressure_hp_bar',    'Pression haute', 'Relevée en régime stabilisé.',
     'number', true, 'bar', 0::numeric, 45::numeric, null::jsonb, 30),
    ('pressure_bp_bar',    'Pression basse', null,
     'number', true, 'bar', 0::numeric, 20::numeric, null::jsonb, 40),
    ('superheat_k',        'Surchauffe', 'Écart à la température de saturation à l''aspiration.',
     'number', true, 'K', 0::numeric, 30::numeric, null::jsonb, 50),
    ('subcooling_k',       'Sous-refroidissement', null,
     'number', false, 'K', 0::numeric, 30::numeric, null::jsonb, 60),
    ('air_in_c',           'Température d''air entrant', null,
     'number', false, '°C', -30::numeric, 60::numeric, null::jsonb, 70),
    ('air_out_c',          'Température d''air soufflé', null,
     'number', false, '°C', -30::numeric, 60::numeric, null::jsonb, 80),
    ('observations',       'Observations', 'Réserves, pièces à prévoir, dérives constatées.',
     'textarea', false, null, null::numeric, null::numeric, null::jsonb, 90)
  ) as f(key, label, help, type, required, unit, min_value, max_value, options, sort_order)
on conflict (form_template_id, key) do update
  set label = excluded.label, help = excluded.help, required = excluded.required,
      unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
      options = excluded.options, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Formulaire — Recherche de fuite
-- -----------------------------------------------------------------------------
with template as (
  insert into public.form_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Constat de fuite et recharge',
         'Localisation, réparation et quantité de fluide manipulée.'
  from public.intervention_types t
  where t.industry_code = 'hvac' and t.code = 'leak_search'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.form_fields
  (form_template_id, key, label, help, type, required, unit, min_value, max_value, options, sort_order)
select template.id, f.key, f.label, f.help, f.type::public.form_field_type,
       f.required, f.unit, f.min_value, f.max_value, f.options, f.sort_order
from template,
  (values
    ('detection_method',  'Méthode de détection', null,
     'select', true, null, null::numeric, null::numeric,
     '["Détecteur électronique","Eau savonneuse","Traceur UV","Azote sous pression","Analyse de performance"]'::jsonb, 10),
    ('leak_location',     'Localisation de la fuite', 'Composant et repère précis.',
     'text', true, null, null::numeric, null::numeric, null::jsonb, 20),
    ('recovered_kg',      'Fluide récupéré', 'Obligatoire au titre du registre F-Gas.',
     'number', true, 'kg', 0::numeric, 500::numeric, null::jsonb, 30),
    ('recharged_kg',      'Fluide rechargé', null,
     'number', true, 'kg', 0::numeric, 500::numeric, null::jsonb, 40),
    ('repair_done',       'Réparation effectuée sur place', null,
     'boolean', true, null, null::numeric, null::numeric, null::jsonb, 50),
    ('pressure_test_ok',  'Épreuve d''étanchéité concluante', 'Après réparation, avant recharge.',
     'boolean', true, null, null::numeric, null::numeric, null::jsonb, 60),
    ('follow_up',         'Suite à donner', null,
     'textarea', false, null, null::numeric, null::numeric, null::jsonb, 70)
  ) as f(key, label, help, type, required, unit, min_value, max_value, options, sort_order)
on conflict (form_template_id, key) do update
  set label = excluded.label, help = excluded.help, required = excluded.required,
      unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
      options = excluded.options, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Check-list — Entretien périodique
-- -----------------------------------------------------------------------------
with template as (
  insert into public.checklist_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Contrôles d''entretien',
         'Points réglementaires et de bon fonctionnement.'
  from public.intervention_types t
  where t.industry_code = 'hvac' and t.code = 'maintenance'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.checklist_items (checklist_template_id, code, label, help, required, sort_order)
select template.id, c.code, c.label, c.help, c.required, c.sort_order
from template,
  (values
    ('leak_check',       'Contrôle d''étanchéité réalisé',
     'Imposé par le règlement F-Gas au-delà des seuils de charge.', true, 10),
    ('logbook_updated',  'Registre de l''équipement renseigné',
     'Fluide manipulé, date, intervenant, attestation de capacité.', true, 20),
    ('electrical_safe',  'Serrages et protections électriques vérifiés',
     'Un défaut de serrage est la première cause d''échauffement.', true, 30),
    ('condensates_ok',   'Évacuation des condensats dégagée', null, false, 40),
    ('filters_cleaned',  'Filtres nettoyés ou remplacés', null, false, 50),
    ('coils_cleaned',    'Batteries dépoussiérées', null, false, 60),
    ('customer_briefed', 'Consignes rappelées au client', null, false, 70)
  ) as c(code, label, help, required, sort_order)
on conflict (checklist_template_id, code) do update
  set label = excluded.label, help = excluded.help,
      required = excluded.required, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Check-list — Mise en service
-- -----------------------------------------------------------------------------
with template as (
  insert into public.checklist_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Contrôles de mise en service',
         'À valider avant remise de l''installation au client.'
  from public.intervention_types t
  where t.industry_code = 'hvac' and t.code = 'commissioning'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.checklist_items (checklist_template_id, code, label, help, required, sort_order)
select template.id, c.code, c.label, c.help, c.required, c.sort_order
from template,
  (values
    ('vacuum_done',      'Tirage au vide effectué',
     'Sous 500 microns, avec maintien vérifié.', true, 10),
    ('tightness_tested', 'Épreuve d''étanchéité concluante', null, true, 20),
    ('charge_recorded',  'Charge de fluide consignée', 'Quantité et fluide portés au registre.', true, 30),
    ('safety_tested',    'Sécurités testées',
     'Pressostats, thermostat de sécurité, arrêt d''urgence.', true, 40),
    ('settings_applied', 'Paramètres de régulation réglés', null, false, 50),
    ('handover_signed',  'Remise et explication au client', null, false, 60)
  ) as c(code, label, help, required, sort_order)
on conflict (checklist_template_id, code) do update
  set label = excluded.label, help = excluded.help,
      required = excluded.required, sort_order = excluded.sort_order;
