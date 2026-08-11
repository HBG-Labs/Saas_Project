import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'ip-mac-converter',
  category: 'networking',
  title: 'Convertisseur IP, MAC & Masque Wildcard ACL',
  description: 'Conversion binaire/hexadécimale d’IP, calcul de masque Wildcard pour ACL Cisco/OSPF et dérivation MAC Multicast.',
  keywords: ['ip', 'mac', 'wildcard', 'acl', 'cisco', 'binaire', 'hexadécimal', 'multicast', 'réseau', 'ospf'],
  icon: 'Network',
  Component: lazy(() => import('./IpMacConverterTool')),
});
