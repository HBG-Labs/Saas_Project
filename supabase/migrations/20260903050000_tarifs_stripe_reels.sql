-- Bascule des identifiants de tarif Stripe du registre de TEST vers le RÉEL.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI CES IDENTIFIANTS ARRIVENT EN MIGRATION, ET NON À LA MAIN
--
-- Les tarifs de test avaient été posés directement en base, hors dépôt : aucune
-- migration ne les portait. Vérifié par recherche sur l'ensemble du dépôt, ils
-- n'apparaissaient nulle part. Un vidage ou une reconstruction de la base les
-- aurait donc perdus en silence, et l'application aurait répondu « Tarifs
-- Stripe non configurés » sans que rien n'explique pourquoi.
--
-- Ils sont désormais versionnés. Le jour où la base est reconstruite, les
-- tarifs suivent.
--
-- CE QUE CETTE MIGRATION CORRIGE VRAIMENT
--
-- Le mode test et le mode réel de Stripe sont deux registres séparés : un
-- `price_...` créé dans l'un n'existe pas dans l'autre, et rien dans sa forme
-- ne les distingue. La clé secrète étant passée en `sk_live_`, les anciens
-- identifiants de test étaient devenus introuvables — tout paiement aurait
-- échoué sur « No such price », au pire moment possible : un client, carte à
-- la main.
--
-- Les cinq valeurs ci-dessous ne sont pas recopiées à la main. Elles ont été
-- rapprochées par `scripts/list-stripe-live-prices.mjs`, qui interroge Stripe
-- avec la clé réellement configurée et apparie sur le MONTANT — refusant de
-- conclure si un montant ne tombe pas sur exactement un tarif. Correspondance
-- obtenue, produit par produit :
--
--   REZO360 Starter                    19,00 €/mois
--   REZO360 Pro                        39,00 €/mois
--   REZO360 Business                   69,00 €/mois
--   REZO360 Enterprise                 99,00 €/mois
--   REZO360 Utilisateur supplementaire  5,00 €/mois
--
-- POUR MÉMOIRE, LES ANCIENS TARIFS DE TEST
--
-- Conservés ici pour qu'un retour en mode test reste possible sans devoir les
-- rechercher dans le tableau de bord :
--
--   starter     price_1U5bJBHaG3CKfjPpl6JtkHDy
--   pro         price_1U5bLyHaG3CKfjPpm5VFjkem
--   business    price_1U5bOaHaG3CKfjPp7bvNKsQz
--   enterprise  price_1U5bPvHaG3CKfjPpXyWRuEgN
--   siège suppl price_1U5bRsHaG3CKfjPpThVu9c5f
--
-- Les colonnes `*_annual` restent vides : un abonnement Stripe ne peut pas
-- mélanger deux périodicités, et l'annuel n'est pas proposé (voir
-- `resolveStripePrices` dans `supabase/functions/_shared/billing.ts`).
-- ─────────────────────────────────────────────────────────────────────────────

update public.plans set stripe_price_id_monthly = 'price_1UBRqVH91veQUR7IBK6UxbMg' where code = 'starter';
update public.plans set stripe_price_id_monthly = 'price_1UBRtWH91veQUR7I1z0PKWh9' where code = 'pro';
update public.plans set stripe_price_id_monthly = 'price_1UBRuQH91veQUR7I1IillW86' where code = 'business';
update public.plans set stripe_price_id_monthly = 'price_1UBRvWH91veQUR7ICSqxkMYr' where code = 'enterprise';

-- `billing_settings` est un singleton garanti par contrainte : `where id` vise
-- l'unique ligne, dont la clé primaire booléenne vaut `true`.
update public.billing_settings set extra_seat_price_id_monthly = 'price_1UBRxeH91veQUR7I20I3sjnU' where id;

-- ── Garde-fou ───────────────────────────────────────────────────────────────
--
-- Un `update` qui ne touche aucune ligne réussit sans rien dire. Si un code de
-- formule venait à changer, la migration passerait au vert en laissant les
-- tarifs de test en place — exactement la panne qu'elle est censée supprimer,
-- avec en prime la certitude trompeuse de l'avoir corrigée.
--
-- On vérifie donc l'état ATTEINT, et non le nombre de lignes écrites.
-- La comparaison porte sur la valeur EXACTE attendue, et non sur un préfixe :
-- les cinq identifiants partagent bien `price_1UBR`, mais c'est un hasard de
-- génération chez Stripe, pas une règle. Un contrôle qui s'appuierait dessus
-- laisserait passer n'importe quel autre tarif du même compte.
do $$
declare
  attendus constant text[][] := array[
    ['starter',    'price_1UBRqVH91veQUR7IBK6UxbMg'],
    ['pro',        'price_1UBRtWH91veQUR7I1z0PKWh9'],
    ['business',   'price_1UBRuQH91veQUR7I1IillW86'],
    ['enterprise', 'price_1UBRvWH91veQUR7ICSqxkMYr']
  ];
  i integer;
  effectif text;
begin
  for i in 1 .. array_length(attendus, 1) loop
    select stripe_price_id_monthly into effectif
      from public.plans where code = attendus[i][1];

    if effectif is distinct from attendus[i][2] then
      raise exception 'Formule « % » : tarif attendu %, trouvé %',
        attendus[i][1], attendus[i][2], coalesce(effectif, 'NULL');
    end if;
  end loop;

  select extra_seat_price_id_monthly into effectif
    from public.billing_settings where id;

  if effectif is distinct from 'price_1UBRxeH91veQUR7I20I3sjnU' then
    raise exception 'Siège supplémentaire : tarif attendu price_1UBRxeH91veQUR7I20I3sjnU, trouvé %',
      coalesce(effectif, 'NULL');
  end if;
end $$;
