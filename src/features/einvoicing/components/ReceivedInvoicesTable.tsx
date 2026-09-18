import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from 'lucide-react';
import { Link } from 'react-router';

import { Card } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import type { ReceivedInvoice } from '@/types/domain';

import type { ReceivedInvoiceSortColumn } from '../api/received-invoices.api';
import { formatInvoiceDate } from '../canonical/date';
import { ReceivedInvoiceStatusBadge } from './ReceivedInvoiceStatusBadge';

export interface ReceivedInvoiceSort {
  column: ReceivedInvoiceSortColumn;
  direction: 'asc' | 'desc';
}

const COLUMN_LABELS: Record<ReceivedInvoiceSortColumn, string> = {
  supplier_name: 'Fournisseur',
  received_at: 'Reçue le',
  payment_due_date: 'Échéance',
  amount_with_vat: 'Montant TTC',
  internal_status: 'Statut',
};

/**
 * Bascule croissant/décroissant sur la colonne déjà triée ; sinon repart
 * décroissant (le sens le plus utile au premier clic, y compris pour le
 * fournisseur — mêmes règles que `ProspectsTable`).
 */
function nextDirection(
  column: ReceivedInvoiceSortColumn,
  current: ReceivedInvoiceSort | undefined,
): 'asc' | 'desc' {
  if (current?.column !== column) return 'desc';
  return current.direction === 'desc' ? 'asc' : 'desc';
}

function SortableHeader({
  column,
  sort,
  onSortChange,
  className,
}: {
  column: ReceivedInvoiceSortColumn;
  sort: ReceivedInvoiceSort | undefined;
  onSortChange: (sort: ReceivedInvoiceSort) => void;
  className?: string;
}) {
  const isActive = sort?.column === column;
  const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSortChange({ column, direction: nextDirection(column, sort) })}
        className={`hover:text-foreground inline-flex items-center gap-1 transition-colors ${
          isActive ? 'text-foreground' : ''
        }`}
        aria-label={`Trier par ${COLUMN_LABELS[column]}${isActive ? (sort.direction === 'asc' ? ', croissant' : ', décroissant') : ''}`}
      >
        {COLUMN_LABELS[column]}
        <Icon className={`size-3 shrink-0 ${isActive ? '' : 'opacity-40'}`} aria-hidden="true" />
      </button>
    </th>
  );
}

function amountLabel(invoice: ReceivedInvoice): string {
  return invoice.amount_with_vat !== null
    ? `${invoice.amount_with_vat.toFixed(2)} ${invoice.currency_code ?? 'EUR'}`
    : '—';
}

/**
 * Cartes sur mobile, table sur desktop — même patron que `ProspectsTable`. Le
 * tri se fait CÔTÉ BASE : `sort`/`onSortChange` remontent à `ReceivedInvoicesPage`,
 * qui relance `listReceivedInvoices` avec la colonne demandée.
 */
export function ReceivedInvoicesTable({
  rows,
  sort,
  onSortChange,
}: {
  rows: ReceivedInvoice[];
  sort?: ReceivedInvoiceSort | undefined;
  onSortChange: (sort: ReceivedInvoiceSort) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card className="border-border/80 bg-surface p-12 text-center shadow-xs">
        <div className="bg-surface-sunken mx-auto flex size-11 items-center justify-center rounded-2xl">
          <Inbox className="text-muted-foreground size-5" aria-hidden="true" />
        </div>
        <p className="text-foreground mt-3 text-sm font-semibold">Aucune facture reçue</p>
        <p className="text-subtle-foreground mx-auto mt-1 max-w-sm text-xs">
          Modifiez vos filtres, ou attendez le prochain relevé auprès de SUPER PDP.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 bg-surface overflow-x-auto shadow-xs">
      {/* Cartes mobile */}
      <div className="divide-border divide-y md:hidden">
        {rows.map((invoice) => (
          <Link
            key={invoice.id}
            to={ROUTES.receivedInvoiceDetail(invoice.id)}
            className="hover:bg-surface-hover/50 block space-y-2.5 p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-foreground truncate text-sm font-bold">
                  {invoice.supplier_name ?? 'Fournisseur inconnu'}
                </h3>
                <p className="text-muted-foreground text-3xs mt-0.5">
                  {invoice.supplier_siren ?? '—'}
                </p>
              </div>
              <p className="text-foreground shrink-0 text-sm font-bold tabular-nums">
                {amountLabel(invoice)}
              </p>
            </div>
            <p className="text-subtle-foreground text-3xs">
              Reçue le {formatInvoiceDate(invoice.received_at)}
              {invoice.payment_due_date
                ? ` · Échéance ${formatInvoiceDate(invoice.payment_due_date)}`
                : ''}
            </p>
            <ReceivedInvoiceStatusBadge status={invoice.internal_status} />
          </Link>
        ))}
      </div>

      {/* Table desktop */}
      <table className="hidden w-full min-w-[760px] border-collapse text-left text-xs md:table">
        <thead>
          <tr className="border-border bg-surface-raised/50 text-muted-foreground text-3xs border-b font-bold tracking-wider uppercase">
            <SortableHeader
              column="supplier_name"
              className="px-3 py-2.5 sm:px-4"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortableHeader column="received_at" className="px-3 py-2.5" sort={sort} onSortChange={onSortChange} />
            <SortableHeader
              column="payment_due_date"
              className="px-3 py-2.5"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortableHeader
              column="amount_with_vat"
              className="px-3 py-2.5"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortableHeader
              column="internal_status"
              className="px-3 py-2.5 sm:px-4"
              sort={sort}
              onSortChange={onSortChange}
            />
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-surface-hover/50 group transition-colors">
              <td className="px-3 py-3 sm:px-4">
                <Link to={ROUTES.receivedInvoiceDetail(invoice.id)} className="hover:underline">
                  <p className="text-foreground text-xs leading-snug font-semibold">
                    {invoice.supplier_name ?? 'Fournisseur inconnu'}
                  </p>
                  <p className="text-3xs text-subtle-foreground mt-0.5 font-mono">
                    {invoice.supplier_siren ?? '—'}
                  </p>
                </Link>
              </td>
              <td className="text-3xs text-subtle-foreground px-3 py-3">
                {formatInvoiceDate(invoice.received_at)}
              </td>
              <td className="text-3xs text-subtle-foreground px-3 py-3">
                {invoice.payment_due_date ? formatInvoiceDate(invoice.payment_due_date) : '—'}
              </td>
              <td className="text-foreground px-3 py-3 font-semibold tabular-nums">
                {amountLabel(invoice)}
              </td>
              <td className="px-3 py-3 sm:px-4">
                <ReceivedInvoiceStatusBadge status={invoice.internal_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
