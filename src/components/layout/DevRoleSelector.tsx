import { Sparkles } from 'lucide-react';

import { useSimulatedRole, type SimulatedRole } from '@/features/auth';
import { cn } from '@/lib/cn';

/**
 * Sélecteur de rôle simulé, en développement uniquement.
 *
 * STRICTEMENT MASQUÉ EN PRODUCTION (`import.meta.env.DEV === false`), et sans
 * effet sur les droits : `usePermission` n'applique ce choix que pour RETIRER
 * des permissions, jamais pour en accorder. Passer sur « entrepreneur » sans
 * l'être en base ne change rien — c'est `organization_members` qui décide.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE BASCULE ET NON UNE LISTE DÉROULANTE
 *
 * Un `<select>` affiche l'intégralité du libellé sélectionné, sans moyen de le
 * raccourcir : « 👔 Entrepreneur (Owner) » occupait à lui seul deux cents
 * pixels dans une barre qui en compte trois cent soixante. Il chassait la
 * recherche hors de l'écran et débordait du cadre.
 *
 * Avec deux rôles, la liste déroulante n'apportait rien qu'une bascule ne fasse
 * mieux : un appui suffit, et l'emoji porte l'information quand la place
 * manque.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Le hook est appelé AVANT la sortie anticipée : l'ordre des hooks doit être
 * identique à chaque rendu, et un `return` placé au-dessus le romprait.
 */

const ROLES: { value: SimulatedRole; emoji: string; short: string; long: string }[] = [
  { value: 'entrepreneur', emoji: '👔', short: 'Patron', long: 'Entrepreneur (Owner)' },
  { value: 'technician', emoji: '👷', short: 'Tech', long: 'Technicien (Terrain)' },
];

export function DevRoleSelector() {
  const { role, setRole } = useSimulatedRole();

  if (!import.meta.env.DEV) {
    return null;
  }

  const index = ROLES.findIndex((item) => item.value === role);
  const current = ROLES[index === -1 ? 0 : index];
  const next = ROLES[(Math.max(index, 0) + 1) % ROLES.length];

  if (current === undefined || next === undefined) return null;

  return (
    <button
      type="button"
      onClick={() => setRole(next.value)}
      title={`Rôle simulé : ${current.long} — appuyer pour passer à ${next.long}`}
      aria-label={`Rôle simulé en développement : ${current.long}. Appuyer pour basculer sur ${next.long}.`}
      className={cn(
        'flex size-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border',
        'md:size-auto md:px-2.5 md:py-1',
        'border-amber-500/30 bg-amber-500/10 text-2xs font-semibold text-amber-700',
        'transition-colors hover:bg-amber-500/20 dark:text-amber-400',
      )}
    >
      <Sparkles className="hidden size-3.5 shrink-0 animate-pulse md:block" aria-hidden="true" />
      <span aria-hidden="true">{current.emoji}</span>
      {/* Le libellé n'apparaît que là où il ne coûte rien à la barre. */}
      <span className="hidden md:inline">{current.short}</span>
      <span className="hidden xl:inline">— {current.long}</span>
    </button>
  );
}
