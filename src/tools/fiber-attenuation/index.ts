import { lazy } from 'react';
import { defineTool } from '@/features/tools/registry';

export default defineTool({
  slug: 'fiber-attenuation',
  category: 'fiber-optics',
  order: 2,
  title: "Bilan d'atténuation fibre optique",
  description: "Calcul du bilan d'atténuation optique FTTH/Monomode (perte linéique, épissures, connecteurs et marge ISO 11801).",
  keywords: ['fibre', 'optique', 'atténuation', 'ftth', 'itu-t', 'db', 'monomode', 'réflectométrie'],
  icon: 'Cable',
  Component: lazy(() => import('./FiberAttenuationTool')),
});
