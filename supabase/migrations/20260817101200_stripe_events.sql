-- =============================================================================
-- Journal des événements Stripe — l'idempotence du webhook
-- =============================================================================
--
-- POURQUOI CETTE TABLE EST INDISPENSABLE
--
-- Stripe REJOUE ses événements. C'est documenté et voulu : si le webhook ne
-- répond pas 2xx assez vite, ou répond une erreur, le même événement revient —
-- parfois plusieurs jours plus tard. Il arrive aussi qu'un événement soit livré
-- deux fois sans aucun échec.
--
-- Sans garde, chaque rejeu réapplique l'écriture. Les conséquences ne sont pas
-- théoriques :
--
--   • un `customer.subscription.deleted` rejoué APRÈS un réabonnement annule
--     l'abonnement neuf ;
--   • un `invoice.payment_failed` rejoué remet en `past_due` un compte déjà
--     régularisé ;
--   • un changement de formule rejoué écrase une modification postérieure.
--
-- L'identifiant d'événement Stripe (`evt_...`) est unique et stable d'un rejeu à
-- l'autre. Il fait donc une clé primaire naturelle : l'insertion échoue au
-- second passage, et le webhook s'arrête là.
--
-- On enregistre AVANT de traiter, dans la même transaction que l'écriture. Si
-- le traitement échoue, la transaction est annulée — la ligne de journal
-- disparaît avec elle, et le rejeu suivant retentera. Enregistrer après aurait
-- laissé un événement perdu à chaque erreur.
-- =============================================================================

create table if not exists public.stripe_events (
  -- L'identifiant Stripe lui-même : `evt_1Abc...`. Pas de `uuid` généré, qui
  -- n'aurait aucun lien avec ce que Stripe renvoie au rejeu.
  id           text primary key,
  type         text not null,
  -- Utile au diagnostic : savoir QUELLE organisation un événement a touchée
  -- sans avoir à rejouer la charge utile.
  organization_id uuid references public.organizations (id) on delete set null,
  received_at  timestamptz not null default now()
);

create index if not exists stripe_events_received_idx
  on public.stripe_events (received_at desc);

-- -----------------------------------------------------------------------------
-- Aucun accès client
-- -----------------------------------------------------------------------------
--
-- Cette table n'est écrite que par le webhook, avec `service_role`, qui
-- contourne la RLS. Aucun rôle client n'a besoin de la lire : elle ne contient
-- rien qu'un utilisateur doive voir, et son contenu renseignerait sur le rythme
-- de facturation d'autres organisations.
--
-- RLS activée sans aucune policy : le refus est total et explicite, comme pour
-- `subscriptions`.
revoke all on public.stripe_events from public, anon, authenticated;

alter table public.stripe_events enable row level security;

comment on table public.stripe_events is
  'Événements Stripe déjà traités. Écrite par le webhook avec service_role ; aucune policy cliente.';

-- -----------------------------------------------------------------------------
-- La cible de l'`upsert` du webhook
-- -----------------------------------------------------------------------------
--
-- Le webhook écrit `on conflict (provider_subscription_id)`. PostgreSQL exige
-- un index UNIQUE sur cette colonne, sinon l'instruction échoue à l'exécution —
-- c'est-à-dire au premier paiement réel, ce qui est le pire moment pour
-- l'apprendre.
--
-- Index PARTIEL : la colonne est nulle pour tous les abonnements d'essai créés
-- par `app.start_organization_trial`, qui n'ont jamais vu Stripe. Un index
-- unique ordinaire les traiterait comme distincts — ce qui marche — mais
-- l'index partiel dit ce qu'on veut vraiment : deux lignes ne peuvent pas
-- décrire le même abonnement Stripe.
create unique index if not exists subscriptions_provider_subscription_idx
  on public.subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;
