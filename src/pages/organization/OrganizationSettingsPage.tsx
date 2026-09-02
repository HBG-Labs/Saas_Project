import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { FormError } from '@/components/feedback/FormError';
import { ROUTES } from '@/config/routes';
import { useIndustries } from '@/features/industries';
import {
  OrganizationBillingCard,
  OrganizationNavTabs,
  PERMISSIONS,
  useCurrentOrganization,
  useOrganization,
  usePermission,
  useUpdateOrganization,
} from '@/features/organizations';
import {
  organizationSettingsSchema,
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

  const data = query.data;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrganizationSettingsValues>({
    resolver: zodResolver(organizationSettingsSchema) as any,
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

  const onSubmit = handleSubmit(async (values) => {
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
      });
      setSaved(true);
      setTimeout(() => {
        handleClose();
      }, 700);
    } catch (error) {
      setSubmitError(error);
    }
  });

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
    <div className="mx-auto max-w-3xl space-y-6">
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
            className="gap-1.5"
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
            <CardHeader>
              <CardTitle>Identité & Secteur d'activité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nom de l’entreprise (Nom commercial)"
                  required
                  disabled={!canUpdate}
                  {...(errors.name?.message ? { error: errors.name.message } : {})}
                  {...register('name')}
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
                {...register('legalName')}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="SIRET"
                  disabled={!canUpdate}
                  {...register('registrationNumber')}
                />
                <Input label="N° TVA intracommunautaire" disabled={!canUpdate} {...register('vatNumber')} />
                <Input
                  label="Taux TVA par défaut (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  hint="Appliqué aux devis et chiffrages"
                  disabled={!canUpdate}
                  {...(errors.defaultVatRate?.message ? { error: errors.defaultVatRate.message } : {})}
                  {...register('defaultVatRate')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
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

          {canUpdate ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="submit" variant="primary" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                Fermer
              </Button>
              {saved && !isDirty ? (
                <span className="text-success text-sm font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <Check className="size-4 text-success" />
                  <span>Modifications enregistrées. Fermeture…</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
