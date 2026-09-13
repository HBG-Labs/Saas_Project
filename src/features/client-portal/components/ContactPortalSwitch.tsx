import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Switch } from '@/components/ui/Switch';
import type { CustomerContact } from '@/types/domain';

import { useClientPortalAccess, useSetContactPortalAccess } from '../hooks/useClientPortal';

/**
 * Ouvre ou révoque l'accès d'un interlocuteur au portail client.
 *
 * L'adresse e-mail EST l'identité : sans elle, aucun code ne peut être envoyé.
 * Le trigger `guard_contact_portal_update` rejuge la permission et journalise
 * l'ouverture comme la révocation.
 */
export function ContactPortalSwitch({ contact }: { contact: CustomerContact }) {
  const access = useClientPortalAccess();
  const setAccess = useSetContactPortalAccess(contact.customer_id);
  const [error, setError] = useState<unknown>(null);

  if (!access.hasFeature || !access.canManage) return null;

  const hasEmail = contact.email !== null && contact.email !== '';

  return (
    <div className="w-full space-y-1">
      <FormError error={error} />
      <Switch
        checked={contact.portal_enabled}
        disabled={!hasEmail || setAccess.isPending}
        onCheckedChange={(enabled) => {
          setError(null);
          setAccess.mutate(
            { contactId: contact.id, enabled },
            {
              onError: (e) => {
                setError(e);
              },
            },
          );
        }}
        label="Accès au portail client"
        description={
          !hasEmail
            ? 'Renseignez une adresse e-mail pour ouvrir l’accès.'
            : !access.isEnabled
              ? 'Le portail est désactivé pour votre entreprise : cet accès ne sera actif qu’une fois le portail activé.'
              : contact.portal_enabled
                ? contact.portal_last_seen_at === null
                  ? 'Accès ouvert — jamais connecté.'
                  : `Dernière visite le ${new Date(contact.portal_last_seen_at).toLocaleDateString('fr-FR')}.`
                : 'Ce contact recevra un code par e-mail pour se connecter.'
        }
      />
    </div>
  );
}
