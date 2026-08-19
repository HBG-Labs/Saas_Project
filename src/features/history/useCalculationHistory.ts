import { useCallback, useState } from 'react';

import { FEATURES, useUserEntitlements } from '@/features/billing';

import { type HistoryEntry } from './types';

const STORAGE_KEY = 'rezo360_calculation_history_v1';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CET HISTORIQUE RESTE LOCAL
 *
 * À ne pas confondre avec `tool_history`, qui vit bien en base et alimente la
 * page Historique : cette table consigne QUELS outils ont été ouverts, pas ce
 * qu'ils ont calculé. Elle n'a pas de colonne pour un résultat.
 *
 * Le ruban ci-dessous garde les CALCULS eux-mêmes — saisies et résultats — au
 * fil d'une session de travail. Deux raisons de ne pas le déplacer :
 *
 *   • il doit fonctionner hors ligne. Un technicien en gaine technique ou en
 *     sous-sol n'a pas de réseau, et c'est précisément là qu'il calcule ;
 *   • une écriture réseau par touche de calculatrice serait absurde.
 *
 * Le déplacer en base demanderait une table dédiée avec une charge utile
 * `jsonb`. Tant que ce besoin n'est pas exprimé, le stockage local est le bon
 * choix — assumé, pas subi.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Lecture de l'historique persisté.
 *
 * Appelée comme initialiseur paresseux de `useState` plutôt que depuis un effet
 * de montage : écrire l'état dans un effet provoquait un second rendu immédiat
 * à chaque montage — l'historique s'affichait vide puis se remplissait. Le
 * `localStorage` étant synchrone, rien ne justifie de différer sa lecture.
 */
function readStoredEntries(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function useCalculationHistory(toolSlug?: string) {
  const [entries, setEntries] = useState<HistoryEntry[]>(readStoredEntries);

  // Le plan vient du serveur. Il n'est plus modifiable depuis l'interface :
  // c'était une auto-attribution de droits déguisée en sélecteur de test.
  const { planCode, limit: featureLimit } = useUserEntitlements();

  // `null` signifie « illimité » côté entitlements ; le reste du hook raisonne
  // en `Infinity`, plus commode pour comparer et tronquer.
  const rawLimit = featureLimit(FEATURES.calculationHistory);
  const limit = rawLimit === null ? Infinity : rawLimit;

  // Sauvegarde dans localStorage à chaque mise à jour
  const persistEntries = useCallback((newEntries: HistoryEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    } catch {
      // Ignore les erreurs de quota localStorage
    }
  }, []);

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

  // Exprimé à partir de la limite effective plutôt que d'un test sur le nom du
  // plan : ajouter une offre intermédiaire ne demandera pas de repasser ici.
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
    /** Lecture seule : `setUserPlan` n'existe plus, volontairement. */
    userPlan: planCode,
    maxLimit: limit,
    isLimitReached,
  };
}
