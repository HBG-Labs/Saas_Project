-- =============================================================================
-- Pack fibre : check-lists de deux types d'intervention
-- =============================================================================
--
-- Données seules, comme le pack de formulaires.
--
-- Deux check-lists, pour les deux types où l'oubli d'un geste coûte le plus
-- cher : le raccordement, qui laisse un client sans service, et la maintenance
-- préventive, dont l'intérêt tient entièrement à ce qu'on n'a pas sauté
-- d'étape.
--
-- CE QUI EST OBLIGATOIRE, ET CE QUI NE L'EST PAS
--
-- Un point obligatoire BLOQUE la transmission du compte rendu. Ce n'est donc
-- pas une case à cocher de plus : c'est un engagement de l'entreprise. On y
-- range ce qui met en jeu la sécurité, la conformité ou le service rendu — pas
-- ce qui relève du soin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Raccordement client
-- -----------------------------------------------------------------------------
with template as (
  insert into public.checklist_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Contrôles de fin de raccordement',
         'À valider avant de quitter le site.'
  from public.intervention_types t
  where t.industry_code = 'fiber_telecom' and t.code = 'connection'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.checklist_items (checklist_template_id, code, label, help, required, sort_order)
select template.id, c.code, c.label, c.help, c.required, c.sort_order
from template,
  (values
    ('service_tested',  'Service testé de bout en bout',
     'Connexion établie et débit vérifié depuis l''équipement du client.', true, 10),
    ('pto_labelled',    'PTO étiquetée',
     'Référence lisible, conforme au dossier.', true, 20),
    ('cable_secured',   'Cheminement fixé et protégé',
     'Aucun câble en tension, aucun rayon de courbure inférieur au minimum.', true, 30),
    ('site_cleaned',    'Chantier nettoyé', 'Chutes de câble et emballages évacués.', false, 40),
    ('customer_briefed', 'Client informé du fonctionnement',
     'Redémarrage de la box, voyants, numéro du support.', false, 50),
    ('photos_taken',    'Photos de l''installation prises', null, false, 60)
  ) as c(code, label, help, required, sort_order)
on conflict (checklist_template_id, code) do update
  set label = excluded.label, help = excluded.help,
      required = excluded.required, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Maintenance préventive
-- -----------------------------------------------------------------------------
with template as (
  insert into public.checklist_templates (intervention_type_id, version, label, description)
  select t.id, 1, 'Ronde de maintenance préventive',
         'Points de contrôle d''un NRO, d''un point de mutualisation ou d''une armoire.'
  from public.intervention_types t
  where t.industry_code = 'fiber_telecom' and t.code = 'maintenance'
  on conflict (intervention_type_id, version) do update set label = excluded.label
  returning id
)
insert into public.checklist_items (checklist_template_id, code, label, help, required, sort_order)
select template.id, c.code, c.label, c.help, c.required, c.sort_order
from template,
  (values
    ('access_secured',   'Local refermé et sécurisé',
     'Un local laissé ouvert engage la responsabilité de l''entreprise.', true, 10),
    ('earthing_checked', 'Mise à la terre vérifiée',
     'Continuité contrôlée, cosses serrées.', true, 20),
    ('connectors_clean', 'Connecteurs nettoyés',
     'Première cause de perte optique en exploitation.', true, 30),
    ('labels_readable',  'Étiquetage lisible et à jour', null, false, 40),
    ('temperature_ok',   'Ventilation et température normales', null, false, 50),
    ('spares_stocked',   'Stock de jarretières reconstitué', null, false, 60)
  ) as c(code, label, help, required, sort_order)
on conflict (checklist_template_id, code) do update
  set label = excluded.label, help = excluded.help,
      required = excluded.required, sort_order = excluded.sort_order;
