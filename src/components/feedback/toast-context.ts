import { createContext, useContext } from 'react';

export type ToastTon = 'success' | 'error' | 'warning' | 'info';

export interface ToastApi {
  /** Une action a abouti : « Mission créée », « Compte rendu validé ». */
  succes: (titre: string, detail?: string) => void;
  /** Une action a échoué. Le détail dit quoi faire, il ne s'excuse pas. */
  erreur: (titre: string, detail?: string) => void;
  avertissement: (titre: string, detail?: string) => void;
  info: (titre: string, detail?: string) => void;
}

/**
 * Contexte et hook des notifications, séparés du composant.
 *
 * Dans un fichier distinct de `Toast.tsx` pour la même raison que
 * `button-variants.ts` l'est de `Button.tsx` : Fast Refresh n'opère que si un
 * module n'exporte que des composants. Exporter le hook depuis le fichier du
 * fournisseur casserait le rechargement à chaud de toute l'application, la
 * règle `react-refresh/only-export-components` le signalant au passage.
 */
export const ToastContext = createContext<ToastApi | null>(null);

/**
 * Accès aux notifications.
 *
 * Lève si le fournisseur est absent plutôt que de rendre une API muette : une
 * confirmation qui ne s'affiche jamais est un défaut qu'on ne remarque qu'en
 * production, et le plus souvent par un client.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast doit être utilisé dans un <ToastProvider>.');
  }
  return ctx;
}
