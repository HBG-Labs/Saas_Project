import { Badge, type BadgeProps } from '@/components/ui/Badge';
import type { ProspectStatus } from '@/types/database';

import { PROSPECT_STATUS_LABELS } from '../lib/prospect-display';

const STATUS_VARIANT: Record<ProspectStatus, BadgeProps['variant']> = {
  nouveau: 'info',
  a_qualifier: 'neutral',
  a_contacter: 'primary',
  contacte: 'accent',
  a_relancer: 'warning',
  interesse: 'success',
  essai: 'success',
  converti: 'success',
  refuse: 'error',
  ignore: 'outline',
  ne_plus_contacter: 'error',
};

export function ProspectStatusBadge({ status }: { status: ProspectStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PROSPECT_STATUS_LABELS[status]}</Badge>;
}
