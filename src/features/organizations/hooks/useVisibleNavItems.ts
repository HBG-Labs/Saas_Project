import { useMemo } from 'react';

import { useOrganizationEntitlements, type FeatureKey } from '@/features/billing';
import type { NavGroup, NavItem } from '@/config/navigation';

import { type Permission } from '../rbac';

import { useCurrentOrganization } from './useCurrentOrganization';
import { usePermission } from './usePermission';

/**
 * Filtre une liste de destinations selon le rôle et la formule.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE HOOK NE SÉCURISE RIEN.
 *
 * Retirer une entrée de menu n'empêche pas d'atteindre l'URL à la main. La
 * section s'ouvrira alors — et restera vide, la RLS ne renvoyant rien. C'est
 * l'ERGONOMIE qui est en jeu : un menu qui annonce des sections inaccessibles
 * décrit le produit, pas le travail de celui qui le consulte.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `permission` et `feature` arrivent en `string` : `config/` est la couche basse
 * et ignore les types des features. La conversion est faite ici, du côté qui les
 * connaît, et `navigation.test.ts` garantit qu'aucune valeur invalide ne se
 * glisse dans la configuration — sans quoi une entrée disparaîtrait
 * silencieusement pour tout le monde.
 */
export function useVisibleNavItems(items: readonly NavItem[]): readonly NavItem[] {
  const { can } = usePermission();
  const { organization } = useCurrentOrganization();
  const { has } = useOrganizationEntitlements(organization?.id ?? null);

  return useMemo(
    () =>
      items.filter((item) => {
        if (item.permission !== undefined && !can(item.permission as Permission)) return false;
        if (item.feature !== undefined && !has(item.feature as FeatureKey)) return false;
        return true;
      }),
    [items, can, has],
  );
}

/**
 * Même filtrage, appliqué à des sections.
 *
 * Un groupe dont plus aucune entrée ne survit disparaît avec son intitulé : un
 * « Ressources » vide n'informe de rien, et laisse croire à une panne.
 *
 * Un seul hook plutôt qu'un `useVisibleNavItems` par groupe : appeler un hook
 * dans une boucle romprait l'ordre des hooks dès qu'un groupe serait ajouté
 * sous condition.
 */
export function useVisibleNavGroups(groups: readonly NavGroup[]): readonly NavGroup[] {
  const { can } = usePermission();
  const { organization } = useCurrentOrganization();
  const { has } = useOrganizationEntitlements(organization?.id ?? null);

  return useMemo(() => {
    const visible: NavGroup[] = [];

    for (const group of groups) {
      const items = group.items.filter((item) => {
        if (item.permission !== undefined && !can(item.permission as Permission)) return false;
        if (item.feature !== undefined && !has(item.feature as FeatureKey)) return false;
        return true;
      });

      if (items.length > 0) visible.push({ ...group, items });
    }

    return visible;
  }, [groups, can, has]);
}
