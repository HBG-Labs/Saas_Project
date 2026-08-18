import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';

export interface MemberQuotaBarProps {
  current: number;
  /** `null` = illimité. Quota de base inclus dans la formule. */
  max: number | null;
  /** Utilisateurs inclus dans le forfait (si différent du max). */
  included?: number;
  /** Code du plan actuel pour adapter les messages (ex: 'free'). */
  planCode?: string;
}

/**
 * Consommation du quota d'utilisateurs et affichage des sièges supplémentaires.
 *
 * Règles d'affichage officielles NexoraTech :
 * - Dans la limite : `2 / 2 utilisateurs`, `5 / 5 utilisateurs` ou `1 / 1 utilisateur` (Free).
 * - Avec sièges supplémentaires (+5 €/mois) : `7 utilisateurs — 5 inclus + 2 supplémentaires (+10 €/mois)`.
 * - Si le quota est atteint :
 *   - Pour Free : CTA « Passer au plan supérieur » (car monocompte strict).
 *   - Pour plans payants : Indique que les prochains collaborateurs seront à +5 €/mois, et bouton « Passer au plan supérieur ».
 */
export function MemberQuotaBar({ current, max, included, planCode }: MemberQuotaBarProps) {
  const baseIncluded = included ?? max ?? 1;
  const isFree = planCode === 'free' || max === 1;

  const hasExtraUsers = current > baseIncluded && !isFree;
  const extraCount = hasExtraUsers ? current - baseIncluded : 0;
  const extraCostEur = extraCount * 5;

  const isQuotaReached = isFree ? current >= 1 : (max !== null && max <= baseIncluded && current >= max);
  const ratio = baseIncluded === 0 ? 1 : Math.min(current / baseIncluded, 1);
  const remaining = Math.max(baseIncluded - current, 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-medium">Utilisateurs actifs</span>
        <span className="text-foreground font-mono font-bold tabular-nums">
          {hasExtraUsers ? (
            <span>
              {current} utilisateurs — <span className="text-muted-foreground font-normal">{baseIncluded} inclus</span>{' '}
              <span className="text-primary font-semibold">+{extraCount} supplémentaires</span>{' '}
              <span className="text-emerald-500 font-bold">(+{extraCostEur} €/mois)</span>
            </span>
          ) : (
            <span>
              {current} / {baseIncluded} {baseIncluded > 1 ? 'utilisateurs' : 'utilisateur'}
            </span>
          )}
        </span>
      </div>

      <div
        className="bg-surface-sunken h-2 overflow-hidden rounded-full border border-border/40"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={baseIncluded}
        aria-label="Utilisateurs consommés sur le forfait"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            hasExtraUsers
              ? 'bg-gradient-to-r from-primary to-emerald-500'
              : isQuotaReached
                ? 'bg-amber-500'
                : ratio >= 0.8
                  ? 'bg-warning'
                  : 'bg-primary',
          )}
          style={{ width: `${String(hasExtraUsers ? 100 : ratio * 100)}%` }}
        />
      </div>

      {isFree && current >= 1 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
          <p className="text-muted-foreground text-2xs">
            Plan Free limité à <strong>1 utilisateur</strong> (Monocompte). Pour collaborer en équipe, passez à une offre payante.
          </p>
          <Button asChild variant="primary" size="sm" className="text-2xs h-7 gap-1 shrink-0">
            <Link to={ROUTES.pricing}>
              <Sparkles className="size-3" />
              <span>Passer au plan supérieur</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        </div>
      ) : isQuotaReached && !hasExtraUsers ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
          <p className="text-muted-foreground text-2xs">
            Limite incluse atteinte ({baseIncluded} {baseIncluded > 1 ? 'utilisateurs' : 'utilisateur'}). Vos prochaines invitations ajouteront un utilisateur supplémentaire à <strong>+5 €/mois</strong>.
          </p>
          <Button asChild variant="outline" size="sm" className="text-2xs h-7 gap-1 shrink-0">
            <Link to={ROUTES.pricing}>
              <span>Passer au plan supérieur</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        </div>
      ) : remaining > 0 && remaining <= 2 ? (
        <p className="text-warning text-2xs">
          Plus que {remaining} {remaining === 1 ? 'utilisateur inclus disponible' : 'utilisateurs inclus disponibles'}.
        </p>
      ) : null}
    </div>
  );
}
