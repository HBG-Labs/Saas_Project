import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'dns-ttl-calculator',
  category: 'general',
  title: 'Planificateur de Migration DNS & TTL',
  description: 'Calculateur de délais de baisse de TTL avant migration de serveur, temps de propagation globale et générateur d’enregistrements DNS.',
  keywords: ['dns', 'ttl', 'réseau', 'migration', 'propagation', 'ip', 'a', 'aaaa', 'cname', 'spf', 'dmarc', 'mx'],
  icon: 'Network',
  Component: lazy(() => import('./DnsTtlCalculatorTool')),
});
