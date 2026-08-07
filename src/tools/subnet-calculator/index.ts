import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'subnet-calculator',
  category: 'networking',
  title: 'Calculateur de sous-réseau IP / CIDR',
  description: "Découpage de sous-réseau IPv4, calcul du masque, adresse réseau, broadcast et plages d'hôtes exploitables.",
  keywords: ['réseau', 'ip', 'ipv4', 'cidr', 'masque', 'subnet', 'broadcast', 'adressage'],
  icon: 'Network',
  Component: lazy(() => import('./SubnetCalculatorTool')),
});
