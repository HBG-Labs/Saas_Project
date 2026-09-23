import { useEffect, useRef } from 'react';

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
        // Le contrôle n'existe qu'en développement. Garder ces imports hors
        // du graphe statique évite de charger le catalogue et le registre sur
        // chaque écran de production.
        await import('@/tools');
        const [catalog, universal, registry] = await Promise.all([
          import('@/features/catalog'),
          import('./calculators/universal'),
          import('./registry'),
        ]);

        const publies = await catalog.listPublishedToolSlugs();
        // Les outils universels sont implémentés hors du registre : les omettre
        // faisait passer douze outils fonctionnels pour des pages vides. Ils
        // sont en revanche servis depuis le code, donc on ne leur réclame pas
        // de ligne en base — seuls ceux du registre y sont adossés.
        const implementes = [
          ...registry.listRegisteredSlugs(),
          ...universal.UNIVERSAL_TOOLS.map((o) => o.slug),
        ];
        registry.logReconciliationReport(
          registry.reconcileRegistryWithCatalog(
            publies,
            implementes,
            registry.listRegisteredSlugs(),
          ),
        );
      } catch {
        // Sans base joignable, il n'y a rien à comparer. Se taire vaut mieux
        // qu'un avertissement de catalogue pour un problème de réseau.
      }
    })();
  }, []);
}
