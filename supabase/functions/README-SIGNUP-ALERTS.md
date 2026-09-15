# Alerte administrateur à chaque inscription — ce qu'il reste à faire

Le code est prêt et testé (26 tests Deno + une suite SQL). Il manque des
comptes tiers et quelques secrets. Ce document décrit exactement ces étapes.

> **Statut actuel : DORMANT.** La migration pose le trigger, la file
> d'attente et le tirage atomique — les inscriptions réelles s'y accumulent
> dès l'application de la migration, quoi qu'il arrive ensuite. Mais sans les
> secrets ci-dessous, le worker les tire, échoue proprement sur les deux
> canaux, et les retente indéfiniment (jusqu'à une heure d'intervalle) sans
> jamais rien envoyer ni perdre une seule inscription.

---

## Ce que ça fait

À chaque inscription **réelle** (email/mot de passe ou Google) — jamais une
reconnexion, un rafraîchissement de jeton, une modification de profil ou
d'abonnement — l'administrateur reçoit un e-mail et une notification push,
chacun **exactement une fois**.

Un collaborateur ajouté par un client existant (invitation ou création
directe par le dirigeant) n'en fait pas partie : ce n'est pas une nouvelle
inscription REZO360, c'est la croissance d'un client déjà là.

## Architecture

```
auth.users (INSERT)
  → trigger app.enqueue_admin_signup_alert()          [migration]
  → public.admin_signup_alerts                         (file d'attente)
  → pg_cron, toutes les minutes
  → app.trigger_admin_signup_alert_worker()             [migration, via Vault]
  → net.http_post
  → notify-admin-signup-worker                          [Edge Function]
      → claim_admin_signup_alerts()  (SKIP LOCKED)
      → e-mail (transport déjà en place : SMTP ou Resend)
      → push (OneSignal)
      → admin_signup_alerts mis à jour, canal par canal
```

Le trigger n'envoie jamais rien lui-même : il enfile une ligne, exactement le
patron déjà en place pour `subscription_seat_sync_jobs` et l'ordonnanceur de
transmission Factur-X. Une panne d'e-mail ou de push se rattrape seule, sans
jamais bloquer ni ralentir une inscription.

## 1. Le destinataire e-mail

```
supabase secrets set ADMIN_SIGNUP_EMAIL=vous@exemple.fr
```

Réutilise le transport déjà configuré (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`
ou `RESEND_API_KEY`, et `INVITATION_FROM_EMAIL` comme expéditeur) : rien à
ajouter s'il fonctionne déjà pour les invitations.

## 2. Le push — compte OneSignal

Choisi pour ce cas d'usage (un seul destinataire, une app Capacitor Android) :
la clé REST OneSignal s'utilise en un seul appel HTTP, sans échange OAuth2 ni
compte de service à signer côté serveur — la seule autre option sérieuse ici,
Firebase Cloud Messaging en direct, demande cette signature pour un gain nul
tant qu'il n'y a qu'un destinataire.

1. Créer un compte sur `onesignal.com`, puis une application.
2. Plateforme **Android** : suivre l'assistant (Firebase/FCM géré par
   OneSignal pour un démarrage simple — un projet Firebase dédié peut être
   branché plus tard sans rien changer ici).
3. Relever dans *Settings → Keys & IDs* :
   - **OneSignal App ID** → `VITE_ONESIGNAL_APP_ID` (fichier `.env` du build,
     **public** : c'est un identifiant de routage, pas un secret) et
     `ONESIGNAL_APP_ID` côté Supabase (même valeur, dupliquée parce que les
     fonctions Edge ne lisent pas les variables `VITE_`).
   - **REST API Key** → `ONESIGNAL_REST_API_KEY` (secret, **jamais** dans le
     frontend).

```
supabase secrets set ONESIGNAL_APP_ID=<uuid affiché par OneSignal>
supabase secrets set ONESIGNAL_REST_API_KEY=<clé REST>
```

## 3. Le destinataire push

Après avoir installé l'app (étape 5) et ouvert une session, l'identifiant
externe posé est votre `auth.users.id`. Le retrouver :

```sql
select id, email from auth.users where email = 'vous@exemple.fr';
```

```
supabase secrets set ONESIGNAL_ADMIN_EXTERNAL_ID=<cet id>
```

## 4. Le secret du worker et Vault

Un secret partagé entre la base (qui l'envoie en en-tête) et la fonction
(qui le vérifie) — même patron que `subscription-seat-sync-worker`.

```
supabase secrets set ADMIN_SIGNUP_ALERT_WORKER_SECRET=<chaîne aléatoire longue>
```

Puis, dans le SQL Editor du dashboard (**une fois**, jamais dans un fichier
versionné) :

```sql
select vault.create_secret(
  'https://<ref>.supabase.co/functions/v1/notify-admin-signup-worker',
  'admin_signup_alert_worker_url'
);
select vault.create_secret(
  '<LA MÊME VALEUR que ADMIN_SIGNUP_ALERT_WORKER_SECRET>',
  'admin_signup_alert_worker_secret'
);
```

## 5. L'app mobile

`onesignal-cordova-plugin` est déjà dans `package.json`. Reste, côté machine
qui build l'APK :

```
npx cap sync android
```

puis reconstruire et installer l'app sur le téléphone. `VITE_ONESIGNAL_APP_ID`
doit être renseignée **avant** ce build : Vite fige les variables à la
compilation.

## 6. L'adresse canonique (optionnelle, mais recommandée)

`APP_URL` (déjà utilisée par ailleurs) sert à construire le bouton « Voir dans
REZO360 » du courriel (`${APP_URL}/dashboard`) et le lien profond du push. Sans
elle, le courriel garde son lien de secours vers la fiche Auth de Supabase
Studio — aucune page d'administration n'existe aujourd'hui dans REZO360 pour
consulter un utilisateur ou une entreprise, c'est le pis-aller le plus honnête
en l'état.

## Déployer

```
npx supabase db push --linked
npx supabase functions deploy notify-admin-signup-worker --no-verify-jwt
```

`--no-verify-jwt` : cette fonction n'est jamais appelée par un navigateur,
seulement par `pg_cron` via `net.http_post` — l'authentification est le secret
partagé (`x-worker-secret`), pas un jeton Supabase.

---

## Tester une inscription

1. Vérifier que le worker répond (sans faire d'envoi, secret volontairement
   faux) :
   ```
   curl -i -X POST https://<ref>.supabase.co/functions/v1/notify-admin-signup-worker \
     -H "x-worker-secret: faux" -H "Content-Type: application/json" -d '{}'
   # → 401 attendu
   ```
2. Créer un compte réel (formulaire d'inscription, avec une adresse qui vous
   appartient — pas `@rezo360.test`, exclue par construction).
3. Dans la minute qui suit, `pg_cron` réveille le worker. Vérifier la file :
   ```sql
   select user_id, email, email_status, push_status, attempts, last_error
   from public.admin_signup_alerts
   order by signed_up_at desc
   limit 5;
   ```
   `email_status`/`push_status` doivent passer à `sent`. S'ils restent
   `pending` avec `attempts` qui grimpe, `last_error` nomme ce qui manque.
4. L'e-mail et la notification doivent arriver à la destination configurée.

## Vérifier les journaux

```sql
-- Le worker tourne-t-il ? Une ligne par minute, y compris sans rien à faire.
select * from public.admin_signup_alert_worker_runs order by ran_at desc limit 10;

-- Une inscription précise
select * from public.admin_signup_alerts where email = 'quelqu''un@exemple.fr';
```

Journaux applicatifs de la fonction : dashboard Supabase → *Edge Functions →
notify-admin-signup-worker → Logs*, ou :

```
npx supabase functions logs notify-admin-signup-worker
```

Aucun secret n'y apparaît jamais — `last_error` et les journaux ne portent que
des messages d'erreur fournisseur (« Resend 500 », « OneSignal 401 »).

## Résultat des tests (locaux, avant déploiement)

- `deno test supabase/functions/_shared/admin-signup-alerts.test.ts` — **16/16**
  (contenu du courriel, charge OneSignal, calcul de reprise, idempotence par
  canal — sans réseau ni environnement).
- `deno test supabase/functions/notify-admin-signup-worker/handler.test.ts` —
  **10/10** (secret, panne d'un fournisseur sans effet sur l'autre, reprise
  sans double envoi, deux inscriptions indépendantes, réponse HTTP sans donnée
  sensible).
- `supabase/tests/09_admin_signup_alerts.sql` (`npm run test:sql`) — trigger,
  exclusions, tirage atomique ; **à exécuter après `db push`**, contre la base
  liée (transaction annulée en fin de suite, aucune trace laissée).
- `npx vitest run src/config/env.test.ts` — **8/8** (nouvelle variable
  `VITE_ONESIGNAL_APP_ID`).
