import { use } from 'react';

import { CommandBarContext, type CommandBarContextValue } from './command-bar-context';

export function useCommandBar(): CommandBarContextValue {
  const context = use(CommandBarContext);

  if (context === null) {
    throw new Error('useCommandBar doit être utilisé à l’intérieur de <CommandBarProvider>.');
  }

  return context;
}
