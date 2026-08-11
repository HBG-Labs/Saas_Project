import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'bandwidth-transfer-calculator',
  category: 'networking',
  title: 'Calculateur de Bande Passante & Temps de Transfert',
  description: 'Estimation exacte de la durée de transfert de fichiers, calcul du débit utile net (overhead TCP/IP) et vitesse réseau requise.',
  keywords: ['réseau', 'bande passante', 'transfert', 'vitesse', 'téléchargement', 'débit', 'octets', 'gbps', 'mbps'],
  icon: 'Network',
  Component: lazy(() => import('./BandwidthTransferCalculatorTool')),
});
