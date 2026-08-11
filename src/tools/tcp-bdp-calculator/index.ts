import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'tcp-bdp-calculator',
  category: 'networking',
  title: 'Calculateur de BDP & Fenêtre TCP',
  description: 'Calcul du produit Bande Passante x Délai (BDP), dimensionnement de tampon TCP Window Size et débit max théorique.',
  keywords: ['tcp', 'bdp', 'réseau', 'latence', 'rtt', 'buffer', 'window size', 'débit', 'wan', 'satellite'],
  icon: 'Network',
  Component: lazy(() => import('./TcpBdpCalculatorTool')),
});
