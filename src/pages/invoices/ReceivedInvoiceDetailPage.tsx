import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useToast } from '@/components/feedback/toast-context';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  formatInvoiceDate,
  getReceivedInvoiceDetail,
  getReceivedInvoiceDocumentUrl,
  ReceivedInvoiceStatusBadge,
  RECEIVED_INVOICE_STATUS_LABELS,
  updateReceivedInvoiceStatus,
} from '@/features/einvoicing';
import { PERMISSIONS, usePermission } from '@/features/organizations';
import { qk } from '@/lib/query-keys';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { InvoiceTransmissionStatus, ReceivedInvoiceInternalStatus } from '@/types/database';

const REGULATORY_STATUS: Record<
  InvoiceTransmissionStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  queued: { label: 'En attente', variant: 'neutral' },
  submitting: { label: 'En cours', variant: 'info' },
  submitted: { label: 'Déposée', variant: 'info' },
  delivered: { label: 'Remise', variant: 'info' },
  accepted: { label: 'Acceptée', variant: 'success' },
  rejected: { label: 'Rejetée', variant: 'error' },
  failed: { label: 'Échec technique', variant: 'error' },
  cancelled: { label: 'Annulée', variant: 'neutral' },
};

const INTERNAL_STATUSES: ReceivedInvoiceInternalStatus[] = [
  'new',
  'viewed',
  'archived',
  'disputed',
];

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export default function ReceivedInvoiceDetailPage() {
  const { receivedInvoiceId } = useParams<{ receivedInvoiceId: string }>();
  const { can } = usePermission();
  const canManage = can(PERMISSIONS.invoiceManage);
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: qk.einvoicing.receivedInvoiceDetail(receivedInvoiceId ?? 'none'),
    queryFn: () => getReceivedInvoiceDetail(receivedInvoiceId ?? ''),
    enabled: Boolean(receivedInvoiceId),
  });

  const updateStatus = useMutation({
    mutationFn: (status: ReceivedInvoiceInternalStatus) =>
      updateReceivedInvoiceStatus(receivedInvoiceId ?? '', status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: qk.einvoicing.receivedInvoiceDetail(receivedInvoiceId ?? 'none'),
      });
    },
    onError: () => toast.erreur('Statut non enregistré', 'Réessayez dans un instant.'),
  });

  async function telecharger(objectPath: string, fileName: string) {
    try {
      const lien = await getReceivedInvoiceDocumentUrl(objectPath, fileName);
      window.open(lien, '_blank', 'noopener,noreferrer');
    } catch {
      toast.erreur('Téléchargement impossible', 'Réessayez dans un instant.');
    }
  }

  useDocumentTitle(
    query.data?.invoice.supplier_name
      ? `Facture reçue — ${query.data.invoice.supplier_name}`
      : 'Facture reçue',
  );

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-12">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl pb-12">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  if (query.data === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-12">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to={ROUTES.receivedInvoices}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour aux factures reçues
          </Link>
        </Button>
        <p className="text-muted-foreground text-sm">Cette facture reçue est introuvable.</p>
      </div>
    );
  }

  const { invoice, events, document } = query.data;
  const fileName = `${invoice.supplier_name ?? 'facture'}-${invoice.provider_invoice_id}.${
    document?.original_format === 'factur_x' ? 'pdf' : 'xml'
  }`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5">
        <Link to={ROUTES.receivedInvoices}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour aux factures reçues
        </Link>
      </Button>

      <PageHeader
        title={invoice.supplier_name ?? 'Fournisseur inconnu'}
        {...(invoice.supplier_siren ? { description: `SIREN ${invoice.supplier_siren}` } : {})}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ReceivedInvoiceStatusBadge status={invoice.internal_status} />
            {invoice.regulatory_status && (
              <Badge variant={REGULATORY_STATUS[invoice.regulatory_status].variant}>
                {REGULATORY_STATUS[invoice.regulatory_status].label}
              </Badge>
            )}
          </div>
        }
      />

      {invoice.last_error_message && (
        <p role="alert" className="border-error/30 bg-error/5 text-error rounded-lg border p-3 text-xs">
          {invoice.last_error_message}
        </p>
      )}

      <div className="border-border bg-surface space-y-4 rounded-xl border p-4">
        <dl className="grid gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Montant HT</dt>
            <dd className="text-foreground font-semibold tabular-nums">
              {invoice.amount_without_vat !== null
                ? `${invoice.amount_without_vat.toFixed(2)} ${invoice.currency_code ?? 'EUR'}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">TVA</dt>
            <dd className="text-foreground font-semibold tabular-nums">
              {invoice.amount_vat !== null
                ? `${invoice.amount_vat.toFixed(2)} ${invoice.currency_code ?? 'EUR'}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Montant TTC</dt>
            <dd className="text-foreground font-semibold tabular-nums">
              {invoice.amount_with_vat !== null
                ? `${invoice.amount_with_vat.toFixed(2)} ${invoice.currency_code ?? 'EUR'}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Date d’émission</dt>
            <dd className="text-foreground font-medium">
              {invoice.issue_date ? formatInvoiceDate(invoice.issue_date) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Échéance</dt>
            <dd className="text-foreground font-medium">
              {invoice.payment_due_date ? formatInvoiceDate(invoice.payment_due_date) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reçue le</dt>
            <dd className="text-foreground font-medium">{formatInvoiceDate(invoice.received_at)}</dd>
          </div>
        </dl>

        {canManage && (
          <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-muted-foreground text-xs">Marquer comme :</span>
            {INTERNAL_STATUSES.filter((status) => status !== invoice.internal_status).map(
              (status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate(status)}
                >
                  {RECEIVED_INVOICE_STATUS_LABELS[status]}
                </Button>
              ),
            )}
          </div>
        )}
      </div>

      <div className="border-border bg-surface space-y-3 rounded-xl border p-4">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4" aria-hidden="true" />
          Document original
        </h2>
        {document ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">
              Format {document.original_format.toUpperCase()} · {(document.byte_size / 1024).toFixed(0)} Ko
            </p>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Download />}
              onClick={() => void telecharger(document.object_path, fileName)}
            >
              Télécharger
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Le document original n’a pas encore pu être conservé. Les données structurées restent
            disponibles ci-dessus.
          </p>
        )}
      </div>

      {events.length > 0 && (
        <div className="border-border bg-surface space-y-2 rounded-xl border p-4">
          <h2 className="text-foreground text-sm font-semibold">Historique</h2>
          <ol className="border-border space-y-2 border-l pl-3">
            {events.map((event) => (
              <li key={event.id} className="text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-foreground font-medium">
                    {event.normalized_status
                      ? REGULATORY_STATUS[event.normalized_status].label
                      : event.event_type}
                  </span>
                  <time className="text-muted-foreground" dateTime={event.occurred_at}>
                    {formatEventDate(event.occurred_at)}
                  </time>
                </div>
                {event.message && <p className="text-muted-foreground mt-0.5">{event.message}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
