import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'fiber-color-code',
  category: 'fiber-optics',
  title: 'Codes couleurs de fibre optique (6 à 3456 FO)',
  description: 'Identification instantanée des tubes et fibres optiques selon les normes Orange / France Télécom, TIA-598 et DIN 0888.',
  keywords: ['fibre', 'optique', 'couleur', 'code couleur', 'orange', 'ftth', 'tia-598', 'din', 'tube', 'épissure', 'câblage'],
  icon: 'Palette',
  Component: lazy(() => import('./FiberColorCodeTool')),
});
