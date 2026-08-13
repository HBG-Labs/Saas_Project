import { createContext, useContext } from 'react';

/**
 * Rôle simulé en développement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE SÉLECTEUR N'ACCORDE AUCUN DROIT
 *
 * Il permet de VOIR l'application comme un technicien sans changer de compte.
 * `usePermission` ne l'applique que dans un sens : il retire des permissions,
 * jamais n'en ajoute. Choisir « entrepreneur » sans l'être en base ne change
 * rien — le rôle réel vient de `organization_members`, et PostgreSQL ne consulte
 * pas ce sélecteur.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Contexte et hook séparés du composant fournisseur : mêler les deux dans un
 * même module casse le rafraîchissement à chaud de Vite
 * (`react-refresh/only-export-components`), comme pour le thème.
 */
export type SimulatedRole = 'entrepreneur' | 'technician';

export interface SimulatedRoleContextValue {
  role: SimulatedRole;
  setRole: (role: SimulatedRole) => void;
  isEntrepreneur: boolean;
  isTechnician: boolean;
}

export const SimulatedRoleContext = createContext<SimulatedRoleContextValue | null>(null);

export const SIMULATED_ROLE_STORAGE_KEY = 'nexoratech_simulated_dev_role';

/**
 * Repli hors fournisseur plutôt qu'une erreur.
 *
 * Le fournisseur n'existe que dans l'arbre applicatif. Un composant monté seul
 * dans un test doit continuer de rendre, et « entrepreneur » — qui signifie
 * « n'applique aucune restriction » — est le comportement neutre attendu.
 */
export function useSimulatedRole(): SimulatedRoleContextValue {
  const context = useContext(SimulatedRoleContext);

  return (
    context ?? {
      role: 'entrepreneur',
      setRole: () => {},
      isEntrepreneur: true,
      isTechnician: false,
    }
  );
}
