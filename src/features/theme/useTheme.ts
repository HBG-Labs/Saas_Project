import { use } from 'react';

import { ThemeContext, type ThemeContextValue } from './theme-context';

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);

  if (context === null) {
    throw new Error('useTheme doit être utilisé à l’intérieur de <ThemeProvider>.');
  }

  return context;
}
