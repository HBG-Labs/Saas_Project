/**
 * Purge unique des données de démonstration locales.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * Pendant une phase de développement, chaque module métier doublait Supabase
 * d'une copie en `localStorage` : missions, clients, équipes, membres et comptes
 * rendus fictifs, écrits au premier chargement puis fusionnés aux données
 * réelles. Ces entrées portaient des identifiants inventés (`org-demo`,
 * `mission-001`, `mem-tech-1`) qu'aucune requête ne peut retrouver en base.
 *
 * Le code qui les produisait a disparu, mais pas leur contenu : il dort dans le
 * navigateur de chaque personne ayant ouvert l'application avant cette version.
 * Sans ce nettoyage, rien ne s'afficherait de faux — plus personne ne les lit —
 * mais plusieurs mégaoctets de données mortes survivraient indéfiniment.
 *
 * Le drapeau évite de reparcourir le stockage à chaque démarrage. Il reste, lui,
 * volontairement : c'est la trace qui dit que le ménage a été fait.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Version 2 : la mise en production a retiré le sélecteur de rôle simulé, dont
// le réglage dort encore dans les onglets ouverts avant la bascule.
const PURGE_FLAG = 'nexoratech_demo_storage_purged_v2';

/**
 * Clés écrites par l'ancienne couche de démonstration.
 *
 * Volontairement énumérées plutôt que devinées par préfixe : `nexoratech_theme`
 * et `nexoratech_current_organization` partagent le même préfixe et sont des
 * préférences légitimes, qu'un balayage aveugle effacerait.
 */
const DEMO_KEYS: readonly string[] = [
  'nexoratech_local_organizations',
  'nexoratech_local_members',
  'nexoratech_local_invitations',
  'nexoratech_local_customers',
  'nexoratech_local_contacts',
  'nexoratech_local_sites',
  'nexoratech_local_missions',
  'nexoratech_local_demo_reports',
  'nexoratech_demo_teams',
  'nexoratech_demo_team_members',
];

export function purgeDemoStorage(): void {
  try {
    if (localStorage.getItem(PURGE_FLAG) !== null) return;

    for (const key of DEMO_KEYS) {
      localStorage.removeItem(key);
    }

    // Le sélecteur de rôle de développement n'existe plus : son réglage ne
    // pilote plus rien. Un réglage sans effet est pire qu'absent — on finit par
    // lui attribuer un comportement qu'il n'a pas.
    sessionStorage.removeItem('nexoratech_simulated_dev_role');

    localStorage.setItem(PURGE_FLAG, new Date().toISOString());
  } catch {
    // Navigation privée stricte ou quota saturé : le stockage est inaccessible,
    // donc il n'y a rien à y purger. Échouer ici empêcherait le démarrage pour
    // une opération de confort.
  }
}
