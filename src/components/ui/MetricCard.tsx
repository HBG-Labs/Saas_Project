import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

export interface MetricCardProps {
  /** Ce que le chiffre compte, en toutes lettres. */
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Pastille de contexte à droite de l'icône : « 3 à valider », « à jour »… */
  badge?: { text: string; variant?: BadgeProps['variant'] };
  /** Destination de la carte entière, et libellé de son action. */
  to: string;
  actionLabel: string;
  /**
   * Signale que ce chiffre appelle une action maintenant.
   *
   * Réservé à ce qui bloque réellement le travail : la couleur haute
   * visibilité ne veut plus rien dire si trois cartes sur quatre la portent.
   */
  attention?: boolean;
  className?: string;
}

/**
 * Indicateur cliquable d'un tableau de bord.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE COMPOSANT EXISTE
 *
 * Ce motif — tuile d'icône, pastille, libellé, chiffre, lien d'action — était
 * recopié SEPT fois à la main : quatre dans `OwnerDashboard` et trois dans
 * `ManagerDashboard`, avec vingt-cinq classes utilitaires par copie et une
 * couleur codée en dur différente à chaque fois (primaire, ambre, émeraude,
 * ciel). Un huitième exemplaire dormait dans `KPICardsGrid`, jamais importé,
 * avec des valeurs de démonstration en dur.
 *
 * UNE SEULE COULEUR, ET ELLE VEUT DIRE QUELQUE CHOSE
 *
 * Les copies coloriaient chaque carte différemment sans que la couleur
 * n'encode rien : quatre teintes côte à côte ne hiérarchisent pas, elles se
 * neutralisent. Ici la carte est neutre par défaut, et `attention` est le seul
 * état coloré — celui qui demande une action.
 *
 * La carte entière est un lien : sur un téléphone, viser un lien de trois mots
 * en bas d'une carte n'est pas une cible tactile, la carte en est une.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  badge,
  to,
  actionLabel,
  attention = false,
  className,
}: MetricCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group bg-surface hover:shadow-raised flex flex-col justify-between gap-3 rounded-xl border p-4 transition-shadow',
        attention ? 'border-warning-border bg-warning-subtle' : 'border-border hover:border-border-strong',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            attention ? 'bg-warning/15 text-warning' : 'bg-primary-subtle text-primary',
          )}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        {badge ? <Badge variant={badge.variant ?? 'outline'}>{badge.text}</Badge> : null}
      </div>

      <div>
        <p className="text-muted-foreground text-sm">{label}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span
            className={cn(
              'text-3xl font-bold tracking-tight tabular-nums',
              attention ? 'text-warning' : 'text-foreground',
            )}
          >
            {value}
          </span>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 text-sm font-medium transition-transform group-hover:translate-x-0.5',
              attention ? 'text-warning' : 'text-primary',
            )}
          >
            {actionLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
