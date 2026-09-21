import { FileText, FolderOpen } from 'lucide-react';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { ListSkeleton } from '@/components/ui/Skeleton';
import {
  FileOpenButton,
  formatDateFr,
  PortalPageHeader,
  usePortalDocuments,
} from '@/features/portal';
import { useDocumentTitle } from '@/lib/use-document-title';

function taille(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function PortalDocumentsPage() {
  useDocumentTitle('Mes documents — Espace client');
  const documents = usePortalDocuments();
  const list = documents.data ?? [];

  return (
    <div>
      <PortalPageHeader
        title="Mes documents"
        description="Retrouvez les fichiers transmis par votre prestataire, disponibles au même endroit."
        icon={FolderOpen}
        tone="accent"
        summary={
          documents.isSuccess ? (
            <Badge variant="accent" size="button">
              {list.length} document{list.length > 1 ? 's' : ''}
            </Badge>
          ) : null
        }
      />

      {documents.isPending ? (
        <ListSkeleton />
      ) : documents.isError ? (
        <ErrorState
          error={documents.error}
          onRetry={() => {
            void documents.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          illustration={<AtelierIllustration subject="library" />}
          title="Aucun document"
          description="Les documents partagés avec vous apparaîtront ici."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((d) => (
            <li
              key={d.id}
              className="border-border/80 bg-surface hover:border-accent/30 hover:shadow-raised flex flex-col gap-3 rounded-2xl border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="bg-accent-subtle text-accent inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <FileText className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-foreground line-clamp-2 text-sm font-semibold">{d.name}</p>
                  <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span>{formatDateFr(d.created_at)}</span>
                    {d.file_size !== null ? <span>· {taille(d.file_size)}</span> : null}
                    {d.category ? <Badge variant="outline">{d.category}</Badge> : null}
                  </div>
                </div>
              </div>
              <FileOpenButton
                bucket="organization-documents"
                path={d.storage_path}
                label="Ouvrir"
                className="w-full sm:w-auto"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
