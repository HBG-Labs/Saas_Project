import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'dbm-mw-converter',
  category: 'general',
  title: 'Convertisseur dBm ↔ Milliwatts (mW)',
  description: 'Conversion bidirectionnelle de puissance optique et radiofréquence (dBm, mW, Watts) et calcul de la tension RMS sous 50 Ω.',
  keywords: ['dbm', 'mw', 'milliwatt', 'watts', 'conversion', 'puissance', 'dbrf', 'vrms', 'volts', 'maths'],
  icon: 'Calculator',
  Component: lazy(() => import('./DbmMwConverterTool')),
});
