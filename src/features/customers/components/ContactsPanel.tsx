import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Pencil, Phone, Star, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Tooltip } from '@/components/ui/Tooltip';

import type { CustomerContact } from '@/types/domain';

import {
  useCreateContact,
  useCustomerContacts,
  useDeleteContact,
  useSetPrimaryContact,
  useUpdateContact,
} from '../hooks/useCustomerChildren';
import {
  contactSchema,
  emptyToNull,
  omitEmpty,
  type ContactValues,
} from '../schemas/customer.schema';

export interface ContactsPanelProps {
  customerId: string;
  organizationId: string;
  canEdit: boolean;
}

export function ContactsPanel({ customerId, organizationId, canEdit }: ContactsPanelProps) {
  const contacts = useCustomerContacts(customerId);
  const setPrimary = useSetPrimaryContact(customerId);
  const deleteContact = useDeleteContact(customerId);

  if (contacts.isPending) return <ListSkeleton />;
  if (contacts.isError) {
    return (
      <ErrorState
        error={contacts.error}
        onRetry={() => {
          void contacts.refetch();
        }}
      />
    );
  }

  const list = contacts.data ?? [];

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <ContactFormDialog customerId={customerId} organizationId={organizationId} />
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Aucun interlocuteur"
          description="Enregistrez qui appeler sur place, et son rôle : c’est ce que le technicien cherchera en premier."
        />
      ) : (
        <ul className="divide-border divide-y">
          {list.map((contact) => {
            const fullName = [contact.first_name, contact.last_name]
              .filter((part) => part !== null && part !== '')
              .join(' ');

            return (
              <li key={contact.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-medium">{fullName}</span>
                    {contact.is_primary ? <Badge variant="primary">Principal</Badge> : null}
                  </div>
                  {contact.role_label !== null && contact.role_label !== '' ? (
                    <p className="text-muted-foreground text-xs">{contact.role_label}</p>
                  ) : null}
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                  {contact.phone !== null && contact.phone !== '' ? (
                    <a href={`tel:${contact.phone}`} className="hover:text-foreground flex items-center gap-1">
                      <Phone className="size-3.5" aria-hidden="true" />
                      {contact.phone}
                    </a>
                  ) : null}
                  {contact.email !== null && contact.email !== '' ? (
                    <a href={`mailto:${contact.email}`} className="hover:text-foreground flex items-center gap-1">
                      <Mail className="size-3.5" aria-hidden="true" />
                      {contact.email}
                    </a>
                  ) : null}
                </div>

                {canEdit ? (
                  <div className="flex items-center gap-1">
                    {/*
                      Modifier plutôt que supprimer-puis-recréer : recréer un
                      contact lui ferait perdre son statut de principal, et le
                      détacherait des sites qui le référencent.
                    */}
                    <ContactFormDialog
                      customerId={customerId}
                      organizationId={organizationId}
                      contact={contact}
                    />

                    {contact.is_primary ? null : (
                      <Tooltip content="Désigner comme interlocuteur principal">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setPrimary.mutate(contact.id);
                          }}
                          disabled={setPrimary.isPending}
                          aria-label={`Désigner ${fullName} comme interlocuteur principal`}
                        >
                          <Star className="size-4" />
                        </Button>
                      </Tooltip>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        deleteContact.mutate(contact.id);
                      }}
                      disabled={deleteContact.isPending}
                      className="text-muted-foreground hover:text-error"
                      aria-label={`Supprimer ${fullName}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Création et édition d'un interlocuteur — un seul composant, mêmes champs. */
function ContactFormDialog({
  customerId,
  organizationId,
  contact,
}: {
  customerId: string;
  organizationId: string;
  /** Fourni : édition. Absent : création. */
  contact?: CustomerContact;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const createContact = useCreateContact(customerId);
  const updateContact = useUpdateContact(customerId);
  const isEdit = contact !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      lastName: contact?.last_name ?? '',
      firstName: contact?.first_name ?? '',
      roleLabel: contact?.role_label ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      notes: contact?.notes ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateContact.mutateAsync({
          contactId: contact.id,
          patch: {
            last_name: values.lastName,
            first_name: emptyToNull(values.firstName),
            role_label: emptyToNull(values.roleLabel),
            email: emptyToNull(values.email),
            phone: emptyToNull(values.phone),
          },
        });
      } else {
        const firstName = omitEmpty(values.firstName);
        const roleLabel = omitEmpty(values.roleLabel);
        const email = omitEmpty(values.email);
        const phone = omitEmpty(values.phone);

        await createContact.mutateAsync({
          customerId,
          organizationId,
          lastName: values.lastName,
          ...(firstName !== undefined ? { firstName } : {}),
          ...(roleLabel !== undefined ? { roleLabel } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(phone !== undefined ? { phone } : {}),
        });
        reset();
      }
      setOpen(false);
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={isEdit ? 'Modifier l’interlocuteur' : 'Nouvel interlocuteur'}
      trigger={
        isEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Modifier ${contact.last_name}`}
          >
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <UserPlus className="size-4" />
            Ajouter un contact
          </Button>
        )
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError error={submitError} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Prénom" {...register('firstName')} />
          <Input
            label="Nom"
            required
            {...(errors.lastName?.message ? { error: errors.lastName.message } : {})}
            {...register('lastName')}
          />
        </div>

        <Input
          label="Fonction"
          placeholder="Responsable technique"
          hint="Ce qui permet de savoir à qui l’on parle sur place."
          {...register('roleLabel')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Téléphone"
            type="tel"
            {...register('phone')}
          />
          <Input
            label="Adresse e-mail"
            type="email"
            {...(errors.email?.message ? { error: errors.email.message } : {})}
            {...register('email')}
          />
        </div>

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
            {isSubmitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
