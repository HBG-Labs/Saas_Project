# Licence Remotion — régime applicable

Statut : **UNCONFIRMED** (dépend d'un fait que seul le titulaire peut attester : l'effectif).
Rien n'a été acheté. Vérification faite le 27/09/2026 sur les sources officielles.

## Ce que dit la licence (sources officielles)

Sources : `LICENSE.md` du dépôt `remotion-dev/remotion` (branche main) et
<https://www.remotion.pro/license>.

**Licence gratuite** — utilisation libre si vous êtes :

- « an individual » ;
- « a for-profit organization with up to 3 employees » ;
- « a non-profit or not-for-profit organization » ;
- en évaluation, « not yet using it in a commercial way ».

**Company License** — obligatoire pour toute entité non éligible à la licence
gratuite (« companies of 4+ people »). Tarifs publiés :

- *Remotion for Creators* : 25 $/mois par siège (1 siège par utilisateur) ;
- *Remotion for Automators* : 0,01 $ par rendu, minimum 100 $/mois.

**Interdit dans tous les cas** : copier ou modifier le code de Remotion « for the
purpose of selling, renting, licensing, relicensing, or sublicensing your own
derivate of Remotion ».

## Application à ce projet

- Le moteur **utilise** Remotion comme renderer (`@motion-engine/renderer-remotion`) ;
  il ne revend ni ne redistribue Remotion. Le cœur (`@motion-engine/core`) n'en
  dépend pas : la dépendance est isolée et remplaçable.
- Les vidéos sont produites automatiquement, côté serveur (`renderMedia`). Si
  une Company License est requise, c'est le profil **Automators** (au rendu) qui
  correspond à cet usage, pas Creators.
- `licenseKey: null` est passé au rendu : aucune télémétrie d'usage n'est envoyée.

## Ce qui reste à confirmer (décision du titulaire)

1. **Effectif de l'entité exploitante** (HBG Labs / REZO360) : ≤ 3 personnes →
   licence gratuite ; ≥ 4 → Company License (Automators, ≥ 100 $/mois).
2. **Usage commercial** : dès que des vidéos rendues servent une activité
   commerciale, l'exception « évaluation » ne s'applique plus.
3. La licence ne définit ni « employee » (salariés ? prestataires ? associés ?)
   ni le cas d'un service rendant des vidéos pour des clients tiers : à faire
   confirmer par écrit auprès de Remotion avant exploitation à grande échelle.

Tant que ces points ne sont pas confirmés : `REMOTION_COMMERCIAL_LICENSE_STATUS = UNCONFIRMED`.
