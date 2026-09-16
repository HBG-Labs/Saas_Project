import { Globe, Mail, Phone } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { formatDateTime } from '@/lib/format';
import type { ProspectContact } from '@/types/domain';

import { usePlatformAdmin } from '../hooks/usePlatformAdmin';
import { useAddProspectContact, useScrapeProspectContacts } from '../hooks/useProspecting';
import { ManageOnlyNotice } from './ManageOnlyNotice';

const CONTACT_ICON = { email: Mail, phone: Phone, website: Globe } as const;
const CONTACT_LABEL: Record<ProspectContact['contact_type'], string> = {
  email: 'E-mail',
  phone: 'Téléphone',
  website: 'Site web',
};

const SOURCE_LABEL: Record<string, string> = {
  saisie_manuelle: 'saisie manuelle',
  site_officiel: 'trouvée sur le site officiel',
};

/**
 * §11 du cahier des charges — saisie MANUELLE des coordonnées (Phase 11),
 * plus une recherche ciblée sur le site officiel déjà renseigné (Phase 14,
 * jamais un annuaire tiers ni un moteur de recherche). `source` distingue
 * toujours l'origine d'une coordonnée, jamais confondue dans l'affichage.
 */
export function ProspectContactsPanel({ siren, contacts }: { siren: string; contacts: ProspectContact[] }) {
  const [contactType, setContactType] = useState<ProspectContact['contact_type']>('email');
  const [value, setValue] = useState('');
  const addContact = useAddProspectContact(siren);
  const scrapeContacts = useScrapeProspectContacts(siren);
  const { can } = usePlatformAdmin();
  const canManage = can('prospecting.manage');
  const website = contacts.find((c) => c.contact_type === 'website');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed === '') return;
    addContact.mutate({ contactType, value: trimmed }, { onSuccess: () => setValue('') });
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Aucune coordonnée pour l’instant
          {canManage ? ' — saisissez-en une ci-dessous, ou renseignez le site officiel pour lancer une recherche.' : '.'}
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
                    {' · '}
                    {SOURCE_LABEL[contact.source] ?? contact.source}
                    {' · '}
                    {formatDateTime(contact.collected_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage ? (
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
      ) : (
        contacts.length > 0 && <ManageOnlyNotice />
      )}

      {canManage && website && (
        <div className="space-y-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={scrapeContacts.isPending}
            onClick={() => scrapeContacts.mutate()}
          >
            {scrapeContacts.isPending ? 'Recherche en cours…' : 'Rechercher sur le site officiel'}
          </Button>
          {scrapeContacts.data && (
            <p className="text-subtle-foreground text-3xs">
              {scrapeContacts.data.found.length > 0
                ? `${scrapeContacts.data.found.length} coordonnée${scrapeContacts.data.found.length !== 1 ? 's' : ''} trouvée${scrapeContacts.data.found.length !== 1 ? 's' : ''}.`
                : (scrapeContacts.data.message ?? 'Aucune coordonnée trouvée sur cette page.')}
            </p>
          )}
          {scrapeContacts.isError && (
            <p className="text-error text-3xs">
              {scrapeContacts.error instanceof Error ? scrapeContacts.error.message : 'La recherche a échoué.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
