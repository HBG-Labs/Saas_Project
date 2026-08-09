import { Badge, type BadgeProps } from '@/components/ui/Badge';
import type { MissionPriority, MissionStatus } from '@/types/database';

import { MISSION_PRIORITY_LABELS } from '../priority-labels';
import { MISSION_STATUS_LABELS } from '../workflow';

/**
 * Couleur par étape du cycle de vie, et non par « gravité ».
 *
 * Le parcours nominal reste neutre ou informatif : une mission en cours n'a rien
 * d'alarmant. Seuls deux états se distinguent — `submitted`, qui ATTEND une
 * action de contrôle, et `rejected`, qui en réclame une du terrain. Colorer tout
 * le reste noierait ces deux-là, qui sont précisément ceux qu'on cherche du
 * regard dans une liste de cinquante lignes.
 */
const STATUS_VARIANTS: Record<MissionStatus, NonNullable<BadgeProps['variant']>> = {
  draft: 'outline',
  assigned: 'info',
  accepted: 'info',
  in_progress: 'primary',
  completed: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
  closed: 'success',
};

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{MISSION_STATUS_LABELS[status]}</Badge>;
}

const PRIORITY_VARIANTS: Record<MissionPriority, NonNullable<BadgeProps['variant']>> = {
  low: 'outline',
  normal: 'neutral',
  high: 'warning',
  urgent: 'error',
};

/**
 * La priorité normale ne s'affiche pas.
 *
 * C'est le cas de la grande majorité des missions : la signaler ajouterait une
 * pastille sur chaque ligne sans jamais rien distinguer. Une priorité mérite
 * d'être vue quand elle s'écarte de l'ordinaire.
 */
export function MissionPriorityBadge({ priority }: { priority: MissionPriority }) {
  if (priority === 'normal') return null;

  return <Badge variant={PRIORITY_VARIANTS[priority]}>{MISSION_PRIORITY_LABELS[priority]}</Badge>;
}
