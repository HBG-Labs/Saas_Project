# Phase 3 — Module Entreprise

> Plan détaillé, à valider avant implémentation.
> Écrit le 9 août 2026, à l'issue de la Phase 2 (`1dc7d83`).

---

## Pourquoi cette phase

À la fin de la Phase 2, tout est prêt et rien n'est visible.

Le schéma existe et est prouvé (20 migrations, 25 tables, scénario multi-tenant
au vert). La couche API existe (`features/organizations/api/`, 15 fonctions). Le
contexte d'organisation, les droits et les entitlements existent. Mais
**aucune page ne permet encore de créer une entreprise ni d'y inviter quelqu'un**.

Conséquence concrète : aujourd'hui, la seule façon de créer une organisation est
un `insert` SQL à la main. La Phase 3 est celle qui rend le produit utilisable
par son premier client réel.

C'est aussi la phase qui **débloque toutes les suivantes** : sans organisation,
ni clients, ni équipes, ni missions ne peuvent exister — chacune de leurs
policies passe par `app.can_use_pro_module(organization_id, …)`.

---

## Ce qui existe déjà et sera réutilisé tel quel

| Élément | Chemin | Usage en Phase 3 |
|---|---|---|
| 15 fonctions d'accès | `features/organizations/api/organizations.api.ts` | **intégralement** |
| Lecture facturation | `features/billing/api/billing.api.ts` | `getOrganizationSubscription`, `listPlans` |
| Contexte + rôle | `features/organizations/context/` | source de l'organisation courante |
| `usePermission` | `features/organizations/hooks/` | masquage des actions |
| 3 gardes | `components/guards/` | protection des routes |
| `qk.organizations.*` | `lib/query-keys.ts` | clés déjà définies |
| Matrice RBAC | `features/organizations/rbac.ts` | `ROLE_LABELS`, `ROLE_DESCRIPTIONS` |
| Primitives UI | `components/ui/` | `Modal`, `Select`, `Input`, `Dropdown`, `Badge`, `Avatar`, `Skeleton` |
| États | `components/feedback/` | `EmptyState`, `ErrorState`, `LoadingScreen` |
| Formulaires | `react-hook-form` + `@hookform/resolvers` + `zod` | déjà en dépendances, jamais utilisés |

**Aucune fonction d'API nouvelle n'est nécessaire.** La Phase 3 est presque
entièrement du travail d'interface — c'est ce qui la rend rapide.

---

## Deux problèmes à résoudre, découverts en préparant ce plan

### 1. Aucun e-mail d'invitation n'est envoyé

`inviteMember()` insère une ligne dans `organization_invitations` avec un jeton.
**C'est tout.** Rien n'envoie de courriel — ni Supabase Auth, ni un trigger, ni
une Edge Function. L'invité ne recevrait donc jamais son lien.

Trois issues possibles :

| Option | Coût | Verdict |
|---|---|---|
| **Lien à copier** — l'inviteur copie l'URL et la transmet par ses propres moyens | ~20 lignes | **Retenu pour la Phase 3.** Honnête, immédiat, zéro dépendance. C'est ce que font Linear et Notion en complément de l'e-mail. |
| Edge Function + fournisseur d'e-mail (Resend, Postmark) | 1 Edge Function, un secret, un modèle | Reporté. Ajoute un déploiement Deno et un compte tiers à une phase déjà dense. |
| Supabase Auth `inviteUserByEmail` | — | Écarté : crée un compte, ce qui court-circuite notre propre flux d'invitation et ne gère pas le rôle. |

L'interface annoncera clairement « Copiez ce lien et transmettez-le » plutôt que
de laisser croire qu'un courriel est parti.

### 2. L'invité ne peut pas voir le nom de l'entreprise qui l'invite

La policy `organization_invitations_select` autorise l'invité à lire **sa
propre** invitation (correspondance sur l'adresse e-mail du JWT). Mais
`organizations_select_member` exige d'être **déjà membre** — l'invité ne peut
donc pas lire le nom de l'organisation.

Un écran d'acceptation qui afficherait « Rejoindre l'organisation `a3f8-…` ? » est
inacceptable : on ne demande pas à quelqu'un d'accepter un identifiant.

**Solution : une petite migration**, `20260810100000_invitation_preview.sql`,
ajoutant une fonction `security definer` :

```sql
public.get_invitation_preview(p_token uuid)
  returns table (organization_name text, role public.org_role, expires_at timestamptz)
```

Elle ne renvoie que ces trois champs, uniquement pour une invitation `pending`
non expirée, et **sans vérifier l'appartenance** — c'est tout son intérêt. Le
jeton étant un UUID v4 imprévisible, le connaître vaut autorisation de lire ces
trois valeurs, rien de plus. Aucune énumération n'est possible.

---

## Ce qui sera construit

### Routes ajoutées à `src/config/routes.ts`

| Constante | Chemin | Garde |
|---|---|---|
| `organizationNew` | `/organisation/nouvelle` | authentifié |
| `invitation` | `/invitations/:token` | authentifié |
| `organization` | `/organisation` | org + `organization.view` |
| `organizationMembers` | `/organisation/membres` | org + `member.view` |
| `organizationBilling` | `/organisation/facturation` | org + `billing.view` |

Chemins en français, cohérents avec le domaine et le public visé. `ROUTES` reste
la source unique — aucune URL écrite ailleurs.

### Pages (`src/pages/organization/`)

| Page | Rôle | États à couvrir |
|---|---|---|
| `CreateOrganizationPage` | Formulaire de création : nom, slug suggéré et modifiable, coordonnées facultatives | loading (soumission), error (slug pris → 23505) |
| `AcceptInvitationPage` | Aperçu de l'invitation puis acceptation | loading, error (jeton inconnu / expiré / mauvaise adresse), succès → redirection |
| `OrganizationSettingsPage` | Identité, coordonnées, adresse, SIRET/TVA | loading, error, lecture seule sans `organization.update` |
| `MembersPage` | Liste des membres, invitations en attente, changement de rôle, retrait | loading (squelette), empty, error, 403 |
| `BillingPage` | Formule, statut, période, quota de membres | loading, error, **pas d'action** (Stripe en Phase 12) |

### Hooks (`src/features/organizations/hooks/`)

Un hook par cas d'usage, jamais un hook générique. Chaque mutation déclare
explicitement les clés qu'elle invalide.

```
useMyOrganizations()        → qk.organizations.mine()
useOrganization(id)         → qk.organizations.detail(id)
useMembers(orgId)           → qk.organizations.members(orgId)
useInvitations(orgId)       → qk.organizations.invitations(orgId)

useCreateOrganization()     → invalide mine()
useUpdateOrganization()     → invalide detail() + mine()
useInviteMember()           → invalide invitations()
useRevokeInvitation()       → invalide invitations()
useAcceptInvitation()       → invalide mine() puis sélectionne la nouvelle org
useUpdateMemberRole()       → invalide members() + membership()
useRemoveMember()           → invalide members()
```

`useInvitationPreview(token)` s'appuiera sur la RPC décrite plus haut.

### Composants (`src/features/organizations/components/`)

| Composant | Détail |
|---|---|
| `OrganizationSwitcher` | Dans `AppLayout`. Masqué si une seule organisation — un sélecteur à un choix est du bruit. |
| `MemberRow` | Avatar, nom (**repli sur `job_title` puis l'e-mail** : `profile` est nullable par conception), badge de rôle, menu d'actions |
| `RoleSelect` | Sélecteur alimenté par `ORG_ROLES` + `ROLE_LABELS` + `ROLE_DESCRIPTIONS` |
| `InviteMemberDialog` | Adresse + rôle, puis **affichage du lien à copier** |
| `InvitationRow` | Adresse, rôle, expiration, copier le lien, révoquer |
| `RoleBadge` | Pastille colorée par niveau de privilège |
| `MemberQuotaBar` | « 18 / 25 membres » — le trigger `enforce_member_quota` refuse le 26ᵉ, l'interface doit prévenir avant |

### Formulaires

Premiers vrais formulaires du projet : `react-hook-form` + `zod`, sur le modèle
de `features/auth/schemas/auth.schema.ts`, qui sert de référence de style.

Schémas dans `features/organizations/schemas/organization.schema.ts`, avec les
**mêmes contraintes que le SQL** : nom entre 2 et 120 caractères, slug
`^[a-z0-9]+(-[a-z0-9]+)*$`, pays sur 2 lettres, e-mail au format attendu.
Valider côté client ne sécurise rien — cela évite un aller-retour pour une faute
de frappe.

---

## Trois règles métier que l'interface doit refléter

Elles sont déjà appliquées par des triggers. L'interface ne les *applique* pas :
elle évite de proposer une action qui échouera, et explique le refus quand il
survient.

| Règle | Trigger | Traduction visuelle |
|---|---|---|
| Le dernier propriétaire ne peut être ni retiré ni rétrogradé | `protect_last_owner` | Actions désactivées sur cette ligne, avec une infobulle expliquant pourquoi |
| Nul ne modifie son propre rôle ; seul un propriétaire crée un propriétaire | `prevent_privilege_escalation` | `RoleSelect` désactivé sur sa propre ligne ; « Propriétaire » absent des choix hors owner |
| Le 26ᵉ membre est refusé | `enforce_member_quota` | Bouton « Inviter » désactivé à la limite + message d'invitation à changer de formule |

**Chacune sera testée côté serveur**, en étendant `01_multitenant_scenario.sql` —
pas seulement masquée côté client.

---

## Modifications de fichiers existants

| Fichier | Changement |
|---|---|
| `src/config/routes.ts` | + 5 constantes |
| `src/config/navigation.ts` | + section « Entreprise » avec `permission` renseignée |
| `src/app/router.tsx` | + branche `RequireOrganization` avec les routes ci-dessus |
| `src/components/guards/RequireOrganization.tsx` | **Devient redirigeant** vers `/organisation/nouvelle` — l'écran existera enfin |
| `src/components/layout/AppLayout.tsx` | + `OrganizationSwitcher` dans l'en-tête |
| `src/app/router.test.tsx` | + cas : route entreprise sans session → `/login` |

---

## Ordre d'implémentation

Chaque étape produit quelque chose d'utilisable, et chacune dépend de la précédente.

| # | Étape | Pourquoi ici |
|---|---|---|
| 1 | Migration `invitation_preview` + tests SQL | Le reste en dépend ; se valide seul |
| 2 | Hooks de lecture (`useMyOrganizations`, `useOrganization`, `useMembers`, `useInvitations`) | Établit la convention `api/` → `hooks/`, absente du projet |
| 3 | `CreateOrganizationPage` + `useCreateOrganization` | **Premier écran qui crée une donnée réelle.** Débloque tous les tests manuels suivants |
| 4 | `OrganizationSwitcher` + `RequireOrganization` redirigeant | L'organisation devient navigable |
| 5 | `OrganizationSettingsPage` | Lecture/écriture simple, sans règle métier délicate |
| 6 | `MembersPage` + rôles + retrait | Le morceau le plus dense : trois règles métier à refléter |
| 7 | `InviteMemberDialog` + `AcceptInvitationPage` | Boucle complète : inviter → transmettre → rejoindre |
| 8 | `BillingPage` (lecture seule) | Prépare la Phase 12 sans rien en développer |
| 9 | Extension du scénario SQL + tests de composants | Preuve serveur des trois règles |

---

## Critères de validation

| | ❌ Non terminé | 🟠 Partiel | ✅ Terminé |
|---|---|---|---|
| **Création** | Aucun écran | Formulaire sans gestion du slug déjà pris | Je crée une entreprise depuis l'interface, j'en deviens propriétaire, le slug en doublon affiche un message clair |
| **Navigation** | Pas de sélecteur | Sélecteur sans persistance | Je change d'organisation, le choix survit au rechargement, les données de la précédente ne s'affichent jamais |
| **Paramètres** | Aucun écran | Lecture seule | Je modifie l'identité et l'adresse ; un technicien voit la page en lecture seule |
| **Membres** | Aucune liste | Liste sans actions | Je change un rôle, je retire un membre ; le dernier propriétaire est protégé **et le serveur le refuse aussi** ; le quota s'affiche |
| **Invitations** | Aucune | Création sans acceptation | J'invite, je copie le lien, un second compte l'ouvre, voit le nom de l'entreprise, accepte, et apparaît dans la liste |
| **Facturation** | Aucun écran | Formule affichée sans détail | Formule, statut, période et quota affichés ; un manager n'accède pas à la page |
| **Serveur** | — | — | `01_multitenant_scenario.sql` affiche `TOUS LES TESTS PASSENT`, quota et protections compris |
| **Qualité** | — | — | `typecheck`, `build`, `test` au vert ; lint sans régression |

---

## Risques

| # | Risque | Gravité | Mitigation |
|---|---|---|---|
| R1 | **`profile` nullable** — la RLS de `profiles` limite la lecture au propriétaire. Une liste de membres affichera donc souvent des profils vides | 🟠 | Repli explicite `job_title` → e-mail d'invitation → « Membre ». **Ne jamais “corriger” par une jointure large : ce serait une fuite entre collègues.** |
| R2 | **Course sur le slug** — `suggestOrganizationSlug` vérifie puis insère ; deux sessions peuvent réserver le même | 🟠 | La contrainte `unique` reste la seule garantie. Traduire le 23505 en « Ce nom est déjà pris » plutôt qu'en erreur technique |
| R3 | **Lien d'invitation transmis à la mauvaise personne** | 🟡 | Déjà couvert en base : la RPC exige la correspondance de l'adresse e-mail. L'interface doit expliquer ce refus, pas le masquer |
| R4 | **Invitation expirée** (7 jours) | 🟡 | Message distinguant « expirée » de « invalide », avec invitation à en redemander une |
| R5 | **Changement d'organisation et cache** | 🟠 | Les clés contiennent déjà l'`organization_id`. Vérifier qu'aucune requête de la Phase 3 ne l'omet |
| R6 | **Auto-rétrogradation** — un propriétaire seul qui se change en technicien se verrouille dehors | 🟠 | `protect_last_owner` refuse déjà. L'interface désactive l'action **et dit pourquoi** |

---

## Ce qui n'est PAS dans la Phase 3

Pour éviter tout malentendu :

- **Aucune écriture dans `subscriptions`.** `BillingPage` est en lecture seule ; Stripe reste en Phase 12.
- **Aucun envoi d'e-mail.** Lien à copier uniquement.
- **Ni clients, ni équipes, ni missions.** Phases 4 à 6.
- **Aucune suppression d'organisation.** `organization.delete` existe en base, mais supprimer une entreprise en cascade — missions, comptes rendus, pièces jointes — mérite son propre écran de confirmation ; ce sera une phase de durcissement.
- **Aucun changement de design.** Les composants réutilisent les primitives existantes.

---

## Estimation

Environ **25 fichiers** : 5 pages, 11 hooks, 7 composants, 1 schéma, 1 migration,
plus les modifications listées. C'est la phase la plus volumineuse en fichiers,
mais l'une des moins risquées : la couche difficile — RLS, triggers, séparation
des pouvoirs — est déjà écrite et prouvée.
