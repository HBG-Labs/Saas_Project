import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEphemeralFlag, useEphemeralValue } from './use-ephemeral-flag';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useEphemeralFlag', () => {
  it('se lève au déclenchement puis retombe seul', () => {
    const { result } = renderHook(() => useEphemeralFlag(2000));

    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBe(false);
  });

  it('repart de zéro à chaque déclenchement', () => {
    // Sans annulation du minuteur précédent, une seconde pression verrait
    // l'indicateur s'éteindre avant la fin de son propre délai.
    const { result } = renderHook(() => useEphemeralFlag(2000));

    act(() => {
      result.current[1]();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      result.current[1]();
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current[0]).toBe(true);
  });

  it('se rabaisse immédiatement sur demande', () => {
    const { result } = renderHook(() => useEphemeralFlag(5000));

    act(() => {
      result.current[1]();
    });
    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe(false);
  });

  it('n’écrit plus rien après démontage', () => {
    // C'est le défaut d'origine : vingt-cinq composants laissaient un minuteur
    // courir et tentaient une mise à jour d'état sur un composant démonté.
    const erreurs: unknown[] = [];
    const espion = vi.spyOn(console, 'error').mockImplementation((...args) => {
      erreurs.push(args);
    });

    const { result, unmount } = renderHook(() => useEphemeralFlag(2000));
    act(() => {
      result.current[1]();
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(erreurs).toHaveLength(0);
    espion.mockRestore();
  });
});

describe('useEphemeralValue', () => {
  it('porte une valeur puis revient à null', () => {
    const { result } = renderHook(() => useEphemeralValue<string>(3000));

    expect(result.current[0]).toBeNull();

    act(() => {
      result.current[1]('adresse');
    });
    expect(result.current[0]).toBe('adresse');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current[0]).toBeNull();
  });

  it('remplace la valeur en cours sans que l’ancien minuteur ne l’efface', () => {
    const { result } = renderHook(() => useEphemeralValue<string>(2000));

    act(() => {
      result.current[1]('premier');
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      result.current[1]('second');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current[0]).toBe('second');
  });
});
