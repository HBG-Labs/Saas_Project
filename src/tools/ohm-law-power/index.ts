import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'ohm-law-power',
  category: 'electrical',
  title: "Loi d'Ohm & Puissance UTE",
  description: 'Calcul de puissance active, apparente, réactive et chute de tension en Monophasé et Triphasé (UTE C 15-105).',
  keywords: ['électricité', 'ohm', 'puissance', 'triphasé', 'tension', 'ampère', 'ute', 'chute de tension', 'kva', 'kw'],
  icon: 'Zap',
  Component: lazy(() => import('./OhmLawPowerTool')),
});
