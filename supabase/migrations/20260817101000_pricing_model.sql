-- =============================================================================
-- Nouvelle grille tarifaire — cinq paliers, sièges inclus, supplément par siège
-- =============================================================================
--
-- LA GRILLE OFFICIELLE
--
--   Plan         Mensuel   Sièges inclus   Supplément      Plafond
--   free           0 €           1         interdit           1
--   starter       19 €           2         +5 €/siège      aucun
--   pro           39 €           5         +5 €/siège      aucun
--   business      69 €          10         +5 €/siège      aucun
--   enterprise    99 €          20         +5 €/siège      aucun
--
-- CE QUE CETTE MIGRATION NE CRÉE PAS, ET POURQUOI
--
-- Pas de colonne `plans.included_users`. Les sièges inclus vivent déjà dans
-- `plan_features` sous la clé `members`, et c'est CETTE valeur que lit
-- `app.org_feature_limit`, donc toute la chaîne d'entitlements et les 34
-- policies qui en dépendent. Une seconde colonne porterait la même vérité à un
-- autre endroit — le doublon que ce dépôt passe son temps à démonter.
--
-- Sont ajoutées les seules données qui n'existent nulle part : le prix du siège
-- supplémentaire, le plafond dur, et les identifiants de tarif Stripe.
--
-- POURQUOI LES IDENTIFIANTS STRIPE SONT EN BASE ET NON DANS LE BUNDLE
--
-- Le webhook doit faire le chemin INVERSE : recevoir un `price_...` et en
-- déduire le plan. Un abonnement modifié depuis le tableau de bord Stripe
-- n'arrive pas autrement. Une constante compilée dans le paquet JavaScript
-- n'est pas interrogeable depuis une fonction Edge.
--
-- ÉTAT AVANT MIGRATION, MESURÉ
--
--   plans     : free, pro (14,99 €), business (39,99 €), ultimate (99 €)
--   abonnés   : 4 organisations, toutes sur `business`, aucune sur `ultimate`
--   provider  : aucun — pas un seul abonnement Stripe existant
--
-- Le renommage `ultimate` → `enterprise` est donc sans risque : personne n'y est
-- abonné. Le passage de business de 39,99 € à 69 € touche quatre comptes de
-- démonstration sans moyen de paiement — aucune proratisation en jeu.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Colonnes manquantes
-- -----------------------------------------------------------------------------
alter table public.plans
  add column if not exists extra_user_price_cents integer not null default 0,
  add column if not exists max_users integer,
  add column if not exists stripe_price_id_monthly text,
  add column if not exists stripe_price_id_annual text;

alter table public.plans drop constraint if exists plans_extra_user_price_positive;
alter table public.plans
  add constraint plans_extra_user_price_positive check (extra_user_price_cents >= 0);

alter table public.plans drop constraint if exists plans_max_users_positive;
alter table public.plans
  add constraint plans_max_users_positive check (max_users is null or max_users >= 1);

comment on column public.plans.extra_user_price_cents is
  'Coût mensuel d''un siège au-delà de ceux inclus (plan_features.members). 0 pour Free.';
comment on column public.plans.max_users is
  'Plafond DUR. Renseigné pour Free (1) uniquement ; null = aucune limite, le dépassement est facturé.';

-- -----------------------------------------------------------------------------
-- billing_settings — ce qui est global, et non par plan
-- -----------------------------------------------------------------------------
--
-- Le siège supplémentaire est UN SEUL tarif Stripe à 5 €, dont seule la
-- `quantity` varie. Créer un tarif par plan multiplierait les identifiants sans
-- rien exprimer de plus, et créer un tarif par quantité — la faute classique —
-- en produirait un par effectif possible.
--
-- Une seule ligne, garantie par une contrainte plutôt que par la discipline.
create table if not exists public.billing_settings (
  id                          boolean primary key default true,
  extra_seat_price_id_monthly text,
  extra_seat_price_id_annual  text,
  updated_at                  timestamptz not null default now(),

  constraint billing_settings_singleton check (id)
);

insert into public.billing_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists billing_settings_set_updated_at on public.billing_settings;
create trigger billing_settings_set_updated_at
  before update on public.billing_settings
  for each row execute function public.set_updated_at();

-- Référentiel de facturation : lisible par les membres authentifiés (la page
-- Facturation affiche les tarifs), jamais écrit par un client.
revoke all on public.billing_settings from public, anon, authenticated;
grant select on public.billing_settings to authenticated;

alter table public.billing_settings enable row level security;

drop policy if exists "billing_settings_select" on public.billing_settings;
create policy "billing_settings_select"
  on public.billing_settings for select
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Renommage `ultimate` → `enterprise`
-- -----------------------------------------------------------------------------
--
-- `plans.code` est référencé par `plan_features.plan_code` et
-- `subscriptions.plan_code`. L'ordre importe : on insère la nouvelle ligne, on
-- déplace les références, puis on retire l'ancienne. Un `update plans set code`
-- direct violerait les clés étrangères le temps de l'instruction.
insert into public.plans (
  code, name, description, price_monthly_cents, price_annual_cents,
  currency, is_organization_plan, sort_order, status
)
select
  'enterprise', 'Enterprise', description, 9900, 94800,
  currency, true, sort_order, status
from public.plans where code = 'ultimate'
on conflict (code) do nothing;

-- Les TROIS références connues, dans l'ordre. `organizations.plan_code` est un
-- cache maintenu par trigger, mais il porte une clé étrangère `on delete set
-- null` : l'oublier ferait perdre son plan à une organisation au lieu de la
-- renommer.
update public.plan_features set plan_code = 'enterprise' where plan_code = 'ultimate';
update public.subscriptions  set plan_code = 'enterprise' where plan_code = 'ultimate';
update public.organizations  set plan_code = 'enterprise' where plan_code = 'ultimate';

delete from public.plans where code = 'ultimate';

-- -----------------------------------------------------------------------------
-- Le palier Starter
-- -----------------------------------------------------------------------------
insert into public.plans (
  code, name, description, price_monthly_cents, price_annual_cents,
  currency, is_organization_plan, sort_order, status
) values (
  'starter',
  'Starter',
  'Deux utilisateurs inclus, puis 5 € par siège supplémentaire.',
  1900, 18000, 'EUR', true, 1, 'active'
)
on conflict (code) do update set
  name                = excluded.name,
  description         = excluded.description,
  price_monthly_cents = excluded.price_monthly_cents,
  price_annual_cents  = excluded.price_annual_cents,
  is_organization_plan = excluded.is_organization_plan;

-- -----------------------------------------------------------------------------
-- Tarifs, plafonds et ordre d'affichage
-- -----------------------------------------------------------------------------
--
-- `pro` devient un plan d'ORGANISATION : il ne l'était pas, et la nouvelle
-- grille lui donne cinq sièges. `is_organization_plan` gouverne l'affichage des
-- offres capables de porter une entreprise.
update public.plans set
  price_monthly_cents    = 0,
  price_annual_cents     = 0,
  extra_user_price_cents = 0,
  max_users              = 1,
  is_organization_plan   = false,
  sort_order             = 0
where code = 'free';

update public.plans set
  price_monthly_cents    = 1900,
  price_annual_cents     = 18000,
  extra_user_price_cents = 500,
  max_users              = null,
  is_organization_plan   = true,
  sort_order             = 1
where code = 'starter';

update public.plans set
  name                   = 'Pro',
  price_monthly_cents    = 3900,
  price_annual_cents     = 37200,
  extra_user_price_cents = 500,
  max_users              = null,
  is_organization_plan   = true,
  sort_order             = 2
where code = 'pro';

update public.plans set
  name                   = 'Business',
  price_monthly_cents    = 6900,
  price_annual_cents     = 66000,
  extra_user_price_cents = 500,
  max_users              = null,
  is_organization_plan   = true,
  sort_order             = 3
where code = 'business';

update public.plans set
  name                   = 'Enterprise',
  price_monthly_cents    = 9900,
  price_annual_cents     = 94800,
  extra_user_price_cents = 500,
  max_users              = null,
  is_organization_plan   = true,
  sort_order             = 4
where code = 'enterprise';

-- -----------------------------------------------------------------------------
-- Matrice des fonctionnalités
-- -----------------------------------------------------------------------------
--
-- Doit refléter EXACTEMENT `PLAN_FEATURES` de
-- `src/features/billing/entitlements.ts`. `entitlements.test.ts` compare les
-- deux plan par plan et échoue à la moindre divergence.
--
-- On repart d'une table nette pour les cinq plans : accumuler des `insert`
-- correctifs sur six migrations successives a produit un état que plus personne
-- ne pouvait lire d'un coup d'œil. Aucune donnée d'entreprise n'est touchée —
-- `plan_features` est un référentiel administré par migration.
delete from public.plan_features
where plan_code in ('free', 'starter', 'pro', 'business', 'enterprise');

insert into public.plan_features (plan_code, feature_key, limit_value) values
  -- free : le catalogue d'outils, rien du module professionnel
  ('free', 'catalog_access',      null),
  ('free', 'calculation_history',   10),
  ('free', 'favorites',              3),

  -- starter : l'entreprise et ses membres, pas encore les missions
  ('starter', 'catalog_access',      null),
  ('starter', 'calculation_history', null),
  ('starter', 'favorites',           null),
  ('starter', 'pro_tools',           null),
  ('starter', 'export_pdf',          null),
  ('starter', 'export_csv',          null),
  ('starter', 'organizations',       null),
  ('starter', 'members',                2),

  -- pro : le terrain — missions, interventions, matériel, devis
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
  ('business', 'quotes',               null),
  ('business', 'planning',             null),

  -- enterprise : identique à business, vingt sièges inclus
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
  ('enterprise', 'quotes',               null),
  ('enterprise', 'planning',             null);
