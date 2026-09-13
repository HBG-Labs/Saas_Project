import { FileText, FolderOpen } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { FileOpenButton, formatDateFr, PortalPageHeader, usePortalDocuments } from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

function taille(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function PortalDocumentsPage() {
  useDocumentTitle('Mes documents — Espace client');
  const documents = usePortalDocuments();

  return (
    <div>
      <PortalPageHeader title="Mes documents" description="Les documents que votre prestataire partage avec vous." />

      {documents.isPending ? (
        <ListSkeleton />
      ) : documents.isError ? (
        <ErrorState
          error={documents.error}
          onRetry={() => {
            void documents.refetch();
          }}
        />
      ) : (documents.data ?? []).length === 0 ? (
        <EmptyState icon={FolderOpen} title="Aucun document" description="Les documents partagés avec vous apparaîtront ici." />
      ) : (
        <ul className="space-y-2">
          {(documents.data ?? []).map((d) => (
            <li
              key={d.id}
              className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 shadow-xs"
            >
              <span className="bg-accent-subtle text-accent inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{d.name}</p>
                <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
                  {formatDateFr(d.created_at)}
                  {d.file_size !== null ? ` · ${taille(d.file_size)}` : ''}
                  {d.category ? <Badge variant="outline">{d.category}</Badge> : null}
                </p>
              </div>
              <FileOpenButton bucket="organization-documents" path={d.storage_path} label="Ouvrir" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
