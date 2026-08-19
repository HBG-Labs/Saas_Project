-- =============================================================================
-- Changement de nom : NexoraTech devient REZO360
-- =============================================================================
--
-- Le renommage est presque entièrement textuel et vit dans le dépôt. Une seule
-- occurrence lui échappe : la description du métier générique, écrite en base
-- par `20260815100000_industries.sql` et affichée dans le sélecteur de métier à
-- la création d'une entreprise.
--
-- Cette ligne-là ne se corrige pas en modifiant le fichier d'origine : il est
-- appliqué, et une migration appliquée ne se réécrit pas. D'où cette migration
-- corrective, qui ne touche qu'un libellé.
--
-- CE QUI N'EST PAS TOUCHÉ, ET POURQUOI
--
--   • le code `general` de la ligne — c'est une clé, référencée par les
--     organisations ; la renommer casserait des liens pour un gain nul ;
--   • les slugs d'organisations, qui sont des données client ;
--   • les comptes de démonstration `@nexoratech.local`, qui sont des identités
--     `auth.users` réelles : les renommer demande `service_role` et casserait
--     les trois scripts de vérification tant que ce n'est pas fait des deux
--     côtés. Décision distincte, à prendre séparément.
--
-- Aucune structure, aucune policy, aucune fonction ne change ici.
-- =============================================================================

update public.industries
   set description = replace(description, 'NexoraTech', 'REZO360')
 where description like '%NexoraTech%';
