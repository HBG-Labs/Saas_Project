import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { MapLocationPickerDialog, forwardGeocode } from '@/features/geo';
import type { Customer } from '@/types/domain';
import { frenchRegistrationError, frenchVatError } from '@/lib/business-identifiers';

import { useSyncPrimarySiteLocation } from '../hooks/useCustomerChildren';
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
export function CustomerFormDialog({ organizationId, customer, trigger }: CustomerFormDialogProps) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer(customer?.id ?? '');
  const syncPrimarySite = useSyncPrimarySiteLocation();
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
      customerType: customer?.customer_type ?? '',
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

  const [customerType, country, registrationNumber, vatNumber] = useWatch({
    control,
    name: ['customerType', 'country', 'registrationNumber', 'vatNumber'],
  });
  const professional = customerType === 'company' || customerType === 'public_body';
  const registrationIssue = professional
    ? frenchRegistrationError(registrationNumber, country)
    : undefined;
  const vatIssue = professional ? frenchVatError(vatNumber, country) : undefined;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (isEdit) {
        /*
          LES COORDONNÉES NE PARTENT PLUS D'ICI — ELLES FAISAIENT ÉCHOUER TOUTE
          MODIFICATION DE FICHE.

          Le patch ajoutait `latitude` et `longitude` à `customers`, or ces deux
          colonnes n'existent QUE sur `sites` (vérifié en base : `customers` en
          compte dix-neuf, aucune des deux). PostgREST rejetait donc la requête.

          Et le défaut se déclenchait presque toujours : le géocodage
          automatique se lançait dès qu'une adresse était renseignée, ce qui est
          le cas de la plupart des fiches. Modifier un client existant échouait
          donc en pratique.

          Il passait inaperçu à la CRÉATION parce que `createCustomer` intercepte
          ces deux champs pour les poser sur le « Site Principal » qu'il crée —
          jamais sur le client. Seule l'édition, qui envoie son patch directement
          à `customers`, tombait dessus.

          Le géocodage ne sert donc plus qu'à la création, où les coordonnées ont
          une destination réelle. Reporter la position sur le site principal lors
          d'une édition reste à faire — c'est une fonctionnalité, pas ce
          correctif.

          `null` et non `undefined` : en édition, vider un champ doit l'effacer
          en base, alors qu'`undefined` le laisserait inchangé.
        */
        await updateCustomer.mutateAsync({
          name: values.name,
          legal_name: emptyToNull(values.legalName),
          customer_type: values.customerType || null,
          registration_number: emptyToNull(values.registrationNumber),
          vat_number: emptyToNull(values.vatNumber),
          email: emptyToNull(values.email),
          phone: emptyToNull(values.phone),
          address_line1: emptyToNull(values.addressLine1),
          postal_code: emptyToNull(values.postalCode),
          city: emptyToNull(values.city),
          country: emptyToNull(values.country),
          notes: emptyToNull(values.notes),
        });

        /*
          La position va sur le SITE PRINCIPAL, seul porteur de coordonnées.

          Et seulement si l'utilisateur a explicitement pointé sur la carte.
          Géocoder à chaque enregistrement — ce que faisait la version
          précédente — déclenchait un appel réseau sur la moindre correction de
          numéro de téléphone, et surtout déplaçait un chantier sans que
          personne ne l'ait demandé. Une position qui bouge toute seule est pire
          qu'une position absente.
        */
        if (coords && customer) {
          await syncPrimarySite.mutateAsync({
            customerId: customer.id,
            organizationId,
            addressLine1: emptyToNull(values.addressLine1),
            postalCode: emptyToNull(values.postalCode),
            city: emptyToNull(values.city),
            country: emptyToNull(values.country),
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        }
      } else {
        let finalLat = coords?.latitude ?? null;
        let finalLng = coords?.longitude ?? null;

        // Aucune coordonnée saisie au clic mais une adresse renseignée : on la
        // géocode pour que le site principal soit plaçable sur la carte.
        if (finalLat === null && values.addressLine1 && (values.city || values.postalCode)) {
          const fullAddress = [values.addressLine1, values.postalCode, values.city]
            .filter(Boolean)
            .join(' ');
          const matches = await forwardGeocode(fullAddress);
          if (matches.length > 0 && matches[0]) {
            finalLat = matches[0].latitude;
            finalLng = matches[0].longitude;
          }
        }

        await createCustomer.mutateAsync({
          organizationId,
          name: values.name,
          ...(values.customerType ? { customerType: values.customerType } : {}),
          ...defined('legalName', omitEmpty(values.legalName)),
          // Ces deux-là manquaient : le N° TVA saisi était perdu en silence, et
          // le SIRET n'avait de toute façon aucun champ pour être saisi.
          ...defined('registrationNumber', omitEmpty(values.registrationNumber)),
          ...defined('vatNumber', omitEmpty(values.vatNumber)),
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
      presentation="drawer"
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      size="lg"
      footer={
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
          <Button type="submit" form={formId} variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le client'}
          </Button>
        </div>
      }
      title={isEdit ? 'Modifier le client' : 'Nouveau client'}
      {...(isEdit
        ? {}
        : {
            description:
              'Seul le nom est requis. Les coordonnées peuvent être complétées plus tard.',
          })}
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError error={submitError} />

        <FormSection
          title="Informations principales"
          description="Le nom suffit pour créer la fiche. Ajoutez un contact si vous l’avez déjà."
          defaultOpen
        >
          <Input
            label="Nom du client"
            placeholder="Mairie de Saint-Pierre"
            required
            {...(errors.name?.message ? { error: errors.name.message } : {})}
            {...register('name')}
          />

          <Controller
            control={control}
            name="customerType"
            render={({ field }) => (
              <Select
                label="Type de client"
                value={field.value || 'unknown'}
                onValueChange={(value) => field.onChange(value === 'unknown' ? '' : value)}
                options={[
                  { value: 'unknown', label: 'À renseigner plus tard' },
                  { value: 'company', label: 'Entreprise' },
                  { value: 'individual', label: 'Particulier' },
                  { value: 'public_body', label: 'Organisme public' },
                ]}
                hint="Détermine les informations demandées avant l’émission d’une facture."
              />
            )}
          />

          <div className="grid gap-3">
            <Input
              label="Adresse e-mail"
              type="email"
              {...(errors.email?.message ? { error: errors.email.message } : {})}
              {...register('email')}
            />
            <Input label="Téléphone" type="tel" {...register('phone')} />
          </div>
        </FormSection>

        <FormSection
          title="Identité de facturation"
          description="À compléter avant d’émettre une facture pour ce client."
          defaultOpen={isEdit || professional}
        >
          <Input label="Raison sociale" {...register('legalName')} />

          {/*
          LE SIRET N'ÉTAIT SAISISSABLE NULLE PART.

          `registrationNumber` figurait déjà dans le schéma de validation et
          dans les valeurs par défaut, la fiche client l'AFFICHAIT en lecture,
          et l'export CSV lui réservait une colonne — mais aucun champ ne
          permettait de le renseigner. La donnée ne pouvait donc entrer que par
          la base.

          Ce n'est pas un détail cosmétique : l'identifiant du destinataire est
          une mention obligatoire de la facture électronique. Sans ce champ,
          aucune facture ne peut partir vers ce client.
        */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="SIRET / SIREN"
              placeholder="123 456 789 00012"
              hint="Pour une entreprise française : SIREN de 9 chiffres ou SIRET de 14 chiffres."
              {...(registrationIssue ? { error: registrationIssue } : {})}
              {...(errors.registrationNumber?.message
                ? { error: errors.registrationNumber.message }
                : {})}
              {...register('registrationNumber')}
            />
            <Input
              label="N° TVA intracommunautaire"
              placeholder="FR12345678901"
              {...(vatIssue ? { error: vatIssue } : {})}
              {...(errors.vatNumber?.message ? { error: errors.vatNumber.message } : {})}
              {...register('vatNumber')}
            />
          </div>
          {(registrationIssue || vatIssue) && (
            <p className="text-muted-foreground text-xs">
              Cette fiche peut être enregistrée. Les identifiants signalés devront être corrigés
              avant l’émission d’une facture.
            </p>
          )}
        </FormSection>

        <FormSection
          title="Adresse principale"
          description="Utilisée pour créer le site principal et préparer les interventions."
          defaultOpen={isEdit}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-foreground text-xs font-semibold">Adresse postale</span>
              <MapLocationPickerDialog
                initialAddress={initialAddress}
                onSelectLocation={(loc) => {
                  setCoords({ latitude: loc.latitude, longitude: loc.longitude });
                  if (loc.addressLine1)
                    setValue('addressLine1', loc.addressLine1, { shouldDirty: true });
                  if (loc.postalCode) setValue('postalCode', loc.postalCode, { shouldDirty: true });
                  if (loc.city) setValue('city', loc.city, { shouldDirty: true });
                  if (loc.country) setValue('country', loc.country, { shouldDirty: true });
                }}
              />
            </div>
            <Input placeholder="Numéro et libellé de voie" {...register('addressLine1')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Code postal" {...register('postalCode')} />
            <Input label="Ville" {...register('city')} />
            <Input
              label="Pays"
              {...(errors.country?.message ? { error: errors.country.message } : {})}
              {...register('country')}
            />
          </div>
        </FormSection>

        <FormSection
          title="Notes internes"
          description="Contexte ou conditions utiles à votre équipe."
          defaultOpen={isEdit && Boolean(customer.notes)}
        >
          <Textarea
            label="Notes"
            hideLabel
            rows={3}
            hint="Contexte, particularités, conditions commerciales."
            {...register('notes')}
          />
        </FormSection>
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

function FormSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <details
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      className="group border-border border-b"
    >
      <summary className="focus-visible:ring-ring/30 min-h-touch flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-3 focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="text-foreground block text-sm font-bold">{title}</span>
          <span className="text-muted-foreground mt-0.5 block text-xs">{description}</span>
        </span>
        <ChevronDown
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-4 pt-2 pb-5">{children}</div>
    </details>
  );
}
