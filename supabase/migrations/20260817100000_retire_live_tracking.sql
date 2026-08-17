-- =============================================================================
-- Retrait du suivi GPS continu — droits et entitlement
-- =============================================================================
--
-- LA DÉCISION
--
-- Le suivi permanent des intervenants est abandonné. Le GPS ne sert plus qu'à
-- quatre gestes ponctuels, tous déclenchés par une action explicite : relever sa
-- position, localiser un chantier, ouvrir un itinéraire, trier les
-- interventions par distance.
--
-- CE QUE CETTE MIGRATION RETIRE
--
--   • la permission `location.view_all`, accordée à quatre rôles ;
--   • l'entitlement `live_tracking` des formules Business et Entreprise.
--
-- Plus rien ne les interroge : la carte s'ouvre désormais sur `missions`, et le
-- code client qui lisait les positions a été supprimé. Les laisser en base
-- reviendrait à décrire dans la matrice des droits une capacité que le produit
-- n'a plus — un lecteur de `role_permissions` en conclurait le contraire.
--
-- CE QUE CETTE MIGRATION NE RETIRE PAS
--
-- Les tables `technician_locations` et `technician_location_pings` restent, avec
-- leur enum, leurs deux fonctions et leurs six policies. Elles sont vides et
-- désormais inatteignables — plus aucune policy de lecture ne peut être
-- satisfaite, puisque `location.view_all` n'existe plus et que `is_own_membership`
-- ne renvoie de ligne à personne.
--
-- Les supprimer serait irréversible pour un gain nul : aucune donnée, aucun
-- coût de stockage, aucune surface d'attaque. Le jour où la décision serait
-- réexaminée, le schéma est là. Une suppression devra être une décision prise
-- pour elle-même, pas l'effet de bord d'un nettoyage.
-- =============================================================================

delete from public.role_permissions where permission = 'location.view_all';

delete from public.plan_features where feature_key = 'live_tracking';

-- Le cache des permissions se rafraîchit seul depuis
-- `20260816100200_permission_cache_self_maintaining.sql` : le trigger
-- `role_permissions_sync_cache` a déjà pris en compte le DELETE ci-dessus.
-- C'est précisément la classe d'oubli que ce trigger a fermée.
