import {
  AlertTriangle,
  Check,
  Clock,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useAiDocuments,
  useDeleteAiDocument,
  useReindexAiDocument,
  useUploadAiDocument,
} from '@/features/ai';
import { useCurrentOrganization } from '@/features/organizations';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { AiDocumentStatus } from '@/types/database';
import type { AiDocument } from '@/types/domain';

/**
 * Bibliothèque documentaire de l'Assistant IA — dépôt et suivi des PDF que
 * `index-ai-document` transforme en fragments recherchables (RAG).
 *
 * Réservée à `ai.manage_documents` (owner/admin/manager) au niveau de la
 * route : c'est un outil d'entreprise, pas un écran de consultation
 * quotidienne pour un technicien.
 */

const STATUS_CONFIG: Record<
  AiDocumentStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']>; icon: typeof Clock }
> = {
  pending: { label: 'En attente', variant: 'neutral', icon: Clock },
  processing: { label: 'Indexation…', variant: 'info', icon: Loader2 },
  ready: { label: 'Prêt', variant: 'success', icon: Check },
  error: { label: 'Erreur', variant: 'error', icon: AlertTriangle },
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default function AiDocumentsPage() {
  useDocumentTitle('Documents de l’Assistant IA');

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const documentsQuery = useAiDocuments(organizationId);
  const documents = documentsQuery.data ?? [];

  const uploadDocument = useUploadAiDocument(organizationId ?? '');
  const reindexDocument = useReindexAiDocument(organizationId ?? '');
  const deleteDocument = useDeleteAiDocument(organizationId ?? '');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentToDelete, setDocumentToDelete] = useState<AiDocument | null>(null);

  const resetUploadForm = () => {
    setTitle('');
    setCategory('');
    setFile(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (selected: File | null) => {
    setValidationError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.type !== 'application/pdf') {
      setValidationError('Seuls les fichiers PDF sont acceptés.');
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setValidationError('Le fichier dépasse la taille maximale de 25 Mo.');
      setFile(null);
      return;
    }
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.pdf$/i, ''));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    try {
      await uploadDocument.mutateAsync({
        title: title.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
        file,
      });
      setIsUploadOpen(false);
      resetUploadForm();
    } catch {
      // L'erreur reste affichée par `FormError` ci-dessous ; rien à faire ici.
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <PageHeader
        title="Documents de l’Assistant IA"
        description="Les PDF déposés ici (notices, procédures, normes) sont indexés et consultés par l’assistant pour répondre à partir de votre propre documentation, avec citation de la source."
        actions={
          <Button
            variant="primary"
            className="gap-2"
            onClick={() => setIsUploadOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            Ajouter un document
          </Button>
        }
      />

      {documentsQuery.isError ? (
        <ErrorState error={documentsQuery.error} onRetry={() => void documentsQuery.refetch()} />
      ) : documentsQuery.isPending ? (
        <div className="space-y-2.5" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun document indexé"
          description="Déposez un premier PDF — guide technique, procédure, norme — pour que l’assistant puisse s’appuyer dessus et citer sa source dans ses réponses."
          action={
            <Button variant="primary" className="gap-2" onClick={() => setIsUploadOpen(true)}>
              <Upload className="size-4" aria-hidden="true" />
              Déposer un document
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {documents.map((document) => {
            const status = STATUS_CONFIG[document.status];
            const StatusIcon = status.icon;

            return (
              <li
                key={document.id}
                className="border-border bg-surface flex items-start gap-3 rounded-xl border p-4"
              >
                <div className="bg-primary-subtle text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <FileText className="size-4.5" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground truncate text-sm font-bold">
                      {document.title}
                    </span>
                    <Badge variant={status.variant} className="gap-1">
                      <StatusIcon
                        className={`size-3 ${document.status === 'processing' ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      {status.label}
                    </Badge>
                    {document.category && <Badge variant="neutral">{document.category}</Badge>}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {document.filename} · Déposé le {formatDate(document.created_at)}
                  </p>
                  {document.status === 'error' && document.error_message && (
                    <p className="text-error text-xs">{document.error_message}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {document.status === 'error' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      disabled={reindexDocument.isPending}
                      onClick={() => reindexDocument.mutate(document.id)}
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Réessayer
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error hover:bg-error-subtle"
                    onClick={() => setDocumentToDelete(document)}
                    aria-label={`Supprimer ${document.title}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Dépôt d'un document */}
      <Modal
        open={isUploadOpen}
        onOpenChange={(open) => {
          setIsUploadOpen(open);
          if (!open) resetUploadForm();
        }}
        title="Ajouter un document"
        description="PDF uniquement, 25 Mo maximum. L’indexation démarre automatiquement après le dépôt."
      >
        <form onSubmit={handleUpload} className="space-y-4 pt-2">
          <FormError error={uploadDocument.error} />
          {validationError && (
            <p className="text-error text-xs" role="alert">
              {validationError}
            </p>
          )}

          <div>
            <label htmlFor="ai-document-file" className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Fichier PDF *
            </label>
            <input
              ref={fileInputRef}
              id="ai-document-file"
              type="file"
              accept="application/pdf"
              required
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
            />
          </div>

          <Input
            label="Titre du document *"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex : Guide OTDR — Procédure de mesure"
          />

          <Input
            label="Catégorie"
            hint="Optionnel — aide à retrouver le document (ex : fibre, électricité, sécurité)."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ex : fibre"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUploadOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!file || !title.trim() || uploadDocument.isPending}
              className="gap-2"
            >
              {uploadDocument.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              {uploadDocument.isPending ? 'Envoi…' : 'Déposer et indexer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation de suppression */}
      <Modal
        open={documentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDocumentToDelete(null);
        }}
        title="Supprimer ce document ?"
        {...(documentToDelete
          ? {
              description: `« ${documentToDelete.title} » et ses fragments indexés seront définitivement retirés. L’assistant ne pourra plus s’appuyer dessus.`,
            }
          : {})}
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setDocumentToDelete(null)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={deleteDocument.isPending}
            onClick={async () => {
              if (!documentToDelete) return;
              await deleteDocument.mutateAsync(documentToDelete);
              setDocumentToDelete(null);
            }}
            className="gap-2"
          >
            {deleteDocument.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            Supprimer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
