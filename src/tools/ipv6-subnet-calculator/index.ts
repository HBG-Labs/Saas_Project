import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'ipv6-subnet-calculator',
  category: 'networking',
  title: 'Calculateur VLAN',
  description: 'Planification des VLANs (802.1Q), découpage de sous-réseaux virtuels et étiquetage de trames.',
  keywords: ['ipv6', 'réseau', 'eui-64', 'compression', 'adressage', 'prefix', 'mac', 'unicast', 'multicast'],
  icon: 'Network',
  Component: lazy(() => import('./IPv6SubnetCalculatorTool')),
});
