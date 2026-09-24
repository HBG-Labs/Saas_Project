import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Check, MapPin, ReceiptText, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { UnsavedChangesGuard } from '@/components/feedback/UnsavedChangesGuard';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import { useIndustries } from '@/features/industries';
import {
  OrganizationBillingCard,
  CompanyLookupInput,
  OrganizationNavTabs,
  PERMISSIONS,
  type FrenchCompanyCandidate,
  useCurrentOrganization,
  useOrganization,
  usePermission,
  useUpdateOrganization,
} from '@/features/organizations';
import { DEFAULT_QUOTE_PAYMENT_METHOD, DEFAULT_QUOTE_PAYMENT_TERMS } from '@/features/quotes';
import { cn } from '@/lib/cn';
import {
  organizationSettingsSchema,
  parseReminderDays,
  type OrganizationSettingsInputValues,
  type OrganizationSettingsValues,
} from '@/features/organizations/schemas/organization.schema';
import { useDocumentTitle } from '@/lib/use-document-title';

/** `''` plutôt que `null` : un champ contrôlé ne doit jamais recevoir `null`. */
function toFormValue(value: string | null | undefined): string {
  return value ?? '';
}

/** `null` plutôt que `''` : la base distingue « vide » de « non renseigné ». */
function toPatchValue(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Choix rapides pour les deux champs du devis — remplissent le texte libre,
 * ne le remplacent pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI DES PUCES SUR UN CHAMP TEXTE PLUTÔT QU'UN VRAI SÉLECTEUR
 *
 * Un `<Select>` imposerait une valeur parmi une liste fermée — inadapté à
 * « Conditions de règlement », où une entreprise peut vouloir un acompte, une
 * échéance à cheval sur deux mentions, ou une formulation qui lui est propre.
 * Les puces ACCÉLÈRENT la saisie du cas courant sans jamais retirer la
 * possibilité d'écrire autre chose : cliquer en pose le texte, la zone reste
 * éditable ensuite.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const PAYMENT_TERMS_PRESETS = [
  { label: 'À réception', text: 'Paiement à réception de la facture.' },
  { label: '15 jours', text: 'Paiement à 15 jours à compter de la réception.' },
  { label: '30 jours', text: 'Paiement à 30 jours à compter de la réception.' },
  { label: '45 jours', text: 'Paiement à 45 jours à compter de la réception.' },
  { label: '60 jours', text: 'Paiement à 60 jours à compter de la réception.' },
] as const;

/**
 * Contrairement aux conditions de règlement, plusieurs moyens de paiement
 * cohabitent couramment (« Virement / CB »). Les puces basculent donc chacune
 * indépendamment, ajoutant ou retirant leur libellé du texte — jamais en le
 * remplaçant en entier, pour ne pas effacer une mention personnalisée déjà
 * présente à côté.
 */
const PAYMENT_METHOD_CHOICES = [
  'Virement bancaire',
  'Carte bancaire',
  'Chèque',
  'Espèces',
  'Prélèvement automatique',
] as const;

/** Segments d'un texte « A / B / C », nettoyés des vides et des espaces superflus. */
function splitMethods(value: string): string[] {
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');
}

export default function OrganizationSettingsPage() {
  useDocumentTitle('Entreprise');

  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const canUpdate = can(PERMISSIONS.organizationUpdate);

  const query = useOrganization(organization?.id ?? null);
  const updateOrganization = useUpdateOrganization(organization?.id ?? '');
  const industries = useIndustries();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [verifiedCompany, setVerifiedCompany] = useState<string | null>(null);

  const data = query.data;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrganizationSettingsInputValues, unknown, OrganizationSettingsValues>({
    resolver: zodResolver(organizationSettingsSchema),
    ...(data
      ? {
          values: {
            name: data.name,
            industry: toFormValue(data.industry),
            legalName: toFormValue(data.legal_name),
            registrationNumber: toFormValue(data.registration_number),
            vatNumber: toFormValue(data.vat_number),
            defaultVatRate: data.default_vat_rate ?? 20,
            email: toFormValue(data.email),
            phone: toFormValue(data.phone),
            addressLine1: toFormValue(data.address_line1),
            addressLine2: toFormValue(data.address_line2),
            postalCode: toFormValue(data.postal_code),
            city: toFormValue(data.city),
            country: toFormValue(data.country),
            quotePaymentTerms: toFormValue(data.quote_payment_terms),
            quotePaymentMethod: toFormValue(data.quote_payment_method),
            quoteReminderDays: (data.quote_reminder_days ?? []).join(', '),
          },
        }
      : {}),
  });

  const navigate = useNavigate();

  const handleClose = () => {
    if (window.history.length > 1) {
      void navigate(-1);
    } else {
      void navigate(ROUTES.dashboard);
    }
  };

  const saveOrganization = async (values: OrganizationSettingsValues): Promise<void> => {
    setSubmitError(null);
    setSaved(false);
    try {
      await updateOrganization.mutateAsync({
        name: values.name,
        industry: toPatchValue(values.industry),
        legal_name: toPatchValue(values.legalName),
        registration_number: toPatchValue(values.registrationNumber),
        vat_number: toPatchValue(values.vatNumber),
        default_vat_rate: values.defaultVatRate !== undefined ? Number(values.defaultVatRate) : 20,
        email: toPatchValue(values.email),
        phone: toPatchValue(values.phone),
        address_line1: toPatchValue(values.addressLine1),
        address_line2: toPatchValue(values.addressLine2),
        postal_code: toPatchValue(values.postalCode),
        city: toPatchValue(values.city),
        country: toPatchValue(values.country),
        quote_payment_terms: toPatchValue(values.quotePaymentTerms),
        quote_payment_method: toPatchValue(values.quotePaymentMethod),
        // Validé par le schéma : `null` est impossible ici.
        quote_reminder_days: parseReminderDays(values.quoteReminderDays ?? '') ?? [],
      });
      setSaved(true);
      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (error) {
      setSubmitError(error);
    }
  };

  const onSubmit = handleSubmit(saveOrganization);

  // `useWatch`, pas `watch()` : la seconde renvoie une fonction que React
  // Compiler ne peut pas mémoïser sans risquer un affichage périmé — même
  // patron que `CustomerFormDialog`/`SitesPanel`.
  const [paymentTermsValue, paymentMethodValue] = useWatch({
    control,
    name: ['quotePaymentTerms', 'quotePaymentMethod'],
  });

  // Une puce « Conditions de règlement » remplace tout le champ : ce sont des
  // formulations mutuellement exclusives, jamais des mentions qui cohabitent.
  function applyPaymentTermsPreset(text: string) {
    setValue('quotePaymentTerms', text, { shouldDirty: true, shouldTouch: true });
  }

  // Une puce « Mode de paiement » bascule SA seule mention, sans toucher au
  // reste du texte : plusieurs moyens de paiement cohabitent couramment.
  const selectedMethods = splitMethods(paymentMethodValue ?? '');
  function togglePaymentMethod(method: string) {
    const next = selectedMethods.includes(method)
      ? selectedMethods.filter((m) => m !== method)
      : [...selectedMethods, method];
    setValue('quotePaymentMethod', next.join(' / '), { shouldDirty: true, shouldTouch: true });
  }

  function applyOfficialCompany(company: FrenchCompanyCandidate) {
    setValue('name', company.commercialName ?? company.name, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue('legalName', company.legalName, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue('registrationNumber', company.siret, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setVerifiedCompany(company.name);
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  return (
    <PageShell width="3xl">
      <UnsavedChangesGuard
        when={canUpdate && isDirty && !saved}
        title="Quitter les paramètres non enregistrés ?"
      />
      <PageHeader
        title="Paramètres de l'entreprise"
        description={
          canUpdate
            ? 'Modifiez le nom, le secteur d’activité, les coordonnées et gérez la formule de votre entreprise.'
            : 'Consultation seule — seuls un propriétaire ou un administrateur peuvent modifier ces informations.'
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="w-full gap-1.5 sm:w-auto"
          >
            <X className="size-4" />
            <span>Fermer</span>
          </Button>
        }
      />

      <OrganizationNavTabs />

      {organization !== null && <OrganizationBillingCard organizationId={organization.id} />}

      {query.isPending ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <FormError error={submitError} />

          <Card>
            <CardHeader className="flex-row items-start gap-3">
              <span className="bg-primary-subtle text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Building2 className="size-5" aria-hidden />
              </span>
              <div>
                <CardTitle>Identité & Secteur d'activité</CardTitle>
                <p className="text-muted-foreground mt-1 text-xs">
                  Informations légales et métier utilisées dans vos documents.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <CompanyLookupInput
                      mode="name"
                      label="Nom de l’entreprise (Nom commercial)"
                      required
                      disabled={!canUpdate}
                      name={field.name}
                      value={field.value ?? ''}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setVerifiedCompany(null);
                      }}
                      onBlur={field.onBlur}
                      onCompanySelect={applyOfficialCompany}
                      {...(errors.name?.message ? { error: errors.name.message } : {})}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="industry"
                  render={({ field }) => (
                    <Select
                      label="Secteur d'activité (Métier)"
                      placeholder={industries.isPending ? 'Chargement…' : 'Choisir un métier…'}
                      hint="Adapte le vocabulaire, les outils métier et les formulaires."
                      disabled={!canUpdate || industries.isPending}
                      options={(industries.data ?? []).map((item) => ({
                        value: item.code,
                        label: item.label,
                      }))}
                      value={field.value || undefined}
                      onValueChange={(value) => field.onChange(value)}
                      {...(errors.industry?.message ? { error: errors.industry.message } : {})}
                    />
                  )}
                />
              </div>

              <Input
                label="Raison sociale"
                hint="Si elle diffère du nom commercial."
                disabled={!canUpdate}
                {...(errors.legalName?.message ? { error: errors.legalName.message } : {})}
                {...register('legalName', { onChange: () => setVerifiedCompany(null) })}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Controller
                  control={control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <CompanyLookupInput
                      mode="siret"
                      label="SIRET"
                      disabled={!canUpdate}
                      inputMode="numeric"
                      name={field.name}
                      value={field.value ?? ''}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setVerifiedCompany(null);
                      }}
                      onBlur={field.onBlur}
                      onCompanySelect={applyOfficialCompany}
                    />
                  )}
                />
                <Input
                  label="N° TVA intracommunautaire"
                  disabled={!canUpdate}
                  {...register('vatNumber')}
                />
                <Input
                  label="Taux TVA par défaut (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  hint="Appliqué aux devis et chiffrages"
                  disabled={!canUpdate}
                  {...(errors.defaultVatRate?.message
                    ? { error: errors.defaultVatRate.message }
                    : {})}
                  {...register('defaultVatRate')}
                />
              </div>
              {verifiedCompany ? (
                <p className="text-success flex items-center gap-1.5 text-xs" role="status">
                  <Check className="size-3.5" aria-hidden="true" />
                  Informations officielles appliquées : {verifiedCompany}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start gap-3">
              <span className="bg-info-subtle text-info flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <MapPin className="size-5" aria-hidden />
              </span>
              <div>
                <CardTitle>Coordonnées</CardTitle>
                <p className="text-muted-foreground mt-1 text-xs">
                  Adresse et contacts affichés sur vos échanges professionnels.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Adresse e-mail"
                  type="email"
                  disabled={!canUpdate}
                  {...(errors.email?.message ? { error: errors.email.message } : {})}
                  {...register('email')}
                />
                <Input label="Téléphone" type="tel" disabled={!canUpdate} {...register('phone')} />
              </div>
              <Input label="Adresse" disabled={!canUpdate} {...register('addressLine1')} />
              <Input
                label="Complément d’adresse"
                disabled={!canUpdate}
                {...register('addressLine2')}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Code postal" disabled={!canUpdate} {...register('postalCode')} />
                <Input label="Ville" disabled={!canUpdate} {...register('city')} />
                <Input
                  label="Pays"
                  placeholder="FR"
                  hint="Code ISO"
                  disabled={!canUpdate}
                  {...(errors.country?.message ? { error: errors.country.message } : {})}
                  {...register('country')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start gap-3">
              <span className="bg-accent-subtle text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <ReceiptText className="size-5" aria-hidden />
              </span>
              <div>
                <CardTitle>Devis</CardTitle>
                <p className="text-muted-foreground mt-1 text-xs">
                  Mentions de paiement proposées par défaut sur les nouveaux devis.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Textarea
                  label="Conditions de règlement"
                  placeholder={DEFAULT_QUOTE_PAYMENT_TERMS}
                  hint="Affiché sur chaque devis. Laissez vide pour garder le texte par défaut."
                  rows={2}
                  disabled={!canUpdate}
                  {...(errors.quotePaymentTerms?.message
                    ? { error: errors.quotePaymentTerms.message }
                    : {})}
                  {...register('quotePaymentTerms')}
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-subtle-foreground text-3xs font-medium">Suggestions :</span>
                  {PAYMENT_TERMS_PRESETS.map((preset) => {
                    const isActive =
                      (paymentTermsValue || DEFAULT_QUOTE_PAYMENT_TERMS) === preset.text;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        disabled={!canUpdate}
                        onClick={() => applyPaymentTermsPreset(preset.text)}
                        aria-pressed={isActive}
                        className={cn(
                          'sm:text-2xs min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-8',
                          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                          isActive
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Textarea
                  label="Mode de paiement"
                  placeholder={DEFAULT_QUOTE_PAYMENT_METHOD}
                  hint="Affiché sur chaque devis. Laissez vide pour garder le texte par défaut."
                  rows={2}
                  disabled={!canUpdate}
                  {...(errors.quotePaymentMethod?.message
                    ? { error: errors.quotePaymentMethod.message }
                    : {})}
                  {...register('quotePaymentMethod')}
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-subtle-foreground text-3xs font-medium">Suggestions :</span>
                  {PAYMENT_METHOD_CHOICES.map((method) => {
                    const isActive = selectedMethods.includes(method);
                    return (
                      <button
                        key={method}
                        type="button"
                        disabled={!canUpdate}
                        onClick={() => togglePaymentMethod(method)}
                        aria-pressed={isActive}
                        className={cn(
                          'sm:text-2xs min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-8',
                          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                          isActive
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                        )}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Relances automatiques (jours après l’envoi)"
                placeholder="7, 14"
                hint="Un devis envoyé au client depuis REZO360 et resté sans réponse est relancé dans le même fil à ces échéances, jamais après sa date de validité. Laissez vide pour ne jamais relancer. Cinq échéances au plus."
                disabled={!canUpdate}
                inputMode="numeric"
                {...(errors.quoteReminderDays?.message
                  ? { error: errors.quoteReminderDays.message }
                  : {})}
                {...register('quoteReminderDays')}
              />
            </CardContent>
          </Card>

          {canUpdate ? (
            <div className="border-border bg-background/95 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || !isDirty}
                  isLoading={isSubmitting}
                  loadingLabel="Enregistrement des paramètres"
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="w-full sm:w-auto"
                >
                  Fermer
                </Button>
              </div>
              {saved && !isDirty ? (
                <span className="text-success animate-in fade-in flex items-center gap-1.5 text-sm font-semibold">
                  <Check className="text-success size-4" />
                  <span>Modifications enregistrées. Fermeture…</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </form>
      )}
    </PageShell>
  );
}
