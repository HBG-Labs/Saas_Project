import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'rezo360:metiers_favorites';
const EVENT_NAME = 'rezo360:metiers-favorites-updated';

function getStoredFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveStoredFavorites(favs: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: favs }));
  } catch {
    // Ignore storage errors
  }
}

export function useMetierFavorites() {
  const [favorites, setFavorites] = useState<string[]>(getStoredFavorites);

  useEffect(() => {
    const handleSync = () => {
      setFavorites(getStoredFavorites());
    };

    window.addEventListener(EVENT_NAME, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(EVENT_NAME, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const isFavorite = useCallback(
    (toolSlug: string) => favorites.includes(toolSlug),
    [favorites],
  );

  const toggleFavorite = useCallback((toolSlug: string) => {
    const current = getStoredFavorites();
    const next = current.includes(toolSlug)
      ? current.filter((s) => s !== toolSlug)
      : [...current, toolSlug];
    saveStoredFavorites(next);
    setFavorites(next);
  }, []);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
  };
}
