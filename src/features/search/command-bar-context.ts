import { createContext } from 'react';

export interface CommandBarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Ouvre la palette. Raccourci d'appel pour les déclencheurs d'interface. */
  openCommandBar: () => void;
}

export const CommandBarContext = createContext<CommandBarContextValue | null>(null);
