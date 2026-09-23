import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { CommandBarContext, type CommandBarContextValue } from './command-bar-context';

const LazyCommandBar = lazy(async () => {
  // Le registre et la palette ne sont nécessaires qu'au premier Ctrl/⌘ + K.
  // Les charger au boot ajoutait leur graphe complet au chemin critique, même
  // lorsqu'un utilisateur n'ouvrait jamais la recherche globale.
  const [, commandBarModule] = await Promise.all([import('@/tools'), import('./CommandBar')]);
  return { default: commandBarModule.CommandBar };
});

/**
 * Rend la palette de commandes disponible dans TOUTE l'application.
 *
 * Monté dans `RootLayout`, donc au-dessus des deux ossatures : la landing
 * publique comme l'application connectée en bénéficient. Auparavant la palette
 * n'existait que dans `AppLayout`, ce qui rendait fausse la promesse « ⌘K
 * ouvre la recherche depuis n'importe où » affichée sur la page d'accueil.
 *
 * Le provider vit à l'intérieur du routeur : `CommandBar` utilise
 * `useNavigate`, qui échouerait s'il était monté dans `AppProviders`.
 */
export function CommandBarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openCommandBar = useCallback(() => {
    setOpen(true);
  }, []);

  // Le raccourci est enregistré ici, une seule fois, plutôt que dans chaque
  // layout : deux écouteurs concurrents se seraient annulés en basculant
  // l'état deux fois par frappe.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const value = useMemo<CommandBarContextValue>(
    () => ({ open, setOpen, openCommandBar }),
    [open, openCommandBar],
  );

  return (
    <CommandBarContext value={value}>
      {children}
      {open ? (
        <Suspense fallback={null}>
          <LazyCommandBar open onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </CommandBarContext>
  );
}
