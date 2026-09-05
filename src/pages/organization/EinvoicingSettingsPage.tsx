import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Building2, Check, CheckCircle2, Circle, Landmark } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { preparationEmetteur, ProviderConnectionCard } from '@/features/einvoicing';
import {
  OrganizationNavTabs,
  PERMISSIONS,
  useCurrentOrganization,
  useOrganization,
  usePermission,
  useUpdateOrganization,
} from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { Organization } from '@/types/domain';

const text = (max: number) => z.string().trim().max(max);
const schema = z.object({
  name: text(120).min(2, 'Renseignez le nom de votre entreprise.'),
  legalName: text(150),
  registrationNumber: text(50),
  vatNumber: text(50),
  addressLine1: text(150),
  addressLine2: text(150),
  postalCode: text(20),
  city: text(100),
  country: z.string().trim().toUpperCase().length(2, 'Utilisez un code pays de deux lettres.'),
  legalForm: text(100),
  apeCode: text(20),
  rcsCity: text(100),
  capital: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        (/^\d{1,10}([.,]\d{1,2})?$/.test(value) && Number(value.replace(',', '.')) <= 21474836.47),
      'Indiquez un montant de 0 à 21 474 836,47 €, avec deux décimales au maximum.',
    ),
  vatRegime: z.enum(['', 'franchise', 'reel_simplifie', 'reel_normal']),
  iban: text(50),
  bic: text(20),
});
type Values = z.infer<typeof schema>;
const nullable = (value: string) => value.trim() || null;

function defaults(org: Organization): Values {
  return {
    name: org.name,
    legalName: org.legal_name ?? '',
    registrationNumber: org.registration_number ?? '',
    vatNumber: org.vat_number ?? '',
    addressLine1: org.address_line1 ?? '',
    addressLine2: org.address_line2 ?? '',
    postalCode: org.postal_code ?? '',
    city: org.city ?? '',
    country: org.country ?? 'FR',
    legalForm: org.legal_form ?? '',
    apeCode: org.ape_code ?? '',
    rcsCity: org.rcs_city ?? '',
    capital: org.share_capital_cents == null ? '' : (org.share_capital_cents / 100).toFixed(2),
    vatRegime: org.vat_regime ?? '',
    iban: org.iban ?? '',
    bic: org.bic ?? '',
  };
}

function IdentityForm({
  organization,
  canUpdate,
}: {
  organization: Organization;
  canUpdate: boolean;
}) {
  const update = useUpdateOrganization(organization.id);
  const [saved, setSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(organization),
  });
  const onSubmit = handleSubmit(async (values) => {
    if (!canUpdate) return;
    setSaved(false);
    try {
      const result = await update.mutateAsync({
        name: values.name,
        legal_name: nullable(values.legalName),
        registration_number: nullable(values.registrationNumber),
        vat_number: nullable(values.vatNumber),
        address_line1: nullable(values.addressLine1),
        address_line2: nullable(values.addressLine2),
        postal_code: nullable(values.postalCode),
        city: nullable(values.city),
        country: values.country,
        legal_form: nullable(values.legalForm),
        ape_code: nullable(values.apeCode),
        rcs_city: nullable(values.rcsCity),
        share_capital_cents:
          values.capital === '' ? null : Math.round(Number(values.capital.replace(',', '.')) * 100),
        vat_regime: values.vatRegime || null,
        iban: nullable(values.iban.replace(/\s/g, '').toUpperCase()),
        bic: nullable(values.bic.replace(/\s/g, '').toUpperCase()),
      });
      reset(defaults(result));
      setSaved(true);
    } catch {
      /* La mutation conserve l'erreur pour FormError, ainsi que la saisie. */
    }
  });
  const fieldError = (key: keyof Values) =>
    errors[key]?.message ? { error: errors[key].message } : {};

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError error={update.error} />
      {!canUpdate && (
        <p className="text-muted-foreground text-sm">
          Consultation seule. Un propriétaire ou administrateur peut compléter ces informations.
        </p>
      )}
      <fieldset disabled={!canUpdate || isSubmitting} className="min-w-0 space-y-5">
        <Card id="identite">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="text-primary size-4" aria-hidden="true" /> Identité de
              l’entreprise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-xs">
              Ces informations sont partagées avec les paramètres de votre entreprise.
            </p>
            <Input label="Nom commercial" {...register('name')} {...fieldError('name')} required />
            <Input
              label="Raison sociale"
              hint="Si elle diffère du nom commercial."
              {...register('legalName')}
              {...fieldError('legalName')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="SIRET / identifiant de l’entreprise"
                {...register('registrationNumber')}
                {...fieldError('registrationNumber')}
              />
              <Input
                label="Forme juridique"
                placeholder="EI, SAS, SARL…"
                {...register('legalForm')}
                {...fieldError('legalForm')}
              />
            </div>
            <Input label="Adresse" {...register('addressLine1')} {...fieldError('addressLine1')} />
            <Input
              label="Complément d’adresse"
              {...register('addressLine2')}
              {...fieldError('addressLine2')}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Code postal"
                {...register('postalCode')}
                {...fieldError('postalCode')}
              />
              <Input label="Ville" {...register('city')} {...fieldError('city')} />
              <Input
                label="Pays"
                hint="Code : FR, BE…"
                {...register('country')}
                {...fieldError('country')}
              />
            </div>
            <details className="border-border rounded-lg border p-3">
              <summary className="text-foreground cursor-pointer text-xs font-medium">
                Informations complémentaires de l’entreprise
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input label="Code APE" {...register('apeCode')} {...fieldError('apeCode')} />
                <Input label="Ville du RCS" {...register('rcsCity')} {...fieldError('rcsCity')} />
                <Input
                  label="Capital social (€)"
                  inputMode="decimal"
                  hint="À renseigner si votre forme juridique le prévoit."
                  {...register('capital')}
                  {...fieldError('capital')}
                />
              </div>
            </details>
          </CardContent>
        </Card>
        <Card id="tva">
          <CardHeader>
            <CardTitle>TVA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Controller
              control={control}
              name="vatRegime"
              render={({ field }) => (
                <Select
                  label="Régime de TVA"
                  value={field.value || 'unknown'}
                  onValueChange={(value) => field.onChange(value === 'unknown' ? '' : value)}
                  disabled={!canUpdate || isSubmitting}
                  options={[
                    { value: 'unknown', label: 'À renseigner' },
                    { value: 'franchise', label: 'Franchise en base — TVA non applicable' },
                    { value: 'reel_simplifie', label: 'Réel simplifié' },
                    { value: 'reel_normal', label: 'Réel normal' },
                  ]}
                  hint="Ce choix détermine les contrôles appliqués avant l’émission. Il ne change pas les taux de vos devis existants."
                />
              )}
            />
            <Input
              label="N° TVA intracommunautaire"
              {...register('vatNumber')}
              {...fieldError('vatNumber')}
            />
          </CardContent>
        </Card>
        <Card id="paiement">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="text-primary size-4" aria-hidden="true" /> Coordonnées de
              règlement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="IBAN"
              hint="Affiché sur les nouvelles factures pour faciliter le règlement par virement."
              {...register('iban')}
              {...fieldError('iban')}
            />
            <Input label="BIC" {...register('bic')} {...fieldError('bic')} />
          </CardContent>
        </Card>
      </fieldset>
      {canUpdate && (
        <div className="bg-surface-raised border-border sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-lg">
          <p className="text-muted-foreground text-xs" role="status">
            {isDirty
              ? 'Modifications à enregistrer'
              : saved
                ? 'Informations enregistrées'
                : 'Les factures déjà émises restent inchangées.'}
          </p>
          <Button
            type="submit"
            variant="primary"
            disabled={!isDirty || isSubmitting}
            className="gap-2"
          >
            <Check className="size-4" aria-hidden="true" />
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer les informations'}
          </Button>
        </div>
      )}
    </form>
  );
}

export default function EinvoicingSettingsPage() {
  useDocumentTitle('Facturation électronique');
  const { organization } = useCurrentOrganization();
  const query = useOrganization(organization?.id ?? null);
  const { can } = usePermission();
  const canManageConnection = can(PERMISSIONS.organizationUpdate);
  const data = query.data;
  const steps = preparationEmetteur(data ?? {});
  const completed = steps.filter((step) => step.fait).length;
  const target = (code: string) =>
    ['regime_tva', 'tva_intracom'].includes(code)
      ? '#tva'
      : code === 'iban'
        ? '#paiement'
        : '#identite';

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-6">
      <PageHeader
        title="Facturation électronique"
        description="Préparez les informations qui accompagneront vos factures."
      />
      <OrganizationNavTabs />
      {organization && (
        <ProviderConnectionCard organizationId={organization.id} canManage={canManageConnection} />
      )}
      <div className="border-primary/20 bg-primary-subtle flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-foreground text-sm font-semibold">
            Votre premier export électronique
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Préparez un brouillon depuis un devis accepté. Sa fiche vous indique les informations à
            compléter pour télécharger un fichier UBL après émission.
          </p>
          <p className="text-muted-foreground text-xs">
            Disponible pour les factures en euros entre professionnels en France.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 gap-2">
          <Link to={ROUTES.invoices}>
            Accéder aux factures
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : data ? (
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-4">
            <Card>
              <CardHeader>
                <CardTitle>Votre préparation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-foreground text-2xl font-semibold tabular-nums">
                    {completed}
                    <span className="text-muted-foreground text-base font-normal">
                      {' '}
                      / {steps.length}
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">informations enregistrées</p>
                  <div
                    role="progressbar"
                    aria-label="Préparation des données de facturation"
                    aria-valuemin={0}
                    aria-valuemax={steps.length}
                    aria-valuenow={completed}
                    className="bg-surface-subtle mt-3 h-1.5 overflow-hidden rounded-full"
                  >
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${(completed / steps.length) * 100}%` }}
                    />
                  </div>
                </div>
                <ul className="space-y-3">
                  {steps.map((step) => (
                    <li key={step.code}>
                      <a
                        href={target(step.code)}
                        className="group flex items-start gap-2.5 rounded-md py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-4"
                      >
                        {step.fait ? (
                          <CheckCircle2
                            className="text-success size-4 shrink-0"
                            aria-label="Renseigné"
                          />
                        ) : (
                          <Circle
                            className="text-muted-foreground size-4 shrink-0"
                            aria-label="À compléter"
                          />
                        )}
                        <span>
                          <span className="text-foreground font-medium group-hover:underline">
                            {step.libelle}
                          </span>
                          <span className="text-muted-foreground mt-0.5 block leading-relaxed">
                            {step.pourquoi}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Button asChild variant="outline" className="w-full justify-between gap-2">
              <Link to={ROUTES.invoices}>
                Voir mes factures
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </aside>
          <IdentityForm
            key={data.id}
            organization={data}
            canUpdate={can(PERMISSIONS.organizationUpdate)}
          />
        </div>
      ) : (
        <p className="text-muted-foreground">
          Sélectionnez une entreprise pour préparer votre facturation.
        </p>
      )}
    </div>
  );
}
