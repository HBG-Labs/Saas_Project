-- =============================================================================
-- Permissions du module Clients
-- =============================================================================
--
-- Insertion ciblée plutôt que re-seed complet de `role_permissions` : rejouer
-- tout le tableau exposerait à en perdre une ligne au passage, alors que seules
-- quatre permissions sont nouvelles.
-- =============================================================================

insert into public.role_permissions (role, permission) values
  -- Propriétaire et administrateur : contrôle complet du portefeuille.
  ('owner',       'customer.view'),
  ('owner',       'customer.create'),
  ('owner',       'customer.update'),
  ('owner',       'customer.delete'),
  ('admin',       'customer.view'),
  ('admin',       'customer.create'),
  ('admin',       'customer.update'),
  ('admin',       'customer.delete'),

  -- Responsable : gère les clients au quotidien, mais ne les supprime pas.
  -- Supprimer une fiche rompt le lien de missions archivées ; l'acte relève de
  -- l'administration, pas de l'exploitation.
  ('manager',     'customer.view'),
  ('manager',     'customer.create'),
  ('manager',     'customer.update'),

  -- Chef d'équipe : consultation seule. Il prépare des interventions, il ne
  -- tient pas le fichier client.
  ('team_leader', 'customer.view')

  -- `technician` et `employee` n'apparaissent pas, et c'est le cœur du modèle :
  -- un technicien n'a pas à connaître le portefeuille de son entreprise. Il
  -- atteint la fiche du client CHEZ QUI il intervient par la seconde branche de
  -- la policy `customers_select`, qui passe par ses missions. Le besoin est
  -- satisfait sans jamais accorder une vue d'ensemble.
on conflict (role, permission) do nothing;

-- -----------------------------------------------------------------------------
-- Rafraîchissement du cache
-- -----------------------------------------------------------------------------
--
-- `app.role_has_permission` lit la vue matérialisée, pas la table : sans ce
-- rafraîchissement, les permissions ci-dessus resteraient invisibles et toutes
-- les policies « customer.* » renverraient false.
--
-- Sans CONCURRENTLY, délibérément : PostgreSQL interdit cette variante dans un
-- bloc transactionnel, et la CLI encapsule chaque migration dans une
-- transaction. Le verrou exclusif est ici sans conséquence — la vue compte une
-- poignée de lignes et personne n'utilise encore le module.
refresh materialized view app.role_permission_cache;
