import { BellRing } from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { formatDate, formatDateTime } from '@/lib/format';
import type { QuoteReminderStatus } from '@/types/database';
import type { Quote } from '@/types/domain';

import { useQuoteReminders } from '../hooks/useQuotes';

/**
 * Les relances automatiques d'un devis envoyé.
 *
 * Tout ce qui est affiché vient de `quote_reminders`, écrite par la base et
 * par le worker — jamais par le navigateur. Le seul geste offert ici est
 * l'interrupteur `reminders_enabled` du devis : le trigger replanifie ou
 * retire ce qui restait à envoyer.
 *
 * N'apparaît que pour un devis envoyé depuis les relances automatiques
 * (`sent_at` posé) : un devis envoyé avant ne sera jamais relancé, il n'y a
 * rien à montrer ni à régler.
 */

const STATUS: Record<QuoteReminderStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  pending: { label: 'Planifiée', variant: 'info' },
  sent: { label: 'Envoyée', variant: 'success' },
  skipped: { label: 'Passée', variant: 'neutral' },
  failed: { label: 'Échec', variant: 'error' },
};

interface QuoteRemindersCardProps {
  quote: Pick<Quote, 'id' | 'status' | 'sent_at' | 'reminders_enabled'>;
  canManage: boolean;
  isUpdating: boolean;
  onToggle: (enabled: boolean) => void;
}

export function QuoteRemindersCard({ quote, canManage, isUpdating, onToggle }: QuoteRemindersCardProps) {
  const remindersQuery = useQuoteReminders(quote.id);
  const reminders = remindersQuery.data ?? [];

  if (quote.sent_at === null) return null;

  const pending = reminders.filter((r) => r.status === 'pending');
  const next = pending.at(0) ?? null;
  const history = reminders.filter((r) => r.status !== 'pending');

  const headline =
    quote.status !== 'sent'
      ? 'Plus de relance : le devis a reçu une réponse ou a expiré.'
      : !quote.reminders_enabled
        ? 'Relances désactivées pour ce devis.'
        : next
          ? `Prochaine relance le ${formatDate(next.due_at)}${pending.length > 1 ? ` (${pending.length} restantes)` : ''}.`
          : 'Aucune relance à venir.';

  return (
    <div className="border-border bg-surface-subtle/50 rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <BellRing className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="text-xs">
            <p className="text-foreground font-semibold">Relances automatiques</p>
            <p className="text-muted-foreground">{headline}</p>
          </div>
        </div>
        {canManage && quote.status === 'sent' && (
          <Switch
            label="Relancer ce client"
            checked={quote.reminders_enabled}
            disabled={isUpdating}
            onCheckedChange={onToggle}
          />
        )}
      </div>

      {history.length > 0 && (
        <ul className="border-border mt-3 space-y-1.5 border-t pt-3 text-xs">
          {history.map((reminder) => {
            const status = STATUS[reminder.status];
            return (
              <li key={reminder.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant={status.variant}>{status.label}</Badge>
                <span className="text-foreground">Relance {reminder.sequence}</span>
                <span className="text-muted-foreground">
                  {reminder.status === 'sent' && reminder.sent_at
                    ? `envoyée le ${formatDateTime(reminder.sent_at)}`
                    : `prévue le ${formatDate(reminder.due_at)}`}
                  {reminder.reason ? ` — ${reminder.reason}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
