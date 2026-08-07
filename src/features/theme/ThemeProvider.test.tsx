import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_STORAGE_KEY } from './theme-context';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';

/** Contrôle `prefers-color-scheme` pour l'ensemble d'un test. */
function mockSystemDark(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: vi.fn(),
    }),
  });

  return listeners;
}

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button
        type="button"
        onClick={() => {
          setTheme('dark');
        }}
      >
        Sombre
      </button>
      <button
        type="button"
        onClick={() => {
          setTheme('system');
        }}
      >
        Système
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('suit la préférence système par défaut', () => {
    mockSystemDark(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('applique et persiste un choix explicite', async () => {
    mockSystemDark(false);
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(screen.getByRole('button', { name: 'Sombre' }));

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('réagit au changement système uniquement en mode « system »', async () => {
    const listeners = mockSystemDark(false);
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    // Choix explicite « sombre » : le système ne doit plus primer.
    await user.click(screen.getByRole('button', { name: 'Sombre' }));
    for (const listener of listeners) {
      listener({ matches: false } as MediaQueryListEvent);
    }
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');

    // Retour en mode « system » : le réglage de l'OS reprend la main.
    await user.click(screen.getByRole('button', { name: 'Système' }));
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
  });

  it('reste utilisable si localStorage est inaccessible', () => {
    mockSystemDark(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('accès refusé');
    });

    // Ne doit pas interrompre le démarrage : une préférence d'affichage ne
    // justifie pas de casser l'application.
    expect(() =>
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      ),
    ).not.toThrow();

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
  });
});
