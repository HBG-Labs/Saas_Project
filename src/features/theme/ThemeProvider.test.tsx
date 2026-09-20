import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCENT_COLORS } from './accent-colors';
import {
  ACCENT_STORAGE_KEY,
  COMPACT_STORAGE_KEY,
  PRESET_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from './theme-context';
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
          setPreset('contraste-eleve');
        }}
      >
        Contraste
      </button>
      <button
        type="button"
        onClick={() => {
          setAccentColor('encre');
        }}
      >
        Accent Encre
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

  it('ramène un thème retiré vers l’ambiance signature de son mode', () => {
    /*
      Douze thèmes sont passés à trois. Le choix ne vivant que dans le
      navigateur, personne ne peut le corriger à distance : c'est au
      chargement suivant que la préférence doit être rattrapée.

      Un utilisateur en « Dracula » travaillait en SOMBRE. Le renvoyer vers le
      thème clair par défaut serait un changement brutal et inexplicable de sa
      part ; il atterrit donc sur Atelier Nuit.
    */
    mockSystemDark(false);
    localStorage.setItem(PRESET_STORAGE_KEY, 'dracula');

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('preset')).toHaveTextContent('atelier-nuit');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('ramène un thème clair retiré vers Atelier Jour', () => {
    mockSystemDark(true);
    localStorage.setItem(PRESET_STORAGE_KEY, 'arctic');

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('preset')).toHaveTextContent('default');
    expect(document.documentElement).not.toHaveClass('dark');
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

  it('bascule RÉELLEMENT en sombre, et pas seulement en intention', async () => {
    // LE TEST QUI MANQUAIT.
    //
    // « Sombre » appelait `setPreset('default')`. C'était juste tant que
    // `default` valait `baseMode: 'dark'` ; en devenant « Atelier Jour », il est
    // passé en clair, et le bouton a cessé de rien changer — sans erreur, sans
    // avertissement, les deux modes rendant exactement la même chose.
    //
    // Vérifier `theme` ne suffisait pas : c'est la CLASSE `dark` posée sur
    // <html> qui décide de ce que l'œil voit. On l'assert donc explicitement.
    mockSystemDark(false);
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Sombre' }));

    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement, 'la classe « dark » commande le rendu').toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    // Et le retour au clair doit la retirer.
    await user.click(screen.getByRole('button', { name: 'Clair' }));

    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('mène le basculeur vers les deux ambiances signature', async () => {
    // Le basculeur envoyait « Clair » sur le preset « light » (Épure Studio),
    // une ambiance du personnalisateur que personne n'avait choisie. Les deux
    // positions doivent atteindre Atelier Jour et Atelier Nuit.
    mockSystemDark(false);
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Sombre' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('atelier-nuit');

    await user.click(screen.getByRole('button', { name: 'Clair' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('default');
  });

  it('permet de changer de preset d’ambiance et d’accent de couleur', async () => {
    mockSystemDark(true);
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Contraste' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('contraste-eleve');

    await user.click(screen.getByRole('button', { name: 'Accent Encre' }));
    expect(screen.getByTestId('accent')).toHaveTextContent('encre');

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('default');
    expect(screen.getByTestId('accent')).toHaveTextContent('auto');
  });

  it('migre un accent retiré vers sa nuance, sans remise à zéro', () => {
    // Les neuf accents de couleur sont devenus neuf nuances de bleu. Sans table
    // de correspondance, `readStoredAccent` retombe sur `auto` : la personne qui
    // avait choisi « Violet Digital » perdrait son réglage au prochain
    // chargement, sans que rien ne l'explique.
    localStorage.setItem(ACCENT_STORAGE_KEY, 'purple');
    mockSystemDark(false);

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('accent')).toHaveTextContent('encre');
  });

  it('retombe sur « auto » pour un accent qui n’a jamais existé', () => {
    // Le repli doit rester, mais ne couvrir QUE les valeurs qu'on n'a jamais
    // écrites — sinon la migration ci-dessus ne servirait à rien.
    localStorage.setItem(ACCENT_STORAGE_KEY, 'chartreuse');
    mockSystemDark(false);

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('accent')).toHaveTextContent('auto');
  });

  it('sert à « Contraste élevé » son propre jeu d’accent, et non celui du clair', async () => {
    /*
      L'accent est appliqué APRÈS le preset, donc il l'écrase. Tant qu'il n'avait
      que deux jeux, personnaliser « Contraste élevé » y posait le bleu du thème
      clair : le thème d'accessibilité retombait au contraste ordinaire, sans
      erreur ni avertissement.
    */
    mockSystemDark(false);
    const user = userEvent.setup();
    const encre = ACCENT_COLORS.find((a) => a.id === 'encre');

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Contraste' }));
    await user.click(screen.getByRole('button', { name: 'Accent Encre' }));

    const applique = document.documentElement.style.getPropertyValue('--primary');
    expect(applique).toBe(encre?.contrastVariables['--primary']);
    expect(applique).not.toBe(encre?.lightVariables['--primary']);
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
