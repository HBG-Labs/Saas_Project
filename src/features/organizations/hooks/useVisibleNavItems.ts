import { useMemo } from 'react';

import { pluralize, type IndustryCode, type IndustryVocabulary } from '@/config/industries';
import { useOrganizationEntitlements, type FeatureKey } from '@/features/billing';
import { useCurrentIndustry } from '@/features/industries';
import type { NavGroup, NavItem } from '@/config/navigation';

import { type Permission } from '../rbac';

import { useCurrentOrganization } from './useCurrentOrganization';
import { usePermission } from './usePermission';

/**
 * Composition du menu : ce qui est visible, et sous quel nom.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CES HOOKS NE SÉCURISENT RIEN.
 *
 * Retirer une entrée de menu n'empêche pas d'atteindre l'URL à la main. La
 * section s'ouvrira alors — et restera vide, la RLS ne renvoyant rien. C'est
 * l'ERGONOMIE qui est en jeu : un menu qui annonce des sections inaccessibles
 * décrit le produit, pas le travail de celui qui le consulte.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `permission`, `feature` et `industry` arrivent en `string` : `config/` est la
 * couche basse et ignore les types des features. La conversion est faite ici,
 * du côté qui les connaît, et `navigation.test.ts` garantit qu'aucune valeur
 * invalide ne se glisse dans la configuration — sans quoi une entrée
 * disparaîtrait silencieusement pour tout le monde.
 */

/**
 * Remplace le libellé d'une entrée par le terme du métier, s'il y a lieu.
 *
 * Fait ici parce que ces hooks connaissent déjà le métier : le résoudre une
 * seconde fois dans chaque composant de menu multiplierait les sources et
 * finirait par les faire diverger.
 */
function withVocabulary(
  item: NavItem,
  vocabulary: IndustryVocabulary,
  overrides: Record<string, string>,
): NavItem {
  if (item.vocabulary === undefined) return item;

  const singular = vocabulary[item.vocabulary.term];
  const label =
    item.vocabulary.plural === true
      ? pluralize(singular, overrides[`${item.vocabulary.term}_plural`])
      : singular;

  return { ...item, label };
}

/**
 * Une destination survit-elle aux trois critères ?
 *
 * L'ordre n'est pas indifférent : abonnement, puis métier, puis rôle. Il va du
 * plus général au plus personnel — ce que l'entreprise a payé, ce que son
 * métier justifie, ce que la personne a le droit de faire. C'est aussi l'ordre
 * dans lequel une absence s'explique le mieux.
 *
 * Prédicat partagé plutôt que dupliqué dans les deux hooks : deux copies du
 * même filtre divergent toujours, et c'est le menu entier qui en dépend.
 */
function isVisible(
  item: NavItem,
  has: (feature: FeatureKey) => boolean,
  industry: IndustryCode,
  can: (permission: Permission) => boolean,
): boolean {
  if (item.feature !== undefined && !has(item.feature as FeatureKey)) return false;

  if (item.industry !== undefined) {
    const allowed = Array.isArray(item.industry) ? item.industry : [item.industry];
    if (!allowed.includes(industry)) return false;
  }

  if (item.permission !== undefined && !can(item.permission as Permission)) return false;

  return true;
}

export function useVisibleNavItems(items: readonly NavItem[]): readonly NavItem[] {
  const { can } = usePermission();
  const { organization } = useCurrentOrganization();
  const { has } = useOrganizationEntitlements(organization?.id ?? null);
  const { code, vocabulary, overrides } = useCurrentIndustry();

  return useMemo(
    () =>
      items
        .filter((item) => isVisible(item, has, code, can))
        .map((item) => withVocabulary(item, vocabulary, overrides)),
    [items, can, has, code, vocabulary, overrides],
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
  const { code, vocabulary, overrides } = useCurrentIndustry();

  return useMemo(() => {
    const visible: NavGroup[] = [];

    for (const group of groups) {
      const items = group.items
        .filter((item) => isVisible(item, has, code, can))
        .map((item) => withVocabulary(item, vocabulary, overrides));

      if (items.length > 0) visible.push({ ...group, items });
    }

    return visible;
  }, [groups, can, has, code, vocabulary, overrides]);
}
