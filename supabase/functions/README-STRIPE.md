# Brancher Stripe — ce qu'il reste à faire

Le backend est prêt et éprouvé. Il manque un compte Stripe et dix identifiants
de tarif. Ce document décrit exactement ces étapes, dans l'ordre.

> **Statut actuel : NOT READY.** Rien n'est déployé, aucune clé n'existe.
> Les colonnes `plans.stripe_price_id_*` et `billing_settings.extra_seat_price_id_*`
> sont vides — `create-checkout-session` répond `503` avec le nom de ce qui manque,
> plutôt que d'échouer au moment du paiement.

---

## 1. Le compte, en mode test

Créer un compte sur `dashboard.stripe.com` et **rester en mode test** : la bascule
est en haut à droite. Toutes les clés de test commencent par `sk_test_` et
`whsec_`. Une clé de production dans ce projet prélèverait de vraies cartes.

## 2. Les produits et leurs tarifs

Cinq produits, dix tarifs récurrents. Le tarif annuel est le **total sur douze
mois**, pas l'équivalent mensuel — Stripe facture ce montant une fois par an.

| Produit | Mensuel | Annuel |
|---|---:|---:|
| Starter | 19,00 € | 180,00 € |
| Pro | 39,00 € | 372,00 € |
| Business | 69,00 € | 660,00 € |
| Enterprise | 99,00 € | 948,00 € |
| **Siège supplémentaire** | 5,00 € | 60,00 € |

Le siège supplémentaire est **un seul produit**, dont seule la quantité varie.
Ne pas créer un tarif par effectif : ce serait un objet Stripe par nombre
d'utilisateurs possible, pour exprimer une multiplication.

Free n'a **aucun** produit. Une souscription à 0 € coûterait un objet à
renouveler, synchroniser et annuler, pour zéro euro encaissé.

## 3. Enregistrer les identifiants en base

Les `price_...` vivent en base et non dans le code : le webhook doit faire le
chemin inverse — d'un Price ID reçu, retrouver le plan — pour absorber un
changement de formule effectué depuis le tableau de bord Stripe.

```sql
update public.plans set
  stripe_price_id_monthly = 'price_...',
  stripe_price_id_annual  = 'price_...'
where code = 'starter';   -- puis pro, business, enterprise

update public.billing_settings set
  extra_seat_price_id_monthly = 'price_...',
  extra_seat_price_id_annual  = 'price_...';
```

## 4. Les secrets Supabase

**Jamais dans le dépôt.** `.gitignore` couvre déjà `.env*`, et rien de ce qui suit
ne doit apparaître dans un fichier versionné.

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### Mesure publicitaire — facultatif

Le webhook déclare à Meta les deux conversions que le navigateur ne peut pas
voir : le début d'essai et l'abonnement. Ces deux secrets sont **facultatifs** —
absents, rien n'est envoyé et le webhook fonctionne exactement comme avant.

```bash
npx supabase secrets set META_PIXEL_ID=...            # le même que VITE_META_PIXEL_ID
npx supabase secrets set META_CAPI_ACCESS_TOKEN=...   # Gestionnaire d'événements > Paramètres
```

`META_PIXEL_ID` doit être **identique** à `VITE_META_PIXEL_ID` côté frontend :
c'est ce qui permet à Meta de rapprocher les événements du navigateur et ceux du
serveur pour le même visiteur.

Pour vérifier l'intégration sans polluer les statistiques réelles, ajoutez
temporairement le code fourni par l'onglet « Événements de test » du
gestionnaire Meta — les envois y apparaissent en direct :

```bash
npx supabase secrets set META_CAPI_TEST_EVENT_CODE=TEST12345
npx supabase secrets unset META_CAPI_TEST_EVENT_CODE   # à retirer ensuite
```

Le jeton d'accès est une clé serveur : il ne doit jamais recevoir de préfixe
`VITE_`, sans quoi Vite l'exposerait dans le bundle du navigateur.

## 5. Déployer et déclarer le webhook

```bash
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-billing-portal-session
npx supabase functions deploy sync-subscription-seats
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` sur le seul webhook : Stripe n'envoie pas de jeton Supabase.
Son authentification est la **signature HMAC**, vérifiée dans la fonction avec
une tolérance de cinq minutes contre le rejeu. C'est pourquoi cette vérification
n'est pas négociable : sans elle, l'URL suffirait à passer n'importe quelle
organisation en Enterprise.

Déclarer ensuite l'endpoint dans Stripe → Developers → Webhooks, sur
`https://<projet>.supabase.co/functions/v1/stripe-webhook`, avec ces événements :

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed
```

Le secret affiché à la création de l'endpoint est le `whsec_...` de l'étape 4.

## 6. Vérifier

```bash
stripe listen --forward-to https://<projet>.supabase.co/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

Puis, dans la base :

```sql
select id, type, received_at from public.stripe_events order by received_at desc limit 5;
select plan_code, status, provider, provider_subscription_id from public.subscriptions;
```

**Le test qui compte** : rejouer le même événement depuis le tableau de bord
Stripe (bouton « Resend »). La seconde réception doit répondre
`{"received":true,"duplicate":true}` et ne rien modifier. C'est ce qui empêche
un `customer.subscription.deleted` rejoué d'annuler un abonnement souscrit
depuis.

---

## Ce que le backend garantit déjà, sans Stripe

- La grille est appliquée par PostgreSQL : `app.org_monthly_amount_cents` est
  la seule source du montant, et les quinze combinaisons de la grille sont
  vérifiées par `supabase/tests/04_billing_scenario.sql`.
- Free est plafonné à un utilisateur, invitations comprises.
- Les plans payants n'ont aucun plafond : le dépassement est facturé.
- `subscriptions` n'a aucune policy d'écriture — un client ne peut pas
  s'attribuer une formule, même en forgeant la requête.
- Le retour à Free est refusé tant que l'effectif dépasse un utilisateur, et le
  message indique combien de membres retirer.

## Le trou connu

`sync-subscription-seats` est appelée après un changement d'effectif. Si cet
appel échoue — réseau, onglet fermé — Stripe reste en retard jusqu'au prochain
changement. La fonction étant idempotente, tout se recale ensuite.

Le combler proprement demande une tâche périodique de réconciliation, donc un
planificateur, qui n'existe pas encore dans ce projet. À traiter le jour où un
client réel paie au siège.
