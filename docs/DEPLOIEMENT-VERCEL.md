# Déploiement sur Vercel

NexoraTech est une application monopage : Vite produit des fichiers statiques,
et toute la logique serveur vit dans Supabase — policies RLS, triggers, et une
Edge Function pour l'envoi des invitations. Vercel n'a donc rien à exécuter : il
compile, sert des fichiers et redirige les routes. **Aucun secret ne lui est
confié**, uniquement les trois variables publiques du frontend.

---

## 1. Ce que le dépôt contient déjà

| Fichier | Rôle |
|---|---|
| [`vercel.json`](../vercel.json) | Framework, commandes, réécritures SPA, en-têtes de sécurité et de cache |
| [`.vercelignore`](../.vercelignore) | Écarte du transfert ce qui ne sert pas au build |
| `package.json` → `engines.node` | `>=20.19.0` — Vercel s'y conforme automatiquement |

Rien d'autre n'est à créer. Les réglages ci-dessous se font dans l'interface
Vercel et dans le tableau de bord Supabase.

---

## 2. Variables d'environnement

Trois variables, à déclarer dans **Vercel → Settings → Environment Variables**.
Le build échoue immédiatement si l'une manque : `src/config/env.ts` les valide
au démarrage et nomme précisément ce qui fait défaut. C'est voulu — une variable
oubliée doit se voir au déploiement, pas se manifester en `undefined` opaque
trois écrans plus loin.

| Variable | Valeur | Environnements |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://wtsiaisfwtthmcxygeei.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publiable — Dashboard Supabase → Project Settings → API | Production, Preview, Development |
| `VITE_APP_ENV` | `production` en Production, `staging` en Preview | selon l'environnement |

> **La clé publiable est faite pour le navigateur.** Elle finit dans le bundle,
> par construction : toute la protection repose sur les politiques RLS. Ce n'est
> pas un secret, et la marquer comme tel dans Vercel n'ajouterait rien.
>
> **`SUPABASE_SERVICE_ROLE_KEY` n'a rien à faire ici.** Elle contourne la RLS.
> Aucun code de ce dépôt ne la lit, et le préfixe `VITE_` étant la seule porte
> d'entrée vers le bundle, elle n'y arriverait pas — mais elle n'aurait de toute
> façon aucune raison d'exister dans un projet sans backend propre.

---

## 3. Réglages Supabase à faire AVANT la première connexion en production

Sans ces deux réglages, l'inscription et la réinitialisation de mot de passe
échoueront en production alors qu'elles fonctionnent en local.

L'application construit ses liens de retour avec `window.location.origin`
(voir [`auth.api.ts`](../src/features/auth/api/auth.api.ts) et
[`invitation-url.ts`](../src/features/organizations/invitation-url.ts)) : un lien
émis depuis une preview renvoie vers cette preview, un lien émis depuis la
production renvoie vers la production. Encore faut-il que Supabase accepte ces
origines.

**Dashboard Supabase → Authentication → URL Configuration :**

1. **Site URL** → `https://<votre-domaine>.vercel.app` (ou le domaine
   personnalisé, une fois branché).
2. **Redirect URLs** → ajouter :
   ```
   https://<votre-domaine>.vercel.app/auth/callback
   https://<votre-domaine>.vercel.app/**
   https://<projet>-*.vercel.app/**      ← pour les déploiements de preview
   http://localhost:5173/**              ← pour le développement local
   ```

Le motif `*` sur les previews est nécessaire : Vercel génère un sous-domaine
différent à chaque commit, et une liste figée les refuserait tous.

**Authentication → Providers → Email :** activer *Leaked password protection*.
C'est le seul avertissement de sécurité encore ouvert côté Supabase ; il ne se
règle pas en SQL, uniquement ici.

---

## 3 bis. Envoi des courriels d'invitation

L'invitation part par courriel via l'Edge Function
[`send-invitation`](../supabase/functions/send-invitation/index.ts), déjà
déployée. Elle n'utilise pas `service_role` : elle relit l'invitation avec le
jeton de l'appelant, et c'est la permission `member.invite` — par la policy
`organization_invitations_select` — qui autorise ou refuse.

### La contrainte à comprendre d'abord

Écrire à **n'importe quelle adresse** (gmail.com, outlook.fr, live.fr…) suppose
de prouver au réseau qu'on est légitime à envoyer. Aucun service ne laisse un
inconnu expédier vers le monde entier : ce serait un relais à spam. Il n'existe
donc que deux façons de s'authentifier, et le choix se fait par les secrets, pas
par le code.

| | **A — SMTP d'une boîte existante** | **B — Resend + domaine vérifié** |
|---|---|---|
| Domaine à posséder | non | oui |
| DNS à configurer | aucun | 3 enregistrements |
| Mise en place | ~5 minutes | ~30 min + propagation DNS |
| Destinataires | **tous** | **tous** |
| Volume | ~500/jour (Gmail) | 3 000/mois gratuits |
| Expéditeur affiché | votre adresse personnelle | `invitations@votre-domaine.fr` |

**Commencez par A, passez à B le jour où vous aurez un domaine.** Le code ne
change pas : seuls les secrets changent.

> ⚠️ **Le mode bac à sable de Resend n'est pas une option de configuration.**
> Avec `onboarding@resend.dev`, Resend refuse tout destinataire autre que
> l'adresse du titulaire du compte. Ce n'est pas contournable — c'est ce qui
> empêche leur infrastructure de servir de relais anonyme.

### A. SMTP — envoi immédiat vers n'importe qui

Aucun domaine, aucun DNS. Vous vous authentifiez sur une boîte que vous possédez
déjà, et c'est elle qui répond de vous auprès des destinataires.

**Avec Gmail** (le plus fiable, ~500 envois/jour) :

1. Activez la validation en deux étapes sur le compte Google.
2. Créez un **mot de passe d'application** :
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   → 16 caractères, à recopier sans les espaces. Votre vrai mot de passe ne
   fonctionnera pas, et c'est voulu : celui-ci se révoque seul, sans toucher au
   compte.
3. Déposez les secrets :

```bash
npx supabase secrets set SMTP_HOST=smtp.gmail.com
npx supabase secrets set SMTP_PORT=465
npx supabase secrets set SMTP_USER=votre.adresse@gmail.com
npx supabase secrets set SMTP_PASSWORD=abcdefghijklmnop
npx supabase secrets set INVITATION_FROM_EMAIL="NexoraTech <votre.adresse@gmail.com>"
npx supabase secrets set APP_URL=https://votre-domaine.vercel.app
```

`INVITATION_FROM_EMAIL` **doit** reprendre l'adresse de `SMTP_USER` : Gmail
refuse d'expédier au nom d'une autre, et les serveurs qui l'acceptent voient
leurs messages rejetés par SPF à l'arrivée.

Autres fournisseurs — même principe, seul l'hôte change :

| Fournisseur | `SMTP_HOST` | `SMTP_PORT` |
|---|---|---|
| Gmail / Google Workspace | `smtp.gmail.com` | `465` |
| Outlook / Hotmail / Live | `smtp-mail.outlook.com` | `587` |
| OVH | `ssl0.ovh.net` | `465` |
| Free | `smtp.free.fr` | `465` |

Le port détermine le mode de chiffrement : **465** ouvre en TLS d'emblée,
**587** commence en clair puis bascule par STARTTLS. Se tromper produit une
négociation qui échoue sans message clair.

> Pour Outlook/Hotmail personnel, Microsoft restreint progressivement
> l'authentification SMTP par mot de passe. Si la connexion est refusée malgré un
> mot de passe d'application valide, préférez Gmail ou passez à l'option B.

### B. Resend — pour un expéditeur à votre nom d'entreprise

À faire quand vous aurez un domaine (`nexoratech.fr`, `hbzindustrie.fr`…).

1. Compte sur [resend.com](https://resend.com), puis *Domains → Add Domain*.
2. Ajoutez les trois enregistrements DNS proposés (SPF, DKIM, DMARC) chez votre
   registrar. Comptez quelques minutes à quelques heures de propagation.
3. Une fois le domaine vérifié :

```bash
npx supabase secrets unset SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD
npx supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
npx supabase secrets set INVITATION_FROM_EMAIL="NexoraTech <invitations@votre-domaine.fr>"
```

La fonction bascule d'elle-même : `SMTP_HOST` défini l'emporte, sinon
`RESEND_API_KEY`. Aucun redéploiement.

### `APP_URL` : pourquoi ce n'est pas le navigateur qui le fournit

Cette variable construit le lien contenu dans le courriel. Elle est
**délibérément** un secret de déploiement : accepter une origine envoyée par le
client permettrait de faire partir, depuis votre adresse et avec votre
réputation d'expéditeur, un courriel pointant vers un site d'hameçonnage.

En développement local, pointez-la sur `http://localhost:5173`.

### Si l'envoi échoue

L'application reste utilisable : l'invitation est créée **quoi qu'il arrive**,
et l'écran bascule sur « Courriel non parti — l'invitation reste valide » avec le
lien à copier. Une invitation n'est jamais perdue à cause d'un serveur de
messagerie.

Le motif exact du refus est dans les journaux, jamais dans la réponse HTTP — il
contient l'adresse du serveur et l'identifiant du compte :

```bash
npx supabase functions logs send-invitation
```

Redéploiement après modification du code :

```bash
npx supabase functions deploy send-invitation
```

---

## 4. Première mise en ligne

Le plus simple, et le mode recommandé : **connecter le dépôt GitHub** dans
l'interface Vercel. Vercel détecte Vite, lit `vercel.json`, et redéploie à chaque
poussée — les branches produisent des previews, `main` produit la production.

En ligne de commande :

```bash
npx vercel login
npx vercel link     # crée .vercel/, déjà ignoré par Git
npx vercel --prod
```

---

## 5. Ce que fait `vercel.json`

**Réécritures.** L'application gère elle-même ses routes : `/missions/xxx` ou
`/invitations/<jeton>` n'existent pas comme fichiers. Sans réécriture, un
rechargement de page ou un lien d'invitation ouvert directement renverrait 404.
La règle renvoie vers `index.html` tout ce qui n'est ni un fichier d'`assets/`
ni un chemin portant une extension — de sorte que les vrais fichiers continuent
d'être servis tels quels.

**Cache.** Vite empreinte les noms de fichiers d'`assets/` d'un hachage de leur
contenu : un fichier donné ne change jamais. Un an d'`immutable` est donc sûr, et
c'est ce qui rend les visites suivantes instantanées. `index.html`, lui, n'est
pas mis en cache — c'est lui qui désigne la nouvelle version après déploiement.

**En-têtes de sécurité.** `nosniff`, `X-Frame-Options: DENY` (l'application n'est
jamais embarquée), `Referrer-Policy` restrictive et HSTS. La
`Permissions-Policy` autorise `camera` et `geolocation` pour la même origine —
tous deux sont utilisés sur le terrain, pour les photos d'intervention et le
relevé de position au démarrage — et refuse le microphone, dont l'application
n'a aucun usage.

**Pas de Content-Security-Policy.** Volontairement : l'application charge des
images depuis `images.unsplash.com`, ouvre des connexions vers
`*.supabase.co` et injecte des styles Tailwind. Une CSP écrite sans être vérifiée
écran par écran casse silencieusement une partie de l'interface. À ajouter dans
un second temps, en mode `Content-Security-Policy-Report-Only` d'abord.

---

## 6. Vérifications après déploiement

1. `https://<domaine>/` affiche la page d'accueil publique.
2. `https://<domaine>/tools` s'ouvre **directement** (test des réécritures — un
   404 ici signale un problème de configuration, pas de code).
3. Inscription avec une adresse réelle → le courriel de confirmation renvoie
   vers `/auth/callback` du bon domaine.
4. Création de l'organisation via `/organisation/nouvelle` → vérifier en base
   que l'abonnement d'essai a bien été créé :
   ```sql
   select o.name, s.plan_code, s.status, s.trial_ends_at
   from public.organizations o
   join public.subscriptions s on s.organization_id = o.id;
   ```
5. Onglet Réseau : aucune requête vers un domaine autre que
   `<projet>.supabase.co` et le domaine Vercel.
6. `localStorage` : ne doivent subsister que `nexoratech_theme`,
   `nexoratech_current_organization`, `nexoratech_calculation_history_v1` et le
   drapeau `nexoratech_demo_storage_purged_v1`. Toute clé `nexoratech_local_*`
   signalerait un reliquat non purgé.

---

## 7. Base de données : les migrations ne partent pas avec le déploiement

Vercel ne touche pas à Supabase. Les migrations s'appliquent séparément, depuis
un poste ayant accès au projet :

```bash
npx supabase db push --linked
```

L'ordre compte : **appliquer les migrations AVANT de déployer un frontend qui en
dépend**. L'inverse produit une application qui interroge des tables absentes.
