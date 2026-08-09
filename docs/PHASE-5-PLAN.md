# Phase 5 — Module Équipes

> Plan détaillé, à valider avant implémentation.
> Écrit le 9 août 2026, à l'issue de la Phase 4 (`0a3a120`).

---

## Ce que l'audit a réellement trouvé

**Le socle est là et ne doit pas être reconstruit.** Table `teams`, table `team_members`,
huit policies RLS, deux triggers anti-cross-tenant, `app.my_team_ids()`,
`app.my_led_team_ids()`, cinq permissions `team.*`, et **les neuf fonctions
d'API sont déjà écrites** dans `features/teams/api/teams.api.ts`.

Ce qui manque est exclusivement côté interface : hooks, schémas, composants,
pages, routes, navigation. Aucune fonction d'accès aux données n'est à créer.

**Mais deux défauts de sécurité ont été mis au jour, et l'un est démontré.**

---

## Défaut 1 — Une équipe peut changer d'entreprise (bloquant)

Mesuré sur la base, avec un utilisateur `manager` chez A et simple `employee` chez B :

```
a team.update chez A          : true
a team.update chez B          : false
A PU DÉPLACER L'ÉQUIPE VERS B : true      ← rupture d'isolation
l'équipe finit chez           : B
```

`teams_update_permitted` exige la permission dans son `USING`, évalué sur
l'ancienne ligne, mais son `WITH CHECK` — appliqué à la nouvelle — ne vérifie
que `can_use_pro_module`, c'est-à-dire l'appartenance. Une simple appartenance à
B suffit donc à y faire entrer une équipe de A, avec ses membres, qui pointent
pourtant vers les `organization_members` de A.

### Pourquoi renforcer le `WITH CHECK` ne suffit pas

La tentation serait d'y recopier la condition du `USING`. Elle contient
`id in (select app.my_led_team_ids())`, et cette fonction renvoie les équipes
dont on est `lead` **quelle que soit leur organisation** — elle part de
`team_members`, pas de `teams.organization_id`. Le responsable d'équipe
repasserait donc la garde après le déplacement. Le trou se refermerait pour le
manager et resterait ouvert pour le lead.

### Le correctif : un trigger d'immuabilité

Comparer l'ancienne et la nouvelle ligne est précisément ce qu'une policy ne sait
pas faire et qu'un trigger fait naturellement — c'est la doctrine déjà écrite
dans `supabase/README.md`.

```sql
app.enforce_organization_immutable()   -- BEFORE UPDATE
  → refuse si new.organization_id is distinct from old.organization_id
```

Posé sur **`teams`, `customers` et `missions`**. Une entité métier n'est pas
censée changer d'entreprise : c'est une règle de conception, pas une préférence,
et elle mérite d'être écrite plutôt que déduite.

Le `WITH CHECK` de `teams_update_permitted` sera par ailleurs aligné sur son
`USING` — inutile une fois le trigger en place, mais deux barrières valent mieux
qu'une, et c'est le principe déjà appliqué partout ailleurs.

### Ce que la mesure dit de `customers` et `missions`

```
CLIENT  déplaçable vers B : false
MISSION déplaçable vers B : false
```

Ils résistent **aujourd'hui**, mais aucune règle ne l'énonce : la protection
découle d'un enchaînement de conditions qu'un ajustement futur pourrait défaire
sans que rien ne le signale. Le trigger rend la garantie explicite et
vérifiable.

---

## Défaut 2 — La RLS est plus permissive que la matrice RBAC (à trancher)

`teams_select_member` n'exige que `can_use_pro_module`. Un `employee`, qui ne
possède pas `team.view` dans la matrice, peut donc lire toutes les équipes de son
entreprise par l'API. L'interface les lui masque ; le serveur les lui sert.

Ce n'est **pas** une fuite — tout reste cloisonné dans l'organisation. C'est une
divergence entre le miroir déclaré et l'autorité réelle, dans le sens permissif.
Or toute la doctrine du projet repose sur l'idée que le miroir dit vrai.

**Décision retenue : aligner la RLS sur la matrice**, en ajoutant
`has_org_permission(organization_id, 'team.view')` à la policy de lecture.

Vérifié : `app.my_team_ids()` est `security definer` et lit `team_members`
directement, sans passer par la RLS de `teams`. Les policies de missions qui en
dépendent ne sont donc pas affectées. Un technicien conserve `team.view` et ne
perd rien.

---

## Migration

Un seul fichier, `20260810100200_teams_hardening.sql` :

1. `app.enforce_organization_immutable()` + trois triggers (`teams`, `customers`, `missions`)
2. `teams_update_permitted` — `WITH CHECK` aligné sur le `USING`
3. `teams_select_member` — ajout de `team.view`

**Aucune table créée, aucune fonction existante réécrite.**

---

## Les trois niveaux de responsabilité

La distinction que vous demandez de préserver en comporte en réalité **trois**,
pas deux — la troisième existe déjà en base et n'apparaissait pas dans la
spécification.

| Niveau | Où | Ce qu'il donne |
|---|---|---|
| `organization_members.role` | entreprise | les **permissions** : `team.create`, `team.update`… |
| `team_members.role = 'lead'` | équipe | le **périmètre** : élargit `my_led_team_ids()` |
| `teams.manager_id` | équipe | le **responsable désigné** : élargit aussi `my_led_team_ids()` |

Un `technician` peut être `lead` : il pilote son équipe sans gagner le droit de
contrôler un compte rendu. C'est le cas que l'interface doit rendre lisible —
deux badges distincts, jamais fondus en un seul.

`app.my_led_team_ids()` réunit les deux derniers niveaux : être `lead` **ou**
`manager_id` donne le même pouvoir opérationnel sur l'équipe.

---

## Ce qui sera construit

### `src/features/teams/`

```
api/teams.api.ts        ← EXISTE, inchangé
hooks/useTeams.ts       useTeams · useTeam · useCreateTeam · useUpdateTeam · useArchiveTeam
hooks/useTeamMembers.ts useAddTeamMember · useRemoveTeamMember · useSetTeamLead
schemas/team.schema.ts  nom 2..100 · slug · couleur #RRGGBB · description
components/             TeamMemberRoleBadge · TeamFormDialog · TeamMembersPanel · AddTeamMemberDialog
index.ts                API publique
```

Aucune couche supplémentaire : la structure copie `features/customers/`.

### Query keys

`qk.teams.{all, list, detail, ofMember}` existent déjà et portent
l'`organization_id` sur `list`. Rien à ajouter.

**Invalidations :** création/archivage → `qk.teams.all` (la liste change et le
compteur de membres aussi) · modification → `detail` + `list` · ajout, retrait ou
changement de lead → `detail(teamId)` uniquement, la liste n'affichant qu'un
décompte recalculé par la même requête.

### Pages

| Page | Route | Contenu |
|---|---|---|
| `TeamsListPage` | `/equipes` | nom, couleur, catégorie, effectif, responsable, statut |
| `TeamDetailPage` | `/equipes/:teamId` | identité, membres, lead, actions permises |

Les deux réutilisent `PageHeader`, `Card`, `Modal`, `Select`, `Badge`,
`EmptyState`, `ErrorState`, `ListSkeleton`. **Aucun composant visuel nouveau
hors du domaine Équipes.**

### Routes et navigation

Sous `RequireOrganization` → `RequirePlan feature="teams"` → `RequirePermission
permission="team.view"`. Entrée « Équipes » dans `ORGANIZATION_NAV`, avec
`permission: 'team.view'` et `feature: 'teams'` — même motif que « Clients ».

La fiche d'équipe reste sous `RequirePermission` : contrairement aux clients, il
n'existe pas de branche RLS ouvrant une équipe à qui n'a pas `team.view`.

---

## Permissions dans l'interface

| Action | Qui | Reflet visuel |
|---|---|---|
| Consulter | owner · admin · manager · team_leader · technician | entrée de menu |
| Créer | owner · admin · manager | bouton « Nouvelle équipe » |
| Modifier | owner · admin · manager · **lead de l'équipe** | bouton « Modifier » |
| Archiver | owner · admin | bouton « Archiver » |
| Ajouter / retirer un membre | owner · admin · manager · **lead de l'équipe** | boutons de la liste |
| Désigner un lead | idem | action sur la ligne du membre |

Le cas du `lead` est le plus délicat : sa permission ne vient pas du rôle
d'entreprise mais de son appartenance à l'équipe. L'interface le déduit de
`team_members`, exactement comme `my_led_team_ids()` côté serveur.

---

## Tests

### SQL — ajoutés au scénario existant

Une **Partie 6**, avec uniquement les assertions manquantes :

- B ne voit aucune équipe ni aucun membre d'équipe de A
- un membre de A ne peut pas insérer un membre de B dans une équipe de A *(déjà couvert en 3.3, à vérifier plutôt qu'à dupliquer)*
- **une équipe ne peut pas changer d'organisation** — le cas démontré ci-dessus
- un `technician` non lead ne peut ni modifier l'équipe ni y ajouter quelqu'un
- un `technician` **lead** le peut, sans gagner `intervention.review`
- un `employee` ne voit plus les équipes après alignement de la policy

### Frontend — décision assumée

Les tests de composants que la spécification demande (rendu, états, invalidation
React Query) supposent un outillage absent du projet : les 140 tests actuels sont
unitaires ou portent sur le routage, et aucun ne monte de composant connecté à
React Query.

**Reporté en Phase 11**, avec le reste du durcissement. Introduire ce motif ici
mêlerait une décision d'outillage à une phase métier, et c'est précisément le
genre de mélange qui fait passer les deux à moitié. Les assertions SQL, elles,
couvrent ce qui est réellement critique : personne ne contourne l'interface, on
contourne le serveur.

Dites-le si vous préférez l'inverse.

---

## Critères de validation

| | ❌ | 🟠 | ✅ |
|---|---|---|---|
| **Sécurité** | équipe encore déplaçable | trigger posé, non testé | déplacement refusé **et** prouvé par le scénario |
| **Liste** | aucun écran | liste sans effectif | nom, couleur, effectif, responsable, statut ; états vide/erreur/chargement |
| **Fiche** | aucun écran | membres sans actions | ajouter, retirer, désigner un lead ; les deux badges distincts |
| **Permissions** | tout visible | rôle d'entreprise seul | un `technician` lead modifie SON équipe et pas les autres |
| **Cloisonnement** | — | — | scénario au vert, `employee` ne voit plus les équipes |
| **Qualité** | — | — | typecheck, build, tests verts ; lint sans régression |

---

## Risques

| # | Risque | Mitigation |
|---|---|---|
| R1 | Le trigger d'immuabilité casse un flux légitime | Aucun code n'écrit `organization_id` en update. Vérifié sur les trois API avant application. |
| R2 | Aligner `teams_select_member` prive un rôle d'un accès utile | Seul `employee` est concerné, et il n'a aucune mission. Le scénario le vérifie. |
| R3 | `manager_id` et `lead` confondus dans l'interface | Deux badges, deux libellés distincts ; `my_led_team_ids()` reste la seule source du périmètre. |
| R4 | Effectif d'équipe coûteux à afficher | `getTeamWithMembers` fait déjà la jointure ; la liste compte côté client sur les données déjà chargées. |
| R5 | Retirer le dernier lead d'une équipe | Aucune contrainte serveur ne l'interdit. L'interface avertit sans bloquer — inventer une règle absente de la base serait pire que le problème. |

---

## Hors périmètre

- **Aucune refonte visuelle.** `src/styles/index.css`, `src/assets/`,
  `src/components/dashboard/`, `FeaturesBento`, `SocialProof`,
  `TechnicianShowcase` : intouchés.
- Aucune table créée, aucune policy existante réécrite hors des deux corrections
  justifiées ci-dessus.
- Pas d'affectation d'équipe à une mission — c'est la Phase 6.
- Pas de suppression définitive d'équipe : archivage seul, comme pour les clients.

---

## Volume

Environ **12 fichiers** : 1 migration, 2 hooks, 1 schéma, 4 composants, 2 pages,
plus routes, navigation et scénario SQL. Nettement moins que la Phase 3 — la
couche d'accès aux données existe déjà.
