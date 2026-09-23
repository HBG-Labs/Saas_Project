import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Démonte les composants entre les tests : sans cela, les rendus s'accumulent
// dans le même document et les requêtes par texte deviennent ambiguës.
afterEach(() => {
  cleanup();
});

// jsdom n'implémente pas le défilement ; les changements de route l'appellent.
// Éviter ses messages asynchrones pendant la fermeture des workers Vitest.
window.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// jsdom n'implémente pas matchMedia, utilisé par les requêtes de préférences
// système (prefers-reduced-motion, thème).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// Radix mesure certains panneaux et menus avec ResizeObserver, absent de jsdom.
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class ResizeObserverMock {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  },
});
