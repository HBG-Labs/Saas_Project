-- =============================================================================
-- Deux défauts révélés par le banc d'essai des écritures
-- =============================================================================
--
-- Le script `scripts/smoke-queries.mjs --writes` crée une organisation jetable,
-- y exerce les écritures de chaque module, puis la supprime. Il a mis au jour
-- deux problèmes qu'aucun test unitaire ne pouvait voir, faute de toucher la
-- base.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Le cache de permissions ignorait les permissions ajoutées
-- -----------------------------------------------------------------------------
--
-- LE CONSTAT
--
--   INSERT INTO quotes          → 42501 (new row violates row-level security)
--   INSERT INTO equipment       → 42501
--   INSERT INTO quote_templates → 42501
--
-- Et ce, pour un PROPRIÉTAIRE de l'organisation. Les insertions de missions et
-- de clients passaient dans la même session — le plan et l'appartenance étaient
-- donc corrects.
--
-- POURQUOI
--
-- `app.role_has_permission` ne lit pas `role_permissions` : elle interroge la
-- vue matérialisée `app.role_permission_cache`. Les migrations `equipment` et
-- `quotes` ont bien inséré les paires `equipment.*` et `quote.*` dans la table,
-- mais sans rafraîchir la vue — que `20260808100100_rbac.sql` demande pourtant
-- explicitement de rafraîchir « en fin de toute migration qui touche
-- role_permissions ».
--
-- Les nouvelles permissions existaient donc en base sans exister pour le moteur
-- d'autorisation. Le miroir TypeScript, lui, les connaissait : l'interface
-- proposait les boutons, le serveur refusait l'écriture — exactement le genre
-- de divergence que ces tests de synchronisation cherchent à empêcher, et qu'ils
-- ne pouvaient pas détecter puisqu'ils comparent le code au SQL, pas à l'état
-- réel de la base.
--
-- Sans CONCURRENTLY : la CLI encapsule chaque migration dans une transaction, et
-- PostgreSQL y interdit cette variante. Même raisonnement que la migration
-- `rbac_customers`.
refresh materialized view app.role_permission_cache;


-- -----------------------------------------------------------------------------
-- 2. Une organisation ne pouvait pas être supprimée
-- -----------------------------------------------------------------------------
--
-- LE CONSTAT
--
--   DELETE FROM organizations WHERE id = ...
--   → 23514 « Impossible de retirer le dernier propriétaire de l'organisation. »
--
-- POURQUOI
--
-- La suppression d'une organisation cascade sur `organization_members`. Chaque
-- ligne supprimée déclenche `protect_last_owner`, qui refuse le retrait du
-- dernier propriétaire — et le refuse ici aussi, alors que l'organisation
-- elle-même est en train de disparaître.
--
-- La policy `organizations_delete_owner` accordait donc un droit inapplicable :
-- un propriétaire pouvait demander la suppression, jamais l'obtenir.
--
-- LA CORRECTION
--
-- Le garde-fou reste entier pour ce qu'il protège : une organisation VIVANTE ne
-- doit jamais se retrouver sans propriétaire. Il s'efface uniquement quand
-- l'organisation n'existe plus.
--
-- La détection est fiable : PostgreSQL supprime d'abord la ligne parente, puis
-- déclenche la cascade. Au moment où ce trigger s'exécute pour un membre,
-- l'organisation a donc déjà disparu de la table. Dans tous les autres cas —
-- retrait manuel d'un membre, rétrogradation, suspension — elle est bien là et
-- la règle s'applique comme avant.
create or replace function app.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining integer;
begin
  -- L'organisation entière est en cours de suppression : il n'y a plus rien à
  -- protéger. Voir le raisonnement ci-dessus sur l'ordre parent → cascade.
  if not exists (
    select 1 from public.organizations o where o.id = old.organization_id
  ) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- Ne se déclenche que si la ligne concernée EST un propriétaire actif.
  -- `new` est NULL sur DELETE : on distingue explicitement les deux cas plutôt
  -- que d'utiliser coalesce(), dont le type de retour est indéterminé sur des
  -- enregistrements composites.
  if old.role <> 'owner' or old.status <> 'active' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- Sortie anticipée : la mise à jour ne touche ni le rôle ni le statut.
  if tg_op = 'UPDATE' and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;

  select count(*) into v_remaining
  from public.organization_members
  where organization_id = old.organization_id
    and role = 'owner'
    and status = 'active'
    and id <> old.id;

  if v_remaining = 0 then
    raise exception
      'Impossible de retirer le dernier propriétaire de l''organisation. Nommez d''abord un autre propriétaire.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
