import { useCallback, useMemo, useState, type ReactNode } from 'react';

import {
  SIMULATED_ROLE_STORAGE_KEY,
  SimulatedRoleContext,
  type SimulatedRole,
  type SimulatedRoleContextValue,
} from './simulated-role-context';

function readStoredRole(): SimulatedRole {
  try {
    const saved = sessionStorage.getItem(SIMULATED_ROLE_STORAGE_KEY);
    if (saved === 'entrepreneur' || saved === 'technician') return saved;
  } catch {
    // Navigation privée stricte : le choix ne survivra pas au rechargement,
    // ce qui est une gêne, pas une panne.
  }
  return 'entrepreneur';
}

/**
 * Fournit le rôle simulé de développement.
 *
 * `sessionStorage` et non `localStorage` : cette bascule est un outil de mise au
 * point, pas une préférence. Elle ne doit pas survivre à la fermeture de
 * l'onglet et se rappeler au prochain démarrage.
 */
export function SimulatedRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<SimulatedRole>(readStoredRole);

  const setRole = useCallback((next: SimulatedRole) => {
    setRoleState(next);
    try {
      sessionStorage.setItem(SIMULATED_ROLE_STORAGE_KEY, next);
    } catch {
      // Voir ci-dessus.
    }
  }, []);

  const value = useMemo<SimulatedRoleContextValue>(
    () => ({
      role,
      setRole,
      isEntrepreneur: role === 'entrepreneur',
      isTechnician: role === 'technician',
    }),
    [role, setRole],
  );

  return <SimulatedRoleContext value={value}>{children}</SimulatedRoleContext>;
}
