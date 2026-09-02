-- =============================================================================
-- Réaligne la matrice des formules sur ce que le produit annonce
-- =============================================================================
--
-- CE QUI A ÉTÉ MESURÉ
--
-- La table `plan_features` déployée ne correspond plus à aucun fichier du dépôt.
-- Relevé sur la base de production :
--
--   starter : calculation_history, catalog_access, export_csv, export_pdf,
--             favorites, members:2, organizations, pro_tools
--
-- Il manque `customers`, `missions`, `interventions` et `quotes` — et
-- `pro_tools` s'y trouve alors qu'il est réservé à Pro. Or les politiques RLS de
-- ces quatre tables passent par `app.can_use_pro_module`, donc par
-- `app.org_has_feature`, qui exige une ligne dans `plan_features` :
--
--   UN CLIENT STARTER À 19 €/MOIS NE PEUT CRÉER NI CLIENT, NI MISSION,
--   NI INTERVENTION, NI DEVIS. Le serveur refuse l'écriture.
--
-- POURQUOI PERSONNE NE L'A VU
--
-- `20260817101000_pricing_model.sql` sème la bonne matrice. Mais ce fichier a
-- été MODIFIÉ DEUX FOIS APRÈS son application (`e80b47c` ajoute missions,
-- interventions, devis et clients à Starter ; `2b3e90c` retire `pro_tools` de
-- Starter). Sa version est déjà inscrite dans `supabase_migrations` : `db push`
-- la saute. Les deux corrections ne sont donc jamais parties en base.
--
-- Le garde-fou existant ne pouvait pas le détecter : `entitlements.test.ts`
-- compare le miroir TypeScript au CONTENU DU FICHIER de migration. Fichier et
-- TypeScript ont été corrigés ensemble — le test est resté vert pendant que la
-- base gardait le seed d'origine. Un test qui lit les migrations valide leur
-- intention, jamais l'état réel du serveur.
--
-- D'où la règle que ce fichier applique : une migration appliquée ne se corrige
-- pas en l'éditant, elle se corrige par une nouvelle migration.
--
-- CE QUE FAIT CETTE MIGRATION
--
-- 1. Elle remet la matrice à plat pour les cinq formules, à l'identique de
--    `PLAN_FEATURES` (`src/features/billing/entitlements.ts`).
-- 2. Elle ouvre le cœur du parcours sur la formule Gratuite, avec des plafonds.
-- 3. Elle rend ces plafonds effectifs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. La matrice, remise à plat
-- -----------------------------------------------------------------------------
--
-- Même geste que `20260817101000_pricing_model.sql` : on supprime les cinq
-- formules et on les réinsère d'un bloc. Accumuler des `insert` correctifs
-- produit un état que plus personne ne sait lire d'un coup d'œil — c'est
-- précisément ce qui a permis à la dérive ci-dessus de passer inaperçue.
--
-- Aucune donnée d'entreprise n'est touchée : `plan_features` est un référentiel
-- administré par migration.
--
-- NOUVEAUTÉ SUR LA FORMULE GRATUITE : `customers`, `missions` et `interventions`
-- y entrent avec des plafonds. Sans eux, un patron qui s'inscrit, crée son
-- entreprise et en devient propriétaire ne rencontre qu'un mur « Mettre à
-- niveau » sur chaque section, sans avoir rien vu fonctionner. Un artisan qui
-- n'a jamais vu une intervention se créer n'a aucune raison de sortir sa carte.
--
-- Les plafonds — 3 clients, 5 missions, 10 interventions — suffisent à
-- reconstituer une journée de travail réelle et à voir la chaîne complète
-- jusqu'au compte rendu. Ils ne suffisent pas à exploiter l'outil : une
-- entreprise de deux personnes les atteint en moins d'une semaine.
--
-- Le pilotage et l'administration restent fermés — devis, stock, achats,
-- matériel, statistiques, planning, équipes, journal d'audit, exports. Ce sont
-- eux qu'on achète.
delete from public.plan_features
where plan_code in ('free', 'starter', 'pro', 'business', 'enterprise');

insert into public.plan_features (plan_code, feature_key, limit_value) values
  -- free : le catalogue, plus un aperçu plafonné du terrain
  ('free', 'catalog_access',      null),
  ('free', 'calculation_history',   10),
  ('free', 'favorites',              3),
  ('free', 'customers',              3),
  ('free', 'missions',               5),
  ('free', 'interventions',         10),

  -- starter : l'artisan solo / duo — missions, interventions, devis, carnet clients
  ('starter', 'catalog_access',      null),
  ('starter', 'calculation_history', null),
  ('starter', 'favorites',           null),
  ('starter', 'export_pdf',          null),
  ('starter', 'export_csv',          null),
  ('starter', 'organizations',       null),
  ('starter', 'customers',           null),
  ('starter', 'members',                2),
  ('starter', 'missions',            null),
  ('starter', 'interventions',       null),
  ('starter', 'quotes',              null),

  -- pro : le terrain outillé — calculateurs métiers, matériel, stock, achats
  ('pro', 'catalog_access',      null),
  ('pro', 'calculation_history', null),
  ('pro', 'favorites',           null),
  ('pro', 'pro_tools',           null),
  ('pro', 'export_pdf',          null),
  ('pro', 'export_csv',          null),
  ('pro', 'organizations',       null),
  ('pro', 'customers',           null),
  ('pro', 'teams',               null),
  ('pro', 'members',                5),
  ('pro', 'missions',            null),
  ('pro', 'interventions',       null),
  ('pro', 'equipment',           null),
  ('pro', 'stock',               null),
  ('pro', 'purchases',           null),
  ('pro', 'quotes',              null),

  -- business : le pilotage — contrôle, audit, statistiques, planning
  ('business', 'catalog_access',       null),
  ('business', 'calculation_history',  null),
  ('business', 'favorites',            null),
  ('business', 'pro_tools',            null),
  ('business', 'export_pdf',           null),
  ('business', 'export_csv',           null),
  ('business', 'organizations',        null),
  ('business', 'customers',            null),
  ('business', 'teams',                null),
  ('business', 'members',                10),
  ('business', 'missions',             null),
  ('business', 'interventions',        null),
  ('business', 'intervention_review',  null),
  ('business', 'audit_log',            null),
  ('business', 'statistics',           null),
  ('business', 'attachments',          null),
  ('business', 'equipment',            null),
  ('business', 'stock',                null),
  ('business', 'purchases',            null),
  ('business', 'quotes',               null),
  ('business', 'planning',             null),

  -- enterprise : identique à business, avec vingt sièges inclus
  ('enterprise', 'catalog_access',       null),
  ('enterprise', 'calculation_history',  null),
  ('enterprise', 'favorites',            null),
  ('enterprise', 'pro_tools',            null),
  ('enterprise', 'export_pdf',           null),
  ('enterprise', 'export_csv',           null),
  ('enterprise', 'organizations',        null),
  ('enterprise', 'customers',            null),
  ('enterprise', 'teams',                null),
  ('enterprise', 'members',                20),
  ('enterprise', 'missions',             null),
  ('enterprise', 'interventions',        null),
  ('enterprise', 'intervention_review',  null),
  ('enterprise', 'audit_log',            null),
  ('enterprise', 'statistics',           null),
  ('enterprise', 'attachments',          null),
  ('enterprise', 'equipment',            null),
  ('enterprise', 'stock',                null),
  ('enterprise', 'purchases',            null),
  ('enterprise', 'quotes',               null),
  ('enterprise', 'planning',             null);

-- -----------------------------------------------------------------------------
-- 2. Rendre les plafonds effectifs
-- -----------------------------------------------------------------------------
--
-- C'est le piège de ce modèle, et il fallait le mesurer avant d'écrire :
-- `app.org_has_feature` considère toute ligne dont `limit_value > 0` comme un
-- accès accordé, et `app.org_feature_limit` n'était lue par AUCUN garde-fou —
-- le quota de membres, seul quota appliqué jusqu'ici, passe par
-- `plans.max_users`, pas par `plan_features`.
--
-- Déclarer `('free', 'missions', 5)` sans plus n'aurait donc pas donné cinq
-- missions : il aurait donné des missions ILLIMITÉES sur la formule gratuite,
-- soit l'inverse de l'intention. Ce trigger est le premier lecteur de
-- `org_feature_limit`.
--
-- Une seule fonction générique plutôt que trois copies : `enforce_member_quota`
-- a la sienne parce qu'elle compte des lignes filtrées par statut. Ici les trois
-- tables se comptent de la même façon, et trois fonctions identiques à un nom de
-- table près auraient divergé à la première correction.
--
-- Le nom de la table vient de `TG_TABLE_NAME`, posé par le moteur, jamais par
-- l'appelant : aucune valeur externe n'entre dans le SQL dynamique.
create or replace function app.enforce_plan_row_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feature text := tg_argv[0];
  v_limit   integer := app.org_feature_limit(new.organization_id, v_feature);
  v_count   integer;
begin
  -- `null` couvre deux cas, tous deux à laisser passer ici :
  --   • formule payante — la fonctionnalité est incluse sans plafond ;
  --   • fonctionnalité absente de la formule — c'est la RLS qui refuse, en
  --     amont, via `app.org_has_feature`.
  -- Les formules payantes ne paient donc aucun coût de comptage.
  if v_limit is null then
    return new;
  end if;

  execute format(
    'select count(*) from public.%I where organization_id = $1',
    tg_table_name
  )
  into v_count
  using new.organization_id;

  if v_count >= v_limit then
    raise exception
      'Formule Gratuite : % au maximum. Passez à une formule supérieure pour continuer.',
      v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ATTENTION AU NOM DE CES TRIGGERS — vérifié après application.
--
-- Postgres exécute les triggers d'un même événement dans l'ORDRE ALPHABÉTIQUE
-- de leur nom. Sur `interventions`, `organization_id` n'est pas fourni par
-- l'appelant : c'est `interventions_enforce_org` qui le déduit de la mission et
-- l'affecte à `new`. Ce nom précède `interventions_enforce_plan_quota`, donc le
-- plafond lit une valeur renseignée.
--
-- Renommer l'un de ces triggers avec un nom qui passerait AVANT
-- `interventions_enforce_org` ferait lire `new.organization_id` à null :
-- `org_feature_limit` renverrait null et le plafond laisserait tout passer,
-- SANS ERREUR VISIBLE. Le garde-fou s'ouvrirait en silence.
drop trigger if exists customers_enforce_plan_quota on public.customers;
create trigger customers_enforce_plan_quota
  before insert on public.customers
  for each row execute function app.enforce_plan_row_quota('customers');

drop trigger if exists missions_enforce_plan_quota on public.missions;
create trigger missions_enforce_plan_quota
  before insert on public.missions
  for each row execute function app.enforce_plan_row_quota('missions');

drop trigger if exists interventions_enforce_plan_quota on public.interventions;
create trigger interventions_enforce_plan_quota
  before insert on public.interventions
  for each row execute function app.enforce_plan_row_quota('interventions');

-- -----------------------------------------------------------------------------
-- 3. Droits
-- -----------------------------------------------------------------------------
-- Même traitement que les autres fonctions `app.` : rien pour `anon`, exécution
-- pour les sessions authentifiées. La fonction est `security definer` et n'est
-- de toute façon atteignable que par les triggers.
revoke all on function app.enforce_plan_row_quota() from public, anon;
grant execute on function app.enforce_plan_row_quota() to authenticated;

comment on function app.enforce_plan_row_quota() is
  'Applique le plafond de lignes declare dans plan_features pour la table portant le trigger. Le nom de la fonctionnalite est passe en argument de trigger ; le nom de la table vient de TG_TABLE_NAME.';
