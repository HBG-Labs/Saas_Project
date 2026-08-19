import { useCallback, useState } from 'react';

import type { AiSearchHistoryItem } from '../types/ai.types';

const STORAGE_PREFIX = 'rezo_ai_search_history_';
const MAX_HISTORY_ITEMS = 30;

export function useAiSearchHistory(organizationId: string) {
  const storageKey = `${STORAGE_PREFIX}${organizationId}`;

  const [history, setHistory] = useState<AiSearchHistoryItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as AiSearchHistoryItem[];
      }
      return [];
    } catch {
      return [];
    }
  });

  const addEntry = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      setHistory((prev) => {
        const filtered = prev.filter(
          (item) => item.query.toLowerCase() !== trimmed.toLowerCase(),
        );
        const newItem: AiSearchHistoryItem = {
          id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          query: trimmed,
          timestamp: new Date().toISOString(),
        };
        const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // Ignore storage quota errors
        }
        return updated;
      });
    },
    [storageKey],
  );

  const removeEntry = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });
    },
    [storageKey],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }, [storageKey]);

  return {
    history,
    addEntry,
    removeEntry,
    clearHistory,
  };
}
