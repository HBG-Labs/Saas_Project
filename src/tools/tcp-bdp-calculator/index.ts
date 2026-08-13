import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'tcp-bdp-calculator',
  category: 'networking',
  title: 'Calculateur PoE',
  description: 'Calcul d’alimentation PoE / PoE+ / PoE++ (802.3af/at/bt), bilan de consommation et chute de tension sur câble RJ45.',
  keywords: ['tcp', 'bdp', 'réseau', 'latence', 'rtt', 'buffer', 'window size', 'débit', 'wan', 'satellite'],
  icon: 'Network',
  Component: lazy(() => import('./TcpBdpCalculatorTool')),
});
