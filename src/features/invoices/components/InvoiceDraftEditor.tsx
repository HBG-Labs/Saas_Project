import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useCustomer } from '@/features/customers';
import { frenchRegistrationError, frenchVatError } from '@/lib/business-identifiers';
import type { InvoiceWithItems } from '@/types/domain';
import { DEFAULT_EARLY_PAYMENT_TERMS, suggestedOperationType } from '../draft-defaults';
import { useSaveInvoiceDraft } from '../hooks/useInvoices';

const decimal = z
  .string()
  .refine(
    (value) => /^\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)),
    'Indiquez un nombre positif ou nul.',
  );
const schema = z.object({
  name: z.string().trim().max(150),
  legalName: z.string().trim().max(150),
  type: z.enum(['', 'company', 'individual', 'public_body']),
  registrationNumber: z.string().trim().max(50),
  vatNumber: z.string().trim().max(50),
  address: z.string().trim().max(150),
  addressLine2: z.string().trim().max(150),
  postalCode: z.string().trim().max(20),
  city: z.string().trim().max(100),
  country: z.string().trim().toUpperCase().length(2).or(z.literal('')),
  serviceDate: z.iso.date().or(z.literal('')),
  operationType: z.enum(['', 'goods', 'services', 'mixed']),
  buyerReference: z.string().trim().max(150),
  purchaseOrderReference: z.string().trim().max(150),
  deliveryAddress: z.string().trim().max(150),
  deliveryAddressLine2: z.string().trim().max(150),
  deliveryPostalCode: z.string().trim().max(20),
  deliveryCity: z.string().trim().max(100),
  deliveryCountry: z.string().trim().toUpperCase().length(2).or(z.literal('')),
  earlyPaymentTerms: z.string().trim().max(1000),
  latePaymentTerms: z.string().trim().max(1000),
  vatOnDebits: z.enum(['', 'yes', 'no']),
  dueDate: z.iso.date().or(z.literal('')),
  terms: z.string().trim().max(2000),
  method: z.string().trim().max(500),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, 'Décrivez la prestation.').max(2000),
        unit: z.string().trim().min(1, 'Indiquez une unité.').max(20),
        quantity: decimal.refine(
          (value) => Number(value) <= 999999999 && (value.split('.')[1]?.length ?? 0) <= 3,
          'Trois décimales au maximum.',
        ),
        price: decimal.refine(
          (value) => Number(value) <= 21474836.47 && (value.split('.')[1]?.length ?? 0) <= 2,
          'Deux décimales au maximum.',
        ),
        rate: decimal.refine(
          (value) => Number(value) <= 100 && (value.split('.')[1]?.length ?? 0) <= 2,
          'Taux de 0 à 100 %, deux décimales au maximum.',
        ),
        category: z.enum(['S', 'Z', 'E', 'AE', 'K', 'G', 'O']),
        exemption: z.string().trim().max(500),
      }),
    )
    .max(500),
});
type Values = z.infer<typeof schema>;
const nullable = (value: string) => value || null;

function DraftForm({ invoice, onClose }: { invoice: InvoiceWithItems; onClose: () => void }) {
  const save = useSaveInvoiceDraft(invoice.id);
  const customer = useCustomer(invoice.customer_id ?? undefined);
  const needsOperationSuggestion =
    invoice.operation_type === null || invoice.operation_type === undefined;
  const needsEarlyPaymentSuggestion =
    invoice.early_payment_terms === null || invoice.early_payment_terms === undefined;
  const suggestedOperation = invoice.operation_type ?? suggestedOperationType(invoice.items);
  const hasSuggestions = needsOperationSuggestion || needsEarlyPaymentSuggestion;
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: invoice.customer_name ?? '',
      legalName: invoice.customer_legal_name ?? '',
      type: invoice.customer_type ?? '',
      registrationNumber: invoice.customer_registration_number ?? '',
      vatNumber: invoice.customer_vat_number ?? '',
      address: invoice.customer_address_line1 ?? '',
      addressLine2: invoice.customer_address_line2 ?? '',
      postalCode: invoice.customer_postal_code ?? '',
      city: invoice.customer_city ?? '',
      country: invoice.customer_country ?? 'FR',
      serviceDate: invoice.service_date ?? '',
      operationType: suggestedOperation ?? '',
      buyerReference: invoice.buyer_reference ?? '',
      purchaseOrderReference: invoice.purchase_order_reference ?? '',
      deliveryAddress: invoice.delivery_address_line1 ?? '',
      deliveryAddressLine2: invoice.delivery_address_line2 ?? '',
      deliveryPostalCode: invoice.delivery_postal_code ?? '',
      deliveryCity: invoice.delivery_city ?? '',
      deliveryCountry: invoice.delivery_country ?? '',
      earlyPaymentTerms: invoice.early_payment_terms ?? DEFAULT_EARLY_PAYMENT_TERMS,
      latePaymentTerms: invoice.late_payment_terms ?? '',
      vatOnDebits: invoice.vat_on_debits == null ? '' : invoice.vat_on_debits ? 'yes' : 'no',
      dueDate: invoice.due_date ?? '',
      terms: invoice.payment_terms ?? '',
      method: invoice.payment_method ?? '',
      items: invoice.items.map((item) => ({
        description: item.description,
        unit: item.unit,
        quantity: String(item.quantity),
        price: (item.unit_price_cents / 100).toFixed(2),
        rate: String(item.vat_rate),
        category: item.vat_category,
        exemption: item.vat_exemption_reason ?? '',
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [customerType, country, registrationNumber, vatNumber] = useWatch({
    control,
    name: ['type', 'country', 'registrationNumber', 'vatNumber'],
  });
  const professional = customerType === 'company' || customerType === 'public_body';
  const registrationIssue = professional
    ? frenchRegistrationError(registrationNumber, country)
    : undefined;
  const vatIssue = professional ? frenchVatError(vatNumber, country) : undefined;
  const [refreshed, setRefreshed] = useState(false);
  function refreshCustomer() {
    const c = customer.data;
    if (!c) return;
    const values = {
      name: c.name,
      legalName: c.legal_name ?? '',
      type: c.customer_type ?? '',
      registrationNumber: c.registration_number ?? '',
      vatNumber: c.vat_number ?? '',
      address: c.address_line1 ?? '',
      addressLine2: c.address_line2 ?? '',
      postalCode: c.postal_code ?? '',
      city: c.city ?? '',
      country: c.country ?? '',
    } as const;
    for (const key of Object.keys(values) as (keyof typeof values)[])
      setValue(key, values[key], { shouldDirty: true });
    setRefreshed(true);
  }
  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        patch: {
          customer_name: nullable(values.name),
          customer_legal_name: nullable(values.legalName),
          customer_type: values.type || null,
          customer_registration_number: nullable(values.registrationNumber),
          customer_vat_number: nullable(values.vatNumber),
          customer_address_line1: nullable(values.address),
          customer_address_line2: nullable(values.addressLine2),
          customer_postal_code: nullable(values.postalCode),
          customer_city: nullable(values.city),
          customer_country: nullable(values.country),
          service_date: nullable(values.serviceDate),
          operation_type: values.operationType || null,
          buyer_reference: nullable(values.buyerReference),
          purchase_order_reference: nullable(values.purchaseOrderReference),
          delivery_address_line1: nullable(values.deliveryAddress),
          delivery_address_line2: nullable(values.deliveryAddressLine2),
          delivery_postal_code: nullable(values.deliveryPostalCode),
          delivery_city: nullable(values.deliveryCity),
          delivery_country: nullable(values.deliveryCountry),
          early_payment_terms: nullable(values.earlyPaymentTerms),
          late_payment_terms: nullable(values.latePaymentTerms),
          vat_on_debits: values.vatOnDebits === '' ? null : values.vatOnDebits === 'yes',
          due_date: nullable(values.dueDate),
          payment_terms: nullable(values.terms),
          payment_method: nullable(values.method),
        },
        expectedUpdatedAt: invoice.updated_at,
        items: values.items.map((item) => ({
          description: item.description,
          unit: item.unit,
          quantity: Number(item.quantity),
          priceEuros: Number(item.price),
          vatRate: Number(item.rate),
          vatCategory: item.category,
          vatExemptionReason: item.exemption,
        })),
      });
      onClose();
    } catch {
      /* L'erreur reste visible ; aucune saisie n'est effacée. */
    }
  });
  const error = (name: keyof Values) =>
    errors[name]?.message ? { error: errors[name].message } : {};
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormError error={save.error} />
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
        {hasSuggestions && (
          <p
            role="status"
            className="border-primary/20 bg-primary/5 text-muted-foreground rounded-lg border px-3 py-2 text-xs"
          >
            Des valeurs sûres ont été proposées depuis le devis. Elles restent modifiables ;
            enregistrez le brouillon pour les conserver.
          </p>
        )}
        <section className="space-y-4" aria-label="Destinataire de la facture">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-foreground text-sm font-semibold">Destinataire</h3>
            {invoice.customer_id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshCustomer}
                disabled={!customer.data || customer.isFetching}
                className="gap-1.5"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Reprendre la fiche client
              </Button>
            )}
          </div>
          {customer.isError && (
            <p className="text-warning text-xs">
              La fiche client est indisponible. Vous pouvez compléter les informations ci-dessous.
            </p>
          )}
          {refreshed && (
            <p role="status" className="text-success text-xs">
              Informations reprises. Enregistrez pour les appliquer à ce brouillon.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Ces changements concernent cette facture. La fiche client reste indépendante.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom du client" {...register('name')} {...error('name')} />
            <Input
              label="Raison sociale du client"
              {...register('legalName')}
              {...error('legalName')}
            />
          </div>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                label="Type de client"
                value={field.value || 'unknown'}
                disabled={isSubmitting}
                onValueChange={(value) => field.onChange(value === 'unknown' ? '' : value)}
                options={[
                  { value: 'unknown', label: 'À renseigner' },
                  { value: 'company', label: 'Entreprise' },
                  { value: 'individual', label: 'Particulier' },
                  { value: 'public_body', label: 'Organisme public' },
                ]}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="SIRET / identifiant du client"
              {...register('registrationNumber')}
              {...(registrationIssue ? { error: registrationIssue } : {})}
              {...error('registrationNumber')}
            />
            <Input
              label="N° TVA du client"
              {...register('vatNumber')}
              {...(vatIssue ? { error: vatIssue } : {})}
              {...error('vatNumber')}
            />
          </div>
          {(registrationIssue || vatIssue) && (
            <p className="text-muted-foreground text-xs">
              Vous pouvez enregistrer ce brouillon. Corrigez les identifiants signalés avant de
              l’émettre.
            </p>
          )}
          <Input label="Adresse du client" {...register('address')} {...error('address')} />
          <Input
            label="Complément d’adresse"
            {...register('addressLine2')}
            {...error('addressLine2')}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Code postal" {...register('postalCode')} {...error('postalCode')} />
            <Input label="Ville" {...register('city')} {...error('city')} />
            <Input label="Pays" {...register('country')} {...error('country')} />
          </div>
        </section>
        <section className="border-border space-y-4 border-t pt-5" aria-label="Opération facturée">
          <h3 className="text-foreground text-sm font-semibold">Opération facturée</h3>
          <Input
            label="Date de prestation ou de livraison"
            type="date"
            hint="Date effective de fin de prestation ou de livraison."
            {...register('serviceDate')}
            {...error('serviceDate')}
          />
          <Controller
            control={control}
            name="operationType"
            render={({ field }) => (
              <Select
                label="Nature de l’opération"
                value={field.value || 'unknown'}
                disabled={isSubmitting}
                onValueChange={(v) => field.onChange(v === 'unknown' ? '' : v)}
                options={[
                  { value: 'unknown', label: 'À renseigner' },
                  { value: 'goods', label: 'Vente de biens' },
                  { value: 'services', label: 'Prestation de services' },
                  { value: 'mixed', label: 'Biens et services' },
                ]}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Référence acheteur"
              hint="Service ou référence demandé par votre client."
              {...register('buyerReference')}
              {...error('buyerReference')}
            />
            <Input
              label="Bon de commande du client"
              {...register('purchaseOrderReference')}
              {...error('purchaseOrderReference')}
            />
          </div>
          <details className="border-border rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Livraison à une autre adresse
            </summary>
            <p className="text-muted-foreground mt-3 text-xs">
              Laissez ces champs vides si l’adresse du client convient.
            </p>
            <div className="mt-3 space-y-3">
              <Input
                label="Adresse de livraison"
                {...register('deliveryAddress')}
                {...error('deliveryAddress')}
              />
              <Input
                label="Complément de livraison"
                {...register('deliveryAddressLine2')}
                {...error('deliveryAddressLine2')}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Code postal de livraison"
                  {...register('deliveryPostalCode')}
                  {...error('deliveryPostalCode')}
                />
                <Input
                  label="Ville de livraison"
                  {...register('deliveryCity')}
                  {...error('deliveryCity')}
                />
                <Input
                  label="Pays de livraison"
                  hint="Code de deux lettres, par exemple FR."
                  {...register('deliveryCountry')}
                  {...error('deliveryCountry')}
                />
              </div>
            </div>
          </details>
        </section>
        <section className="border-border space-y-4 border-t pt-5" aria-label="Règlement">
          <h3 className="text-foreground text-sm font-semibold">Règlement</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date d’échéance"
              type="date"
              {...register('dueDate')}
              {...error('dueDate')}
            />
            <Input label="Mode de règlement" {...register('method')} {...error('method')} />
          </div>
          <Textarea
            label="Conditions d’escompte"
            hint="Par exemple : Escompte pour paiement anticipé : néant. À adapter à vos conditions."
            {...register('earlyPaymentTerms')}
            {...error('earlyPaymentTerms')}
          />
          <Textarea
            label="Pénalités de retard"
            hint="Précisez le taux applicable aux clients professionnels. L’indemnité de recouvrement de 40 € sera mentionnée pour ces clients uniquement."
            {...register('latePaymentTerms')}
            {...error('latePaymentTerms')}
          />
          <Textarea
            label="Conditions de règlement"
            hint="Renseignez les conditions applicables à ce client, notamment les pénalités de retard lorsqu’elles s’appliquent."
            {...register('terms')}
            {...error('terms')}
          />
        </section>
        <section
          className="border-border space-y-4 border-t pt-5"
          aria-label="Lignes de la facture"
        >
          <h3 className="text-foreground text-sm font-semibold">Prestations et TVA</h3>
          <Controller
            control={control}
            name="vatOnDebits"
            render={({ field }) => (
              <Select
                label="Option TVA d’après les débits"
                value={field.value || 'unknown'}
                disabled={isSubmitting}
                onValueChange={(v) => field.onChange(v === 'unknown' ? '' : v)}
                options={[
                  { value: 'unknown', label: 'À confirmer' },
                  { value: 'no', label: 'Non' },
                  { value: 'yes', label: 'Oui, option exercée' },
                ]}
              />
            )}
          />
          {fields.map((field, index) => (
            <div key={field.id} className="border-border space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Ligne {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Supprimer la ligne ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <Input
                label={`Description ${index + 1}`}
                {...register(`items.${index}.description`)}
                {...(errors.items?.[index]?.description?.message
                  ? { error: errors.items[index].description.message }
                  : {})}
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Input
                  label={`Quantité ${index + 1}`}
                  type="number"
                  min="0"
                  step="0.001"
                  {...register(`items.${index}.quantity`)}
                />
                <Input label={`Unité ${index + 1}`} {...register(`items.${index}.unit`)} />
                <Input
                  label={`Prix HT (€) ${index + 1}`}
                  type="number"
                  min="0"
                  step="0.01"
                  {...register(`items.${index}.price`)}
                />
                <Input
                  label={`TVA (%) ${index + 1}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  {...register(`items.${index}.rate`)}
                />
              </div>
              <Controller
                control={control}
                name={`items.${index}.category`}
                render={({ field: category }) => (
                  <Select
                    label={`Catégorie de TVA ${index + 1}`}
                    value={category.value}
                    onValueChange={category.onChange}
                    disabled={isSubmitting}
                    options={[
                      { value: 'S', label: 'TVA applicable' },
                      { value: 'Z', label: 'Taux zéro' },
                      { value: 'E', label: 'Exonération' },
                      { value: 'AE', label: 'Autoliquidation' },
                      { value: 'K', label: 'Livraison intracommunautaire' },
                      { value: 'G', label: 'Exportation' },
                      { value: 'O', label: 'Hors champ' },
                    ]}
                  />
                )}
              />
              <Input
                label={`Motif d’exonération ${index + 1}`}
                hint="À préciser pour une exonération ou une autoliquidation."
                {...register(`items.${index}.exemption`)}
              />
              {errors.items?.[index] && (
                <p role="alert" className="text-error text-xs">
                  Vérifiez cette ligne : description et unité requises, montants positifs, TVA de 0
                  à 100 %.
                </p>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({
                description: '',
                unit: 'u',
                quantity: '1',
                price: '0.00',
                rate: '0',
                category: 'S',
                exemption: '',
              })
            }
            className="gap-2"
          >
            <Plus className="size-4" aria-hidden="true" />
            Ajouter une prestation
          </Button>
        </section>
      </fieldset>
      <div className="border-border bg-surface-raised sticky bottom-0 flex justify-end gap-2 border-t py-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </Button>
      </div>
    </form>
  );
}

export function InvoiceDraftEditor({
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
      size="xl"
      title="Corriger le brouillon"
      description="Complétez le destinataire, le règlement et les prestations avant l’émission."
    >
      {open && <DraftForm key={invoice.id} invoice={invoice} onClose={() => onOpenChange(false)} />}
    </Modal>
  );
}
