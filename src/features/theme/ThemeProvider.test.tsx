import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COMPACT_STORAGE_KEY, THEME_STORAGE_KEY } from './theme-context';
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
  const {
    theme,
    resolvedTheme,
    preset,
    accentColor,
    compactMode,
    setTheme,
    setPreset,
    setAccentColor,
    setCompactMode,
    resetCustomization,
  } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="preset">{preset}</span>
      <span data-testid="accent">{accentColor}</span>
      <span data-testid="compact">{String(compactMode)}</span>
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
          setTheme('light');
        }}
      >
        Clair
      </button>
      <button
        type="button"
        onClick={() => {
          setPreset('luxury');
        }}
      >
        Luxe
      </button>
      <button
        type="button"
        onClick={() => {
          setAccentColor('purple');
        }}
      >
        Accent Violet
      </button>
      <button
        type="button"
        onClick={() => {
          setCompactMode(true);
        }}
      >
        Activer Compact
      </button>
      <button
        type="button"
        onClick={() => {
          setCompactMode(false);
        }}
      >
        Désactiver Compact
      </button>
      <button
        type="button"
        onClick={() => {
          resetCustomization();
        }}
      >
        Reset
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.classList.remove('compact-mode');
  document.documentElement.removeAttribute('data-density');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  // Le thème par défaut est celui du preset signature « Atelier Jour », qui est
  // clair : l'application se lit d'abord en plein jour. Le système en sombre ne
  // le renverse pas — sans quoi le premier rendu et le preset se
  // contrediraient, et l'écran flasherait au démarrage.
  it('applique le thème clair par défaut, même sur un système en sombre', () => {
    mockSystemDark(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(screen.getByTestId('compact')).toHaveTextContent('false');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('compact-mode');
  });

  it('applique et persiste un choix explicite', async () => {
    mockSystemDark(false);
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Clair' }));

    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('permet de changer de preset d’ambiance et d’accent de couleur', async () => {
    mockSystemDark(true);
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Luxe' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('luxury');

    await user.click(screen.getByRole('button', { name: 'Accent Violet' }));
    expect(screen.getByTestId('accent')).toHaveTextContent('purple');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('default');
    expect(screen.getByTestId('accent')).toHaveTextContent('auto');
  });

  it('permet d’activer et de persister le mode compact haute densité', async () => {
    mockSystemDark(true);
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('compact')).toHaveTextContent('false');
    expect(document.documentElement).not.toHaveClass('compact-mode');

    await user.click(screen.getByRole('button', { name: 'Activer Compact' }));

    expect(screen.getByTestId('compact')).toHaveTextContent('true');
    expect(document.documentElement).toHaveClass('compact-mode');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(localStorage.getItem(COMPACT_STORAGE_KEY)).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('compact')).toHaveTextContent('false');
    expect(document.documentElement).not.toHaveClass('compact-mode');
  });

  it('reste utilisable si localStorage est inaccessible', () => {
    mockSystemDark(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('accès refusé');
    });

    expect(() =>
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      ),
    ).not.toThrow();

    // Stockage inaccessible : on retombe sur le preset par défaut, donc clair.
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });
});


