# Base de données Supabase

## Appliquer les migrations (sans CLI ni Docker)

Ni la CLI Supabase ni Docker ne sont installés sur cette machine. Les migrations
sont donc des fichiers SQL bruts, à appliquer via le SQL Editor du dashboard.
Ils restent parfaitement compatibles avec `supabase db push` le jour où la CLI
sera installée.

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Ouvrir **SQL Editor** dans le dashboard.
3. Exécuter les fichiers de `migrations/` **dans l'ordre des horodatages** :

   | Ordre | Fichier | Contenu |
   |---|---|---|
   | 1 | `20260807090000_profiles.sql` | `profiles`, trigger de création automatique, `set_updated_at` |
   | 2 | `20260807090100_catalog.sql` | `categories`, `tools`, RLS de lecture publique |
   | 3 | `20260807090200_user_data.sql` | `favorites`, `tool_history`, RLS par utilisateur |
   | 4 | `20260807090300_seed_categories.sql` | Les 4 catégories |

4. Récupérer **Project URL** et **Publishable key** dans
   *Project Settings → API*, puis les reporter dans `.env.local`.

> ⚠️ Ne jamais copier la clé `service_role` dans le projet frontend : elle
> contourne entièrement la RLS.

## Vérifier la RLS après application

Dans le SQL Editor, cette requête doit renvoyer `true` pour les cinq tables :

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles', 'categories', 'tools', 'favorites', 'tool_history');
```

Le dashboard signale par ailleurs toute table publique sans RLS dans
*Advisors → Security*.

## Modèle de données

Cinq tables, correspondant strictement aux besoins actuels.

```
auth.users (géré par Supabase)
   │
   ├─1:1─ profiles          lisible/modifiable par son propriétaire uniquement
   │
   ├─1:N─ favorites  ──┐
   └─1:N─ tool_history ─┤    isolées par utilisateur
                        │
categories ─1:N─ tools ─┘    lecture publique du contenu publié
```

### Modèle hybride code + base

`categories` et `tools` portent les **métadonnées** et la curation.
L'**implémentation** de chaque outil vit dans `src/tools/<slug>/`.
La jointure se fait par `slug`.

`reconcileRegistryWithCatalog()` (dans
`src/features/tools/registry/reconcile.ts`) signale les divergences : outil
publié sans implémentation, ou implémenté sans ligne en base.

### Ajouter un outil au catalogue

```sql
insert into public.tools (slug, category_id, name, description, keywords, sort_order, is_published)
select
  'ohms-law',
  c.id,
  'Loi d''Ohm',
  'Calcule tension, courant et résistance.',
  array['ohm', 'tension', 'courant'],
  10,
  true
from public.categories c
where c.slug = 'electrical';
```

Le `slug` doit être **identique** à celui déclaré par `defineTool()` dans
`src/tools/ohms-law/index.ts`.

## Principes de sécurité appliqués

- **RLS activée sur les cinq tables**, sans exception.
- **Aucune politique d'écriture sur `categories` et `tools`** : le catalogue
  s'administre via le dashboard (rôle `service_role`). Le frontend ne peut que
  lire, et uniquement les lignes publiées.
- **`with check` sur toutes les insertions** de données utilisateur : sans lui,
  un client pourrait écrire une ligne au nom d'un autre utilisateur.
- **Pas de politique `update` sur `favorites` et `tool_history`** : ces données
  se créent et se suppriment, elles ne se modifient pas. Toute permission non
  nécessaire est une surface d'attaque.
- **`(select auth.uid())`** plutôt que `auth.uid()` : Postgres évalue la
  fonction une fois par requête au lieu d'une fois par ligne.
- **`set search_path = ''`** sur les fonctions `security definer` : empêche le
  détournement des appels non qualifiés dans une fonction privilégiée.

## Régénérer les types TypeScript

`src/types/database.ts` est écrit à la main, en correspondance exacte avec ces
migrations. Dès que le projet Supabase existe, préférer la génération :

```bash
npx supabase gen types typescript --project-id <votre-ref> > src/types/database.ts
```

## Migrations volontairement reportées

Deux entités du cahier des charges initial ne sont **pas** créées, afin de ne
pas figer un schéma avant d'en connaître l'usage réel :

| Table | Raison du report |
|---|---|
| `tool_configurations` | Sa forme dépend entièrement de la structure des paramètres des outils, qui n'existent pas encore. La créer maintenant garantirait de la refaire. |
| `references` | Aucun contenu de référence n'est encore défini. Le format (texte, tableau, abaque, fichier) déterminera le schéma. |

À créer lorsque le besoin sera concret, respectivement en Phase 3 et Phase 5.
