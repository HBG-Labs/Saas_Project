import { Receipt } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
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
  const montantDu = list
    .filter((i) => invoiceIsDue(i.status))
    .reduce((sum, i) => sum + i.total_cents, 0);

  return (
    <div>
      <PortalPageHeader
        title="Mes factures"
        description="Consultez vos factures, avoirs et échéances transmis par votre prestataire."
        icon={Receipt}
        tone={montantDu > 0 ? 'warning' : 'success'}
        summary={
          invoices.isSuccess ? (
            <div
              className={`rounded-xl border px-3 py-2 sm:text-right ${
                montantDu > 0
                  ? 'border-warning-border bg-warning-subtle'
                  : 'border-success-border bg-success-subtle'
              }`}
            >
              <p className="text-muted-foreground text-3xs font-semibold tracking-wide uppercase">
                {montantDu > 0 ? 'Reste à régler' : 'Situation'}
              </p>
              <p
                className={`mt-0.5 text-base font-bold tabular-nums ${
                  montantDu > 0 ? 'text-warning' : 'text-success'
                }`}
              >
                {montantDu > 0 ? formatEuros(montantDu) : 'À jour'}
              </p>
            </div>
          ) : null
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
        <EmptyState
          icon={Receipt}
          title="Aucune facture"
          description="Vos factures apparaîtront ici dès leur émission."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((i) => (
            <li
              key={i.id}
              className="border-border/80 bg-surface hover:border-primary/30 hover:shadow-raised rounded-2xl border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    invoiceIsDue(i.status)
                      ? 'bg-warning-subtle text-warning'
                      : 'bg-success-subtle text-success'
                  }`}
                >
                  <Receipt className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-foreground text-sm font-semibold">
                      {i.document_type === 'credit_note' ? 'Avoir' : 'Facture'} {i.reference}
                    </p>
                    <StatusBadge status={i.status} kind="invoice" />
                  </div>
                  {i.title ? <p className="text-foreground/80 mt-1 text-sm">{i.title}</p> : null}
                  <p className="text-muted-foreground text-xs">
                    Émise le {formatDateFr(i.issued_at)}
                    {i.due_date && invoiceIsDue(i.status)
                      ? ` · échéance ${formatDateFr(i.due_date)}`
                      : ''}
                  </p>
                </div>
                <p className="text-foreground basis-full pl-[3.25rem] text-lg font-bold tabular-nums sm:basis-auto sm:pl-0">
                  {formatEuros(i.total_cents)}
                </p>
              </div>
              {i.pdf_path ? (
                <div className="border-border mt-3 flex border-t pt-3 sm:justify-end">
                  <FileOpenButton
                    bucket="invoice-electronic-documents"
                    path={i.pdf_path}
                    label="Ouvrir le PDF"
                    className="w-full sm:w-auto"
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
