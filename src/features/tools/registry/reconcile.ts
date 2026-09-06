import { listRegisteredSlugs } from './registry';

/**
 * Garde-fou du modèle hybride code + base de données.
 *
 * Le catalogue a deux faces : la table `tools` porte les métadonnées et la
 * curation (ordre, publication), le registry porte l'implémentation. Elles sont
 * jointes par le `slug`. Une divergence est silencieuse et déroutante — un
 * outil publié qui affiche une page vide, ou un outil développé qui n'apparaît
 * jamais. Cette fonction la rend visible immédiatement.
 *
 * Appelée uniquement en développement.
 */
export interface ReconciliationReport {
  /** Publiés en base mais sans implémentation : la page planterait. */
  missingImplementation: string[];
  /** Implémentés mais absents de la base : l'outil reste invisible au catalogue. */
  missingCatalogEntry: string[];
}

/**
 * Rapproche le catalogue et les implémentations.
 *
 * Les deux paramètres facultatifs corrigent deux faux signalements qui
 * rendaient ce contrôle inutilisable — seize lignes de bruit à chaque
 * chargement, qui masquaient les rares écarts réels.
 *
 * `implementedSlugs` — le registre de `src/tools/` n'est pas la seule source
 * d'implémentations : les outils universels vivent dans une liste à part, qui
 * ne s'y déclare pas. Les ignorer faisait passer douze outils parfaitement
 * fonctionnels pour des pages vides.
 *
 * `cataloguedSlugs` — tout ce qui est implémenté n'a pas vocation à figurer en
 * base. Les outils universels sont servis depuis le code ; leur réclamer une
 * ligne n'aurait aucun sens. Seuls ceux du registre sont adossés au catalogue.
 *
 * Reste une limite assumée : la RLS de `tools` n'expose que les lignes
 * `active`. Un outil laissé en brouillon est donc indiscernable d'un outil
 * absent, et apparaîtra ici. C'est peu, et c'est le prix d'un contrôle qui
 * tourne côté navigateur.
 */
export function reconcileRegistryWithCatalog(
  publishedSlugs: readonly string[],
  implementedSlugs: readonly string[] = listRegisteredSlugs(),
  cataloguedSlugs: readonly string[] = implementedSlugs,
): ReconciliationReport {
  const implemented = new Set(implementedSlugs);
  const published = new Set(publishedSlugs);

  return {
    missingImplementation: [...published].filter((slug) => !implemented.has(slug)),
    missingCatalogEntry: [...new Set(cataloguedSlugs)].filter((slug) => !published.has(slug)),
  };
}

export function logReconciliationReport(report: ReconciliationReport): void {
  if (report.missingImplementation.length > 0) {
    console.warn(
      '[catalogue] Outils publiés en base sans implémentation :',
      report.missingImplementation.join(', '),
      '\n→ créez src/tools/<slug>/ ou dépubliez la ligne correspondante.',
    );
  }

  if (report.missingCatalogEntry.length > 0) {
    console.warn(
      '[catalogue] Outils implémentés mais absents de la table `tools` :',
      report.missingCatalogEntry.join(', '),
      '\n→ ajoutez la ligne correspondante via une migration.',
    );
  }
}
