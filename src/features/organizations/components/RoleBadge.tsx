import { Badge, type BadgeProps } from '@/components/ui/Badge';
import type { OrgRole } from '@/types/database';

import { ROLE_LABELS } from '../rbac';

/**
 * Variante par niveau de privilège, du plus élevé au plus restreint.
 *
 * L'intensité visuelle suit le pouvoir réel : dans une liste de trente membres,
 * on doit repérer les propriétaires d'un coup d'œil, pas les lire un par un.
 * Les rôles d'exécution restent neutres — ils sont la majorité, et les colorer
 * transformerait la liste en arc-en-ciel sans rien hiérarchiser.
 */
const ROLE_VARIANTS: Record<OrgRole, NonNullable<BadgeProps['variant']>> = {
  owner: 'primary',
  admin: 'accent',
  manager: 'info',
  team_leader: 'neutral',
  technician: 'neutral',
  employee: 'outline',
};

export function RoleBadge({ role }: { role: OrgRole }) {
  return <Badge variant={ROLE_VARIANTS[role]}>{ROLE_LABELS[role]}</Badge>;
}
