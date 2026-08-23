import { useCallback, useContext, useState } from 'react';

import { AuthContext } from '@/features/auth';
import { FEATURES, useUserEntitlements } from '@/features/billing';

import { type HistoryEntry } from './types';

function getStorageKey(userId: string | null | undefined): string {
  if (!userId) return 'rezo360_calculation_history_anonymous';
  return `rezo360_calculation_history_${userId}`;
}

/**
 * Lecture de l'historique persisté pour la clé de compte donnée.
 */
function readStoredEntries(key: string): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function useCalculationHistory(toolSlug?: string) {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id ?? null;
  const storageKey = getStorageKey(userId);

  const [entries, setEntries] = useState<HistoryEntry[]>(() => readStoredEntries(storageKey));

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
    setEntries(readStoredEntries(storageKey));
  }

  // Le plan vient du serveur. Il n'est plus modifiable depuis l'interface
  const { planCode, limit: featureLimit } = useUserEntitlements();

  const rawLimit = featureLimit(FEATURES.calculationHistory);
  const limit = rawLimit === null ? Infinity : rawLimit;

  // Sauvegarde dans localStorage pour le compte actif
  const persistEntries = useCallback(
    (newEntries: HistoryEntry[]) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(newEntries));
      } catch {
        // Ignore les erreurs de quota localStorage
      }
    },
    [storageKey],
  );

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
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }, [storageKey]);

  // Filtrage optionnel par outil
  const filteredEntries = toolSlug
    ? entries.filter((item) => item.toolSlug === toolSlug)
    : entries;

  const isLimitReached = limit !== Infinity && filteredEntries.length >= limit;

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
    link.download = `rezo360_historique_${new Date().toISOString().slice(0, 10)}.csv`;
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
    userPlan: planCode,
    maxLimit: limit,
    isLimitReached,
  };
}
