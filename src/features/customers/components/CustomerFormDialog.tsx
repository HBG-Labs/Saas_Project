import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { MapLocationPickerDialog, forwardGeocode } from '@/features/geo';
import type { Customer } from '@/types/domain';

import { useCreateCustomer, useUpdateCustomer } from '../hooks/useCustomers';
import {
  customerSchema,
  emptyToNull,
  omitEmpty,
  type CustomerValues,
} from '../schemas/customer.schema';

export interface CustomerFormDialogProps {
  organizationId: string;
  /** Fourni : édition. Absent : création. */
  customer?: Customer;
  trigger: ReactNode;
}

/**
 * Création et édition d', une fiche client.
 *
 * Un seul composant pour les deux : les champs sont identiques, et deux
 * formulaires jumeaux divergent toujours — l'un gagne un champ que l'autre
 * n'aura jamais.
 */
export function CustomerFormDialog({
  organizationId,
  customer,
  trigger,
}: CustomerFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer(customer?.id ?? '');
  const isEdit = customer !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? '',
      legalName: customer?.legal_name ?? '',
      registrationNumber: customer?.registration_number ?? '',
      vatNumber: customer?.vat_number ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      addressLine1: customer?.address_line1 ?? '',
      postalCode: customer?.postal_code ?? '',
      city: customer?.city ?? '',
      country: customer?.country ?? 'FR',
      notes: customer?.notes ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      let finalLat = coords?.latitude ?? null;
      let finalLng = coords?.longitude ?? null;

      // Si aucune coordonnée n'a été saisie au clic mais qu'une adresse est renseignée, géocodage automatique
      if (finalLat === null && values.addressLine1 && (values.city || values.postalCode)) {
        const fullAddress = [values.addressLine1, values.postalCode, values.city].filter(Boolean).join(' ');
        const matches = await forwardGeocode(fullAddress);
        if (matches.length > 0 && matches[0]) {
          finalLat = matches[0].latitude;
          finalLng = matches[0].longitude;
        }
      }

      if (isEdit) {
        // `null` et non `undefined` : en édition, vider un champ doit l'effacer
        // en base, alors qu'`undefined` le laisserait inchangé.
        await updateCustomer.mutateAsync({
          name: values.name,
          legal_name: emptyToNull(values.legalName),
          registration_number: emptyToNull(values.registrationNumber),
          vat_number: emptyToNull(values.vatNumber),
          email: emptyToNull(values.email),
          phone: emptyToNull(values.phone),
          address_line1: emptyToNull(values.addressLine1),
          postal_code: emptyToNull(values.postalCode),
          city: emptyToNull(values.city),
          country: emptyToNull(values.country),
          notes: emptyToNull(values.notes),
          ...(finalLat != null ? { latitude: finalLat, longitude: finalLng } : {}),
        });
      } else {
        await createCustomer.mutateAsync({
          organizationId,
          name: values.name,
          ...defined('legalName', omitEmpty(values.legalName)),
          ...defined('email', omitEmpty(values.email)),
          ...defined('phone', omitEmpty(values.phone)),
          ...defined('addressLine1', omitEmpty(values.addressLine1)),
          ...defined('postalCode', omitEmpty(values.postalCode)),
          ...defined('city', omitEmpty(values.city)),
          ...defined('country', omitEmpty(values.country)),
          ...defined('notes', omitEmpty(values.notes)),
          ...(finalLat != null ? { latitude: finalLat, longitude: finalLng } : {}),
        });
        reset();
      }
      setCoords(null);
      setOpen(false);
    } catch (error) {
      setSubmitError(error);
    }
  });

  const [addressLine1, postalCode, city] = useWatch({
    control,
    name: ['addressLine1', 'postalCode', 'city'],
  });

  const initialAddress = addressLine1
    ? `${addressLine1} ${postalCode ?? ''} ${city ?? ''}`.trim()
    : '';

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      size="lg"
      title={isEdit ? 'Modifier le client' : 'Nouveau client'}
      {...(isEdit
        ? {}
        : {
            description:
              'Seul le nom est requis. Les coordonnées peuvent être complétées plus tard.',
          })}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError error={submitError} />

        <Input
          label="Nom du client"
          placeholder="Mairie de Saint-Pierre"
          required
          {...(errors.name?.message ? { error: errors.name.message } : {})}
          {...register('name')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Raison sociale" {...register('legalName')} />
          <Input label="N° TVA" {...register('vatNumber')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Adresse e-mail"
            type="email"
            {...(errors.email?.message ? { error: errors.email.message } : {})}
            {...register('email')}
          />
          <Input label="Téléphone" type="tel" {...register('phone')} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Adresse postale</span>
            <MapLocationPickerDialog
              initialAddress={initialAddress}
              onSelectLocation={(loc) => {
                setCoords({ latitude: loc.latitude, longitude: loc.longitude });
                if (loc.addressLine1) setValue('addressLine1', loc.addressLine1, { shouldDirty: true });
                if (loc.postalCode) setValue('postalCode', loc.postalCode, { shouldDirty: true });
                if (loc.city) setValue('city', loc.city, { shouldDirty: true });
                if (loc.country) setValue('country', loc.country, { shouldDirty: true });
              }}
            />
          </div>
          <Input placeholder="Numéro et libellé de voie" {...register('addressLine1')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Code postal" {...register('postalCode')} />
          <Input label="Ville" {...register('city')} />
          <Input
            label="Pays"
            {...(errors.country?.message ? { error: errors.country.message } : {})}
            {...register('country')}
          />
        </div>

        <Textarea
          label="Notes"
          rows={3}
          hint="Contexte, particularités, conditions commerciales."
          {...register('notes')}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
          >
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le client'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Ajoute une clé seulement si la valeur existe.
 *
 * `exactOptionalPropertyTypes` distingue « propriété absente » de « propriété à
 * `undefined` » : passer la seconde à une signature optionnelle est une erreur
 * de type. Ce helper évite de répéter le ternaire à chaque champ.
 */
function defined<K extends string>(key: K, value: string | undefined) {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}
