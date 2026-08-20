import { useCallback, useState } from 'react';
import type { CalculationHistoryEntry } from '../types/tools.types';

const STORAGE_KEY = 'rezo360_tools_history_v1';
const MAX_HISTORY_ENTRIES = 50;

function readStoredHistory(): CalculationHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CalculationHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function useToolHistory() {
  const [history, setHistory] = useState<CalculationHistoryEntry[]>(readStoredHistory);

  const persistHistory = useCallback((items: CalculationHistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota errors
    }
  }, []);

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
          (item) => !(item.toolSlug === entry.toolSlug && item.summary === entry.summary && Date.now() - item.timestamp < 3000),
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    history,
    addHistoryEntry,
    removeHistoryEntry,
    clearHistory,
  };
}
