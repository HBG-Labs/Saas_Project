import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'ohm-law',
  industry: ['electrical', 'hvac', 'heating'],
  category: 'electrical',
  title: "Calculateur Loi d'Ohm",
  description: "Calcul instantané de la tension U (V), l'intensité I (A) et la résistance R (Ω) avec conversion automatique des unités.",
  keywords: [
    'ohm',
    'loi d\'ohm',
    'tension',
    'intensité',
    'courant',
    'résistance',
    'volt',
    'ampère',
    'électricité',
    'u=ri',
    'nf c 15-100',
  ],
  icon: 'Zap',
  Component: lazy(() => import('./OhmLawTool')),
});
