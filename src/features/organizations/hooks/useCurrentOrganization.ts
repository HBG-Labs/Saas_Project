import { use } from 'react';

import { OrganizationContext, type OrganizationContextValue } from '../context/organization-context';

/**
 * Organisation courante.
 *
 * Lève si le provider est absent plutôt que de renvoyer une valeur par défaut :
 * un composant métier rendu hors contexte afficherait sinon « aucune donnée »
 * de façon parfaitement crédible, et le défaut passerait en production.
 */
export function useCurrentOrganization(): OrganizationContextValue {
  const context = use(OrganizationContext);

  if (context === null) {
    throw new Error(
      'useCurrentOrganization doit être utilisé à l’intérieur de <OrganizationProvider>.',
    );
  }

  return context;
}
