import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'bandwidth-transfer-calculator',
  category: 'networking',
  title: 'Calculateur Débit Réseau',
  description: 'Calcul du débit utile net, estimation de la durée de transfert de fichiers et bande passante requise.',
  keywords: ['réseau', 'bande passante', 'transfert', 'vitesse', 'téléchargement', 'débit', 'octets', 'gbps', 'mbps'],
  icon: 'Network',
  Component: lazy(() => import('./BandwidthTransferCalculatorTool')),
});
