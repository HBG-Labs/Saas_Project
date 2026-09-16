-- =============================================================================
-- Prospect Radar — Phase 8 : gabarits de brouillon par secteur
-- =============================================================================
--
-- CE QUE CETTE MIGRATION POSE, ET NE POSE PAS
--
-- Elle peuple `prospecting_message_templates` (posée vide en Phase 2) avec un
-- gabarit par secteur actif de la Phase 4. Rien de plus : aucun envoi n'est
-- câblé ici, aucun bouton « envoyer » n'existe côté application (§25 —
-- interdiction absolue en V1). L'assemblage final du texte (accueil,
-- personnalisation par la date de création, appel à l'action) est fait par
-- `buildProspectMessageDraft` côté frontend, jamais ici : cette table ne
-- contient que ce qui varie RÉELLEMENT par secteur.
--
-- `features` liste UNIQUEMENT des fonctionnalités qui existent réellement
-- dans REZO360 (vérifiées contre `src/features/billing/entitlements.ts` :
-- clients, planning, missions/interventions, devis, factures, stock, équipes,
-- documents, véhicules) — jamais une fonctionnalité inventée pour rendre un
-- argumentaire plus convaincant.
--
-- `opening_variant` n'est utilisé par le frontend QUE si l'entreprise a été
-- créée récemment (§17 : « uniquement si la date de création disponible le
-- permet raisonnablement ») — jamais pour une entreprise ancienne.
--
-- `body_template` reste volontairement identique dans sa structure d'un
-- secteur à l'autre (deux paragraphes, `{{FEATURES}}`/`{{TERRITOIRE}}`
-- substitués côté frontend) : c'est `features` qui porte la personnalisation
-- réelle. La colonne existe néanmoins par secteur pour permettre de réécrire
-- le ton d'UN secteur sans toucher aux autres, le jour où ce sera utile.
--
-- Les deux codes NAF partageant un même métier (nettoyage, mécanique,
-- transport) reçoivent le MÊME contenu, une ligne par code — la table est
-- indexée par secteur (donc par code NAF), pas par métier.
-- =============================================================================

insert into public.prospecting_message_templates (sector_id, opening_variant, pain_points, features, body_template)
select id,
  v.opening_variant,
  v.pain_points::jsonb,
  v.features::jsonb,
  v.body_template
from public.prospecting_sectors,
lateral (values
  ('43.22A', 'Félicitations pour le lancement de votre activité de plomberie.',
   '["organiser les interventions au jour le jour","perdre du temps sur les devis et factures"]',
   '["centraliser vos clients et chantiers","planifier vos interventions","générer devis et factures","suivre votre stock de pièces"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('43.21A', 'Félicitations pour le lancement de votre activité d''installation électrique.',
   '["suivre plusieurs chantiers en parallèle","centraliser devis et factures"]',
   '["centraliser vos clients et chantiers","planifier vos interventions","générer devis et factures","suivre votre stock de matériel"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('43.22B', 'Félicitations pour le lancement de votre activité de chauffage et climatisation.',
   '["planifier les interventions de maintenance","coordonner plusieurs équipes sur le terrain"]',
   '["planifier vos interventions et votre maintenance","organiser vos équipes sur le terrain","générer des comptes-rendus d''intervention","centraliser devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('81.21Z', 'Félicitations pour le lancement de votre activité de nettoyage.',
   '["planifier des interventions récurrentes","organiser plusieurs équipes par site"]',
   '["planifier vos interventions récurrentes","organiser vos équipes par site","centraliser vos clients et contrats","générer devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('81.22Z', 'Félicitations pour le lancement de votre activité de nettoyage.',
   '["planifier des interventions récurrentes","organiser plusieurs équipes par site"]',
   '["planifier vos interventions récurrentes","organiser vos équipes par site","centraliser vos clients et contrats","générer devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('81.30Z', 'Félicitations pour le lancement de votre activité de paysagisme.',
   '["suivre plusieurs sites clients","planifier les passages d''entretien"]',
   '["centraliser vos clients et sites","planifier vos interventions et votre planning","organiser vos équipes","générer devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('81.29A', 'Félicitations pour le lancement de votre activité de désinsectisation/dératisation.',
   '["planifier les passages de contrôle","tracer les interventions par site"]',
   '["planifier vos interventions et vos passages de contrôle","centraliser vos clients et contrats","générer des comptes-rendus d''intervention","centraliser devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('88.10A', 'Félicitations pour le lancement de votre activité d''aide à domicile.',
   '["planifier les tournées d''intervenants","centraliser les dossiers des bénéficiaires"]',
   '["planifier les interventions à domicile","centraliser les dossiers clients","organiser vos équipes d''intervenants","centraliser vos documents"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('45.20A', 'Félicitations pour le lancement de votre activité de mécanique automobile.',
   '["suivre les véhicules en atelier","gérer le stock de pièces détachées"]',
   '["centraliser vos clients et véhicules","planifier vos interventions d''atelier","suivre votre stock de pièces","générer devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('45.20B', 'Félicitations pour le lancement de votre activité de mécanique automobile.',
   '["suivre les véhicules en atelier","gérer le stock de pièces détachées"]',
   '["centraliser vos clients et véhicules","planifier vos interventions d''atelier","suivre votre stock de pièces","générer devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('49.41A', 'Félicitations pour le lancement de votre activité de transport.',
   '["suivre sa flotte de véhicules","planifier les tournées"]',
   '["centraliser vos clients","planifier vos missions","suivre votre flotte de véhicules","centraliser devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('49.41B', 'Félicitations pour le lancement de votre activité de transport.',
   '["suivre sa flotte de véhicules","planifier les tournées"]',
   '["centraliser vos clients","planifier vos missions","suivre votre flotte de véhicules","centraliser devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.'),

  ('62.02A', 'Félicitations pour le lancement de votre activité.',
   '["suivre plusieurs missions techniques en parallèle","tracer les interventions avec preuves"]',
   '["centraliser vos clients et missions","planifier vos interventions techniques","générer des comptes-rendus d''intervention avec pièces jointes","centraliser devis et factures"]',
   E'Je me permets de vous contacter car j''ai développé REZO360, une solution pensée pour les entreprises de terrain.\n\nElle permet notamment de {{FEATURES}}.\n\nJe pense que certaines de ces fonctionnalités pourraient être pertinentes pour votre activité{{TERRITOIRE}}.')
) as v(ape_code, opening_variant, pain_points, features, body_template)
where prospecting_sectors.ape_code = v.ape_code;

-- Contrôle : un gabarit par secteur, jamais deux (une divergence silencieuse
-- ferait tirer un texte au hasard entre deux versions).
do $$
declare
  v_doublon record;
begin
  for v_doublon in
    select sector_id, count(*) as n
    from public.prospecting_message_templates
    group by sector_id
    having count(*) > 1
  loop
    raise exception 'Secteur % porte % gabarits — un seul attendu.', v_doublon.sector_id, v_doublon.n;
  end loop;
end
$$;
