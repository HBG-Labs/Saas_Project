import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'dbm-mw-converter',
  category: 'general',
  subcategory: 'converter',
  title: 'Convertisseur',
  description: 'Convertisseur universel multi-domaines : Puissance (dBm, W, dBW), Tension (V, dBu, dBµV), Courant (A, dBµA), Terminé (Z=50/75Ω), Intensité de champ (dBµV/m, W/m²) et Distances.',
  keywords: ['dbm', 'mw', 'milliwatt', 'watts', 'conversion', 'puissance', 'dbrf', 'vrms', 'volts', 'maths'],
  icon: 'Calculator',
  Component: lazy(() => import('./DbmMwConverterTool')),
});
