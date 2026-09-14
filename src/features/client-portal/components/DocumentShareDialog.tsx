import { Users } from 'lucide-react';
import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useCustomers } from '@/features/customers';
import type { OrganizationDocument } from '@/types/domain';

import { useSetDocumentCustomerShares, useShareDocument } from '../hooks/useClientPortal';

export interface DocumentShareDialogProps {
  document: OrganizationDocument | null;
  organizationId: string;
  /** Clients avec lesquels ce document est déjà partagé (ids). */
  sharedCustomerIds: readonly string[];
  onOpenChange: (open: boolean) => void;
}

/**
 * Qui voit ce document dans son espace client.
 *
 * Deux portées, clairement séparées : « tous les clients » (CGV, attestation,
 * plaquette) et une liste de clients choisis (plan d'un site, contrat). Les
 * deux sont rejugées en base — `guard_document_share_update` pour la
 * première, `enforce_document_share` pour la seconde — et journalisées.
 */
export function DocumentShareDialog({ document, organizationId, sharedCustomerIds, onOpenChange }: DocumentShareDialogProps) {
  // La clé remonte le formulaire d'un document à l'autre.
  if (document === null) return null;
  return (
    <ShareForm
      key={document.id}
      document={document}
      organizationId={organizationId}
      sharedCustomerIds={sharedCustomerIds}
      onOpenChange={onOpenChange}
    />
  );
}

function ShareForm({
  document,
  organizationId,
  sharedCustomerIds,
  onOpenChange,
}: DocumentShareDialogProps & { document: OrganizationDocument }) {
  const customers = useCustomers(organizationId);
  const setAll = useShareDocument();
  const setCustomers = useSetDocumentCustomerShares();
  const [everyone, setEveryone] = useState(document.shared_with_client);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(sharedCustomerIds));
  const [error, setError] = useState<unknown>(null);

  const initial = new Set(sharedCustomerIds);
  const add = Array.from(selected).filter((id) => !initial.has(id));
  const remove = Array.from(initial).filter((id) => !selected.has(id));
  const dirty = everyone !== document.shared_with_client || add.length > 0 || remove.length > 0;
  const pending = setAll.isPending || setCustomers.isPending;

  const save = async () => {
    setError(null);
    try {
      if (everyone !== document.shared_with_client) {
        await setAll.mutateAsync({ documentId: document.id, shared: everyone });
      }
      if (add.length > 0 || remove.length > 0) {
        await setCustomers.mutateAsync({ documentId: document.id, organizationId, add, remove });
      }
      onOpenChange(false);
    } catch (e) {
      setError(e);
    }
  };

  const list = (customers.data ?? []).filter((c) => c.status !== 'archived' || selected.has(c.id));

  return (
    <Modal open onOpenChange={onOpenChange} title="Qui voit ce document ?" description={document.name}>
      <div className="space-y-4">
        <FormError error={error} />

        <Switch
          className="border-border bg-surface-raised rounded-xl border p-3"
          checked={everyone}
          disabled={pending}
          onCheckedChange={setEveryone}
          label="Visible par tous les clients"
          description="Pour un document général : conditions, attestation d’assurance, plaquette. Chaque client ayant un accès au portail le verra."
        />

        <div className="space-y-2">
          <p className="text-foreground text-xs font-semibold">Ou seulement pour certains clients</p>
          {customers.isPending ? (
            <ListSkeleton rows={3} />
          ) : list.length === 0 ? (
            <p className="text-muted-foreground text-xs">Aucun client dans votre base pour le moment.</p>
          ) : (
            <ul className="border-border max-h-64 space-y-1 overflow-y-auto rounded-xl border p-2">
              {list.map((c) => (
                <li key={c.id}>
                  <Checkbox
                    checked={selected.has(c.id)}
                    disabled={pending || everyone}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked === true) next.add(c.id);
                      else next.delete(c.id);
                      setSelected(next);
                    }}
                    label={c.name}
                    description={c.reference}
                  />
                </li>
              ))}
            </ul>
          )}
          {everyone ? (
            <p className="text-muted-foreground text-xs">
              Le document étant visible par tous, la sélection par client ne change rien tant que ce réglage est actif.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!dirty || pending}
            onClick={() => {
              void save();
            }}
          >
            <Users className="size-4" />
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
