# Transmission automatique — cadrage

Ce document fige les décisions d'architecture prises avant l'implémentation de la
synchronisation et de la reprise automatiques des transmissions SUPER PDP.
Il n'y a rien d'implémenté à ce jour : la synchronisation reste **manuelle**.

## Ce qui existe déjà

L'essentiel du socle a été écrit en anticipant un ordonnanceur qui n'est jamais
venu. Il ne faut donc pas le refaire :

| Brique | État |
|---|---|
| `invoice_transmissions.next_attempt_at` + index partiel `invoice_transmissions_retry_idx` | présents, **jamais écrits** ailleurs qu'à `null` |
| Machine à états anti-régression (`app.guard_invoice_transmission`) | autorise déjà `submitted → delivered → accepted/rejected` |
| Remise à `null` de `next_attempt_at` sur état terminal | déjà dans le trigger |
| Verrou optimiste de prise de tâche | `.in('status', ['queued','failed'])` → `submitting` |
| Idempotence du dépôt | récupération par `external_id` + index unique sur `(provider_code, provider_submission_id)` |
| Déduplication d'événements | index unique `(transmission_id, provider_event_id)` |
| Renouvellement de jeton concurrent-safe | `usableSuperPdpAccessToken` |
| Journal immuable | `invoice_transmission_events` |

**D2 n'est pas « construire la reprise ». C'est brancher un déclencheur sur une
mécanique déjà écrite, et définir la politique de report.**

## L'obstacle réel : l'autorisation

`superpdp-invoice` exige un JWT utilisateur, puis évalue `can_transmit_invoice`
**sous l'identité de l'appelant**. Un ordonnanceur n'a pas d'utilisateur.

**Décision : une fonction distincte `superpdp-worker`**, `verify_jwt = false`,
authentifiée par secret partagé comparé à temps constant, qui n'expose aucune
action utilisateur.

L'alternative — ajouter une branche `service_role` dans `superpdp-invoice` —
est écartée : elle ferait cohabiter deux régimes d'autorisation dans le fichier
le plus sensible du domaine.

Conséquence : `syncEvents`, `recordProviderEvent` et `recoverSubmission` vivent
aujourd'hui dans `superpdp-invoice/index.ts`. Il faudra les extraire vers
`_shared/superpdp-transmission.ts` pour que les deux fonctions partagent une
seule implémentation plutôt que d'en laisser diverger deux.

## Ordonnanceur : `pg_cron` + `pg_net`

Relevé sur le projet lié : `pg_cron` 1.6.4 et `pg_net` 0.20.4 sont disponibles
mais **non installés**. `supabase_vault` est installé. Aucun cron Vercel.

**Décision : option base de données.** Un job `pg_cron` appelle la fonction via
`net.http_post`, le secret étant conservé dans Vault.

Les alternatives écartées, et pourquoi :

- **GitHub Actions `schedule`** — ferait piloter un comportement de production
  par l'infrastructure d'intégration continue. Inversion de responsabilité, et
  l'ordonnanceur GitHub est « au mieux » : des retards de cinq à quinze minutes
  sont courants.
- **Vercel Cron** — le projet est une SPA Vite pure. Il faudrait créer une
  surface serverless `/api` qui n'existe pas aujourd'hui. En formule Hobby,
  Vercel limite par ailleurs à un déclenchement par jour.

## Ce que fait le worker

Deux files, une fonction, appelée toutes les quinze minutes.

**Synchronisation** — transmissions `submitted` ou `delivered` avec un
`provider_submission_id`, par lots d'environ vingt-cinq, les plus anciennes
d'abord. Réutilise `syncEvents` tel quel : la déduplication d'événements la rend
rejouable sans effet de bord.

**Reprise** — transmissions `queued` ou `failed` dont `next_attempt_at` est
échu ; c'est exactement l'index partiel existant. Uniquement les échecs
**techniques** (`last_error_code = 'submission_failed'`). Un `rejected` est un
refus métier, terminal par le trigger, et n'est jamais rejoué.

**Report** — seul code réellement nouveau :
`next_attempt_at = now() + f(attempt_count)`, croissance exponentielle plafonnée
(5 min, 15 min, 1 h, 6 h, 24 h).

**Périmètre tenant** — seules les organisations dont la connexion est
`connected`. Le renouvellement de jeton est déjà géré organisation par
organisation.

## Décisions arrêtées

| Question | Décision | Motif |
|---|---|---|
| Dépôt automatique des `queued` | **Non** | Une facture ne part pas sur le réseau réglementaire sans geste humain. Ce sera un jour un choix explicite, pas un effet de bord du worker. |
| Cadence | **15 minutes** | Un statut PDP n'évolue pas à la seconde. 96 exécutions par jour, coût négligeable. |
| Plafond de tentatives | **5**, puis arrêt | Au-delà, ce n'est plus un incident réseau. `next_attempt_at` laissé à `null` rend l'abandon visible. |
| Alerte | **Battement de cœur minimal** (`last_run_at`) | Sans lui, un worker muet est indiscernable d'un worker qui n'a rien à faire — le mode de panne le plus vicieux. |

## Prérequis : prouver le chemin de dépôt en production

**À traiter avant D2.**

`resolveElectronicAddresses` comporte deux branches entièrement distinctes :

- **bac à sable** — `officialSandboxRouting`, qui lit les adresses dans un
  document de référence fourni par SUPER PDP ;
- **production** — interrogation de l'annuaire (`/v1.beta/directory_entries`
  pour l'émetteur, `/v1.beta/french_directory/entries` pour le destinataire),
  puis arbitrage par `selectRecipientIdentifier` entre plusieurs adresses
  actives.

Les trois transmissions existantes datent des 4 et 5 septembre 2026, **toutes en
bac à sable**. La connexion n'est passée en production que le 6 septembre à
01:49 UTC. **La branche production n'a donc jamais été exécutée.**

Automatiser la reprise par-dessus un chemin de dépôt non éprouvé reviendrait à
automatiser la répétition d'un échec structurel. L'ordre retenu est donc :

1. contrôle de routage **en lecture seule** en production — les appels
   d'annuaire sont des `GET`, la résolution d'adresses se prouve sans rien
   envoyer ;
2. selon le résultat, correction de la branche production, puis répétition d'un
   dépôt réel ;
3. D2.

## Risque principal

Il n'est pas technique, il est métier : une reprise automatique qui redéposerait
une facture déjà acceptée serait grave. Les protections existent — récupération
par `external_id`, index unique sur l'identifiant de dépôt, états terminaux
verrouillés par trigger — mais elles devront être **testées explicitement** avant
activation, et non supposées.
