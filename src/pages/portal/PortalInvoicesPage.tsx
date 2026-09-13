import { Receipt } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { ListSkeleton } from '@/components/ui/Skeleton';
import {
  FileOpenButton,
  formatDateFr,
  formatEuros,
  invoiceIsDue,
  PortalPageHeader,
  StatusBadge,
  usePortalInvoices,
} from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function PortalInvoicesPage() {
  useDocumentTitle('Mes factures — Espace client');
  const invoices = usePortalInvoices();
  const list = invoices.data ?? [];
  const montantDu = list.filter((i) => invoiceIsDue(i.status)).reduce((sum, i) => sum + i.total_cents, 0);

  return (
    <div>
      <PortalPageHeader
        title="Mes factures"
        description={
          invoices.isSuccess && montantDu > 0 ? `Montant restant dû : ${formatEuros(montantDu)}` : 'Vos factures et avoirs.'
        }
      />

      {invoices.isPending ? (
        <ListSkeleton />
      ) : invoices.isError ? (
        <ErrorState
          error={invoices.error}
          onRetry={() => {
            void invoices.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucune facture" description="Vos factures apparaîtront ici dès leur émission." />
      ) : (
        <ul className="space-y-2">
          {list.map((i) => (
            <li key={i.id} className="border-border bg-surface rounded-xl border p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-foreground text-sm font-semibold">
                      {i.document_type === 'credit_note' ? 'Avoir' : 'Facture'} {i.reference}
                    </p>
                    {i.title ? <Badge variant="outline">{i.title}</Badge> : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Émise le {formatDateFr(i.issued_at)}
                    {i.due_date && invoiceIsDue(i.status) ? ` · échéance ${formatDateFr(i.due_date)}` : ''}
                  </p>
                  <StatusBadge status={i.status} kind="invoice" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-foreground text-lg font-bold">{formatEuros(i.total_cents)}</p>
                  {i.pdf_path ? (
                    <FileOpenButton bucket="invoice-electronic-documents" path={i.pdf_path} label="PDF" />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
