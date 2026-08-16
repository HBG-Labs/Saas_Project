-- =============================================================================
-- Le cache des permissions se rafraîchit tout seul
-- =============================================================================
--
-- LE DÉFAUT
--
-- `app.has_org_permission` ne lit pas `role_permissions`. Elle lit
-- `app.role_permission_cache`, une vue matérialisée — décision juste, puisque
-- les 104 policies interrogent la matrice à chaque ligne évaluée.
--
-- Cette vue ne se met à jour que si on le demande. Le commentaire de
-- `20260808100100_rbac.sql` le dit d'ailleurs en toutes lettres :
--
--     « À appeler en fin de toute migration qui touche `role_permissions`. »
--
-- Les migrations `20260816100000_planning.sql` et
-- `20260816100100_technician_locations.sql` ne l'ont pas fait. Mesuré sur la
-- base réelle avant ce correctif :
--
--     dans la table : 126 permissions        dans le cache : 101
--
-- Les vingt-cinq manquantes étaient exactement les nouvelles. Conséquence :
-- `leave.request`, `leave.approve`, `planning.view`, `planning.manage` et
-- `location.view_all` renvoyaient `false` pour TOUS les rôles. Les écrans
-- s'affichaient, les requêtes revenaient vides, et rien n'expliquait pourquoi.
--
-- POURQUOI UN TRIGGER PLUTÔT QU'UN APPEL DE PLUS
--
-- Appeler la fonction ici règlerait le cas d'aujourd'hui et laisserait le piège
-- intact pour la prochaine migration. Ce projet a déjà tranché ce genre de
-- question : les frontières d'architecture sont appliquées par ESLint, les
-- miroirs TypeScript par des tests qui lisent le SQL. Une convention non
-- outillée finit toujours par être contournée — celle-ci l'a été deux fois.
--
-- Le cache devient donc une conséquence de l'écriture, et non un geste à
-- retenir.
-- =============================================================================

create or replace function app.sync_role_permission_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sans `concurrently` : cette variante-là s'exécute dans une transaction,
  -- ce que fait toute migration. Le verrou exclusif est sans conséquence sur
  -- une table de 126 lignes qu'aucun client n'écrit — `role_permissions` est
  -- administrée par migration, et son type `Insert` est `never`.
  refresh materialized view app.role_permission_cache;
  return null;
end;
$$;

-- `for each statement` : un semis de vingt permissions est UNE écriture, donc
-- un rafraîchissement. Par ligne, ce serait vingt reconstructions de la vue.
drop trigger if exists role_permissions_sync_cache on public.role_permissions;
create trigger role_permissions_sync_cache
  after insert or update or delete or truncate on public.role_permissions
  for each statement execute function app.sync_role_permission_cache();

-- Et on répare l'état actuel, que le trigger ne peut pas rattraper
-- rétroactivement.
refresh materialized view app.role_permission_cache;
