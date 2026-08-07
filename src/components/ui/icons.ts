import { Cable, Calculator, Network, Puzzle, Wrench, Zap, type LucideIcon } from 'lucide-react';

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
export const TOOL_ICONS: Record<string, LucideIcon> = {
  cable: Cable,
  calculator: Calculator,
  network: Network,
  puzzle: Puzzle,
  wrench: Wrench,
  zap: Zap,
};

export const FALLBACK_TOOL_ICON: LucideIcon = Wrench;
