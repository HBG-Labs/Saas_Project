import { Badge, type BadgeProps } from '@/components/ui/Badge';
import type { ReceivedInvoiceInternalStatus } from '@/types/database';

import { RECEIVED_INVOICE_STATUS_LABELS } from '../lib/received-invoice-display';

const STATUS_VARIANT: Record<ReceivedInvoiceInternalStatus, NonNullable<BadgeProps['variant']>> = {
  new: 'info',
  viewed: 'neutral',
  archived: 'outline',
  disputed: 'error',
};

export function ReceivedInvoiceStatusBadge({
  status,
}: {
  status: ReceivedInvoiceInternalStatus;
}) {
  return <Badge variant={STATUS_VARIANT[status]}>{RECEIVED_INVOICE_STATUS_LABELS[status]}</Badge>;
}
