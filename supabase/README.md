# Base de données Supabase

## Appliquer les migrations (sans CLI ni Docker)

Ni la CLI Supabase ni Docker ne sont installés sur cette machine. Les migrations
sont donc des fichiers SQL bruts, à appliquer via le SQL Editor du dashboard.
Ils restent parfaitement compatibles avec `supabase db push` le jour où la CLI
sera installée.

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Ouvrir **SQL Editor** dans le dashboard.
3. Exécuter les fichiers de `migrations/` **dans l'ordre des horodatages**.
   L'ordre n'est pas indicatif : chaque migration s'appuie sur les types et les
   fonctions de la précédente.

   | # | Fichier | Contenu |
   |---|---|---|
   | 1 | `20260807090000_profiles.sql` | `profiles`, trigger de création automatique, `set_updated_at` |
   | 2 | `20260807090100_catalog.sql` | `categories`, `tools` (version initiale) |
   | 3 | `20260807090200_user_data.sql` | `favorites`, `tool_history` |
   | 4 | `20260807090300_seed_categories.sql` | Les 4 catégories d'origine |
   | 5 | `20260808100000_catalog_v2.sql` | **8 catégories**, `status`, `visibility`, seed des 6 outils |
   | 6 | `20260808100100_rbac.sql` | Schéma `app`, enums de rôles, matrice `role_permissions` |
   | 7 | `20260808100200_organizations.sql` | `organizations`, `organization_members`, invitations, **fonctions d'autorisation** |
   | 8 | `20260808100300_billing.sql` | `plans`, `plan_features`, `subscriptions`, entitlements |
   | 9 | `20260808100400_teams.sql` | `teams`, `team_members` |
   | 10 | `20260808100500_missions.sql` | `missions`, affectations, **machine à états** |
   | 11 | `20260808100600_interventions.sql` | `interventions`, comptes rendus, **séparation des pouvoirs** |
   | 12 | `20260808100700_audit_logs.sql` | Journal d'audit immuable |
   | 13 | `20260808100800_storage.sql` | Bucket privé des pièces jointes |
   | 14 | `20260808100900_grants.sql` | **Privilèges explicites** + contrôle RLS global |

4. Récupérer **Project URL** et **Publishable key** dans
   *Project Settings → API*, puis les reporter dans `.env.local`.

> ⚠️ Ne jamais copier la clé `service_role` dans le projet frontend : elle
> contourne entièrement la RLS.

## Vérifier l'installation

La migration `20260808100900_grants.sql` se termine par un contrôle qui **échoue
bruyamment** si une table de `public` a été créée sans RLS. Si elle passe, la
protection est en place sur l'ensemble du schéma.

Pour un contrôle manuel :

```sql
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
```

## Tester l'isolation multi-tenant

`tests/01_multitenant_scenario.sql` rejoue le scénario complet — équipe,
techniciens, mission fibre, acceptation, intervention, compte rendu, validation
— puis vérifie qu'une seconde entreprise n'accède à rien.

Coller le fichier **entier** dans le SQL Editor et exécuter. Il se termine par
`rollback` : aucune donnée n'est laissée derrière lui. Le succès s'affiche dans
l'onglet des messages :

```
TOUS LES TESTS PASSENT
```

Un échec interrompt le script sur une exception nommant l'assertion fautive.

## Modèle de données

```
auth.users ──1:1── profiles
     │
     ├─1:N─ favorites  ─┐
     ├─1:N─ tool_history┤  isolées par utilisateur
     │                  │
     └─1:N─ organization_members ──┐
                                   │
categories ─1:N─ tools ────────────┘  lecture publique du contenu actif

organizations
├── organization_members ── (rôle : owner | admin | manager | team_leader | technician | employee)
├── organization_invitations
├── subscriptions ── plans ── plan_features
├── teams ── team_members
├── missions ──┬── mission_assignments      (historique des affectations)
│              ├── mission_status_events    (journal des changements d'état)
│              └── interventions ──┬── intervention_reports
│                                  └── intervention_attachments
└── audit_logs
```

### Modèle hybride code + base

`categories` et `tools` portent les **métadonnées** et la curation.
L'**implémentation** de chaque outil vit dans `src/tools/<slug>/`.
La jointure se fait par `slug`.

Les catégories ont une **source unique** : `src/config/categories.ts`. Le seed
SQL en est la contrepartie, et `src/config/categories.test.ts` compare les deux.
Modifier l'un sans l'autre casse `npm test`.

## Architecture de sécurité

### Le schéma `app` et la récursion des policies

La policy naturelle sur `organization_members` — « je vois les membres des
organisations dont je suis membre » — interroge `organization_members`, ce qui
réévalue la même policy. PostgreSQL détecte la boucle et rejette **toute**
requête avec l'erreur `42P17`.

La parade est un jeu de fonctions `security definer` dans le schéma privé `app`,
qui s'exécutent avec les droits de leur propriétaire et contournent donc la RLS
de façon contrôlée :

| Fonction | Rôle |
|---|---|
| `app.current_org_role(org)` | Rôle de l'appelant, ou `null` |
| `app.is_org_member(org)` | Appartenance |
| `app.has_org_permission(org, perm)` | Appartenance **et** permission |
| `app.my_organization_ids()` | Organisations de l'appelant |
| `app.my_team_ids()` / `app.my_led_team_ids()` | Équipes, équipes pilotées |
| `app.org_has_feature(org, key)` | Entitlement d'abonnement |
| `app.can_use_pro_module(org, key)` | Appartenance **et** entitlement |
| `app.is_mission_assignee(mission)` | Intervenant affecté |

Le contournement est sûr parce que ces fonctions ne renvoient **jamais de
données** : seulement un booléen, un rôle ou une liste d'identifiants déduits de
`auth.uid()`, qu'aucun client ne peut falsifier.

`app` n'est pas exposé par PostgREST : aucune de ces fonctions n'est appelable
depuis le navigateur.

### Les trois barrières

Une donnée d'entreprise est protégée par trois mécanismes distincts. Il faut se
tromper aux trois endroits pour ouvrir une brèche.

| Barrière | Mécanisme | Ce qu'elle attrape |
|---|---|---|
| **Privilèges** | `grant` explicites (`20260808100900_grants.sql`) | Un verbe SQL jamais utilisé par aucune policy |
| **Policies RLS** | `using` / `with check` par table | L'accès aux lignes d'un autre tenant |
| **Triggers** | Contrôles impossibles à exprimer en policy | Transitions d'état illégales, élévation de privilège, auto-validation |

Ce que seul un trigger peut faire : comparer l'ancienne et la nouvelle ligne. Un
`with check` ne voit pas `OLD` — il ne saurait pas distinguer une soumission de
compte rendu d'une validation.

### Séparation des pouvoirs

> Un intervenant ne valide jamais son propre compte rendu.

Retirer `intervention.review` au rôle `technician` ne suffit pas : un chef
d'équipe ou un manager **peut** valider, et rien ne l'empêcherait de valider son
propre rapport s'il est descendu sur le terrain. Le contrôle porte donc sur
l'**identité** (`auth.users.id`) et non sur le rôle, dans
`app.enforce_report_review_separation()`.

### Tables fermées en écriture

| Table | Pourquoi |
|---|---|
| `subscriptions` | Un INSERT client permettrait de s'attribuer le plan `business` et de déverrouiller tout le module professionnel. Alimentée par le webhook de paiement (`service_role`). |
| `audit_logs` | Un journal modifiable ne vaut rien en litige. Un trigger rejette `update` et `delete`, même pour un rôle privilégié. |
| `mission_status_events` | Écrit par le trigger de transition. Un INSERT client permettrait de forger un historique. |
| `plans`, `plan_features`, `role_permissions`, `mission_status_transitions` | Tables de référence, administrées par migration. |

## Ajouter un outil au catalogue

```sql
insert into public.tools (slug, category_id, name, description, keywords, icon, sort_order, status, visibility)
select
  'chute-de-tension',
  c.id,
  'Chute de tension',
  'Calcule la chute de tension en ligne selon NF C 15-100.',
  array['électricité', 'chute', 'tension'],
  'zap',
  30,
  'active',
  'public'
from public.categories c
where c.slug = 'electrical';
```

Le `slug` doit être **identique** à celui déclaré par `defineTool()` dans
`src/tools/chute-de-tension/index.ts`.

`visibility` vaut `public` (visible sans compte), `authenticated` (compte requis)
ou `pro` (abonnement débloquant `pro_tools`).

## Créer un abonnement

Aucune policy ne permet au client d'écrire dans `subscriptions`. En attendant le
webhook de paiement, la création se fait depuis le SQL Editor :

```sql
insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
select id, 'business', 'active', now() + interval '1 year'
from public.organizations where slug = 'mon-entreprise';
```

Le trigger `sync_organization_plan` met à jour `organizations.plan_code` dans la
foulée.

## Régénérer les types TypeScript

`src/types/database.ts` est écrit à la main, en correspondance exacte avec ces
migrations. Dès que le projet Supabase existe, préférer la génération :

```bash
npx supabase gen types typescript --project-id <votre-ref> > src/types/database.ts
```

⚠️ La génération ne produit **que** le schéma `public`. Les fonctions du schéma
`app` sont volontairement absentes du fichier : elles ne doivent jamais être
appelables depuis le navigateur.

## Migrations volontairement reportées

| Table | Raison du report |
|---|---|
| `tool_configurations` | Sa forme dépend de la structure des paramètres des outils, qui n'existe pas encore. |
| `references` | Aucun contenu de référence n'est encore défini. |
| `materials` / `vehicles` / `customers` | Le §14 les prévoit. `intervention_reports.materials_used` est un `jsonb` en attendant : il accueille la saisie libre d'aujourd'hui et se migrera vers des tables quand la forme sera connue. |
| `establishments` | Table fille de `organizations` le jour où le multi-établissement sera demandé. Aucun changement de schéma requis pour l'accueillir. |
