import {
  ArrowLeftRight,
  Box,
  Cable,
  Calculator,
  Clock,
  Cog,
  Droplets,
  Gauge,
  HardHat,
  Network,
  Palette,
  Percent,
  Puzzle,
  RadioTower,
  Ruler,
  Scale,
  Square,
  TrendingUp,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icônes des outils et catégories, indexées par nom.
 *
 * Les outils déclarent leur icône par une CHAÎNE (`icon: 'zap'`) plutôt que par
 * un composant : cela évite de coupler le registry à lucide-react, et permet à
 * la table `tools` de stocker la même valeur.
 *
 * Exposée comme constante et non comme fonction de résolution : un appel
 * renvoyant un composant déclenche `react-hooks/static-components`, le
 * compilateur React ne pouvant pas prouver la stabilité du résultat.
 *
 * Table explicite plutôt qu'import dynamique : seules ces icônes entrent dans
 * le bundle, au lieu des plusieurs centaines de la bibliothèque.
 */
const BASE_TOOL_ICONS = {
  'arrow-left-right': ArrowLeftRight,
  box: Box,
  cable: Cable,
  calculator: Calculator,
  clock: Clock,
  cog: Cog,
  droplets: Droplets,
  gauge: Gauge,
  'hard-hat': HardHat,
  network: Network,
  palette: Palette,
  percent: Percent,
  puzzle: Puzzle,
  'radio-tower': RadioTower,
  ruler: Ruler,
  scale: Scale,
  square: Square,
  'trending-up': TrendingUp,
  wrench: Wrench,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

/** `'hard-hat'` → `'HardHat'`, `'zap'` → `'Zap'`. */
function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Table de résolution, indexée sous DEUX formes.
 *
 * Les définitions d'outils déclarent leur icône en PascalCase (`icon: 'Calculator'`,
 * le nom du composant lucide), tandis que `config/categories.ts` et la colonne
 * `tools.icon` utilisent le kebab-case. Une table ne connaissant qu'une seule
 * forme renvoie silencieusement l'icône de repli pour l'autre — c'est
 * exactement le défaut qui faisait afficher une clé à molette à la totalité
 * des outils du catalogue.
 *
 * Les deux graphies sont donc dérivées d'une source unique : ajouter une icône
 * ne demande qu'une ligne dans `BASE_TOOL_ICONS`.
 */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  ...BASE_TOOL_ICONS,
  ...Object.fromEntries(
    Object.entries(BASE_TOOL_ICONS).map(([key, icon]) => [toPascalCase(key), icon]),
  ),
};

export const FALLBACK_TOOL_ICON: LucideIcon = Wrench;
