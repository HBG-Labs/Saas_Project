import { cn } from '@/lib/cn';

export interface MemberQuotaBarProps {
  current: number;
  /** `null` = illimité. */
  max: number | null;
}

/**
 * Consommation du quota de membres.
 *
 * Le trigger `enforce_member_quota` refuse purement et simplement le membre en
 * trop. Découvrir la limite au moment où l'on invite quelqu'un — après avoir
 * saisi son adresse et choisi son rôle — est une mauvaise surprise ; l'afficher
 * en permanence la rend prévisible.
 *
 * Rien n'est rendu quand le quota est illimité : une jauge qui ne se remplit
 * jamais n'informe pas, elle occupe.
 */
export function MemberQuotaBar({ current, max }: MemberQuotaBarProps) {
  if (max === null) return null;

  const ratio = max === 0 ? 1 : Math.min(current / max, 1);
  const remaining = Math.max(max - current, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">Membres</span>
        <span className="text-foreground font-mono tabular-nums">
          {current} / {max}
        </span>
      </div>

      <div
        className="bg-surface-sunken h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label="Membres utilisés sur le quota de la formule"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            // L'avertissement démarre à 80 % : prévenir au dernier moment ne
            // laisse pas le temps de changer de formule.
            ratio >= 1 ? 'bg-error' : ratio >= 0.8 ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${String(ratio * 100)}%` }}
        />
      </div>

      {remaining === 0 ? (
        <p className="text-error text-2xs">
          Quota atteint. Retirez un membre ou changez de formule pour en inviter d’autres.
        </p>
      ) : remaining <= 3 ? (
        <p className="text-warning text-2xs">
          Plus que {remaining} {remaining === 1 ? 'place disponible' : 'places disponibles'}.
        </p>
      ) : null}
    </div>
  );
}
