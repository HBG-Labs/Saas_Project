import { use } from 'react';

import { AuthContext, type AuthContextValue } from '../context/auth-context';

/**
 * Accès à la session courante et aux actions d'authentification.
 *
 * Lance une erreur explicite hors du provider : sans cela, un contexte `null`
 * produirait un « cannot read property of null » très éloigné de la cause.
 */
export function useAuth(): AuthContextValue {
  const context = use(AuthContext);

  if (context === null) {
    throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  }

  return context;
}
