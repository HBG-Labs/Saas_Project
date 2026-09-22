import { useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Download,
  Globe,
  ReceiptText,
  Send,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table } from '@/components/ui/Table';
import { ROUTES } from '@/config/routes';
import { useCustomer } from '@/features/customers';
import { DEFAULT_DOCUMENT_OPTIONS, normalizeDocumentOptions } from '@/features/documents';
import {
  LinkCustomerControl,
  SendToClientDialog,
  useClientPortalAccess,
} from '@/features/client-portal';
import { useCreateInvoiceFromQuote } from '@/features/invoices';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import {
  DEFAULT_QUOTE_PAYMENT_METHOD,
  DEFAULT_QUOTE_PAYMENT_TERMS,
  QuoteRemindersCard,
  toEuros,
  useDeleteQuote,
  useEnsureQuotePdf,
  useQuote,
  useUpdateQuote,
} from '@/features/quotes';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { QuoteStatus } from '@/types/database';

const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  draft: { label: 'Brouillon', variant: 'neutral' },
  sent: { label: 'Envoyé', variant: 'info' },
  accepted: { label: 'Accepté', variant: 'success' },
  refused: { label: 'Refusé', variant: 'error' },
  expired: { label: 'Expiré', variant: 'warning' },
};

export default function QuoteDetailPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const canManage = can(PERMISSIONS.quoteManage);

  const quoteQuery = useQuote(quoteId);
  const quote = quoteQuery.data ?? null;
  const customerQuery = useCustomer(quote?.customer_id ?? undefined);

  const updateQuote = useUpdateQuote(quoteId ?? '');
  const deleteQuote = useDeleteQuote();
  const createInvoice = useCreateInvoiceFromQuote();
  const ensureQuotePdf = useEnsureQuotePdf();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const portal = useClientPortalAccess();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  /**
   * Prépare le PDF sans bloquer l'envoi ni le faire échouer : le document
   * existera au plus tard au prochain clic sur « Télécharger le PDF ». Voir
   * `generate-quote-pdf` — mêmes garanties que `ensureFacturX`.
   */
  const warmUpQuotePdf = (id: string) => {
    ensureQuotePdf.mutate(id, { onError: () => undefined });
  };

  useDocumentTitle(quote ? `Devis ${quote.reference}` : 'Devis');

  const handleDelete = () => {
    if (quoteId === undefined) return;
    deleteQuote.mutate(quoteId, {
      onSuccess: () => {
        void navigate(ROUTES.quotesHistory);
      },
    });
  };

  if (quoteQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <PageHeader title="Devis" />
        <ErrorState error={quoteQuery.error} onRetry={() => void quoteQuery.refetch()} />
      </div>
    );
  }

  if (quoteQuery.isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12" aria-hidden="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (quote === null) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        <PageHeader title="Devis introuvable" />
        <ErrorState
          error={new Error('Ce devis n’existe pas ou a été supprimé.')}
          title="Devis introuvable"
        />
      </div>
    );
  }

  const status = STATUS_CONFIG[quote.status];
  const totalHT = quote.totals ? toEuros(quote.totals.subtotal_cents) : 0;
  const totalVAT = quote.totals ? toEuros(quote.totals.vat_cents) : 0;
  const totalTTC = quote.totals ? toEuros(quote.totals.total_cents) : 0;
  const documentOptions =
    quote.document_options === null
      ? {
          ...DEFAULT_DOCUMENT_OPTIONS,
          showAcceptanceTerms: true,
          showSignature: true,
        }
      : normalizeDocumentOptions(quote.document_options);
  const customer = customerQuery.data ?? null;
  const customerAddress = customer
    ? [
        [customer.address_line1, customer.address_line2].filter(Boolean).join(' '),
        [customer.postal_code, customer.city].filter(Boolean).join(' '),
        customer.country,
      ].filter(Boolean)
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <Link
        to={ROUTES.quotesHistory}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Historique des devis
      </Link>

      <PageHeader
        title={quote.reference}
        description={quote.customer_name || quote.title || 'Client non renseigné'}
        actions={
          <>
            <Badge variant={status.variant} className="self-center">
              {status.label}
            </Badge>
            {quote.status === 'draft' ? (
              // Brouillon : rien n'est conservé côté serveur — les montants
              // peuvent encore changer. L'aperçu navigateur reste le seul PDF.
              <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                <Download className="size-4" aria-hidden="true" />
                Aperçu
              </Button>
            ) : (
              <Button
                variant="outline"
                className="gap-2"
                disabled={ensureQuotePdf.isPending}
                isLoading={ensureQuotePdf.isPending}
                loadingLabel="Préparation du PDF"
                onClick={() => {
                  setPdfError(null);
                  ensureQuotePdf.mutate(quote.id, {
                    onSuccess: (document) => {
                      window.open(document.url, '_blank', 'noopener');
                    },
                    onError: (error) => {
                      setPdfError(
                        error instanceof Error ? error.message : 'Le PDF n’a pas pu être préparé.',
                      );
                    },
                  });
                }}
              >
                <Download className="size-4" aria-hidden="true" />
                Télécharger le PDF
              </Button>
            )}
          </>
        }
      />
      {pdfError && <FormError error={new Error(pdfError)} />}

      <dl
        aria-label="Résumé financier du devis"
        className="border-border bg-surface grid grid-cols-2 overflow-hidden rounded-xl border shadow-xs sm:grid-cols-3 print:hidden"
      >
        <div className="border-border border-r p-3 sm:p-4">
          <dt className="text-muted-foreground text-xs">Total HT</dt>
          <dd className="text-foreground mt-1 font-mono text-sm font-bold tabular-nums sm:text-base">
            {totalHT.toFixed(2)} €
          </dd>
        </div>
        <div className="border-border p-3 sm:border-r sm:p-4">
          <dt className="text-muted-foreground text-xs">TVA</dt>
          <dd className="text-foreground mt-1 font-mono text-sm font-bold tabular-nums sm:text-base">
            {totalVAT.toFixed(2)} €
          </dd>
        </div>
        <div className="border-border bg-primary-subtle/45 col-span-2 border-t p-3 sm:col-span-1 sm:border-t-0 sm:p-4">
          <dt className="text-primary text-xs font-semibold">Total TTC</dt>
          <dd className="text-primary mt-1 font-mono text-base font-bold tabular-nums sm:text-lg">
            {totalTTC.toFixed(2)} €
          </dd>
        </div>
      </dl>

      {/*
        MODIFIER LE STATUT NE MODIFIE JAMAIS LES LIGNES.

        Un devis accepté est un engagement pris avec le client sur des montants
        précis : rouvrir ses lignes après coup permettrait de faire dire au
        document accepté autre chose que ce qui a été signé. Seul l'EN-TÊTE
        (le statut) évolue ; le détail chiffré reste ce qu'il était au moment
        de l'enregistrement.
      */}
      {canManage && quote.status !== 'accepted' && quote.status !== 'refused' && (
        <div className="border-border bg-surface-subtle/50 flex flex-wrap items-center gap-2 rounded-xl border p-3">
          <span className="text-muted-foreground w-full text-xs font-medium sm:w-auto">
            Faire évoluer le statut :
          </span>

          {quote.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs sm:w-auto"
              disabled={updateQuote.isPending}
              onClick={() =>
                updateQuote.mutate(
                  { status: 'sent' },
                  { onSuccess: () => warmUpQuotePdf(quote.id) },
                )
              }
            >
              <Send className="size-3.5" aria-hidden="true" />
              Marquer comme envoyé
            </Button>
          )}

          {quote.status === 'sent' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="border-success/40 text-success hover:bg-success/10 w-full justify-center gap-1.5 text-xs sm:w-auto"
                disabled={updateQuote.isPending}
                onClick={() => updateQuote.mutate({ status: 'accepted' })}
              >
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Marquer comme accepté
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-error/40 text-error hover:bg-error/10 w-full justify-center gap-1.5 text-xs sm:w-auto"
                disabled={updateQuote.isPending}
                onClick={() => updateQuote.mutate({ status: 'refused' })}
              >
                <Ban className="size-3.5" aria-hidden="true" />
                Marquer comme refusé
              </Button>
            </>
          )}
        </div>
      )}

      {/*
        ESPACE CLIENT.

        Un devis n'est visible par le client qu'à deux conditions, toutes deux
        tenues par la base (`portal_list_quotes`) : rattaché à une fiche client,
        et sorti du brouillon. Ce bloc dit laquelle manque, et propose de
        prévenir le client — l'e-mail et la conversation partent par
        `portal-message-send`, jamais depuis le navigateur.
      */}
      {portal.canView && (
        <div className="border-border bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div className="flex items-start gap-2">
            <Globe className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="text-xs">
              <p className="text-foreground font-semibold">Espace client</p>
              <p className="text-muted-foreground">
                {quote.customer_id === null
                  ? 'Ce devis n’est rattaché à aucune fiche client. Rattachez-le pour l’envoyer et le rendre visible dans son espace client — le devis lui-même ne change pas.'
                  : quote.status === 'draft'
                    ? 'Encore en brouillon : invisible pour le client. « Envoyer au client » le marque envoyé et prévient votre interlocuteur.'
                    : quote.client_responded_at !== null
                      ? `${quote.status === 'accepted' ? 'Accepté' : 'Refusé'} par le client depuis son espace le ${formatDate(quote.client_responded_at)}.`
                      : `Visible dans l’espace client de ${quote.customer_name ?? 'ce client'}.`}
              </p>
            </div>
          </div>
          {quote.customer_id === null && canManage && organization && (
            <LinkCustomerControl
              kind="quote"
              documentId={quote.id}
              organizationId={organization.id}
            />
          )}
          {quote.customer_id !== null && portal.canSend && (
            <>
              <Button
                variant={quote.status === 'draft' ? 'primary' : 'outline'}
                size="sm"
                className="w-full justify-center gap-1.5 text-xs sm:w-auto"
                disabled={updateQuote.isPending}
                onClick={() => {
                  if (quote.status === 'draft') {
                    updateQuote.mutate(
                      { status: 'sent' },
                      {
                        onSuccess: () => {
                          warmUpQuotePdf(quote.id);
                          setNotifyOpen(true);
                        },
                      },
                    );
                  } else {
                    setNotifyOpen(true);
                  }
                }}
              >
                <Send className="size-3.5" aria-hidden="true" />
                {quote.status === 'draft' ? 'Envoyer au client' : 'Prévenir le client'}
              </Button>
              <SendToClientDialog
                customerId={quote.customer_id}
                open={notifyOpen}
                onOpenChange={setNotifyOpen}
                title={`Devis ${quote.reference} — prévenir le client`}
                defaultSubject={`Votre devis ${quote.reference}`}
                defaultBody={[
                  'Bonjour,',
                  '',
                  `votre devis ${quote.reference} est disponible dans votre espace client, rubrique « Mes devis ».`,
                  '',
                  'N’hésitez pas à nous répondre pour toute question.',
                  '',
                  organization?.name ?? '',
                ].join('\n')}
                link={{ quoteId: quote.id }}
              />
            </>
          )}
        </div>
      )}

      {portal.canView && (
        <QuoteRemindersCard
          quote={quote}
          canManage={canManage}
          isUpdating={updateQuote.isPending}
          onToggle={(enabled) => updateQuote.mutate({ reminders_enabled: enabled })}
        />
      )}

      {/*
        ZONE IMPRIMABLE : COULEURS EN DUR VOLONTAIRES.

        Même raison que sur `QuotesPage` : ce document part chez le client, à
        l'impression ou en PDF. Il reste noir sur blanc quel que soit le thème
        de l'application.
      */}
      <div
        id="quote-printable-area"
        className="financial-paper financial-paper-a4-preview space-y-6 rounded-sm border p-4 font-sans sm:p-10"
      >
        <div className="financial-paper-accent-bar -mx-4 -mt-4 h-1.5 sm:-mx-10 sm:-mt-10" />
        <div className="financial-paper-border flex flex-col justify-between gap-5 border-b pb-5 sm:flex-row">
          <div className="space-y-3">
            {organization?.logo_url ? (
              <div
                className="financial-paper-company flex items-center justify-center overflow-hidden border border-dashed"
                style={{ width: documentOptions.logoWidth, height: documentOptions.logoHeight }}
              >
                <img
                  src={organization.logo_url}
                  alt="Logo de l’entreprise"
                  className="size-full object-contain p-2"
                />
              </div>
            ) : null}
            <div className="financial-paper-company border border-dashed px-3 py-2">
              <h2 className="financial-paper-brand text-base font-bold tracking-tight">
                {organization?.name ?? 'REZO360 Pro'}
              </h2>
              {organization?.legal_name && organization.legal_name !== organization.name && (
                <p className="financial-paper-text text-xs font-semibold">
                  {organization.legal_name}
                </p>
              )}
              <p className="financial-paper-muted text-2xs mt-1">
                {organization?.registration_number
                  ? `SIRET : ${organization.registration_number}`
                  : ''}
                {organization?.registration_number && organization?.vat_number ? ' • ' : ''}
                {organization?.vat_number ? `TVA : ${organization.vat_number}` : ''}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="financial-paper-label inline-block rounded-md px-2.5 py-1 text-xs font-bold">
              DEVIS N° {quote.reference}
            </span>
            <p className="financial-paper-muted text-2xs mt-1">
              Émis le : {formatDate(quote.issue_date)}
            </p>
            {quote.valid_until && (
              <p className="financial-paper-muted text-2xs">
                Valide jusqu’au : {formatDate(quote.valid_until)}
              </p>
            )}
            {documentOptions.mode === 'electronic' ? (
              <p className="financial-paper-electronic text-3xs mt-2 inline-flex rounded-full px-2.5 py-1 font-bold">
                Prêt pour conversion Factur‑X
              </p>
            ) : null}
          </div>
        </div>

        {documentOptions.showTitle && quote.title ? (
          <h3 className="financial-paper-strong text-lg font-black">{quote.title}</h3>
        ) : null}

        <div className="financial-paper-panel grid grid-cols-1 gap-4 rounded-lg border p-4 text-xs sm:grid-cols-2">
          <div>
            <p className="financial-paper-muted text-3xs font-bold tracking-wider uppercase">
              Destinataire client
            </p>
            <p className="financial-paper-strong mt-0.5 text-sm font-bold">
              {quote.customer_name || 'Client non spécifié'}
            </p>
            {documentOptions.showDeliveryAddress ? (
              <p className="financial-paper-muted text-3xs mt-1 leading-relaxed">
                {customerAddress.length > 0
                  ? customerAddress.join(' · ')
                  : 'Adresse non renseignée'}
              </p>
            ) : null}
            {documentOptions.showRegistrationNumber ? (
              <p className="financial-paper-muted text-3xs mt-1">
                SIREN / SIRET : {customer?.registration_number || 'Non renseigné'}
              </p>
            ) : null}
            {documentOptions.showVatNumber ? (
              <p className="financial-paper-muted text-3xs mt-1">
                TVA : {customer?.vat_number || 'Non renseignée'}
              </p>
            ) : null}
          </div>
          <div>
            <p className="financial-paper-muted text-3xs font-bold tracking-wider uppercase">
              Site d’intervention
            </p>
            <p className="financial-paper-strong mt-0.5 text-sm font-semibold">
              {quote.site_name || 'Site principal'}
            </p>
          </div>
        </div>

        <Table label="Lignes du devis" minWidth="34rem" containerClassName="financial-paper-focus">
          <thead>
            <tr className="financial-paper-table-head border-b font-semibold">
              <th className="px-3 py-2.5">Désignation de la prestation</th>
              <th className="px-2 py-2.5 text-center">Qté</th>
              <th className="px-2 py-2.5 text-center">Unité</th>
              <th className="px-3 py-2.5 text-right">P.U HT</th>
              <th className="px-3 py-2.5 text-right">Total HT</th>
            </tr>
          </thead>
          <tbody className="financial-paper-table-body divide-y">
            {quote.items.map((item) => {
              const priceEuros = toEuros(item.unit_price_cents);
              return (
                <tr key={item.id}>
                  <td className="financial-paper-strong px-3 py-2.5 font-medium">
                    {item.description}
                  </td>
                  <td className="px-2 py-2.5 text-center">{item.quantity}</td>
                  <td className="financial-paper-muted px-2 py-2.5 text-center">{item.unit}</td>
                  <td className="px-3 py-2.5 text-right">{priceEuros.toFixed(2)} €</td>
                  <td className="financial-paper-strong px-3 py-2.5 text-right font-semibold">
                    {(item.quantity * priceEuros).toFixed(2)} €
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>

        {documentOptions.showFreeField && quote.notes ? (
          <div className="financial-paper-company financial-paper-text border border-dashed p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {quote.notes}
          </div>
        ) : null}

        <div className="financial-paper-border-strong flex flex-col items-end justify-between gap-4 border-t pt-4 sm:flex-row">
          <div className="financial-paper-muted text-3xs space-y-2">
            {documentOptions.showAcceptanceTerms ? (
              <>
                <p>
                  <strong>Conditions de règlement :</strong>{' '}
                  {organization?.quote_payment_terms ?? DEFAULT_QUOTE_PAYMENT_TERMS}
                </p>
                <p>
                  <strong>Mode de paiement :</strong>{' '}
                  {organization?.quote_payment_method ?? DEFAULT_QUOTE_PAYMENT_METHOD}
                </p>
              </>
            ) : null}
            {documentOptions.showBankDetails ? (
              <p>
                <strong>Coordonnées bancaires :</strong> IBAN {organization?.iban || 'à compléter'}
                {organization?.bic ? ` · BIC ${organization.bic}` : ''}
              </p>
            ) : null}
          </div>

          <div className="financial-paper-border w-full space-y-1.5 border-t pt-3 text-right text-xs sm:w-56 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <div className="financial-paper-text flex justify-between">
              <span>Total HT :</span>
              <span className="financial-paper-strong font-semibold">{totalHT.toFixed(2)} €</span>
            </div>
            <div className="financial-paper-muted flex justify-between">
              <span>TVA ({quote.vat_rate}%) :</span>
              <span>{totalVAT.toFixed(2)} €</span>
            </div>
            <div className="financial-paper-border-strong financial-paper-total flex justify-between border-t pt-2 text-sm font-bold">
              <span>TOTAL TTC :</span>
              <span className="text-base">{totalTTC.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {documentOptions.showSignature ? (
          <div className="financial-paper-panel financial-paper-border-strong rounded-lg border p-4">
            <div className="financial-paper-text text-2xs flex flex-col items-start justify-between gap-3 sm:flex-row">
              <div>
                <p className="financial-paper-strong font-bold">Bon pour accord et commande :</p>
                <p className="financial-paper-muted text-3xs">
                  Mention manuscrite, date et signature du client.
                </p>
              </div>
              <div className="financial-paper-signature text-3xs flex h-14 w-full items-center justify-center rounded border border-dashed italic sm:w-40">
                Emplacement signature
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/*
        FACTURER, ET SEULEMENT UN DEVIS ACCEPTÉ.

        Proposer le bouton sur un devis encore en discussion inviterait à
        facturer ce que le client n'a pas validé. La condition est donc le
        statut, pas la seule permission.

        La facture naît en BROUILLON : elle reprend les lignes, mais son
        identité de destinataire est relue dans la fiche client — un devis ne
        retient que le nom, une facture doit porter raison sociale, SIRET et
        numéro de TVA. Rien n'est figé tant qu'elle n'est pas émise.
      */}
      {canManage && quote.status === 'accepted' && (
        <Card className="border-primary/20">
          <CardContent className="flex flex-col items-stretch justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-foreground text-xs font-semibold">Facturer ce devis</p>
              <p className="text-muted-foreground text-xs">
                Crée une facture en brouillon reprenant les lignes, le client et les montants. Vous
                pourrez la relire avant de l’émettre.
              </p>
              <FormError error={createInvoice.error} />
            </div>
            <Button
              variant="primary"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs sm:w-auto"
              disabled={createInvoice.isPending}
              onClick={() => {
                if (!quote.organization_id) return;
                createInvoice.mutate(
                  {
                    quoteId: quote.id,
                    organizationId: quote.organization_id,
                    paymentTerms:
                      organization?.id === quote.organization_id
                        ? (organization.quote_payment_terms ?? DEFAULT_QUOTE_PAYMENT_TERMS)
                        : DEFAULT_QUOTE_PAYMENT_TERMS,
                    paymentMethod:
                      organization?.id === quote.organization_id
                        ? (organization.quote_payment_method ?? DEFAULT_QUOTE_PAYMENT_METHOD)
                        : DEFAULT_QUOTE_PAYMENT_METHOD,
                  },
                  { onSuccess: (invoice) => void navigate(ROUTES.invoiceDetail(invoice.id)) },
                );
              }}
            >
              <ReceiptText className="size-3.5" aria-hidden="true" />
              {createInvoice.isPending ? 'Création…' : 'Créer la facture'}
            </Button>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="border-error/20">
          <CardContent className="flex flex-col items-stretch justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-foreground text-xs font-semibold">Supprimer ce devis</p>
              <p className="text-muted-foreground text-xs">
                Le devis et ses lignes sont définitivement retirés. Cette action est irréversible.
              </p>
            </div>
            <Button
              variant="danger-outline"
              size="sm"
              className="w-full justify-center gap-1.5 text-xs sm:w-auto"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Supprimer
            </Button>
          </CardContent>
        </Card>
      )}

      <Modal
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Supprimer ce devis ?"
        description={`Le devis ${quote.reference} et ses lignes seront définitivement supprimés.`}
      >
        <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setIsDeleteConfirmOpen(false)}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            variant="danger-outline"
            disabled={deleteQuote.isPending}
            onClick={handleDelete}
            className="w-full gap-1.5 sm:w-auto"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {deleteQuote.isPending ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
