import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { applyStoredTheme } from '@/features/theme/theme-script';
import { purgeDemoStorage } from '@/lib/purge-demo-storage';
import '@/styles/index.css';

// Enregistre tous les outils présents dans src/tools/ (auto-découverte).
// Doit précéder le premier rendu : le catalogue lit le registry.
import '@/tools';

// Applique le thème AVANT le premier rendu, sans quoi la page s'afficherait
// brièvement en clair avant de basculer en sombre.
applyStoredTheme();

// Retire les données de démonstration laissées par les versions précédentes.
purgeDemoStorage();

const container = document.getElementById('root');

if (!container) {
  throw new Error('Élément #root introuvable : vérifiez index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
