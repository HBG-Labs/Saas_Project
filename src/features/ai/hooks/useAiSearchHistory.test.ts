import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AiSearchHistoryItem } from '../types/ai.types';

import { useAiSearchHistory } from './useAiSearchHistory';

describe('useAiSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initialise avec un historique vide si rien en localStorage', () => {
    const { result } = renderHook(() => useAiSearchHistory('org-1'));
    expect(result.current.history).toEqual([]);
  });

  it('ajoute une recherche dans l’historique et la persiste', () => {
    const { result } = renderHook(() => useAiSearchHistory('org-1'));

    act(() => {
      result.current.addEntry('Vérifier les interventions en retard');
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]?.query).toBe('Vérifier les interventions en retard');

    // Vérifie la persistance dans localStorage
    const saved = JSON.parse(
      localStorage.getItem('rezo_ai_search_history_org-1') || '[]',
    ) as AiSearchHistoryItem[];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.query).toBe('Vérifier les interventions en retard');
  });

  it('dédoublonne les requêtes identiques et place la plus récente en premier', () => {
    const { result } = renderHook(() => useAiSearchHistory('org-1'));

    act(() => {
      result.current.addEntry('Question 1');
      result.current.addEntry('Question 2');
      result.current.addEntry('Question 1');
    });

    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0]?.query).toBe('Question 1');
    expect(result.current.history[1]?.query).toBe('Question 2');
  });

  it('permet de supprimer un élément individuel de l’historique', () => {
    const { result } = renderHook(() => useAiSearchHistory('org-1'));

    act(() => {
      result.current.addEntry('Question A');
      result.current.addEntry('Question B');
    });

    const itemToDelete = result.current.history.find((i) => i.query === 'Question A');
    expect(itemToDelete).toBeDefined();

    act(() => {
      if (itemToDelete) {
        result.current.removeEntry(itemToDelete.id);
      }
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]?.query).toBe('Question B');
  });

  it('permet de vider complètement l’historique', () => {
    const { result } = renderHook(() => useAiSearchHistory('org-1'));

    act(() => {
      result.current.addEntry('Question A');
      result.current.addEntry('Question B');
    });

    expect(result.current.history).toHaveLength(2);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(localStorage.getItem('rezo_ai_search_history_org-1')).toBeNull();
  });
});
