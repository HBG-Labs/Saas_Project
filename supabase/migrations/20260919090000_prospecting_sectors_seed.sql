-- =============================================================================
-- Prospect Radar — Phase 4 : codes NAF réels ciblés
-- =============================================================================
--
-- Choix arrêtés avec l'utilisateur (validation explicite, pas une déduction) :
--
-- 1. « Chauffage » et « Froid & Climatisation » n'ont PAS de code NAF distinct
--    en France : la nomenclature les regroupe tous deux sous 43.22B. Une
--    seule ligne est créée, rattachée à `heating` par convention — un
--    prospect détecté par ce code peut tout aussi bien être un frigoriste
--    qu'un chauffagiste. Ne pas créer de seconde ligne pour `hvac` sur le
--    même code (violerait l'unicité de `ape_code`, et laisserait croire à
--    une distinction qui n'existe pas dans la donnée source).
-- 2. « Fibre & Télécom » n'est PAS ciblé : aucun code NAF fiable et
--    spécifique aux installateurs de terrain (43.21A se confond avec les
--    électriciens, 61.90Z vise des opérateurs/FAI, pas des installateurs).
--    Plutôt qu'un code approximatif, ce métier reste sans ligne — conforme à
--    « pas de correspondance approximative par mots-clés ».
-- 3. « Autre métier de terrain » (`general`) est un fourre-tout, jamais ciblé.
-- 4. « Réseaux & IT » et « Transport » sont des codes réels mais larges
--    (couvrent surtout des ESN généralistes et des transporteurs classiques
--    sans rapport avec le champ REZO360) : inclus avec un poids de
--    pertinence réduit (0.5 au lieu de 1.0) plutôt qu'exclus ou traités à
--    égalité avec les métiers de terrain sans ambiguïté.
--
-- Sources des libellés : nomenclature NAF rév. 2 (INSEE), vérifiée pour
-- chaque code avant insertion — jamais une correspondance mot-clé.
-- =============================================================================

insert into public.prospecting_sectors (ape_code, label, industry_code, relevance_weight) values
  ('43.22A', 'Travaux d''installation d''eau et de gaz en tous locaux',                'plumbing',     1.0),
  ('43.21A', 'Travaux d''installation électrique dans tous locaux',                    'electrical',   1.0),
  -- Couvre à la fois « Chauffage » et « Froid & Climatisation » (§1 ci-dessus).
  ('43.22B', 'Travaux d''installation d''équipements thermiques et de climatisation',  'heating',      1.0),
  ('81.21Z', 'Nettoyage courant des bâtiments',                                        'cleaning',     1.0),
  ('81.22Z', 'Autres activités de nettoyage des bâtiments et nettoyage industriel',    'cleaning',     1.0),
  ('81.30Z', 'Services d''aménagement paysager',                                       'landscaping',  1.0),
  ('81.29A', 'Désinfection, désinsectisation, dératisation',                           'pest_control', 1.0),
  ('88.10A', 'Aide à domicile',                                                        'home_care',    1.0),
  ('45.20A', 'Entretien et réparation de véhicules automobiles légers',                'mechanics',    1.0),
  ('45.20B', 'Entretien et réparation d''autres véhicules automobiles',                'mechanics',    1.0),
  -- Poids réduit : codes réels mais larges (§4 ci-dessus).
  ('49.41A', 'Transports routiers de fret interurbains',                               'transport',    0.5),
  ('49.41B', 'Transports routiers de fret de proximité',                               'transport',    0.5),
  ('62.02A', 'Conseil en systèmes et logiciels informatiques',                         'it_networks',  0.5);

comment on table public.prospecting_sectors is
  'Codes NAF/APE ciblés par la prospection, avec leur poids de pertinence. Peuplée en Phase 4 (20260919090000) — '
  'voir ce fichier pour les choix explicitement validés (chauffage/climatisation partagent un code, fibre/télécom '
  'et « autre métier » ne sont pas ciblés, IT/transport à poids réduit).';
