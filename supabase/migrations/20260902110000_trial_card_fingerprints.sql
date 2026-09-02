-- =============================================================================
-- Un essai par carte, et non un essai par organisation
-- =============================================================================
--
-- CE QUI RESTAIT OUVERT
--
-- `20260830100000_monetization_trial_with_card` a fermé l'essai gratuit sans
-- carte : une organisation neuve démarre en formule Gratuite, et les 14 jours
-- passent par Stripe Checkout avec saisie d'un moyen de paiement.
--
-- Mais l'éligibilité se juge PAR ORGANISATION — `app.is_trial_eligible` et le
-- contrôle équivalent dans `create-checkout-session` interrogent tous deux
-- `subscriptions` filtrée sur `organization_id`. Or une nouvelle adresse mail
-- donne un nouvel utilisateur, donc une nouvelle organisation, donc une
-- nouvelle éligibilité. La même personne, avec la même carte, obtient encore
-- 14 jours autant de fois qu'elle crée de comptes.
--
-- L'EMPREINTE DE CARTE
--
-- Stripe expose `payment_method.card.fingerprint` : un condensé STABLE pour un
-- même numéro de carte, identique d'un client Stripe à l'autre. C'est
-- précisément l'invariant qui manque — il traverse les adresses mail, les
-- comptes et les organisations.
--
-- Ce n'est pas une donnée de carte : ni PAN, ni date, ni cryptogramme. Rien ici
-- ne relève du périmètre PCI, et l'empreinte seule ne permet pas de reconstituer
-- le numéro.
--
-- POURQUOI UNE TABLE, ET PAS UN CONTRÔLE AU MOMENT DU CHECKOUT
--
-- Au moment où `create-checkout-session` s'exécute, la carte n'est pas encore
-- saisie : elle l'est ensuite, sur la page hébergée par Stripe. L'empreinte
-- n'existe donc pas encore quand `trial_period_days` est décidé.
--
-- Le contrôle se fait à l'inverse : l'essai est accordé, puis le webhook — qui
-- reçoit le moyen de paiement — vérifie l'empreinte et COUPE l'essai
-- immédiatement (`trial_end=now`) si la carte a déjà servi ailleurs. Stripe
-- facture alors sur-le-champ. Le fraudeur n'obtient pas 14 jours ; le client
-- honnête ne voit rien.
--
-- LA LIMITE, ASSUMÉE
--
-- Une carte d'entreprise partagée par deux organisations réellement distinctes
-- ne donnera l'essai qu'à la première. C'est rare, et le second client peut
-- souscrire sans essai — il n'est jamais bloqué, seulement facturé tout de
-- suite. Le compromis inverse — laisser l'abus ouvert — coûte davantage.
-- =============================================================================

create table if not exists public.trial_card_fingerprints (
  -- L'empreinte Stripe elle-même. Clé primaire naturelle : c'est exactement la
  -- valeur qu'on interroge, et elle est unique par numéro de carte.
  fingerprint     text primary key,

  -- L'organisation qui a consommé l'essai avec cette carte. Purement
  -- informatif : utile pour comprendre un refus, jamais lu par la décision.
  --
  -- `on delete set null` et NON `cascade` : c'est le cœur du dispositif. Si la
  -- suppression de l'organisation effaçait l'empreinte, il suffirait de
  -- supprimer son entreprise pour rendre la carte à nouveau éligible — soit
  -- exactement la fraude qu'on ferme, avec une étape de plus.
  organization_id uuid references public.organizations (id) on delete set null,

  used_at         timestamptz not null default now()
);

create index if not exists trial_card_fingerprints_used_idx
  on public.trial_card_fingerprints (used_at desc);

-- -----------------------------------------------------------------------------
-- Aucun accès client
-- -----------------------------------------------------------------------------
--
-- Même régime que `stripe_events` : écrite uniquement par le webhook avec
-- `service_role`, qui contourne la RLS. Aucun rôle client n'a de raison de la
-- lire — la liste des cartes ayant essayé le produit renseignerait sur d'autres
-- organisations que la sienne.
--
-- RLS activée sans aucune policy : le refus est total et explicite.
revoke all on public.trial_card_fingerprints from public, anon, authenticated;

alter table public.trial_card_fingerprints enable row level security;

comment on table public.trial_card_fingerprints is
  'Empreintes Stripe des cartes ayant deja consomme un essai. Ecrite par le webhook avec service_role ; aucune policy cliente. Conservee meme apres suppression de l''organisation, sans quoi supprimer son entreprise rouvrirait l''essai.';
