import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Lock,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import {
  emetteurFacture,
  ExportUblPanel,
  TransmissionStatusPanel,
  mentionsReglement,
  OPERATION_LABELS,
  validerFactureAvantEmission,
  type Cible,
  type Manque,
} from '@/features/einvoicing';
import {
  estFigee,
  CreateCreditNotePanel,
  CreditNoteDraftEditor,
  CreditNoteOrigin,
  InvoiceDraftEditor,
  toEuros,
  useDeleteInvoice,
  useInvoice,
  useIssueInvoice,
  useUpdateInvoice,
} from '@/features/invoices';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { formatInvoiceDate } from '@/features/einvoicing';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { InvoiceStatus } from '@/types/database';

/**
 * Le lien de correction, décidé ICI et non par la règle.
 *
 * Une règle réglementaire qui sait où vit un bouton n'est plus testable seule,
 * et déménage avec lui. Elle rend une cible ; la page en déduit la route.
 */
const LIBELLE_CORRECTION: Record<Cible, string> = {
  organisation: 'Compléter mon entreprise',
  client: 'Modifier le client',
  facture: 'Corriger la facture',
};

function lienDeCorrection(manque: Manque, customerId: string | null): string {
  if (manque.cible === 'organisation') return ROUTES.organizationEinvoicing;
  // Le client a pu être supprimé depuis : on retombe sur la liste plutôt que
  // sur une fiche qui n'existe plus.
  if (manque.cible === 'client') {
    return customerId === null ? ROUTES.customers : ROUTES.customer(customerId);
  }
  return ROUTES.invoices;
}

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  draft: { label: 'Brouillon', variant: 'neutral' },
  issued: { label: 'Émise', variant: 'info' },
  sent: { label: 'Envoyée', variant: 'info' },
  paid: { label: 'Payée', variant: 'success' },
  cancelled: { label: 'Annulée', variant: 'error' },
};

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const canManage = can(PERMISSIONS.invoiceManage);

  const invoiceQuery = useInvoice(invoiceId);
  const invoice = invoiceQuery.data ?? null;

  const updateInvoice = useUpdateInvoice(invoiceId ?? '');
  const issueInvoice = useIssueInvoice(invoiceId ?? '');
  const deleteInvoice = useDeleteInvoice();

  const [edition, setEdition] = useState(false);
  const [confirmationEmission, setConfirmationEmission] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);

  useDocumentTitle(
    invoice
      ? invoice.status === 'draft'
        ? invoice.document_type === 'credit_note'
          ? 'Brouillon d’avoir'
          : 'Brouillon de facture'
        : `${invoice.document_type === 'credit_note' ? 'Avoir' : 'Facture'} ${invoice.reference}`
      : 'Facture',
  );

  if (invoiceQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <ErrorState error={invoiceQuery.error} onRetry={() => void invoiceQuery.refetch()} />
      </div>
    );
  }

  if (invoiceQuery.isPending || invoice === null) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-8" aria-hidden="true">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const status = STATUS_CONFIG[invoice.status];
  const figee = estFigee(invoice);

  const verdict = validerFactureAvantEmission(invoice, organization);
  const seller = emetteurFacture(invoice, organization);
  const estAvoir = invoice.document_type === 'credit_note';
  const totalHT = invoice.totals ? toEuros(invoice.totals.subtotal_cents) : 0;
  const totalTVA = invoice.totals ? toEuros(invoice.totals.vat_cents) : 0;
  const totalTTC = invoice.totals ? toEuros(invoice.totals.total_cents) : 0;

  const libelle = estAvoir ? 'AVOIR' : 'FACTURE';

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <Link
        to={ROUTES.invoices}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors print:hidden"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Factures
      </Link>

      <div className="print:hidden">
        <PageHeader
          title={
            invoice.status === 'draft'
              ? estAvoir
                ? 'Brouillon d’avoir'
                : 'Brouillon de facture'
              : invoice.reference
          }
          description={invoice.customer_name || invoice.title || 'Client non renseigné'}
          actions={
            <>
              <Badge variant={status.variant} className="self-center">
                {estAvoir && invoice.status === 'paid' ? 'Remboursé / imputé' : status.label}
              </Badge>
              <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                <Download className="size-4" aria-hidden="true" />
                PDF
              </Button>
            </>
          }
        />
      </div>

      <FormError error={updateInvoice.error ?? issueInvoice.error ?? deleteInvoice.error} />

      {/*
        L'ÉMISSION EST LE SEUL GESTE IRRÉVERSIBLE DE CETTE PAGE.

        Passé ce clic, la base refuse toute modification du contenu et toute
        suppression : la correction passe alors par un avoir. Le dire AVANT
        plutôt que d'afficher une erreur après est la moindre des choses — un
        artisan qui découvre l'irréversibilité au message d'échec a déjà perdu
        confiance dans l'outil.
      */}
      {/*
        CE QUI MANQUE, DIT AVANT LE CLIC ET DANS LA LANGUE DE L'UTILISATEUR.

        Pas « HTTP 422 », pas « contrainte violée » : le champ qui manque, et où
        aller le remplir. Le bouton d'émission reste inactif tant qu'un manque
        bloquant subsiste — une facture émise ne se corrige plus qu'avec un
        avoir, il vaut mieux empêcher que réparer.

        Les avertissements, eux, n'empêchent rien : ils annoncent ce que la
        transmission électronique exigera à partir du 1er septembre 2027.
      */}
      {canManage && !figee && verdict.manques.length > 0 && (
        <div
          className={`rounded-xl border p-4 print:hidden ${
            verdict.emissionPossible
              ? 'border-warning/30 bg-warning/5'
              : 'border-error/30 bg-error/5'
          }`}
        >
          <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle
              className={`size-4 ${verdict.emissionPossible ? 'text-warning' : 'text-error'}`}
              aria-hidden="true"
            />
            {verdict.emissionPossible
              ? 'Cette facture peut être émise, mais il manque des informations'
              : 'Cette facture ne peut pas être émise'}
          </p>

          <ul className="mt-3 space-y-2">
            {verdict.manques.map((manque) => (
              <li key={manque.code} className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    manque.gravite === 'bloquant' ? 'bg-error' : 'bg-warning'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{manque.message}</span>
                {manque.cible === 'organisation' ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link to={lienDeCorrection(manque, invoice.customer_id)}>
                      {LIBELLE_CORRECTION[manque.cible]}
                    </Link>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setEdition(true)}>
                    Corriger le brouillon
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {!verdict.emissionPossible && (
            <p className="text-muted-foreground text-2xs mt-3 leading-relaxed">
              Une facture émise ne peut plus être corrigée : il faudrait émettre un avoir. C’est
              pourquoi ces informations sont demandées maintenant.
            </p>
          )}
        </div>
      )}

      {canManage && !figee && (
        <div className="border-border bg-surface-subtle/50 flex flex-wrap items-center gap-2 rounded-xl border p-3 print:hidden">
          <span className="text-muted-foreground text-xs font-medium">Brouillon :</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEdition(true)}>
            <Pencil className="size-3.5" aria-hidden="true" />
            Modifier le brouillon
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={issueInvoice.isPending || !verdict.emissionPossible}
            onClick={() => setConfirmationEmission(true)}
          >
            <Lock className="size-3.5" aria-hidden="true" />
            {estAvoir ? 'Émettre l’avoir' : 'Émettre la facture'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-error/40 text-error hover:bg-error/10 gap-1.5 text-xs"
            disabled={deleteInvoice.isPending}
            onClick={() => setConfirmationSuppression(true)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Supprimer
          </Button>
        </div>
      )}

      {canManage && figee && invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
        <div className="border-border bg-surface-subtle/50 flex flex-wrap items-center gap-2 rounded-xl border p-3 print:hidden">
          <span className="text-muted-foreground text-xs font-medium">Faire évoluer :</span>

          {invoice.status === 'issued' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={updateInvoice.isPending}
              onClick={() => updateInvoice.mutate({ status: 'sent' })}
            >
              <Send className="size-3.5" aria-hidden="true" />
              Marquer comme envoyée
            </Button>
          )}

          {/*
            « Marquer comme payée » est une DÉCLARATION de l'utilisateur, pas un
            constat de REZO360 : aucun encaissement n'est rapproché ici. Le
            libellé le dit, et rien dans cette page n'affiche « impayée » — on
            ne prête pas à un client un défaut de paiement qu'on n'a pas
            constaté.
          */}
          <Button
            variant="outline"
            size="sm"
            className="border-success/40 text-success hover:bg-success/10 gap-1.5 text-xs"
            disabled={updateInvoice.isPending}
            onClick={() => updateInvoice.mutate({ status: 'paid' })}
          >
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {estAvoir ? 'Marquer comme remboursé / imputé' : 'Marquer comme payée'}
          </Button>

          <p className="text-muted-foreground w-full text-xs">
            Suivi manuel : ces actions ne transmettent aucune facture et ne déclenchent aucun
            paiement. Une correction du montant après émission nécessite un avoir.
          </p>
        </div>
      )}

      {!estAvoir && ['issued', 'sent', 'paid'].includes(invoice.status) && (
        <CreateCreditNotePanel
          key={`credit-${invoice.id}`}
          invoice={invoice}
          canManage={canManage}
        />
      )}
      <ExportUblPanel key={`export-${invoice.id}`} invoice={invoice} organization={organization} />
      {invoice.status !== 'draft' && (
        <TransmissionStatusPanel
          invoiceId={invoice.id}
          organizationId={invoice.organization_id}
          canManage={canManage}
          customerType={invoice.customer_type}
        />
      )}

      {/*
        ZONE IMPRIMABLE : COULEURS EN DUR VOLONTAIRES.

        Ce document part chez le client, à l'impression ou en PDF. Il reste noir
        sur blanc quel que soit le thème de l'application.

        ET CE N'EST PAS LA FACTURE ÉLECTRONIQUE RÉGLEMENTAIRE. Un PDF lisible
        par un humain ne vaut pas données structurées : la transmission passera
        par un format normalisé (UBL, CII, Factur-X) et une plateforme agréée.
        Ce document reste ce qu'il a toujours été — la version lisible.
      */}
      <div
        id="invoice-printable-area"
        className="space-y-6 rounded-xl border border-slate-300 bg-white p-6 font-sans text-slate-900 shadow-2xl sm:p-8"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-blue-900">
              {seller.name || seller.legal_name || 'Émetteur à renseigner'}
            </h2>
            {seller.legal_name && seller.legal_name !== seller.name && (
              <p className="text-xs font-semibold text-slate-600">{seller.legal_name}</p>
            )}
            <p className="text-2xs mt-1 text-slate-500">
              {seller.registration_number ? `SIRET : ${seller.registration_number}` : ''}
              {seller.registration_number && seller.vat_number ? ' • ' : ''}
              {seller.vat_number ? `TVA : ${seller.vat_number}` : ''}
            </p>
          </div>

          <div className="text-right">
            <span
              className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold ${
                estAvoir ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
              }`}
            >
              {invoice.status === 'draft'
                ? `${libelle} — BROUILLON`
                : `${libelle} N° ${invoice.reference}`}
            </span>
            <p className="text-2xs mt-1 text-slate-500">
              {invoice.issued_at
                ? `${estAvoir ? 'Émis' : 'Émise'} le : ${formatInvoiceDate(invoice.issued_at)}`
                : estAvoir
                  ? 'Brouillon — non émis'
                  : 'Brouillon — non émise'}
            </p>
            {invoice.due_date && (
              <p className="text-2xs text-slate-500">
                {estAvoir ? 'Remboursement / imputation prévu le' : 'Échéance'} :{' '}
                {formatInvoiceDate(invoice.due_date)}
              </p>
            )}
          </div>
        </div>

        {estAvoir && <CreditNoteOrigin invoice={invoice} />}
        <div className="text-xs text-slate-600">
          <p>
            {[
              seller.address_line1,
              seller.address_line2,
              seller.postal_code,
              seller.city,
              seller.country,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p>
            {[
              seller.legal_form,
              seller.rcs_city ? 'RCS ' + seller.rcs_city : null,
              seller.share_capital_cents != null
                ? 'Capital : ' + toEuros(seller.share_capital_cents).toFixed(2) + ' €'
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {/*
          L'identité du destinataire vient de l'INSTANTANÉ figé sur la facture,
          jamais de la fiche client actuelle : une facture doit continuer
          d'énoncer ce qui était vrai le jour de son émission, même si le client
          a déménagé ou changé de raison sociale depuis.
        */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
          <div>
            <p className="text-3xs font-bold tracking-wider text-slate-500 uppercase">
              Destinataire
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {invoice.customer_name || 'Client non spécifié'}
            </p>
            {invoice.customer_legal_name && (
              <p className="text-2xs text-slate-600">{invoice.customer_legal_name}</p>
            )}
            {(invoice.customer_address_line1 || invoice.customer_city) && (
              <p className="text-2xs mt-1 text-slate-600">
                {invoice.customer_address_line1}
                {invoice.customer_address_line1 && <br />}
                {[invoice.customer_postal_code, invoice.customer_city].filter(Boolean).join(' ')}
              </p>
            )}
            <p className="text-2xs mt-1 text-slate-500">
              {invoice.customer_registration_number
                ? `SIRET : ${invoice.customer_registration_number}`
                : ''}
              {invoice.customer_registration_number && invoice.customer_vat_number ? ' • ' : ''}
              {invoice.customer_vat_number ? `TVA : ${invoice.customer_vat_number}` : ''}
            </p>
          </div>
          <div>
            <p className="text-3xs font-bold tracking-wider text-slate-500 uppercase">
              Site d’intervention
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {invoice.site_name || 'Site principal'}
            </p>
          </div>
        </div>

        <div className="scroll-x">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 font-semibold text-slate-700">
                <th className="px-3 py-2.5">Désignation</th>
                <th className="px-2 py-2.5 text-center">Qté</th>
                <th className="px-2 py-2.5 text-center">Unité</th>
                <th className="px-3 py-2.5 text-right">P.U HT</th>
                <th className="px-2 py-2.5 text-center">TVA</th>
                <th className="px-3 py-2.5 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {invoice.items.map((item) => {
                const prixEuros = toEuros(item.unit_price_cents);
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5 font-medium text-slate-900">{item.description}</td>
                    <td className="px-2 py-2.5 text-center tabular-nums">{item.quantity}</td>
                    <td className="px-2 py-2.5 text-center text-slate-500">{item.unit}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {prixEuros.toFixed(2)} €
                    </td>
                    <td className="px-2 py-2.5 text-center text-slate-500 tabular-nums">
                      {item.vat_rate} %
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                      {(item.quantity * prixEuros).toFixed(2)} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 text-xs text-slate-600">
          {invoice.service_date && (
            <p>Date de prestation ou de livraison : {formatInvoiceDate(invoice.service_date)}</p>
          )}
          {invoice.operation_type && (
            <p>Nature de l’opération : {OPERATION_LABELS[invoice.operation_type]}</p>
          )}
          {invoice.buyer_reference && <p>Référence acheteur : {invoice.buyer_reference}</p>}
          {invoice.purchase_order_reference && (
            <p>Bon de commande : {invoice.purchase_order_reference}</p>
          )}
          {invoice.delivery_address_line1 && (
            <p>
              Livraison :{' '}
              {[
                invoice.delivery_address_line1,
                invoice.delivery_address_line2,
                invoice.delivery_postal_code,
                invoice.delivery_city,
                invoice.delivery_country,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
          {invoice.vat_on_debits && <p>Option pour le paiement de la taxe d’après les débits.</p>}
        </div>
        <div className="flex flex-col items-end justify-between gap-4 border-t border-slate-300 pt-4 sm:flex-row">
          <div className="text-3xs space-y-1 text-slate-500">
            {mentionsReglement(invoice).map((mention, index) => (
              <p key={index}>{mention}</p>
            ))}
            {invoice.payment_method && (
              <p>
                <strong>Mode de paiement :</strong> {invoice.payment_method}
              </p>
            )}
          </div>

          <div className="w-full space-y-1.5 border-t border-slate-200 pt-3 text-right text-xs sm:w-64 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <div className="flex justify-between text-slate-600">
              <span>Total HT :</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {totalHT.toFixed(2)} €
              </span>
            </div>

            {/*
              UNE LIGNE PAR TAUX, et non un taux unique comme sur un devis.
              L'artisan facture couramment 8,5 % de main-d'œuvre et 20 % de
              fournitures ; EN 16931 exige ce détail, et l'arrondi se fait sur
              la base groupée — c'est la vue SQL qui le calcule, jamais cette
              page.
            */}
            {invoice.vatBreakdown.map((ligne) => (
              <div
                key={`${ligne.vat_rate}-${ligne.vat_category}`}
                className="flex justify-between text-slate-500"
              >
                <span>
                  TVA {ligne.vat_rate} % (base {toEuros(ligne.base_cents).toFixed(2)} €) :
                </span>
                <span className="tabular-nums">{toEuros(ligne.vat_cents).toFixed(2)} €</span>
              </div>
            ))}

            {invoice.vatBreakdown.length === 0 && (
              <div className="flex justify-between text-slate-500">
                <span>TVA :</span>
                <span className="tabular-nums">{totalTVA.toFixed(2)} €</span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-blue-900">
              <span>{estAvoir ? 'TOTAL À CRÉDITER :' : 'TOTAL TTC :'}</span>
              <span className="text-base text-blue-900 tabular-nums">{totalTTC.toFixed(2)} €</span>
            </div>
          </div>
        </div>
        <div className="space-y-1 border-t border-slate-200 pt-4 text-xs text-slate-600">
          {seller.vat_regime === 'franchise' && <p>TVA non applicable, art. 293 B du CGI.</p>}
          {[
            ...new Set(
              invoice.items.map((item) => item.vat_exemption_reason?.trim()).filter(Boolean),
            ),
          ].map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          {seller.iban && !estAvoir && (
            <p>
              IBAN : {seller.iban}
              {seller.bic ? ' · BIC : ' + seller.bic : ''}
            </p>
          )}
        </div>
      </div>

      {!figee && canManage && !estAvoir && (
        <InvoiceDraftEditor invoice={invoice} open={edition} onOpenChange={setEdition} />
      )}
      {!figee && canManage && estAvoir && (
        <CreditNoteDraftEditor invoice={invoice} open={edition} onOpenChange={setEdition} />
      )}

      <Modal
        open={confirmationEmission}
        onOpenChange={setConfirmationEmission}
        title={estAvoir ? 'Émettre cet avoir ?' : 'Émettre cette facture ?'}
        description="Ce geste est définitif."
      >
        <div className="space-y-4">
          {estAvoir ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Un numéro d’avoir définitif sera attribué. Ce document créditera la totalité de la
              facture {invoice.corrected_invoice_reference} et sera figé. La facture d’origine reste
              conservée. Aucun remboursement ni envoi automatique ne sera effectué.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Un numéro définitif sera attribué à cette facture. Une fois émise, elle ne pourra plus
              être modifiée ni supprimée — ni son contenu, ni ses lignes, ni son numéro. Une erreur
              découverte ensuite se corrige en émettant un{' '}
              <strong className="text-foreground">avoir</strong>.
            </p>
          )}
          <p className="text-muted-foreground text-sm leading-relaxed">
            Vérifiez le destinataire, les lignes et les taux de TVA avant de continuer.
          </p>
          <FormError error={issueInvoice.error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmationEmission(false)}>
              Relire d’abord
            </Button>
            <Button
              variant="primary"
              disabled={issueInvoice.isPending || !verdict.emissionPossible}
              onClick={() => {
                issueInvoice.mutate(invoice.updated_at, {
                  onSuccess: () => setConfirmationEmission(false),
                });
              }}
            >
              {issueInvoice.isPending ? 'Émission…' : 'Émettre définitivement'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmationSuppression}
        onOpenChange={setConfirmationSuppression}
        title="Supprimer ce brouillon ?"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Le brouillon sera supprimé. Un brouillon ne consomme aucun numéro dans la série des
            factures émises.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmationSuppression(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={deleteInvoice.isPending}
              onClick={() => {
                deleteInvoice.mutate(invoice.id, {
                  onSuccess: () => {
                    setConfirmationSuppression(false);
                    void navigate(ROUTES.invoices);
                  },
                });
              }}
            >
              {deleteInvoice.isPending ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
