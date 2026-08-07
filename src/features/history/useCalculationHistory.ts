import { useCallback, useEffect, useState } from 'react';
import { type HistoryEntry, PLAN_HISTORY_LIMITS, type PlanTier } from './types';

const STORAGE_KEY = 'nexoratech_calculation_history_v1';

export function useCalculationHistory(toolSlug?: string) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [userPlan, setUserPlan] = useState<PlanTier>('free');

  // Chargement initial depuis localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryEntry[];
        setEntries(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setEntries([]);
    }
  }, []);

  // Sauvegarde dans localStorage à chaque mise à jour
  const persistEntries = useCallback((newEntries: HistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    } catch {
      // Ignore les erreurs de quota localStorage
    }
  }, []);

  const limit = PLAN_HISTORY_LIMITS[userPlan];

  const addEntry = useCallback(
    (item: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
      const newEntry: HistoryEntry = {
        ...item,
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
      };

      setEntries((prev) => {
        const updated = [newEntry, ...prev];
        // Troncature selon le plan tarifaire actif
        const clamped = limit === Infinity ? updated : updated.slice(0, limit);
        persistEntries(clamped);
        return clamped;
      });
    },
    [limit, persistEntries],
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const filtered = prev.filter((item) => item.id !== id);
        persistEntries(filtered);
        return filtered;
      });
    },
    [persistEntries],
  );

  const clearHistory = useCallback(() => {
    setEntries([]);
    persistEntries([]);
  }, [persistEntries]);

  // Filtrage optionnel par outil
  const filteredEntries = toolSlug
    ? entries.filter((item) => item.toolSlug === toolSlug)
    : entries;

  const isLimitReached = userPlan === 'free' && filteredEntries.length >= PLAN_HISTORY_LIMITS.free;

  const exportCsv = useCallback(() => {
    if (filteredEntries.length === 0) return;

    const headers = 'ID,Date,Outil,Expression,Resultat\n';
    const rows = filteredEntries
      .map(
        (e) =>
          `"${e.id}","${new Date(e.timestamp).toLocaleString('fr-FR')}","${e.toolTitle}","${e.expression.replace(/"/g, '""')}","${e.formattedResult}"`,
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexoratech_historique_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredEntries]);

  return {
    entries: filteredEntries,
    allEntries: entries,
    addEntry,
    removeEntry,
    clearHistory,
    exportCsv,
    userPlan,
    setUserPlan,
    maxLimit: limit,
    isLimitReached,
  };
}
