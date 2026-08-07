import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import '@/styles/index.css';

// Enregistre tous les outils présents dans src/tools/ (auto-découverte).
// Cet import doit précéder le premier rendu : le catalogue lit le registry.
import '@/tools';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Élément #root introuvable : vérifiez index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
