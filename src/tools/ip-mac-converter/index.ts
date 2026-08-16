import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'ip-mac-converter',
  industry: ['fiber_telecom', 'it_networks'],
  category: 'networking',
  title: 'Convertisseur IP Binaire',
  description: 'Conversion d’adresses IP en binaire (32 bits), hexadécimal, masques réseaux et dérivations Wildcard.',
  keywords: ['ip', 'mac', 'wildcard', 'acl', 'cisco', 'binaire', 'hexadécimal', 'multicast', 'réseau', 'ospf'],
  icon: 'Network',
  Component: lazy(() => import('./IpMacConverterTool')),
});
