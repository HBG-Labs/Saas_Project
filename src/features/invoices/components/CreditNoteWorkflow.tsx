import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { FileMinus2 } from 'lucide-react';
import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import type { InvoiceWithItems } from '@/types/domain';
import { formatInvoiceDate } from '@/features/einvoicing';
import {
  useCreateCreditNoteDraft,
  useCreditableInvoiceLines,
  useRelatedCreditNotes,
  useSaveFullCreditNoteDraft,
} from '../hooks/useInvoices';

const money = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

function creditTotal(
  lines: Array<{ quantity: number; unitPriceCents: number; vatRate: number; vatCategory: string }>,
) {
  const groups = new Map<string, { base: number; rate: number }>();
  for (const line of lines) {
    const base = Math.round(line.quantity * line.unitPriceCents);
    const key = `${line.vatCategory}:${line.vatRate}`;
    const group = groups.get(key) ?? { base: 0, rate: line.vatRate };
    group.base += base;
    groups.set(key, group);
  }
  let total = 0;
  for (const group of groups.values())
    total += group.base + Math.round((group.base * group.rate) / 100);
  return total;
}

export function CreateCreditNotePanel({
  invoice,
  canManage,
}: {
  invoice: InvoiceWithItems;
  canManage: boolean;
}) {
  const related = useRelatedCreditNotes(invoice.id);
  const creditable = useCreditableInvoiceLines(invoice.id);
  const create = useCreateCreditNoteDraft();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const total = invoice.totals?.total_cents ?? 0;
  const credits = related.data ?? [];
  const activeDraft = credits.find((credit) => credit.status === 'draft');
  const issuedCredits = credits.filter((credit) => credit.status !== 'draft');
  const lines = creditable.data ?? [];
  const availableLines = lines.filter((line) => line.available_quantity > 0);
  const eligible = total > 0 && invoice.currency === 'EUR' && availableLines.length > 0;
  const selected = availableLines
    .filter((line) => Object.hasOwn(quantities, line.invoice_item_id))
    .map((line) => ({ line, quantity: Number(quantities[line.invoice_item_id]) }))
    .filter(({ quantity }) => Number.isFinite(quantity) && quantity > 0);
  const selectionValid =
    selected.length > 0 &&
    selected.length === Object.keys(quantities).length &&
    selected.every(
      ({ line, quantity }) =>
        quantity <= line.available_quantity &&
        Math.abs(Math.round(quantity * 1000) - quantity * 1000) < 1e-8,
    );
  const scope: 'full' | 'partial' =
    selectionValid &&
    availableLines.length === lines.length &&
    selected.length === lines.length &&
    selected.every(
      ({ line, quantity }) => line.credited_quantity === 0 && quantity === line.original_quantity,
    )
      ? 'full'
      : 'partial';
  const selectedTotal = creditTotal(
    selected.map(({ line, quantity }) => ({
      quantity,
      unitPriceCents: line.unit_price_cents,
      vatRate: line.vat_rate,
      vatCategory: line.vat_category,
    })),
  );
  const prepare = () => {
    create.reset();
    setReason('');
    setQuantities(
      Object.fromEntries(
        availableLines.map((line) => [line.invoice_item_id, String(line.available_quantity)]),
      ),
    );
    setOpen(true);
  };
  return (
    <section
      aria-label="Correction par avoir"
      className="border-border bg-surface rounded-xl border p-4 print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <FileMinus2 className="size-4" aria-hidden="true" /> Correction par avoir
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Retrouvez ici l’avoir associé à cette facture.
          </p>
        </div>
        {activeDraft ? (
          <Link
            className="text-primary text-sm font-semibold hover:underline"
            to={ROUTES.invoiceDetail(activeDraft.id)}
          >
            Ouvrir le brouillon d’avoir
          </Link>
        ) : (
          canManage && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={
                related.isPending ||
                related.isError ||
                creditable.isPending ||
                creditable.isError ||
                !eligible
              }
              onClick={prepare}
            >
              <FileMinus2 className="size-4" aria-hidden="true" />
              Préparer un avoir
            </Button>
          )
        )}
      </div>
      {(related.isError || creditable.isError) && (
        <div className="mt-3">
          <FormError error={related.error ?? creditable.error} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void Promise.all([related.refetch(), creditable.refetch()])}
          >
            Réessayer
          </Button>
        </div>
      )}
      {activeDraft && (
        <p className="text-muted-foreground mt-2 text-xs">
          Un brouillon est déjà préparé. Il n’a pas encore d’effet sur cette facture.
        </p>
      )}
      {!!issuedCredits.length && (
        <div className="mt-3 space-y-1 text-xs">
          <p className="text-muted-foreground font-medium">Avoirs déjà émis</p>
          {issuedCredits.map((credit) => (
            <Link
              key={credit.id}
              to={ROUTES.invoiceDetail(credit.id)}
              className="text-primary block font-medium hover:underline"
            >
              {credit.reference} · {credit.credit_note_scope === 'full' ? 'total' : 'partiel'}
            </Link>
          ))}
        </div>
      )}
      {!eligible && !activeDraft && !creditable.isPending && !creditable.isError && (
        <p className="text-muted-foreground mt-2 text-xs">
          {lines.length > 0 && availableLines.length === 0
            ? 'Toutes les quantités de cette facture ont déjà été créditées.'
            : 'La préparation d’un avoir couvre les factures en euros avec un montant positif.'}
        </p>
      )}
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!create.isPending) setOpen(value);
        }}
        title="Préparer un avoir"
        description="Choisissez les lignes et quantités à créditer, puis relisez le brouillon avant toute émission."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (create.isPending || reason.trim().length < 3 || !selectionValid) return;
            create.mutate(
              {
                invoiceId: invoice.id,
                expectedUpdatedAt: invoice.updated_at,
                reason,
                scope,
                lines: selected.map(({ line, quantity }) => ({
                  invoiceItemId: line.invoice_item_id,
                  quantity,
                })),
              },
              {
                onSuccess: (draft) => {
                  setOpen(false);
                  void navigate(ROUTES.invoiceDetail(draft.id));
                },
              },
            );
          }}
        >
          <div className="border-border bg-surface-subtle rounded-lg border p-3 text-sm">
            <p className="font-semibold">
              {invoice.reference} ·{' '}
              {invoice.issued_at ? formatInvoiceDate(invoice.issued_at) : 'Date à vérifier'}
            </p>
            <p className="text-muted-foreground mt-1">
              {invoice.customer_name || invoice.customer_legal_name}
            </p>
            <p className="mt-2">
              Type : <strong>{scope === 'full' ? 'avoir total' : 'avoir partiel'}</strong>
            </p>
          </div>
          <p className="text-muted-foreground text-sm">
            Le destinataire, les prix et la TVA sont repris de la facture d’origine. Aucun
            remboursement ni aucune émission ne sont déclenchés à cette étape.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Lignes à créditer</legend>
            {availableLines.map((line) => {
              const checked = Object.hasOwn(quantities, line.invoice_item_id);
              return (
                <div
                  key={line.invoice_item_id}
                  className="border-border grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_9rem]"
                >
                  <div className="flex min-w-0 items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${line.description}`}
                      className="mt-1 size-4"
                      checked={checked}
                      onChange={(event) =>
                        setQuantities((current) => {
                          const next = { ...current };
                          if (event.target.checked)
                            next[line.invoice_item_id] = String(line.available_quantity);
                          else delete next[line.invoice_item_id];
                          return next;
                        })
                      }
                    />
                    <span>
                      <span className="block font-medium">{line.description}</span>
                      <span className="text-muted-foreground block text-xs">
                        Disponible : {line.available_quantity} {line.unit}
                        {line.credited_quantity > 0
                          ? ` · déjà crédité : ${line.credited_quantity}`
                          : ''}{' '}
                        · {money(line.unit_price_cents)} HT · TVA {line.vat_rate} %
                      </span>
                    </span>
                  </div>
                  <label
                    htmlFor={`credit-quantity-${line.invoice_item_id}`}
                    className="text-xs font-medium"
                  >
                    Quantité à créditer
                    <input
                      id={`credit-quantity-${line.invoice_item_id}`}
                      type="number"
                      min="0.001"
                      max={line.available_quantity}
                      step="0.001"
                      value={checked ? (quantities[line.invoice_item_id] ?? '') : ''}
                      disabled={!checked}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [line.invoice_item_id]: event.target.value,
                        }))
                      }
                      className="border-border bg-surface text-foreground mt-1 h-10 w-full rounded-md border px-3"
                    />
                  </label>
                </div>
              );
            })}
          </fieldset>
          <p className="border-border bg-surface-subtle rounded-lg border p-3 text-sm">
            Montant estimé à créditer : <strong>{money(selectedTotal)}</strong>
          </p>
          <Textarea
            label="Motif de l’avoir"
            id="credit-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={3}
            maxLength={1000}
            placeholder="Ex. : annulation complète de la prestation à la demande du client."
            disabled={create.isPending}
          />
          <FormError error={create.error} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={create.isPending}
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || reason.trim().length < 3 || !selectionValid}
            >
              {create.isPending ? 'Préparation…' : 'Créer le brouillon d’avoir'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

export function CreditNoteOrigin({ invoice }: { invoice: InvoiceWithItems }) {
  return (
    <section
      aria-label="Facture corrigée"
      className="border-warning/30 bg-warning/5 rounded-lg border p-3 text-sm"
    >
      <p className="font-semibold">
        Avoir {invoice.credit_note_scope === 'partial' ? 'partiel' : 'total'} sur{' '}
        {invoice.corrected_invoice_reference || 'la facture d’origine'}
        {invoice.corrected_invoice_issued_at &&
          ` du ${formatInvoiceDate(invoice.corrected_invoice_issued_at)}`}
      </p>
      {invoice.credit_note_reason && (
        <p className="mt-2 whitespace-pre-wrap">Motif : {invoice.credit_note_reason}</p>
      )}
      {invoice.corrects_invoice_id && (
        <Link
          to={ROUTES.invoiceDetail(invoice.corrects_invoice_id)}
          className="text-primary mt-2 inline-block text-xs font-medium hover:underline print:hidden"
        >
          Voir la facture d’origine
        </Link>
      )}
    </section>
  );
}

function CreditNoteForm({ invoice, onClose }: { invoice: InvoiceWithItems; onClose: () => void }) {
  const save = useSaveFullCreditNoteDraft();
  const [reason, setReason] = useState(invoice.credit_note_reason ?? '');
  const [dueDate, setDueDate] = useState(invoice.due_date ?? '');
  const [terms, setTerms] = useState(invoice.payment_terms ?? '');
  const changed =
    reason !== (invoice.credit_note_reason ?? '') ||
    dueDate !== (invoice.due_date ?? '') ||
    terms !== (invoice.payment_terms ?? '');
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (save.isPending || !changed) return;
        save.mutate(
          {
            invoiceId: invoice.id,
            expectedUpdatedAt: invoice.updated_at,
            reason,
            dueDate,
            paymentTerms: terms,
          },
          { onSuccess: onClose },
        );
      }}
    >
      <CreditNoteOrigin invoice={invoice} />
      <p className="text-muted-foreground text-sm">
        Les lignes sélectionnées, leurs prix, la TVA et le destinataire proviennent de la facture
        d’origine. Vous pouvez préciser le motif et les modalités de remboursement ou d’imputation.
      </p>
      <Textarea
        label="Motif de l’avoir"
        id="edit-credit-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        minLength={3}
        maxLength={1000}
        required
      />
      <Input
        label="Date prévue de remboursement ou d’imputation"
        id="credit-due-date"
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        required
      />
      <Textarea
        label="Modalités de remboursement ou d’imputation"
        id="credit-terms"
        value={terms}
        onChange={(event) => setTerms(event.target.value)}
        minLength={3}
        maxLength={2000}
        required
      />
      <FormError error={save.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={
            save.isPending ||
            !changed ||
            reason.trim().length < 3 ||
            terms.trim().length < 3 ||
            !dueDate
          }
        >
          {save.isPending ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </Button>
      </div>
    </form>
  );
}

export function CreditNoteDraftEditor({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Modifier le brouillon d’avoir"
      description={`${invoice.credit_note_scope === 'partial' ? 'Avoir partiel' : 'Avoir total'} lié à la facture d’origine.`}
    >
      {open && <CreditNoteForm invoice={invoice} onClose={() => onOpenChange(false)} />}
    </Modal>
  );
}
