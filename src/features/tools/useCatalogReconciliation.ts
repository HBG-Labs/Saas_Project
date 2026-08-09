import { useEffect, useRef } from 'react';

import { listPublishedToolSlugs } from '@/features/catalog';

import { logReconciliationReport, reconcileRegistryWithCatalog } from './registry/reconcile';

/**
 * Confronte le registry au catalogue en base, au démarrage.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE CONTRÔLE EXISTE
 *
 * Le catalogue a deux faces jointes par le `slug` : la table `tools` porte les
 * métadonnées et la publication, `src/tools/<slug>/` porte l'implémentation.
 * Une divergence ne provoque aucune erreur — elle produit un symptôme, et un
 * symptôme trompeur : un outil publié sans code affiche une page « outil
 * introuvable », un outil codé sans ligne en base reste simplement invisible.
 *
 * Dans les deux cas on cherche le défaut du mauvais côté. Ces avertissements
 * disent immédiatement lequel manque, et quoi faire.
 *
 * DÉVELOPPEMENT UNIQUEMENT
 *
 * En production, la divergence est déjà tranchée : le déploiement fige le code
 * et les migrations ensemble. Y consacrer une requête au démarrage coûterait un
 * aller-retour à chaque visiteur pour un message que personne ne lirait.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useCatalogReconciliation(): void {
  const checked = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV || checked.current) return;
    checked.current = true;

    void (async () => {
      try {
        const slugs = await listPublishedToolSlugs();
        logReconciliationReport(reconcileRegistryWithCatalog(slugs));
      } catch {
        // Sans base joignable, il n'y a rien à comparer. Se taire vaut mieux
        // qu'un avertissement de catalogue pour un problème de réseau.
      }
    })();
  }, []);
}
