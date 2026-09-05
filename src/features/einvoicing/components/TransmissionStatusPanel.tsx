import { AlertTriangle, CheckCircle2, CircleDashed, RadioTower } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import { qk } from '@/lib/query-keys';
import type { CustomerType, InvoiceTransmissionStatus } from '@/types/database';
import type { InvoiceTransmissionTimeline } from '../api/transmission.api';
import { getInvoiceTransmissionTimeline } from '../api/transmission.api';
import {
  getEinvoicingProviderConnection,
  submitInvoiceToSuperPdp,
  syncInvoiceFromSuperPdp,
} from '../api/provider.api';

const STATUS: Record<
  InvoiceTransmissionStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  queued: { label: 'En attente', variant: 'neutral' },
  submitting: { label: 'Transmission en cours', variant: 'info' },
  submitted: { label: 'Déposée', variant: 'info' },
  delivered: { label: 'Remise au destinataire', variant: 'info' },
  accepted: { label: 'Acceptée', variant: 'success' },
  rejected: { label: 'Rejetée', variant: 'error' },
  failed: { label: 'Échec technique', variant: 'error' },
  cancelled: { label: 'Transmission annulée', variant: 'neutral' },
};

function formatEventDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function TransmissionStatusView({
  timeline,
  actions,
}: {
  timeline: InvoiceTransmissionTimeline;
  actions?: ReactNode;
}) {
  const { transmission, events } = timeline;

  if (transmission === null) {
    return (
      <section
        aria-label="Transmission électronique"
        className="border-border bg-surface space-y-2 rounded-xl border p-4 print:hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <RadioTower className="size-4" aria-hidden="true" />
            Transmission électronique
          </h2>
          <Badge variant="neutral">Pas encore transmise</Badge>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Cette facture n’a pas encore été transmise. Les fichiers disponibles sur cette page sont
          prêts à être contrôlés ou déposés auprès de la plateforme agréée.
        </p>
        {actions}
      </section>
    );
  }

  const config = STATUS[transmission.status];
  const terminal = transmission.status === 'accepted';
  return (
    <section
      aria-label="Transmission électronique"
      className="border-border bg-surface space-y-3 rounded-xl border p-4 print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          {terminal ? (
            <CheckCircle2 className="text-success size-4" aria-hidden="true" />
          ) : transmission.status === 'failed' || transmission.status === 'rejected' ? (
            <AlertTriangle className="text-error size-4" aria-hidden="true" />
          ) : (
            <CircleDashed className="text-info size-4" aria-hidden="true" />
          )}
          Transmission électronique
        </h2>
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Plateforme</dt>
          <dd className="text-foreground font-medium">{transmission.provider_code}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tentatives</dt>
          <dd className="text-foreground font-medium">{transmission.attempt_count}</dd>
        </div>
      </dl>

      {transmission.last_error_message && (
        <p
          role="alert"
          className="border-error/30 bg-error/5 text-error rounded-lg border p-3 text-xs"
        >
          {transmission.last_error_message}
        </p>
      )}

      {events.length > 0 && (
        <div>
          <h3 className="text-foreground text-xs font-semibold">Historique</h3>
          <ol className="border-border mt-2 space-y-2 border-l pl-3">
            {events.map((event) => (
              <li key={event.id} className="text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-foreground font-medium">
                    {event.normalized_status
                      ? STATUS[event.normalized_status].label
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
      {actions}
    </section>
  );
}

export function TransmissionStatusPanel({
  invoiceId,
  organizationId,
  canManage,
  customerType,
}: {
  invoiceId: string;
  organizationId: string;
  canManage: boolean;
  customerType: CustomerType | null;
}) {
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState(false);
  const query = useQuery({
    queryKey: qk.einvoicing.transmission(invoiceId),
    queryFn: () => getInvoiceTransmissionTimeline(invoiceId),
  });
  const connectionQuery = useQuery({
    queryKey: qk.einvoicing.connection(organizationId),
    queryFn: () => getEinvoicingProviderConnection(organizationId),
  });
  const refreshTimeline = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.einvoicing.transmission(invoiceId) });
  };
  const submit = useMutation({
    mutationFn: () => submitInvoiceToSuperPdp(invoiceId),
    onSuccess: () => {
      setConfirmation(false);
    },
    onSettled: refreshTimeline,
  });
  const sync = useMutation({
    mutationFn: () => syncInvoiceFromSuperPdp(invoiceId),
    onSuccess: refreshTimeline,
  });

  if (query.isPending) {
    return (
      <section
        aria-label="Transmission électronique"
        className="border-border bg-surface rounded-xl border p-4 print:hidden"
      >
        <p className="text-muted-foreground text-xs">Lecture du statut de transmission…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section
        aria-label="Transmission électronique"
        className="border-error/30 bg-error/5 rounded-xl border p-4 print:hidden"
      >
        <p role="alert" className="text-error text-xs">
          Le statut de transmission n’a pas pu être chargé.
        </p>
      </section>
    );
  }

  const transmission = query.data.transmission;
  const connection = connectionQuery.data ?? null;
  const supported = customerType === 'company';
  const actionError = submit.error ?? sync.error ?? connectionQuery.error;
  const actions = (
    <div className="border-border mt-3 space-y-2 border-t pt-3">
      {actionError && (
        <p role="alert" className="text-error text-xs">
          {actionError instanceof Error
            ? actionError.message
            : 'La plateforme ne répond pas pour le moment.'}
        </p>
      )}
      {!supported ? (
        <p className="text-muted-foreground text-xs">
          Le raccordement actuel couvre d’abord les factures B2B françaises. Les organismes publics
          et les particuliers seront traités avec leurs parcours dédiés.
        </p>
      ) : connection?.status !== 'connected' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground text-xs">
            Connectez et faites valider SUPER PDP avant le premier envoi.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.organizationEinvoicing}>Configurer la plateforme</Link>
          </Button>
        </div>
      ) : canManage ? (
        <div className="flex flex-wrap gap-2">
          {transmission === null && (
            <Button size="sm" onClick={() => setConfirmation(true)} disabled={submit.isPending}>
              Transmettre via SUPER PDP
            </Button>
          )}
          {transmission?.status === 'failed' && (
            <Button size="sm" onClick={() => setConfirmation(true)} disabled={submit.isPending}>
              Reprendre l’envoi
            </Button>
          )}
          {transmission?.provider_submission_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              {sync.isPending ? 'Synchronisation…' : 'Actualiser auprès de SUPER PDP'}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Un responsable autorisé peut transmettre cette facture.
        </p>
      )}
    </div>
  );

  return (
    <>
      <TransmissionStatusView timeline={query.data} actions={actions} />
      <Modal
        open={confirmation}
        onOpenChange={setConfirmation}
        title="Transmettre cette facture ?"
        description="Le document sera déposé sur SUPER PDP."
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            REZO360 préparera la facture électronique définitive, puis la transmettra à la
            plateforme agréée. Le dépôt et les statuts reçus seront conservés dans l’historique.
          </p>
          <p className="text-foreground text-sm font-medium">
            Vérifiez une dernière fois le destinataire et les montants avant de continuer.
          </p>
          {submit.error && (
            <p role="alert" className="text-error text-xs">
              {submit.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmation(false)}>
              Annuler
            </Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? 'Transmission…' : 'Transmettre définitivement'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
