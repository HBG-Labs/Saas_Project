import { useEffect } from 'react';

/**
 * Hook pour mettre à jour le titre du document HTML (<title>).
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} — REZO360`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
