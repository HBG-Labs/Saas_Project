# DESIGN_INVENTORY — Cartographie de NexoraTech

> Audit réalisé le 9 août 2026, sur l'état `f5659ea` (branche `phase-2/application-foundation`).
> **Aucun fichier applicatif n'a été modifié pour produire ce document.**

---

## Méthode, et ses limites

Trois mesures automatiques, dont deux ont d'abord donné des résultats faux — je le
signale parce que la conclusion en dépend.

1. **Routes déclarées vs routes câblées.** Comparaison de `config/routes.ts` et de
   `app/router.tsx`.
2. **Données fictives.** Recherche de `PagePlaceholder`, `readonly never[]`, littéraux
   `= 0`.
3. **Exports jamais consommés.** Première tentative : « non utilisé hors de sa feature ».
   **Critère faux** — il déclarait morts des symboles comme `useCreateContact`, consommé
   par `ContactsPanel` qui vit *dans* la même feature. C'est précisément le découpage
   `api/ → hooks/ → composants` que l'architecture impose. Critère retenu : « jamais
   mentionné dans aucun fichier autre que celui qui le déclare ».

**Deux angles morts subsistent** dans la troisième mesure : les symboles utilisés
uniquement par un `index.ts` (`registerTool`) ou uniquement par les tests
(`MISSION_TRANSITIONS`, `TERMINAL_STATUSES`, `canReviewReport`) apparaissent à tort.
Ils sont écartés manuellement ci-dessous.

**Ce que cet audit ne peut pas dire.** Aucun de ces écrans n'a été vu rendu. Ils sont
derrière `RequirePlan` et l'organisation de test n'a pas d'abonnement `business`. Toute
appréciation visuelle — débordement, contraste, atteignabilité au pouce — est hors de
portée de ce document.

---

## Résultat des deux premières mesures

**Routes : aucune orpheline.** Les 32 routes déclarées sont toutes câblées. `home` est
la route index, sans `path`.

**Données fictives : deux occurrences**, toutes deux dans `DashboardPage.tsx` :

```
ligne 26 : const favoriteCount = 0;
ligne 27 : const historyCount  = 0;
```

Elles alimentent deux `StatCard`. Les hooks `useFavorites` et `useToolHistory` existent
depuis le commit `4d441ea` et ne sont pas appelés ici. **C'est la dernière donnée
inventée de l'application.**

---

## A — Fonctionnel et accessible

| Fonctionnalité | Phase | Route | Page | Permission | Formule |
|---|---|---|---|---|---|
| Catalogue d'outils | 0 | `/tools` | `ToolsPage` | — | — |
| Fiche outil + 6 calculatrices | 0 | `/tools/:slug` | `ToolDetailPage` | — | — |
| Catégories | 0 | `/categories/:slug` | `CategoryPage` | — | — |
| Favoris | 11 | `/favorites` | `FavoritesPage` | authentifié | — |
| Historique d'outils | 11 | `/history` | `HistoryPage` | authentifié | — |
| Authentification | 0 | `/login` `/register` `/forgot-password` | — | — | — |
| Retour de lien e-mail | 11 | `/auth/callback` | `AuthCallbackPage` | — | — |
| Landing, tarifs, FAQ | 0/2 | `/` `/pricing` `/faq` `/features` | — | — | — |
| Création d'entreprise | 3 | `/organisation/nouvelle` | `CreateOrganizationPage` | authentifié | — |
| Acceptation d'invitation | 3 | `/invitations/:token` | `AcceptInvitationPage` | authentifié | — |
| Paramètres d'entreprise | 3 | `/organisation` | `OrganizationSettingsPage` | `organization.view` | — |
| Membres, rôles, retrait | 3 | `/organisation/membres` | `MembersPage` | `member.view` | — |
| Invitations + lien à copier | 3 | idem | idem | `member.invite` | — |
| Facturation (lecture) | 3 | `/organisation/facturation` | `BillingPage` | `billing.view` | — |
| Sélecteur d'organisation | 3 | menu avatar | `OrganizationSwitcher` | — | — |
| Liste et fiche client (4 onglets) | 4 | `/clients` `/clients/:id` | `Customers*Page` | `customer.view`* | `customers` |
| Contacts : créer, supprimer, principal | 4 | onglet | `ContactsPanel` | `customer.update` | idem |
| Sites : créer, archiver | 4 | onglet | `SitesPanel` | `customer.update` | idem |
| Historique client | 4 | onglet | — | — | idem |
| Liste et fiche équipe | 5 | `/equipes` `/equipes/:id` | `Teams*Page` | `team.view` | `teams` |
| Composition d'équipe, lead | 5 | fiche | `TeamMembersPanel` | `team.assign_member`* | idem |
| Liste, création, fiche mission | 6 | `/missions` `/missions/nouvelle` `/missions/:id` | `Mission*Page` | `mission.create` pour créer | `missions` |
| Transitions de statut | 6 | fiche | `MissionTransitions` | selon la transition | idem |
| Affectation équipe/technicien | 6 | fiche | `AssignMissionDialog` | `mission.assign` | idem |
| **Démarrage d'intervention** | 7 | fiche mission | `MissionInterventionsPanel` | intervenant | `interventions` |
| Chronomètre, pause, reprise, fin | 7 | `/interventions/:id` | `InterventionPage` | intervenant | idem |
| Relevé du temps | 7 | idem | idem | lecture large | idem |
| Compte rendu : rédiger, soumettre | 8 | `/interventions/:id/rapport` | `ReportEditorPage` | auteur | idem |
| Photos avant/après, pièces jointes | 8 | idem | `AttachmentGallery` | auteur | `attachments` |
| File de contrôle, valider, refuser | 8 | `/controle` | `ReviewQueuePage` | `intervention.review` | `intervention_review` |
| Tableau de bord métier par rôle | 10 | `/dashboard` | `ProfessionalSummary` | selon le rôle | `missions` |
| Journal d'audit | 10 | `/journal` | `AuditLogPage` | `audit.view` | `audit_log` |

\* La **fiche** client n'exige pas `customer.view` : un technicien doit atteindre celle
du client de sa mission, et la policy l'y autorise par sa seconde branche. Idem pour la
composition d'équipe, ouverte au `lead` sans permission d'entreprise.

---

## B — Fonctionnel côté serveur, absent de l'interface

**C'est la catégorie qui compte.** Chaque ligne est une capacité existante, testée,
sécurisée — et inatteignable.

| # | Manque | Symbole inutilisé | Conséquence concrète | Gravité |
|---|---|---|---|---|
| B1 | **Modifier une mission** | `useUpdateMission` | Une faute de frappe dans l'intitulé, une date erronée ou une description incomplète sont **définitives**. Seuls le statut et l'affectation sont modifiables. | 🔴 |
| B2 | **Modifier un contact** | `useUpdateContact` | Un numéro de téléphone erroné se corrige en supprimant puis recréant le contact — ce qui perd son statut de principal. | 🟠 |
| B3 | **Modifier un site** | `useUpdateSite` | Un code de portail changé oblige à archiver le site et à le recréer, ce qui rompt le lien des missions passées. | 🔴 |
| B4 | **Voir et restaurer les clients archivés** | `useRestoreCustomer` | L'archivage est à sens unique : la fiche disparaît sans retour possible. La liste filtre `status = 'active'` sans alternative. | 🟠 |
| B5 | **Historique d'affectation d'une mission** | `listMissionAssignments` | La table trace chaque affectation et désaffectation ; rien ne l'affiche. On ne sait pas à qui la mission avait été confiée avant. | 🟡 |
| B6 | **Équipes d'un membre** | `listTeamsOfMember` | La fiche d'un membre ne dit pas à quelles équipes il appartient. | 🟡 |
| B7 | **Notes d'intervention hors clôture** | `updateIntervention` | Les notes ne se saisissent qu'au moment de terminer. | 🟡 |
| B8 | **Comparer les formules** | `listPlans`, `getPlan`, `listPlanFeatures` | `BillingPage` affiche la formule courante mais ne montre pas ce que les autres apportent. | 🟡 |
| B9 | **Catégories servies par la base** | `getCategoryBySlug`, `listToolsByCategorySlug` | `CategoryPage` lit le registry en mémoire. Un outil publié en base sans code reste invisible au lieu d'être signalé. | 🟡 |

**Redondances assumées, à ne pas « corriger »** : `useOrganizationSites` (le sélecteur
de site part du client), `getOpenTimeEntry` (le chronomètre déduit le segment ouvert de
la liste déjà chargée), `useMyOrganizations` (le contexte fait sa propre requête),
`getOrganizationBySlug` (aucune route par slug). Les supprimer serait plus honnête que
les brancher artificiellement.

---

## C — Partiellement implémenté

| Élément | Ce qui manque |
|---|---|
| `DashboardPage` — tuiles Favoris et Calculs | Deux `0` codés en dur. Les hooks existent. |
| `ReferencesPage` | État vide uniquement. **Aucune donnée de référence n'existe en base** — la table a été délibérément reportée. Rien à brancher. |
| `ProfilePage` | Lecture seule, bouton d'enregistrement inerte. `profiles` accepte pourtant l'écriture par son propriétaire. |
| `SettingsPage` | Le thème fonctionne ; les autres interrupteurs sont désactivés. |
| Filtres missions | Statut et recherche uniquement. Client, site, équipe, technicien, priorité et dates sont supportés par `listMissions` mais absents de l'écran. |
| Signatures manuscrites | Colonnes en base, bucket acceptant le type `signature`, aucun composant de saisie. |
| Vue planning | `scheduled_start` et son index existent ; aucune vue calendrier. |

---

## D — Non implémenté, et assumé

| Élément | Raison |
|---|---|
| Stripe | Phase 12. `subscriptions` est fermée en écriture au client, colonnes `provider_*` en attente. |
| Envoi d'e-mail d'invitation | Aucune Edge Function. Le lien à copier est le mécanisme retenu, et l'interface le dit. |
| Tables `references`, `materials`, `vehicles`, `establishments` | Reportées faute d'usage défini. |
| Tests de composants React Query | Aucun motif de test montant un composant connecté n'existe dans le projet. |

---

## Navigation actuelle

Quinze entrées réparties en trois groupes plats — application, entreprise, compte :

```
Tableau de bord · Outils · Favoris · Historique · Références
ENTREPRISE  Missions · Contrôle · Clients · Équipes · Entreprise · Membres · Facturation · Journal
COMPTE      Profil · Paramètres
```

**Deux défauts.** Le groupe « Entreprise » mêle l'exploitation quotidienne (Missions,
Contrôle) et l'administration (Membres, Facturation, Journal) — un technicien et un
propriétaire n'y cherchent pas la même chose. Et l'intitulé « Entreprise » désigne à la
fois le groupe et l'une de ses entrées.

**Un manque.** Aucune entrée ne mène aux interventions ni aux rapports : on n'y accède
que par une mission. C'est cohérent pour un technicien qui part de son travail du jour,
mais un responsable n'a aucun moyen de voir les interventions en cours.

---

## Ordre de travail proposé

Par valeur décroissante, et non par ordre de facilité.

| # | Travail | Pourquoi ce rang |
|---|---|---|
| 1 | **B1 + B3 — modifier une mission et un site** | Une donnée métier non modifiable est un défaut bloquant à l'usage : la seule issue est de recréer, ce qui rompt l'historique. |
| 2 | **C — les deux `0` du tableau de bord** | Dernière donnée inventée de l'application. Les hooks existent, c'est une ligne. |
| 3 | **B2 + B4 — contacts modifiables, clients archivés visibles** | Même nature que 1, moindre fréquence. |
| 4 | **Navigation** — séparer exploitation et administration | Conditionne la lisibilité de tout le reste. |
| 5 | **Filtres missions** — client, équipe, technicien, dates | `listMissions` les accepte déjà ; c'est de l'interface pure. |
| 6 | **B5 + B6 + B7** — historique d'affectation, équipes d'un membre, notes | Confort, pas blocage. |
| 7 | **Mobile-first et design system** | **À faire en dernier, et à vue.** Y travailler sans avoir vu un seul écran rendu serait deviner. |

---

## Sécurité

**Aucune modification n'est nécessaire.** Tout ce qui figure en catégorie B est déjà
autorisé par les policies existantes : il ne manque que l'écran. Les travaux 1 à 6
n'appellent aucune migration, aucune policy, aucun trigger.

Si l'implémentation révélait une anomalie, elle serait signalée avant toute écriture,
conformément au §19 de la consigne.
