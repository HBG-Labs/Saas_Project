import { useMemo } from 'react';

import { pluralize, type IndustryCode, type IndustryVocabulary } from '@/config/industries';
import { useOrganizationEntitlements, type FeatureKey } from '@/features/billing';
import { useCurrentIndustry } from '@/features/industries';
import type { NavGroup, NavItem, ResolvedNavGroup } from '@/config/navigation';

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
 * Cette destination CONCERNE-T-ELLE cette personne ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEUX SORTES D'INDISPONIBILITÉ, QU'IL NE FAUT PAS CONFONDRE
 *
 * Ce prédicat ne juge que le métier et le rôle — jamais l'abonnement. La
 * distinction commande tout l'affichage du menu :
 *
 *   • MÉTIER ou RÔLE manquant → l'entrée est RETIRÉE. La personne ne peut rien
 *     y faire : un technicien ne « débloquera » pas la facturation, et un
 *     paysagiste n'a que faire d'un calculateur de charge électrique. Un
 *     cadenas ici ne serait qu'un reproche, et il renseignerait au passage sur
 *     l'organisation du travail des autres.
 *
 *   • FORMULE insuffisante → l'entrée RESTE, cadenassée. Là, il y a quelque
 *     chose à faire, et la cacher revient à cacher le produit : un patron qui
 *     ignore que le module Devis existe ne l'achètera jamais.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Prédicat partagé plutôt que dupliqué dans les deux hooks : deux copies du
 * même filtre divergent toujours, et c'est le menu entier qui en dépend.
 */
function concerne(
  item: NavItem,
  industry: IndustryCode,
  can: (permission: Permission) => boolean,
): boolean {
  if (item.industry !== undefined) {
    const allowed = Array.isArray(item.industry) ? item.industry : [item.industry];
    if (!allowed.includes(industry)) return false;
  }

  if (item.permission !== undefined && !can(item.permission as Permission)) return false;

  return true;
}

/** La formule en cours inclut-elle cette destination ? */
function estOuverte(item: NavItem, has: (feature: FeatureKey) => boolean): boolean {
  return item.feature === undefined || has(item.feature as FeatureKey);
}

/** Les deux conditions réunies — ce qui est réellement atteignable aujourd'hui. */
function isVisible(
  item: NavItem,
  has: (feature: FeatureKey) => boolean,
  industry: IndustryCode,
  can: (permission: Permission) => boolean,
): boolean {
  return estOuverte(item, has) && concerne(item, industry, can);
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
 * Les sections du menu, entrées verrouillées COMPRISES.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE HOOK NE FILTRE PAS SUR L'ABONNEMENT, CONTRAIREMENT AU PRÉCÉDENT
 *
 * Un menu qui cache ce que la formule n'inclut pas décrit l'abonnement, pas le
 * produit. L'utilisateur ne découvre l'existence du module Devis, du stock ou
 * du planning qu'en tombant dessus par hasard — et le plus souvent, jamais.
 *
 * Les entrées hors formule sont donc conservées et marquées `locked`. Le clic
 * reste actif à dessein : la route est gardée par `RequirePlan`, qui nomme la
 * formule requise, son prix, et propose la mise à niveau. C'est une meilleure
 * explication que tout ce qu'une barre latérale de 240 px pourrait afficher.
 *
 * `useVisibleNavItems`, lui, continue de filtrer : il sert la barre basse
 * mobile, qui n'a que cinq places et dont chacune doit mener quelque part.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un groupe dont plus aucune entrée ne survit disparaît avec son intitulé : un
 * « Ressources » vide n'informe de rien, et laisse croire à une panne. Un
 * groupe entièrement verrouillé, en revanche, reste affiché — c'est justement
 * ce qu'on veut montrer.
 *
 * Un seul hook plutôt qu'un `useVisibleNavItems` par groupe : appeler un hook
 * dans une boucle romprait l'ordre des hooks dès qu'un groupe serait ajouté
 * sous condition.
 */
export function useVisibleNavGroups(groups: readonly NavGroup[]): readonly ResolvedNavGroup[] {
  const { can } = usePermission();
  const { organization } = useCurrentOrganization();
  const { has } = useOrganizationEntitlements(organization?.id ?? null);
  const { code, vocabulary, overrides } = useCurrentIndustry();

  return useMemo(() => {
    const visible: ResolvedNavGroup[] = [];

    for (const group of groups) {
      const items = group.items
        .filter((item) => concerne(item, code, can))
        .map((item) => ({
          ...withVocabulary(item, vocabulary, overrides),
          locked: !estOuverte(item, has),
        }))
        // Cadenassées en dernier, dans le volet. `sort` est stable : l'ordre
        // métier déclaré dans `navigation.ts` reste intact à l'intérieur de
        // chacun des deux groupes — seule la frontière accessible/verrouillé
        // se déplace en fin de liste.
        .sort((a, b) => Number(a.locked) - Number(b.locked));

      if (items.length > 0) visible.push({ ...group, items });
    }

    return visible;
  }, [groups, can, has, code, vocabulary, overrides]);
}
