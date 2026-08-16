import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'copper-color-code',
  industry: ['fiber_telecom', 'it_networks'],
  category: 'telecom',
  title: 'Générateur Code Couleur Câble Cuivre Télécom',
  description: 'Repérage instantané des paires et couleurs de câbles cuivre télécom : 28 paires (4 amorces) et multipaires (8 à 720 paires).',
  keywords: [
    'cuivre',
    'télécom',
    'code couleur',
    'ptt 92',
    'multipaire',
    'paire',
    'fils',
    'amorce',
    'réseau',
    'cad',
  ],
  icon: 'Radio',
  Component: lazy(() => import('./CopperColorCodeTool')),
});
