import { Globe, Mail, Phone } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { formatDateTime } from '@/lib/format';
import type { ProspectContact } from '@/types/domain';

import { useAddProspectContact } from '../hooks/useProspecting';

const CONTACT_ICON = { email: Mail, phone: Phone, website: Globe } as const;
const CONTACT_LABEL: Record<ProspectContact['contact_type'], string> = {
  email: 'E-mail',
  phone: 'Téléphone',
  website: 'Site web',
};

/**
 * §11 du cahier des charges — aucune source d'enrichissement automatisée
 * n'est branchée en V1 (Phase 11, décision du 24/09/2026 : rien à connecter,
 * rien à payer). La saisie MANUELLE reste possible : `source` distingue
 * toujours une coordonnée saisie à la main d'une future intégration.
 */
export function ProspectContactsPanel({ siren, contacts }: { siren: string; contacts: ProspectContact[] }) {
  const [contactType, setContactType] = useState<ProspectContact['contact_type']>('email');
  const [value, setValue] = useState('');
  const addContact = useAddProspectContact(siren);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed === '') return;
    addContact.mutate({ contactType, value: trimmed }, { onSuccess: () => setValue('') });
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Aucune coordonnée — aucune source d’enrichissement automatisée n’est branchée en V1, mais
          vous pouvez en saisir une manuellement ci-dessous.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const Icon = CONTACT_ICON[contact.contact_type];
            return (
              <div key={contact.id} className="border-border/70 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
                <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-foreground truncate font-semibold">{contact.value}</p>
                  <p className="text-subtle-foreground text-3xs mt-0.5">
                    {CONTACT_LABEL[contact.contact_type]}
                    {contact.source === 'saisie_manuelle' ? ' · saisie manuelle' : ` · ${contact.source}`}
                    {' · '}
                    {formatDateTime(contact.collected_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SelectField
          value={contactType}
          onChange={(e) => setContactType(e.target.value as ProspectContact['contact_type'])}
          aria-label="Type de coordonnée"
          className="sm:w-36"
        >
          <option value="email">E-mail</option>
          <option value="phone">Téléphone</option>
          <option value="website">Site web</option>
        </SelectField>
        <Input
          label="Valeur"
          hideLabel
          placeholder={contactType === 'email' ? 'contact@entreprise.fr' : contactType === 'phone' ? '05 96 …' : 'https://…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1"
        />
        <Button size="sm" variant="outline" disabled={value.trim() === '' || addContact.isPending} onClick={handleSubmit}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
