import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'ipv6-subnet-calculator',
  category: 'networking',
  title: 'Calculateur & Compresseur IPv6',
  description: 'Expansion, compression RFC 5952, analyse de sous-réseaux IPv6, conversion MAC vers EUI-64 et type d’adresse.',
  keywords: ['ipv6', 'réseau', 'eui-64', 'compression', 'adressage', 'prefix', 'mac', 'unicast', 'multicast'],
  icon: 'Network',
  Component: lazy(() => import('./IPv6SubnetCalculatorTool')),
});
