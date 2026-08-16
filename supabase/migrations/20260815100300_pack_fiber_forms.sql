-- =============================================================================
-- Pack fibre : les formulaires de trois types d'intervention
-- =============================================================================
--
-- Premier pack métier. Il ne contient QUE des données — aucune table, aucune
-- fonction, aucune policy. C'est la démonstration de ce que l'architecture
-- promet : ajouter un métier ne demandera pas de code.
--
-- POURQUOI TROIS, ET PAS LES SEPT
--
-- Trois types couvrent la majorité des treize missions observées :
-- « Mesures & recette », « Raccordement client », « Dépannage ». Les quatre
-- autres restent sans formulaire, et c'est un état valide — la fiche
-- d'intervention affiche alors le compte rendu seul, comme aujourd'hui.
--
-- Livrer trois formulaires bien pensés vaut mieux que sept remplis à la hâte :
-- ce sont des techniciens qui les rempliront sur un toit, avec des gants.
--
-- LES CHAMPS NE SONT PAS INVENTÉS
--
-- Puissance optique en dBm, atténuation linéique en dB/km, nombre de soudures,
-- type de fibre : ce sont les grandeurs d'un procès-verbal de recette FTTH.
-- Les bornes viennent de l'usage — une puissance de réception au-delà de 0 dBm
-- ou en deçà de -40 dBm signale une erreur de saisie, pas une mesure.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Mesures & recette
-- -----------------------------------------------------------------------------
with template as (
  insert into public.form_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Procès-verbal de recette optique',
         'Mesures relevées à la réception du lien.'
  from public.intervention_types t
  where t.industry_code = 'fiber_telecom' and t.code = 'measurement'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.form_fields
  (form_template_id, key, label, help, type, required, unit, min_value, max_value, options, sort_order)
select template.id, f.key, f.label, f.help, f.type::public.form_field_type,
       f.required, f.unit, f.min_value, f.max_value, f.options, f.sort_order
from template,
  (values
    ('fiber_type',      'Type de fibre',          null,
     'select', true,  null, null, null,
     '["Monomode G.652D","Monomode G.657A","Multimode OM3","Multimode OM4"]'::jsonb, 10),
    ('link_length_m',   'Longueur du lien',       'Mesurée au réflectomètre.',
     'number', true,  'm',  0::numeric, 100000::numeric, null::jsonb, 20),
    ('power_dbm',       'Puissance reçue',        'Relevé photométrique côté client.',
     'number', true,  'dBm', -40::numeric, 0::numeric, null::jsonb, 30),
    ('attenuation_db',  'Atténuation totale',     'Somme des pertes du lien.',
     'number', true,  'dB', 0::numeric, 40::numeric, null::jsonb, 40),
    ('splice_count',    'Nombre de soudures',     null,
     'number', false, null, 0::numeric, 200::numeric, null::jsonb, 50),
    ('otdr_conform',    'Trace OTDR conforme',    'Aucun événement réflectif hors tolérance.',
     'boolean', true, null, null, null, null::jsonb, 60),
    ('observations',    'Réserves',               'Points à lever avant mise en service.',
     'textarea', false, null, null, null, null::jsonb, 70)
  ) as f(key, label, help, type, required, unit, min_value, max_value, options, sort_order)
on conflict (form_template_id, key) do update
  set label = excluded.label, help = excluded.help, required = excluded.required,
      unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
      options = excluded.options, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Raccordement client
-- -----------------------------------------------------------------------------
with template as (
  insert into public.form_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Fiche de raccordement',
         'Constat de raccordement terminal chez le client.'
  from public.intervention_types t
  where t.industry_code = 'fiber_telecom' and t.code = 'connection'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.form_fields
  (form_template_id, key, label, help, type, required, unit, min_value, max_value, options, sort_order)
select template.id, f.key, f.label, f.help, f.type::public.form_field_type,
       f.required, f.unit, f.min_value, f.max_value, f.options, f.sort_order
from template,
  (values
    ('pto_reference',   'Référence PTO',          'Prise terminale optique posée.',
     'text', true, null, null::numeric, null::numeric, null::jsonb, 10),
    ('cable_run_m',     'Longueur de câble tirée', null,
     'number', true, 'm', 0::numeric, 5000::numeric, null::jsonb, 20),
    ('power_dbm',       'Puissance à la PTO',     null,
     'number', true, 'dBm', -40::numeric, 0::numeric, null::jsonb, 30),
    ('passage_mode',    'Mode de passage',        null,
     'select', true, null, null::numeric, null::numeric,
     '["Fourreau existant","Aérien","Façade","Colonne montante","Apparent"]'::jsonb, 40),
    ('equipment_left',  'Matériel laissé sur place', null,
     'multiselect', false, null, null::numeric, null::numeric,
     '["Box","ONT","Jarretière","Goulotte","Fixations"]'::jsonb, 50),
    ('customer_present', 'Client présent à la fin', null,
     'boolean', true, null, null::numeric, null::numeric, null::jsonb, 60)
  ) as f(key, label, help, type, required, unit, min_value, max_value, options, sort_order)
on conflict (form_template_id, key) do update
  set label = excluded.label, help = excluded.help, required = excluded.required,
      unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
      options = excluded.options, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Dépannage
-- -----------------------------------------------------------------------------
with template as (
  insert into public.form_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Constat de dépannage',
         'Origine de la panne et action corrective.'
  from public.intervention_types t
  where t.industry_code = 'fiber_telecom' and t.code = 'repair'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.form_fields
  (form_template_id, key, label, help, type, required, unit, min_value, max_value, options, sort_order)
select template.id, f.key, f.label, f.help, f.type::public.form_field_type,
       f.required, f.unit, f.min_value, f.max_value, f.options, f.sort_order
from template,
  (values
    ('fault_origin',    'Origine de la panne',    null,
     'select', true, null, null::numeric, null::numeric,
     '["Câble sectionné","Connecteur souillé","Soudure défaillante","Équipement actif","Alimentation","Configuration","Non reproduite"]'::jsonb, 10),
    ('fault_location',  'Localisation',           'Distance ou point de repère.',
     'text', false, null, null::numeric, null::numeric, null::jsonb, 20),
    ('service_restored', 'Service rétabli',       null,
     'boolean', true, null, null::numeric, null::numeric, null::jsonb, 30),
    ('power_after_dbm', 'Puissance après intervention', null,
     'number', false, 'dBm', -40::numeric, 0::numeric, null::jsonb, 40),
    ('follow_up',       'Suite à donner',         'Laisser vide si le dossier est clos.',
     'textarea', false, null, null::numeric, null::numeric, null::jsonb, 50)
  ) as f(key, label, help, type, required, unit, min_value, max_value, options, sort_order)
on conflict (form_template_id, key) do update
  set label = excluded.label, help = excluded.help, required = excluded.required,
      unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
      options = excluded.options, sort_order = excluded.sort_order;
