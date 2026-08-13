import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { FormError } from '@/components/feedback/FormError';
import {
  OwnershipCard,
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
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrganizationSettingsValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      name: '',
      legalName: '',
      registrationNumber: '',
      vatNumber: '',
      email: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
    },
  });

  // Le formulaire est renseigné à l'arrivée des données, pas à la construction :
  // la requête n'est pas résolue au premier rendu, et `defaultValues` ne serait
  // plus relu ensuite.
  const data = query.data;
  useEffect(() => {
    if (!data) return;

    reset({
      name: data.name,
      legalName: toFormValue(data.legal_name),
      registrationNumber: toFormValue(data.registration_number),
      vatNumber: toFormValue(data.vat_number),
      email: toFormValue(data.email),
      phone: toFormValue(data.phone),
      addressLine1: toFormValue(data.address_line1),
      addressLine2: toFormValue(data.address_line2),
      postalCode: toFormValue(data.postal_code),
      city: toFormValue(data.city),
      country: toFormValue(data.country),
    });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setSaved(false);
    try {
      await updateOrganization.mutateAsync({
        name: values.name,
        legal_name: toPatchValue(values.legalName),
        registration_number: toPatchValue(values.registrationNumber),
        vat_number: toPatchValue(values.vatNumber),
        email: toPatchValue(values.email),
        phone: toPatchValue(values.phone),
        address_line1: toPatchValue(values.addressLine1),
        address_line2: toPatchValue(values.addressLine2),
        postal_code: toPatchValue(values.postalCode),
        city: toPatchValue(values.city),
        country: toPatchValue(values.country),
      });
      setSaved(true);
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
        title="Entreprise"
        description={
          canUpdate
            ? 'Ces informations apparaissent sur les comptes rendus d’intervention.'
            : 'Consultation seule — seuls un propriétaire ou un administrateur peuvent modifier ces informations.'
        }
      />

      {organization !== null && <OwnershipCard organizationId={organization.id} />}

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
              <CardTitle>Identité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nom commercial"
                required
                disabled={!canUpdate}
                {...(errors.name?.message ? { error: errors.name.message } : {})}
                {...register('name')}
              />
              <Input
                label="Raison sociale"
                hint="Si elle diffère du nom commercial."
                disabled={!canUpdate}
                {...(errors.legalName?.message ? { error: errors.legalName.message } : {})}
                {...register('legalName')}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="SIRET"
                  disabled={!canUpdate}
                  {...register('registrationNumber')}
                />
                <Input label="N° TVA" disabled={!canUpdate} {...register('vatNumber')} />
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
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {saved && !isDirty ? (
                <span className="text-success text-sm">Modifications enregistrées.</span>
              ) : null}
            </div>
          ) : null}
        </form>
      )}
    </div>
  );
}
