import { Sparkles } from 'lucide-react';

import { useSimulatedRole, type SimulatedRole } from '@/features/auth';

/**
 * Sélecteur de rôle simulé, en développement uniquement.
 *
 * STRICTEMENT MASQUÉ EN PRODUCTION (`import.meta.env.DEV === false`), et sans
 * effet sur les droits : `usePermission` n'applique ce choix que pour RETIRER
 * des permissions, jamais pour en accorder. Passer sur « entrepreneur » sans
 * l'être en base ne change rien — c'est `organization_members` qui décide.
 *
 * Le hook est appelé AVANT la sortie anticipée : l'ordre des hooks doit être
 * identique à chaque rendu, et un `return` placé au-dessus le romprait.
 */
export function DevRoleSelector() {
  const { role, setRole } = useSimulatedRole();

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-2xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
      <Sparkles className="size-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
      <span className="hidden md:inline font-bold uppercase tracking-wider text-3xs text-amber-600 dark:text-amber-400">
        DEV ROLE :
      </span>

      <select
        value={role}
        onChange={(e) => setRole(e.target.value as SimulatedRole)}
        className="bg-transparent font-semibold text-amber-700 dark:text-amber-300 focus:outline-none cursor-pointer rounded px-1 text-xs"
        aria-label="Sélectionner le rôle simulé en développement"
      >
        <option value="entrepreneur" className="bg-surface text-foreground">
          👔 Entrepreneur (Owner)
        </option>
        <option value="technician" className="bg-surface text-foreground">
          👷 Technicien (Terrain)
        </option>
      </select>
    </div>
  );
}
