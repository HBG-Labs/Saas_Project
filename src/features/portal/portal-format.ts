import type { BadgeProps } from '@/components/ui/Badge';

/**
 * Libellés à destination du CLIENT — pas ceux de l'espace entreprise.
 * « Brouillon » ou « Rejeté » n'y figurent pas : ces états ne sortent jamais
 * de la base vers le portail.
 */
export type Tone = NonNullable<BadgeProps['variant']>;

const MISSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  assigned: { label: 'Planifiée', tone: 'info' },
  accepted: { label: 'Planifiée', tone: 'info' },
  in_progress: { label: 'En cours', tone: 'primary' },
  completed: { label: 'Réalisée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

const QUOTE_STATUS: Record<string, { label: string; tone: Tone }> = {
  sent: { label: 'En attente de votre réponse', tone: 'warning' },
  accepted: { label: 'Accepté', tone: 'success' },
  refused: { label: 'Refusé', tone: 'neutral' },
  expired: { label: 'Expiré', tone: 'neutral' },
};

const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  issued: { label: 'À régler', tone: 'warning' },
  sent: { label: 'À régler', tone: 'warning' },
  paid: { label: 'Réglée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export function missionStatusLabel(status: string): { label: string; tone: Tone } {
  return MISSION_STATUS[status] ?? { label: status, tone: 'neutral' };
}
export function quoteStatusLabel(status: string): { label: string; tone: Tone } {
  return QUOTE_STATUS[status] ?? { label: status, tone: 'neutral' };
}
export function invoiceStatusLabel(status: string): { label: string; tone: Tone } {
  return INVOICE_STATUS[status] ?? { label: status, tone: 'neutral' };
}

/** Une facture est « due » tant qu'elle n'est ni réglée ni annulée. */
export function invoiceIsDue(status: string): boolean {
  return status === 'issued' || status === 'sent';
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatEuros(cents: number): string {
  return euros.format(cents / 100);
}

export function formatDateFr(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

