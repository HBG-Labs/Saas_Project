import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'subnet-calculator',
  industry: ['fiber_telecom', 'it_networks'],
  category: 'networking',
  title: 'Calculateur IPv4 / CIDR',
  description: "Découpage de sous-réseau IPv4, calcul du masque, adresse réseau, broadcast et plages d'hôtes exploitables.",
  keywords: ['réseau', 'ip', 'ipv4', 'cidr', 'masque', 'subnet', 'broadcast', 'adressage'],
  icon: 'Network',
  Component: lazy(() => import('./SubnetCalculatorTool')),
});
