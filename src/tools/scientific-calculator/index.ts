import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'scientific-calculator',
  category: 'general',
  subcategory: 'calculator',
  title: 'Calculatrice Scientifique',
  description: 'Calculatrice scientifique complète : trigonométrie (deg/rad), logarithmes, puissances, factorielle et fonctions mathématiques.',
  keywords: ['calculatrice', 'scientifique', 'trigonométrie', 'sin', 'cos', 'tan', 'log', 'ln', 'racine', 'puissance', 'factorielle', 'maths'],
  icon: 'Calculator',
  Component: lazy(() => import('./ScientificCalculatorTool')),
});
