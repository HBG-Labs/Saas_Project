import { useCallback, useEffect, useState } from 'react';

export interface MetierHistoryEntry {
  id: string;
  tradeSlug: string;
  toolSlug: string;
  toolTitle: string;
  result: string;
  summary: string;
  timestamp: string;
}

const STORAGE_KEY = 'rezo360:metiers_history';
const MAX_HISTORY = 30;

function getStoredHistory(): MetierHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredHistory(entries: MetierHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // Ignore storage errors
  }
}

export function useMetierHistory() {
  const [history, setHistory] = useState<MetierHistoryEntry[]>(getStoredHistory);

  useEffect(() => {
    setHistory(getStoredHistory());
  }, []);

  const addHistoryEntry = useCallback(
    (entry: Omit<MetierHistoryEntry, 'id' | 'timestamp'>) => {
      const newEntry: MetierHistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };
      const updated = [newEntry, ...getStoredHistory().filter((e) => e.result !== entry.result || e.toolSlug !== entry.toolSlug)].slice(0, MAX_HISTORY);
      saveStoredHistory(updated);
      setHistory(updated);
    },
    [],
  );

  const clearHistory = useCallback(() => {
    saveStoredHistory([]);
    setHistory([]);
  }, []);

  const removeHistoryEntry = useCallback((id: string) => {
    const updated = getStoredHistory().filter((e) => e.id !== id);
    saveStoredHistory(updated);
    setHistory(updated);
  }, []);

  return {
    history,
    addHistoryEntry,
    clearHistory,
    removeHistoryEntry,
  };
}
