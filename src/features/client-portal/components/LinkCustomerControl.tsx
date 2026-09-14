import { Link2 } from 'lucide-react';
import { useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { CustomerPicker } from '@/features/customers';

import { useLinkDocumentCustomer } from '../hooks/useClientPortal';

export interface LinkCustomerControlProps {
  kind: 'invoice' | 'quote';
  documentId: string;
  organizationId: string;
}

/**
 * Rattache un document créé en texte libre à une fiche client. Le document
 * ne change pas ; seul le lien est posé — c'est ce qui le rend visible dans
 * l'espace client concerné.
 */
export function LinkCustomerControl({ kind, documentId, organizationId }: LinkCustomerControlProps) {
  const link = useLinkDocumentCustomer();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <CustomerPicker organizationId={organizationId} value={customerId} onChange={setCustomerId} label="Rattacher à une fiche client" />
        <FormError error={error} />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={customerId === null || link.isPending}
        onClick={() => {
          if (customerId === null) return;
          setError(null);
          link.mutate(
            { kind, documentId, customerId },
            {
              onError: (e) => {
                setError(e);
              },
            },
          );
        }}
      >
        <Link2 className="size-4" />
        {link.isPending ? 'Rattachement…' : 'Rattacher'}
      </Button>
    </div>
  );
}
