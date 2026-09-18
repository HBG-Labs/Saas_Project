import { Search } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import type { ReceivedInvoiceInternalStatus } from '@/types/database';

import type { ReceivedInvoiceFilters as Filters } from '../api/received-invoices.api';
import { RECEIVED_INVOICE_STATUS_LABELS } from '../lib/received-invoice-display';

const STATUSES: ReceivedInvoiceInternalStatus[] = ['new', 'viewed', 'archived', 'disputed'];

export interface ReceivedInvoiceFiltersBarProps {
  value: Filters;
  onChange: (value: Filters) => void;
}

export function ReceivedInvoiceFiltersBar({ value, onChange }: ReceivedInvoiceFiltersBarProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch, page: 0 });

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex-1 sm:min-w-[220px]">
        <Input
          label="Rechercher une facture reçue"
          hideLabel
          placeholder="Fournisseur, SIREN…"
          value={value.search ?? ''}
          onChange={(e) => set({ search: e.target.value })}
          leadingIcon={<Search aria-hidden="true" />}
        />
      </div>

      <SelectField
        value={value.internalStatus ?? 'all'}
        onChange={(e) =>
          set({
            internalStatus:
              e.target.value === 'all'
                ? undefined
                : (e.target.value as ReceivedInvoiceInternalStatus),
          })
        }
        aria-label="Filtrer par statut"
      >
        <option value="all">Tous statuts</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {RECEIVED_INVOICE_STATUS_LABELS[status]}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
