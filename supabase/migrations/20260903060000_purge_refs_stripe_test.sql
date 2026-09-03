-- Retrait des références Stripe de TEST devenues introuvables en mode réel.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CE QUI EST CASSÉ SANS CETTE MIGRATION
--
-- Deux organisations portaient un `provider_customer_id` et un
-- `provider_subscription_id` créés du temps où la clé était `sk_test_`. Le
-- passage en `sk_live_` les a rendus inexistants : test et réel sont deux
-- registres séparés, et rien dans la forme d'un `cus_...` ne les distingue.
--
-- Vérifié en interrogeant l'API Stripe avec la clé réelle — les quatre objets
-- répondent « introuvable » :
--
--   REZO360 Démo Business   cus_V9VOwmJdJqqS27  sub_1U9CNzHaG3CKfjPpHOvY4Zg5
--   HBTech                  cus_V9WKupTTKO8dN9  sub_1U9DHmHaG3CKfjPpqnrO9Cmv
--
-- Le suffixe `HaG3CKfjPp` de ces identifiants est celui du compte en mode test,
-- le même que portaient les anciens tarifs ; les objets réels portent
-- `H91veQUR7I`.
--
-- Conséquence concrète : `create-checkout-session` retransmet le
-- `provider_customer_id` connu quand il en trouve un. Ces deux organisations
-- envoyaient donc un client de test à Stripe en réel, qui répondait « No such
-- customer ». Souscrire, changer de formule, ouvrir le portail de facturation
-- ou résilier : tout échouait, sur un message qui ne désigne pas la cause.
--
-- POURQUOI SEULEMENT LES RÉFÉRENCES, ET PAS LES LIGNES
--
-- Le statut et la formule décrivent des droits réellement accordés — l'une est
-- une organisation de démonstration en Enterprise, l'autre est en essai. Les
-- annuler retirerait des accès pour un motif qui n'a rien à voir avec eux.
--
-- Seuls les pointeurs vers Stripe sont faux, et une fois vidés, l'organisation
-- redevient traitée comme n'ayant jamais souscrit : la prochaine souscription
-- crée un client neuf dans le bon registre.
--
-- CIBLAGE PAR IDENTIFIANT EXACT, ET NON « TOUTES LES RÉFÉRENCES »
--
-- Au moment de l'écriture, ces deux lignes sont les seules à porter une
-- référence Stripe — un `update` sans condition aurait donc le même effet. Mais
-- entre l'écriture et l'application, un VRAI abonnement peut naître : le premier
-- paiement réel est justement à l'essai. Une purge globale l'effacerait, et
-- l'organisation qui vient de payer perdrait le lien vers son abonnement.
--
-- `stripe_events` n'est pas touché : c'est un journal en ajout seul servant
-- l'idempotence, et les identifiants d'événements réels ne peuvent pas entrer
-- en collision avec ceux de test.
-- ─────────────────────────────────────────────────────────────────────────────

update public.subscriptions
   set provider_customer_id     = null,
       provider_subscription_id = null,
       updated_at               = now()
 where provider_subscription_id in (
         'sub_1U9CNzHaG3CKfjPpHOvY4Zg5',
         'sub_1U9DHmHaG3CKfjPpqnrO9Cmv'
       );

-- ── Garde-fou ───────────────────────────────────────────────────────────────
--
-- Un `update` qui ne touche aucune ligne réussit sans rien dire. On contrôle
-- donc l'état atteint : plus aucune trace des objets de test, et les lignes
-- toujours présentes avec leurs droits intacts.
do $$
declare
  restants integer;
  orphelins integer;
begin
  select count(*) into restants
    from public.subscriptions
   where provider_subscription_id in ('sub_1U9CNzHaG3CKfjPpHOvY4Zg5', 'sub_1U9DHmHaG3CKfjPpqnrO9Cmv')
      or provider_customer_id in ('cus_V9VOwmJdJqqS27', 'cus_V9WKupTTKO8dN9');

  if restants > 0 then
    raise exception 'Références Stripe de test encore présentes : % ligne(s)', restants;
  end if;

  -- Une référence à moitié vidée serait pire que le mal : le webhook fait son
  -- `upsert` sur `provider_subscription_id`, et un client sans abonnement
  -- laisserait `create-checkout-session` retransmettre un `cus_...` mort.
  select count(*) into orphelins
    from public.subscriptions
   where (provider_customer_id is null) <> (provider_subscription_id is null);

  if orphelins > 0 then
    raise exception 'Abonnement(s) avec une seule des deux références Stripe : %', orphelins;
  end if;
end $$;
