import { LayoutGrid, LayoutList } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { SegmentedOption } from '@/components/ui/SegmentedControl';

export type ViewMode = 'list' | 'grid';

/** Les deux mêmes segments partout : un catalogue se lit en liste ou en grille. */
export const VIEW_MODE_OPTIONS: readonly SegmentedOption<ViewMode>[] = [
  { value: 'list', label: 'Liste', icon: LayoutList },
  { value: 'grid', label: 'Grille', icon: LayoutGrid },
];

/**
 * Mode d'affichage d'un catalogue, mémorisé d'une visite à l'autre.
 *
 * Quatre écrans répétaient les mêmes douze lignes : lecture du `localStorage`
 * à l'initialisation, écriture dans un `try/catch` à chaque changement, et le
 * même transtypage depuis `string`. Le stockage pouvant être inaccessible
 * (navigation privée stricte, iframe cloisonnée), l'oubli d'un `catch` dans
 * une copie suffisait à faire planter la page au clic.
 *
 * La clé reste un paramètre : le catalogue d'outils et les outils métiers
 * mémorisent des préférences distinctes, et les confondre reviendrait à
 * changer l'affichage d'un écran en réglant l'autre.
 */
export function useViewMode(storageKey: string, fallback: ViewMode = 'list') {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === 'grid' || stored === 'list' ? stored : fallback;
    } catch {
      return fallback;
    }
  });

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      try {
        localStorage.setItem(storageKey, mode);
      } catch {
        // Stockage inaccessible : la préférence vaut pour la session en cours.
      }
    },
    [storageKey],
  );

  return { viewMode, setViewMode };
}
