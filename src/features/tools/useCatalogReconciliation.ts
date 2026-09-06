import { useEffect, useRef } from 'react';

import { listPublishedToolSlugs } from '@/features/catalog';

import { UNIVERSAL_TOOLS } from './calculators/universal';
import { listRegisteredSlugs } from './registry';

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
        const publies = await listPublishedToolSlugs();
        // Les outils universels sont implémentés hors du registre : les omettre
        // faisait passer douze outils fonctionnels pour des pages vides. Ils
        // sont en revanche servis depuis le code, donc on ne leur réclame pas
        // de ligne en base — seuls ceux du registre y sont adossés.
        const implementes = [...listRegisteredSlugs(), ...UNIVERSAL_TOOLS.map((o) => o.slug)];
        logReconciliationReport(
          reconcileRegistryWithCatalog(publies, implementes, listRegisteredSlugs()),
        );
      } catch {
        // Sans base joignable, il n'y a rien à comparer. Se taire vaut mieux
        // qu'un avertissement de catalogue pour un problème de réseau.
      }
    })();
  }, []);
}
