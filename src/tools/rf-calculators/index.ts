import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'rf-calculators',
  category: 'general',
  subcategory: 'calculator',
  title: 'Calculatrices RF & Radiofréquences',
  description: 'Suite complète de 13 calculatrices RF & Télécoms : Longueur d’onde (λ), FSPL, Atténuateurs Pi/Tee, Budget Lien, Résonance LC, ROS/SWR, Rho, Return Loss, Mismatch, Puissance rayonnée, Ligne de transmission, EIRP/ERP et Zone de Fresnel.',
  keywords: [
    'rf',
    'radiofrequence',
    'calculatrices',
    'longueur d onde',
    'lambda',
    'fspl',
    'attenuateurs',
    'budget lien',
    'rssi',
    'resonance',
    'ros',
    'swr',
    'rho',
    'return loss',
    'mismatch',
    'eirp',
    'erp',
    'fresnel',
    'telecoms',
  ],
  icon: 'Radio',
  Component: lazy(() => import('./RfCalculatorsTool')),
});
