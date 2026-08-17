import { useState, useEffect, useCallback } from 'react';
import type { HolidayTerritory } from '@/features/planning/types';

export interface TerritoryConfig {
  code: string;
  id: HolidayTerritory;
  label: string;
  shortLabel: string;
  flag: string;
  center: [number, number]; // [lat, lng]
  zoom: number;
}

export const TERRITORIES: readonly TerritoryConfig[] = [
  {
    code: 'FR',
    id: 'metropole',
    label: 'France Métropolitaine',
    shortLabel: 'Métropole',
    flag: '🇫🇷',
    center: [48.8566, 2.3522],
    zoom: 11,
  },
  {
    code: '971',
    id: 'guadeloupe',
    label: 'Guadeloupe (971)',
    shortLabel: 'Guadeloupe',
    flag: '🇬🇵',
    center: [16.265, -61.551],
    zoom: 10,
  },
  {
    code: '972',
    id: 'martinique',
    label: 'Martinique (972)',
    shortLabel: 'Martinique',
    flag: '🇲🇶',
    center: [14.6415, -61.0242],
    zoom: 11,
  },
  {
    code: '973',
    id: 'guyane',
    label: 'Guyane (973)',
    shortLabel: 'Guyane',
    flag: '🇬🇫',
    center: [4.9372, -52.326],
    zoom: 9,
  },
  {
    code: '974',
    id: 'reunion',
    label: 'La Réunion (974)',
    shortLabel: 'La Réunion',
    flag: '🇷🇪',
    center: [-21.1151, 55.5364],
    zoom: 10,
  },
  {
    code: '976',
    id: 'mayotte',
    label: 'Mayotte (976)',
    shortLabel: 'Mayotte',
    flag: '🇾🇹',
    center: [-12.8275, 45.1662],
    zoom: 11,
  },
] as const;

export const DEFAULT_TERRITORY_CODE = '972';
export const DEFAULT_TERRITORY: TerritoryConfig = {
  code: '972',
  id: 'martinique',
  label: 'Martinique (972)',
  shortLabel: 'Martinique',
  flag: '🇲🇶',
  center: [14.6415, -61.0242],
  zoom: 11,
};

export function getTerritoryByCode(code: string | null | undefined): TerritoryConfig {
  const found = TERRITORIES.find((t) => t.code === code || t.id === code);
  return found ?? DEFAULT_TERRITORY;
}

export function getTerritoryByHolidayId(holidayId: HolidayTerritory): TerritoryConfig {
  const found = TERRITORIES.find((t) => t.id === holidayId);
  return found ?? DEFAULT_TERRITORY;
}

const STORAGE_KEY = 'pref_default_territory';

export function useDefaultTerritory() {
  const [territoryCode, setTerritoryCodeState] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_TERRITORY_CODE;
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TERRITORY_CODE;
  });

  const setTerritoryCode = useCallback((code: string) => {
    setTerritoryCodeState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
      window.dispatchEvent(new Event('territory-changed'));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored !== territoryCode) {
        setTerritoryCodeState(stored);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('territory-changed', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('territory-changed', handleStorage);
    };
  }, [territoryCode]);

  const territory = getTerritoryByCode(territoryCode);

  return {
    territoryCode,
    territory,
    setTerritoryCode,
  };
}
