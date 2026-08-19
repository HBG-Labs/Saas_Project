/**
 * Reprise des préférences locales après le changement de nom.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE FICHIER ÉVITE
 *
 * Le projet s'appelait NexoraTech ; il s'appelle REZO360. Les clés de stockage
 * portaient le nom de la marque, et le renommage du code les a suivies. Sans
 * cette reprise, chaque personne ayant déjà ouvert l'application perdrait
 * silencieusement, à la première visite : son thème, sa couleur d'accentuation,
 * l'organisation qu'elle avait sélectionnée, son avatar, et surtout le contenu
 * du module Véhicules — qui n'est stocké QUE là, et nulle part en base.
 *
 * Rien ne signalerait la perte. L'application afficherait des réglages par
 * défaut, et l'utilisateur conclurait à un dysfonctionnement.
 *
 * DISTINCT DE `purge-demo-storage.ts`, ET COMPLÉMENTAIRE
 *
 * Ce module-là efface des données MORTES, écrites par une couche de
 * démonstration disparue ; il conserve donc l'ancien préfixe, puisque c'est
 * sous ce nom qu'elles dorment. Celui-ci recopie des préférences VIVANTES vers
 * leur nouveau nom. Les deux se lisent ensemble, et aucun ne fait le travail de
 * l'autre.
 *
 * ÉNUMÉRÉES, JAMAIS DEVINÉES
 *
 * Même parti que le module voisin : on nomme les clés une par une plutôt que de
 * balayer le préfixe `nexoratech`. Un balayage aveugle emporterait les entrées
 * héritées que la purge doit encore trouver, et transformerait une reprise en
 * effacement.
 *
 * ÉCRITE POUR DISPARAÎTRE
 *
 * Ce fichier n'a de sens que pendant la transition. Une fois que plus personne
 * n'ouvre l'application avec un stockage d'avant le renommage — quelques mois —
 * il peut être supprimé avec son appel dans `main.tsx`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Trace du passage. Sa présence dispense de reparcourir le stockage. */
const MIGRATION_FLAG = 'rezo360_storage_keys_migrated';

/** Correspondances exactes : ancienne clé → nouvelle. */
const RENOMMAGES: readonly (readonly [string, string])[] = [
  ['nexoratech-theme', 'rezo360-theme'],
  ['nexoratech-theme-preset', 'rezo360-theme-preset'],
  ['nexoratech-accent-color', 'rezo360-accent-color'],
  ['nexoratech_current_organization', 'rezo360_current_organization'],
  ['nexoratech_active_avatar_url', 'rezo360_active_avatar_url'],
];

/**
 * Préfixes : la clé se termine par un identifiant variable.
 *
 * `nexoratech_fleet_vehicles_<organizationId>` en est le seul cas — le module
 * Véhicules écrit une entrée par organisation. On ne peut donc pas les nommer,
 * seulement reconnaître leur début.
 */
const PREFIXES: readonly (readonly [string, string])[] = [
  ['nexoratech_fleet_vehicles_', 'rezo360_fleet_vehicles_'],
];

/** Recopie une entrée sous son nouveau nom, puis retire l'ancienne. */
function deplacer(ancienne: string, nouvelle: string): boolean {
  const valeur = localStorage.getItem(ancienne);
  if (valeur === null) return false;

  // On n'écrase JAMAIS une valeur déjà présente sous le nouveau nom : elle est
  // forcément plus récente que celle d'avant le renommage.
  if (localStorage.getItem(nouvelle) === null) {
    localStorage.setItem(nouvelle, valeur);
  }

  localStorage.removeItem(ancienne);
  return true;
}

export function migrateStorageKeys(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG) !== null) return;

    for (const [ancienne, nouvelle] of RENOMMAGES) {
      deplacer(ancienne, nouvelle);
    }

    // Les clés à préfixe demandent un parcours. On collecte AVANT de modifier :
    // retirer une entrée pendant l'itération décale les index et en saute une.
    const aDeplacer: (readonly [string, string])[] = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const cle = localStorage.key(i);
      if (cle === null) continue;

      for (const [ancienPrefixe, nouveauPrefixe] of PREFIXES) {
        if (cle.startsWith(ancienPrefixe)) {
          aDeplacer.push([cle, nouveauPrefixe + cle.slice(ancienPrefixe.length)]);
        }
      }
    }

    for (const [ancienne, nouvelle] of aDeplacer) {
      deplacer(ancienne, nouvelle);
    }

    localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  } catch {
    // Stockage indisponible — navigation privée stricte, quota saturé. Perdre
    // des préférences est regrettable ; empêcher l'application de démarrer pour
    // cette raison ne l'est pas, c'est inacceptable.
  }
}
