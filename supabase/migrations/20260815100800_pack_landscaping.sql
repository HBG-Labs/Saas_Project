-- =============================================================================
-- Pack métier « Paysage & Espaces verts »
-- =============================================================================
--
-- Troisième métier, données seules — même forme que le pack froid.
--
-- CE QUE CE MÉTIER CHANGE DES DEUX PREMIERS
--
-- Un fibreur et un frigoriste relèvent des grandeurs physiques sur un
-- équipement. Un paysagiste mesure des SURFACES et des VOLUMES, et facture
-- souvent à la quantité. Le vocabulaire aussi diffère : on parle de chantier
-- plutôt que de mission, de passage plutôt que d'intervention — ce que
-- `industries.vocabulary` porte déjà pour ce métier.
--
-- LE TRAITEMENT PHYTOSANITAIRE EST À PART
--
-- Il engage la responsabilité de l'entreprise et la santé de tiers. Le produit
-- employé, sa dose, le délai de rentrée et le port des protections sont donc
-- obligatoires — ce qui bloque la transmission du compte rendu tant qu'ils ne
-- sont pas attestés. C'est le même raisonnement que pour le registre F-Gas du
-- pack froid : une obligation légale n'est pas une case de confort.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types d'intervention
-- -----------------------------------------------------------------------------
insert into public.intervention_types (industry_code, code, label, description, icon, sort_order)
values
  ('landscaping', 'maintenance', 'Entretien courant',
   'Passage contractuel : tonte, désherbage, soufflage.', 'shield-check', 10),
  ('landscaping', 'pruning', 'Taille & élagage',
   'Taille de haies, d''arbustes, élagage de sujets.', 'scissors', 20),
  ('landscaping', 'clearing', 'Débroussaillage',
   'Ouverture de terrain, obligation légale de débroussaillement.', 'axe', 30),
  ('landscaping', 'planting', 'Création & plantation',
   'Aménagement, engazonnement, plantation de sujets.', 'sprout', 40),
  ('landscaping', 'treatment', 'Traitement phytosanitaire',
   'Application de produit — soumis à certificat et registre.', 'flask-conical', 50)
on conflict (industry_code, code) do update
  set label = excluded.label, description = excluded.description,
      icon = excluded.icon, sort_order = excluded.sort_order, updated_at = now();

-- -----------------------------------------------------------------------------
-- Formulaire — Entretien courant
-- -----------------------------------------------------------------------------
with template as (
  insert into public.form_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Relevé de passage',
         'Surfaces traitées et volumes évacués — base de la facturation.'
  from public.intervention_types t
  where t.industry_code = 'landscaping' and t.code = 'maintenance'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.form_fields
  (form_template_id, key, label, help, type, required, unit, min_value, max_value, options, sort_order)
select template.id, f.key, f.label, f.help, f.type::public.form_field_type,
       f.required, f.unit, f.min_value, f.max_value, f.options, f.sort_order
from template,
  (values
    ('operations',       'Opérations réalisées', null,
     'multiselect', true, null, null::numeric, null::numeric,
     '["Tonte","Désherbage","Taille légère","Soufflage","Ramassage de feuilles","Bordures"]'::jsonb, 10),
    ('mowed_area_m2',    'Surface tondue', null,
     'number', false, 'm²', 0::numeric, 200000::numeric, null::jsonb, 20),
    ('cut_height_mm',    'Hauteur de coupe', 'Adaptée à la saison et à l''essence du gazon.',
     'number', false, 'mm', 10::numeric, 150::numeric, null::jsonb, 30),
    ('green_waste_m3',   'Déchets verts évacués', 'Volume estimé, benne ou remorque.',
     'number', false, 'm³', 0::numeric, 200::numeric, null::jsonb, 40),
    ('waste_destination', 'Destination des déchets', null,
     'select', false, null, null::numeric, null::numeric,
     '["Déchetterie","Plateforme de compostage","Broyage sur place","Laissés au client"]'::jsonb, 50),
    ('observations',     'Observations', 'État du terrain, points à prévoir au prochain passage.',
     'textarea', false, null, null::numeric, null::numeric, null::jsonb, 60)
  ) as f(key, label, help, type, required, unit, min_value, max_value, options, sort_order)
on conflict (form_template_id, key) do update
  set label = excluded.label, help = excluded.help, required = excluded.required,
      unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
      options = excluded.options, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Formulaire — Taille & élagage
-- -----------------------------------------------------------------------------
with template as (
  insert into public.form_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Relevé de taille',
         'Sujets traités et volumes produits.'
  from public.intervention_types t
  where t.industry_code = 'landscaping' and t.code = 'pruning'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.form_fields
  (form_template_id, key, label, help, type, required, unit, min_value, max_value, options, sort_order)
select template.id, f.key, f.label, f.help, f.type::public.form_field_type,
       f.required, f.unit, f.min_value, f.max_value, f.options, f.sort_order
from template,
  (values
    ('work_type',       'Nature de la taille', null,
     'select', true, null, null::numeric, null::numeric,
     '["Taille de haie","Taille douce","Taille sévère","Élagage","Abattage","Démontage"]'::jsonb, 10),
    ('subjects_count',  'Nombre de sujets', null,
     'number', true, null, 0::numeric, 5000::numeric, null::jsonb, 20),
    ('hedge_length_m',  'Linéaire de haie', null,
     'number', false, 'm', 0::numeric, 10000::numeric, null::jsonb, 30),
    ('max_height_m',    'Hauteur maximale traitée', 'Détermine le matériel et le classement du travail en hauteur.',
     'number', false, 'm', 0::numeric, 60::numeric, null::jsonb, 40),
    ('access_means',    'Moyen d''accès', null,
     'select', false, null, null::numeric, null::numeric,
     '["Depuis le sol","Échelle","Nacelle","Grimpe","Plateforme"]'::jsonb, 50),
    ('green_waste_m3',  'Déchets verts évacués', null,
     'number', false, 'm³', 0::numeric, 500::numeric, null::jsonb, 60)
  ) as f(key, label, help, type, required, unit, min_value, max_value, options, sort_order)
on conflict (form_template_id, key) do update
  set label = excluded.label, help = excluded.help, required = excluded.required,
      unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
      options = excluded.options, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Formulaire — Traitement phytosanitaire
-- -----------------------------------------------------------------------------
with template as (
  insert into public.form_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Registre de traitement',
         'Mentions exigées pour la traçabilité d''une application.'
  from public.intervention_types t
  where t.industry_code = 'landscaping' and t.code = 'treatment'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.form_fields
  (form_template_id, key, label, help, type, required, unit, min_value, max_value, options, sort_order)
select template.id, f.key, f.label, f.help, f.type::public.form_field_type,
       f.required, f.unit, f.min_value, f.max_value, f.options, f.sort_order
from template,
  (values
    ('product_name',    'Produit employé', 'Nom commercial, tel qu''il figure sur l''emballage.',
     'text', true, null, null::numeric, null::numeric, null::jsonb, 10),
    ('amm_number',      'Numéro d''AMM', 'Autorisation de mise sur le marché.',
     'text', true, null, null::numeric, null::numeric, null::jsonb, 20),
    ('dose_l_ha',       'Dose appliquée', null,
     'number', true, 'L/ha', 0::numeric, 100::numeric, null::jsonb, 30),
    ('treated_area_m2', 'Surface traitée', null,
     'number', true, 'm²', 0::numeric, 200000::numeric, null::jsonb, 40),
    ('reentry_hours',   'Délai de rentrée', 'Durée avant réouverture au public.',
     'number', true, 'h', 0::numeric, 168::numeric, null::jsonb, 50),
    ('wind_ok',         'Vent inférieur à 19 km/h', 'Au-delà, l''application est interdite.',
     'boolean', true, null, null::numeric, null::numeric, null::jsonb, 60),
    ('weather',         'Conditions météorologiques', null,
     'select', false, null, null::numeric, null::numeric,
     '["Sec","Couvert","Humidité résiduelle","Pluie annoncée"]'::jsonb, 70)
  ) as f(key, label, help, type, required, unit, min_value, max_value, options, sort_order)
on conflict (form_template_id, key) do update
  set label = excluded.label, help = excluded.help, required = excluded.required,
      unit = excluded.unit, min_value = excluded.min_value, max_value = excluded.max_value,
      options = excluded.options, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Check-list — Traitement phytosanitaire
-- -----------------------------------------------------------------------------
with template as (
  insert into public.checklist_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Contrôles avant et après application',
         'Obligations liées à l''emploi d''un produit phytopharmaceutique.'
  from public.intervention_types t
  where t.industry_code = 'landscaping' and t.code = 'treatment'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.checklist_items (checklist_template_id, code, label, help, required, sort_order)
select template.id, c.code, c.label, c.help, c.required, c.sort_order
from template,
  (values
    ('certificate_valid', 'Certificat d''applicateur en cours de validité', null, true, 10),
    ('ppe_worn',          'Protections individuelles portées',
     'Combinaison, gants, masque adaptés au produit.', true, 20),
    ('signage_posted',    'Affichage du délai de rentrée en place',
     'Visible depuis chaque accès à la zone traitée.', true, 30),
    ('register_filled',   'Registre d''application renseigné', null, true, 40),
    ('equipment_rinsed',  'Pulvérisateur rincé', 'Effluents gérés conformément.', false, 50),
    ('neighbours_warned', 'Riverains prévenus', null, false, 60)
  ) as c(code, label, help, required, sort_order)
on conflict (checklist_template_id, code) do update
  set label = excluded.label, help = excluded.help,
      required = excluded.required, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Check-list — Taille & élagage
-- -----------------------------------------------------------------------------
with template as (
  insert into public.checklist_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Sécurité du chantier de taille',
         'Le travail en hauteur et les outils tranchants sont la première cause d''accident du métier.'
  from public.intervention_types t
  where t.industry_code = 'landscaping' and t.code = 'pruning'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.checklist_items (checklist_template_id, code, label, help, required, sort_order)
select template.id, c.code, c.label, c.help, c.required, c.sort_order
from template,
  (values
    ('zone_secured',    'Zone de chute balisée',
     'Périmètre interdit au public pendant toute l''intervention.', true, 10),
    ('ppe_worn',        'EPI portés',
     'Casque, protections auditives, pantalon anti-coupure.', true, 20),
    ('tools_checked',   'Matériel de coupe vérifié',
     'Frein de chaîne, tension, affûtage.', true, 30),
    ('overhead_lines',  'Absence de ligne aérienne à proximité', null, false, 40),
    ('site_cleared',    'Chantier dégagé en fin d''intervention', null, false, 50)
  ) as c(code, label, help, required, sort_order)
on conflict (checklist_template_id, code) do update
  set label = excluded.label, help = excluded.help,
      required = excluded.required, sort_order = excluded.sort_order;
