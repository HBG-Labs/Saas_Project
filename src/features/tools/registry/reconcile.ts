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

export function reconcileRegistryWithCatalog(
  catalogSlugs: readonly string[],
): ReconciliationReport {
  const registered = new Set(listRegisteredSlugs());
  const catalog = new Set(catalogSlugs);

  return {
    missingImplementation: [...catalog].filter((slug) => !registered.has(slug)),
    missingCatalogEntry: [...registered].filter((slug) => !catalog.has(slug)),
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
