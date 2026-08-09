import { useMemo } from 'react';

import { useOrganizationEntitlements, type FeatureKey } from '@/features/billing';
import type { NavItem } from '@/config/navigation';

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
