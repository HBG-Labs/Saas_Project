import { useCallback, useContext, useState } from 'react';

import { AuthContext } from '@/features/auth';
import type { CalculationHistoryEntry } from '../types/tools.types';

const MAX_HISTORY_ENTRIES = 50;

function getStorageKey(userId: string | null | undefined): string {
  if (!userId) return 'rezo360_tools_history_anonymous';
  return `rezo360_tools_history_${userId}`;
}

function readStoredHistory(key: string): CalculationHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CalculationHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function useToolHistory() {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id ?? null;
  const storageKey = getStorageKey(userId);

  const [history, setHistory] = useState<CalculationHistoryEntry[]>(() =>
    readStoredHistory(storageKey),
  );

  /*
    Changement de compte : l'historique doit repartir de celui du nouvel
    utilisateur, jamais rester sur celui du précédent.

    C'est le patron « ajuster un état quand une prop change » : la remise à
    niveau se fait PENDANT le rendu, pas dans un effet. Dans un effet, React
    peignait d'abord l'historique de l'ancien compte, puis le remplaçait au
    rendu suivant — un rendu en cascade, et un instant où l'écran affichait les
    données de quelqu'un d'autre.
  */
  const [cleLue, setCleLue] = useState(storageKey);
  if (cleLue !== storageKey) {
    setCleLue(storageKey);
    setHistory(readStoredHistory(storageKey));
  }

  const persistHistory = useCallback(
    (items: CalculationHistoryEntry[]) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(items));
      } catch {
        // Ignore quota errors
      }
    },
    [storageKey],
  );

  const addHistoryEntry = useCallback(
    (entry: Omit<CalculationHistoryEntry, 'id' | 'timestamp'>) => {
      const newItem: CalculationHistoryEntry = {
        ...entry,
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        // Supprimer les doublons très rapprochés ou identiques récents
        const filtered = prev.filter(
          (item) =>
            !(
              item.toolSlug === entry.toolSlug &&
              item.summary === entry.summary &&
              Date.now() - item.timestamp < 3000
            ),
        );
        const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ENTRIES);
        persistHistory(updated);
        return updated;
      });
    },
    [persistHistory],
  );

  const removeHistoryEntry = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        persistHistory(updated);
        return updated;
      });
    },
    [persistHistory],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }, [storageKey]);

  return {
    history,
    addHistoryEntry,
    removeHistoryEntry,
    clearHistory,
  };
}
